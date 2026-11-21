"""Readiness, provenance, release gates and tenant entitlement for industry packs (F2).

- Readiness: every pack reports READY, PARTIAL (names what is missing) or BLOCKED. A pack never fills a gap.
- Provenance: every figure a pack states names where it came from. Figures are decimal strings.
- Release gates: a pack is installable only when the manifest is valid, every agent is in the catalog,
  its entitlement product exists, and every evaluation dataset is present. Gates fail closed.
- Entitlement: a tenant may use a pack only when its entitlement product is on the tenant's list.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from enum import StrEnum
from typing import Literal

from uaap.errors import UaapError
from uaap.packs.manifest import PackManifest, manifest_problems


class Readiness(StrEnum):
    READY = "READY"
    PARTIAL = "PARTIAL"
    BLOCKED = "BLOCKED"


SourceKind = Literal["erp", "document", "configuration", "external", "calculation"]


@dataclass(frozen=True)
class DataRequirement:
    name: str
    source: SourceKind
    available: bool
    required: bool = True
    permitted: bool = True  # False when the caller may not read the source.


@dataclass(frozen=True)
class ReadinessReport:
    status: Readiness
    missing: tuple[str, ...]


def assess(requirements: list[DataRequirement]) -> ReadinessReport:
    """BLOCKED if a required ERP source is unavailable or unreadable by the caller; PARTIAL if any other
    required input is missing; READY only when every required input is present and permitted."""
    missing: list[str] = []
    blocked = False
    for req in requirements:
        if not req.required:
            continue
        if not req.available or not req.permitted:
            missing.append(req.name)
            if req.source == "erp" and (not req.available or not req.permitted):
                blocked = True
    if blocked:
        return ReadinessReport(Readiness.BLOCKED, tuple(missing))
    if missing:
        return ReadinessReport(Readiness.PARTIAL, tuple(missing))
    return ReadinessReport(Readiness.READY, ())


@dataclass(frozen=True)
class Figure:
    """A stated number and where it came from. Nothing is shown without a source."""

    value: str
    source: SourceKind
    source_id: str

    def __post_init__(self) -> None:
        if not self.source_id.strip():
            raise UaapError("VALIDATION", "Every figure needs a source id")
        try:
            Decimal(self.value)
        except InvalidOperation as exc:
            raise UaapError("VALIDATION", "Figures must be decimal strings") from exc


def release_problems(
    manifest: PackManifest,
    *,
    catalog_agents: frozenset[str],
    catalog_products: frozenset[str],
    evaluation_datasets: frozenset[str],
) -> list[str]:
    problems: list[str] = []
    for agent in manifest.agents:
        if agent not in catalog_agents:
            problems.append(f"agent {agent} is not registered in the catalog")
    if manifest.entitlement not in catalog_products:
        problems.append(f"entitlement {manifest.entitlement} is not a catalog product")
    for dataset in manifest.evaluations:
        if dataset not in evaluation_datasets:
            problems.append(f"evaluation dataset {dataset} is missing")
    return problems


class PackRegistry:
    """Installed packs by (id, version). Duplicate versions are refused; nothing is replaced silently."""

    def __init__(self) -> None:
        self._packs: dict[tuple[str, str], PackManifest] = {}
        self._entitled: dict[str, set[str]] = {}
        self._lock = threading.Lock()

    def install(
        self,
        raw: dict[str, object],
        *,
        catalog_agents: frozenset[str],
        catalog_products: frozenset[str],
        evaluation_datasets: frozenset[str],
    ) -> PackManifest:
        problems = manifest_problems(raw)
        if problems:
            raise UaapError("VALIDATION", "Pack manifest is invalid", {"problems": problems})
        manifest = PackManifest.model_validate(raw)
        problems = release_problems(
            manifest,
            catalog_agents=catalog_agents,
            catalog_products=catalog_products,
            evaluation_datasets=evaluation_datasets,
        )
        if problems:
            raise UaapError("VALIDATION", "Pack failed its release gates", {"problems": problems})
        with self._lock:
            key = (manifest.id, manifest.version)
            if key in self._packs:
                raise UaapError("CONFLICT", f"Pack {manifest.id} {manifest.version} is already installed")
            self._packs[key] = manifest
        return manifest

    def entitle(self, tenant_id: str, product: str) -> None:
        with self._lock:
            self._entitled.setdefault(tenant_id, set()).add(product)

    def may_use(self, tenant_id: str, pack_id: str) -> bool:
        """A tenant may use an installed pack only when its entitlement product is on the tenant's list."""
        with self._lock:
            installed = [m for (pid, _), m in self._packs.items() if pid == pack_id]
            granted = self._entitled.get(tenant_id, set())
        return any(m.entitlement in granted for m in installed)

    def get(self, pack_id: str, version: str) -> PackManifest | None:
        with self._lock:
            return self._packs.get((pack_id, version))
