"""Agent service principals (ADR-006): each agent has explicit grants and a tool allow-list."""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass

from uaap.errors import UaapError

_AGENT_ID = re.compile(r"^[a-z][a-z0-9_-]{2,63}$")


@dataclass(frozen=True)
class AgentPrincipal:
    agent_id: str
    display_name: str
    grants: frozenset[str]
    tools: frozenset[str]
    enabled: bool = True

    @property
    def principal(self) -> str:
        return f"agent:{self.agent_id}"


class AgentRegistry:
    def __init__(self) -> None:
        self._agents: dict[str, AgentPrincipal] = {}
        self._lock = threading.Lock()

    def register(self, agent: AgentPrincipal) -> None:
        if not _AGENT_ID.match(agent.agent_id):
            raise UaapError("VALIDATION", f"Invalid agent id '{agent.agent_id}'")
        if "*" in agent.grants:
            # Agents are least-privilege by construction; a full wildcard is never granted.
            raise UaapError("VALIDATION", "Agents cannot be granted '*'", {"agent_id": agent.agent_id})
        with self._lock:
            if agent.agent_id in self._agents:
                raise UaapError("VALIDATION", f"Agent '{agent.agent_id}' is already registered")
            self._agents[agent.agent_id] = agent

    def get(self, agent_id: str) -> AgentPrincipal | None:
        with self._lock:
            return self._agents.get(agent_id)

    def disable(self, agent_id: str) -> None:
        """Kill switch: a disabled agent cannot call any tool."""
        with self._lock:
            agent = self._agents.get(agent_id)
            if agent is None:
                raise UaapError("NOT_FOUND", f"Agent '{agent_id}' is not registered")
            self._agents[agent_id] = AgentPrincipal(
                agent_id=agent.agent_id,
                display_name=agent.display_name,
                grants=agent.grants,
                tools=agent.tools,
                enabled=False,
            )
