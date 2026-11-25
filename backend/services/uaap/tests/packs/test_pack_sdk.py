"""Industry pack SDK: manifest validation, release gates, readiness, provenance and entitlement."""

from __future__ import annotations

from typing import Any

import pytest

from uaap.errors import UaapError
from uaap.packs.core import DataRequirement, Figure, PackRegistry, Readiness, assess
from uaap.packs.manifest import PackManifest, manifest_problems

AGENTS = frozenset({"gar-08-costing", "gar-02-tech-pack"})
PRODUCTS = frozenset({"GAR-08"})
DATASETS = frozenset({"costing-accuracy", "tech-pack-accuracy"})


def _raw(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": "garments",
        "version": "1.0.0",
        "name": "Garments Intelligence",
        "agents": ["gar-08-costing", "gar-02-tech-pack"],
        "entitlement": "GAR-08",
        "evaluations": ["costing-accuracy", "tech-pack-accuracy"],
        "dependencies": {"required": ["document-management"], "optional": ["inventory"]},
    }
    base.update(overrides)
    return base


def _install(registry: PackRegistry, raw: dict[str, Any]) -> PackManifest:
    return registry.install(raw, catalog_agents=AGENTS, catalog_products=PRODUCTS, evaluation_datasets=DATASETS)


def test_valid_manifest_has_no_problems() -> None:
    assert manifest_problems(_raw()) == []


@pytest.mark.parametrize(
    "change",
    [
        {"version": "1.0"},  # not semver
        {"id": "Garments"},  # not a slug
        {"agents": []},  # a pack needs agents
        {"agents": ["gar-08-costing", "gar-08-costing"]},  # duplicates
        {"entitlement": "garment-pack"},  # not a catalog-style id
        {"evaluations": []},  # every pack needs evaluation datasets
        {"unknown_key": True},  # typos must not silently drop a control
    ],
)
def test_malformed_manifests_are_refused(change: dict[str, Any]) -> None:
    assert manifest_problems(_raw(**change)) != []


def test_release_gates_block_unregistered_agents_and_missing_datasets() -> None:
    registry = PackRegistry()
    with pytest.raises(UaapError) as exc:
        registry.install(
            _raw(agents=["gar-99-unknown"]),
            catalog_agents=AGENTS,
            catalog_products=PRODUCTS,
            evaluation_datasets=DATASETS,
        )
    assert exc.value.code == "VALIDATION"
    assert any("not registered in the catalog" in p for p in exc.value.details["problems"])

    with pytest.raises(UaapError) as exc:
        registry.install(
            _raw(evaluations=["no-such-dataset"]),
            catalog_agents=AGENTS,
            catalog_products=PRODUCTS,
            evaluation_datasets=DATASETS,
        )
    assert any("missing" in p for p in exc.value.details["problems"])


def test_install_refuses_a_duplicate_version() -> None:
    registry = PackRegistry()
    _install(registry, _raw())
    with pytest.raises(UaapError) as exc:
        _install(registry, _raw())
    assert exc.value.code == "CONFLICT"


def test_pack_is_usable_only_by_entitled_tenants() -> None:
    registry = PackRegistry()
    _install(registry, _raw())
    assert registry.may_use("tenant-a", "garments") is False
    registry.entitle("tenant-a", "GAR-08")
    assert registry.may_use("tenant-a", "garments") is True
    assert registry.may_use("tenant-b", "garments") is False


def test_readiness_is_ready_only_when_every_input_is_present() -> None:
    report = assess([DataRequirement("rates", "configuration", available=True)])
    assert report.status == Readiness.READY and report.missing == ()


def test_readiness_is_partial_and_names_the_missing_inputs() -> None:
    report = assess(
        [
            DataRequirement("rates", "configuration", available=True),
            DataRequirement("labour SAM", "configuration", available=False),
            DataRequirement("overhead", "configuration", available=False),
        ]
    )
    assert report.status == Readiness.PARTIAL
    assert report.missing == ("labour SAM", "overhead")


def test_unavailable_erp_source_is_blocked_not_partial() -> None:
    report = assess([DataRequirement("ledger", "erp", available=False)])
    assert report.status == Readiness.BLOCKED


def test_erp_source_the_caller_may_not_read_is_blocked() -> None:
    report = assess([DataRequirement("inventory", "erp", available=True, permitted=False)])
    assert report.status == Readiness.BLOCKED


def test_optional_inputs_do_not_reduce_readiness() -> None:
    report = assess([DataRequirement("notes", "document", available=False, required=False)])
    assert report.status == Readiness.READY


def test_figures_need_a_source_and_a_decimal_value() -> None:
    assert Figure("1250.00", "calculation", "calc-7").value == "1250.00"
    with pytest.raises(UaapError):
        Figure("1250.00", "erp", "   ")
    with pytest.raises(UaapError):
        Figure("twelve", "erp", "je-1")


def test_manifest_model_is_immutable() -> None:
    manifest = PackManifest.model_validate(_raw())
    with pytest.raises(Exception):
        manifest.version = "2.0.0"  # type: ignore[misc]
