"""Industry pack manifest (F2). Validated before anything else, and it must be complete to be installed."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

_SLUG = r"^[a-z][a-z0-9-]{1,39}$"
_SEMVER = r"^\d+\.\d+\.\d+$"
_PRODUCT = r"^[A-Z]{2,4}-\d{2}$"  # Catalog-style id such as GAR-08. Checked against the catalog at release.


class PackDependencies(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    required: tuple[str, ...] = ()
    optional: tuple[str, ...] = ()


class PackManifest(BaseModel):
    """What a pack declares. Extra keys are rejected so a typo cannot silently drop a control."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: Annotated[str, Field(pattern=_SLUG)]
    version: Annotated[str, Field(pattern=_SEMVER)]
    name: Annotated[str, Field(min_length=3, max_length=120)]
    agents: tuple[str, ...] = Field(min_length=1)
    schemas: tuple[str, ...] = ()
    workflows: tuple[str, ...] = ()
    policies: tuple[str, ...] = ()
    entitlement: Annotated[str, Field(pattern=_PRODUCT)]
    evaluations: tuple[str, ...] = Field(min_length=1)
    dependencies: PackDependencies = PackDependencies()

    @field_validator("agents", "evaluations")
    @classmethod
    def _unique(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(set(value)) != len(value):
            raise ValueError("entries must be unique")
        return value


def manifest_problems(raw: dict[str, object]) -> list[str]:
    """Human-readable validation problems; an empty list means the manifest is well formed."""
    try:
        PackManifest.model_validate(raw)
    except ValidationError as exc:
        return [f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in exc.errors()]
    return []
