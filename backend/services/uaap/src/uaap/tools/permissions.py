"""Permission matching, identical to `hasPermission` in packages/identity/src/permissions.ts.

A grant can be "*" (everything), "fin.*" (everything under "fin.") or an exact permission.
"""

from __future__ import annotations

from collections.abc import Iterable


def has_permission(granted: Iterable[str], required: str) -> bool:
    for grant in granted:
        if grant == "*" or grant == required:
            return True
        if grant.endswith(".*") and required.startswith(grant[:-1]):
            return True
    return False


def effective_allows(agent_grants: Iterable[str], user_permissions: Iterable[str], required: str) -> bool:
    """ADR-006: an agent may act only where both the agent and the invoking user are allowed.

    A user holding "*" does not give an agent "*": the agent's own grants still have to match.
    """
    return has_permission(agent_grants, required) and has_permission(user_permissions, required)
