# QAVRIL LABS — Universal AI Agent Platform (UAAP)
## Milestone A3 Implementation Plan: Stateful Agent Runtime & Memory

**Document ID:** UAAP-A3-IMPLEMENTATION-PLAN  
**Author:** Principal Software Architect, Enterprise ERP Architect & AI Systems Engineer  
**Date:** November 6, 2026  
**Status:** **PLANNING ONLY — Awaiting User Authorization Before Execution**  
**Milestone:** Wave A · Milestone A3 · Stateful Agent Runtime & Memory Abstraction  

---

## 1. Executive Summary & Governance Boundaries

Milestone A3 introduces the Stateful Agent Runtime and Memory Layer to the Universal AI Agent Platform (UAAP), building directly upon the central AI Model Gateway scaffolded in Milestone A2.

### Strict Governance & Architectural Boundaries:
- **Planning Only:** This document defines the architecture, data models, protocols, and test matrix. No code has been written and no infrastructure has been modified.
- **No Database Provisioning:** In compliance with [`UAAP_DATABASE_OWNERSHIP_SPEC.md`](file:///e:/SaaS/docs/ai-agent-readiness/UAAP_DATABASE_OWNERSHIP_SPEC.md), PostgreSQL remains an unprovisioned architectural decision. Persistent database tables, migrations, and `pgvector` extensions remain strictly blocked until database availability, credentials, permissions, backups, and RLS requirements are independently verified and authorized.
- **In-Memory First:** Checkpointing, session state, working memory, and long-term memory will operate via thread-safe, tenant-isolated in-memory test backends during Milestone A3.
- **No Tool Registry (A4 Scope):** Milestone A3 will define the execution graph and interrupt hooks, but will not implement the Typed Tool Registry or tool execution engines (scheduled for Milestone A4).
- **No Financial / ERP Writes:** Human approval interrupt hooks will be tested with mock payloads. No live financial writes, ledger dispatches, or ERP mutations will be triggered.
- **Core SaaS & Construction ERP Isolation:** Core SaaS packages and Construction ERP SQLite database (`_sqlite_work`) remain strictly isolated.

---

## 2. Architecture & Execution Topology

```
+-----------------------------------------------------------------------------------+
|                                 UAAP Agent Runtime                                |
|                                                                                   |
|  [Agent Workflow Request] ---> [Tenant Context & Budget Check] ---> [StateGraph]  |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                              LangGraph State Machine                              |
|                                                                                   |
|    +-------------------+       +--------------------+       +------------------+  |
|    |     PENDING       | ----> |      RUNNING       | ----> |  CHECK PERMISSION|  |
|    +-------------------+       +--------------------+       +--------+---------+  |
|                                                                      |            |
|              +-------------------------------------------------------+            |
|              | Tier 3 Action Required                                             |
|              v                                                                    |
|    +-------------------+       Dual-Control Approved        +------------------+  |
|    | AWAITING_APPROVAL | ---------------------------------> |  EXECUTE / RESUME|  |
|    +---------+---------+                                    +--------+---------+  |
|              | Rejected / Expired                                    |            |
|              v                                                       v            |
|    +-------------------+                                    +------------------+  |
|    |    REJECTED       |                                    |    COMPLETED     |  |
|    +-------------------+                                    +------------------+  |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                           Persistence & Memory Subsystems                         |
|                                                                                   |
|  1. LangGraph Saver Interface: In-Memory Tenant-Partitioned State Checkpointer    |
|  2. Working Memory: Session-Scoped Context Window & Run Isolation Boundaries      |
|  3. Long-Term Memory Protocol: Tenant-Filtered Retrieval (Synthetic Test Mock)   |
|  4. Audit Sink: Append-Only Event Stream for State Transitions & HITL Decisions   |
+-----------------------------------------------------------------------------------+
```

---

## 3. Core Component Specifications

### Component 1: LangGraph Stateful Runtime Architecture
1. **Agent Lifecycle States (Consistent Terminal Model):**
   - `PENDING`: Request received and validated; execution graph initialized.
   - `RUNNING`: Agent actively executing reasoning steps against Model Gateway.
   - `AWAITING_APPROVAL`: Graph execution suspended at human-in-the-loop Tier-3 interrupt hook.
   - `COMPLETED`: Run successfully finished; terminal state reached.
   - `FAILED`: Execution terminated due to unrecoverable upstream error or schema failure (terminal state).
   - `REJECTED`: Action rejected by human approver or approval token expired (terminal state).
   - `CANCELLED`: Explicitly aborted by authorized tenant actor or run timeout (terminal state).

2. **Typed Agent State (`AgentState`):**
   ```python
   @dataclass(frozen=True)
   class AgentState:
       run_id: str
       tenant_id: str
       actor_id: str
       step_count: int
       max_steps: int
       status: AgentStatus  # PENDING | RUNNING | AWAITING_APPROVAL | COMPLETED | FAILED | REJECTED | CANCELLED
       messages: tuple[Message, ...]
       working_context: dict[str, Any]
       pending_approval: ApprovalRequest | None = None
       error: str | None = None
   ```

3. **Execution Guards:**
   - Maximum recursion / step limit (default: 25 steps) to prevent execution loops.
   - Context window compaction and token budget tracking (integrated with A2 Metering).

---

### Component 2: Execution Persistence Abstraction (Checkpointer)
1. **Internal Storage Contract (UAAP-owned):**
   The internal protocol is deliberately independent of LangGraph. It stores serialized checkpoint records and enforces tenant/run ownership:
   ```python
   class CheckpointStore(Protocol):
       async def put(
           self,
           tenant_id: str,
           run_id: str,
           checkpoint_id: str,
           state: dict[str, Any],
           metadata: dict[str, Any],
       ) -> None: ...

       async def get(
           self,
           tenant_id: str,
           run_id: str,
           checkpoint_id: str | None = None,
       ) -> CheckpointRecord | None: ...

       async def list(
           self,
           tenant_id: str,
           run_id: str,
           *,
           before: str | None = None,
           limit: int | None = None,
       ) -> list[CheckpointRecord]: ...

       async def delete(self, tenant_id: str, run_id: str) -> None: ...
   ```
   `InMemoryCheckpointStore` implements this contract using an `asyncio.Lock()` and keys records by the tuple `(tenant_id, run_id, checkpoint_id)`. It validates JSON serializability before accepting a record.

2. **LangGraph Adapter (framework boundary):**
   `LangGraphCheckpointSaverAdapter` is a separate adapter around `CheckpointStore`. It subclasses/implements the installed LangGraph `BaseCheckpointSaver` contract and translates LangGraph checkpoint operations into internal `put`, `get`, `list`, and `delete` calls. Its LangGraph-facing methods (`aput`, `aget_tuple`, and `alist`, plus any additional abstract methods required by the installed LangGraph version) belong only to this adapter—not to `CheckpointStore`.
   - The adapter must be implemented against the exact LangGraph version pinned in `pyproject.toml`; tests must verify its abstract-method completeness and checkpoint round-trips.
   - Tenant identity is supplied by the trusted server-side runtime principal/context and bound to the adapter invocation. It must never be derived from an unverified request header, caller-controlled configurable field, or a caller-chosen `thread_id`.
   - The adapter binds the trusted `(tenant_id, run_id)` to LangGraph's checkpoint/thread identifiers using a server-generated or server-validated mapping. A thread identifier alone is not proof of tenant ownership.
   - Every read, write, list, resume, and delete validates the trusted tenant and run binding. Cross-tenant access raises `UaapError("FORBIDDEN")`.

3. **Milestone A3 Implementation:**
   - Implement only `InMemoryCheckpointStore` and `LangGraphCheckpointSaverAdapter`.
   - Keep the storage contract replaceable so a persistent backend can be introduced in a separately authorized milestone without changing the LangGraph runtime contract.

4. **Database Block Policy:**
   PostgreSQL checkpointing, database provisioning, migrations, and `pgvector` are strictly deferred until separately verified and explicitly authorized.

---

### Component 3: Working Memory Architecture
1. **Scope:** Ephemeral, session-scoped memory holding immediate conversational turns, intermediate reasoning, and working variables.
2. **Tenant & Run Isolation:**
   - Every read and write requires explicit `tenant_id` and `run_id`.
   - No shared in-memory buffers across distinct runs.
3. **Compaction & Truncation:**
   - If working context exceeds model context threshold, automated compaction summarizes older turns into a high-level summary while preserving recent user turns.

---

### Component 4: Long-Term Memory Abstraction (Synthetic Test Mock)
1. **Interface Contract:**
   ```python
   class LongTermMemoryStore(Protocol):
       async def search(self, tenant_id: str, query: str, top_k: int = 5) -> list[MemoryItem]: ...
       async def store(self, tenant_id: str, item: MemoryItem) -> None: ...
       async def delete(self, tenant_id: str, item_id: str) -> None: ...
   ```
2. **Milestone A3 Implementation:** `InMemoryMemoryStore`
   - **Synthetic Test Mock Only:** Employs deterministic mock embeddings and in-memory cosine similarity search solely for protocol and isolation verification.
   - **No Production Vector Search:** No genuine semantic retrieval capability is claimed. PostgreSQL/`pgvector` and external vector databases remain strictly deferred.
   - **Enforced Filter:** Every retrieval query unconditionally injects `WHERE tenant_id == :tenant_id`. Cross-tenant queries are rejected at the protocol layer.
3. **Database Block Policy:** `pgvector`, ChromaDB, and PostgreSQL table storage remain deferred.

---

### Component 5: Canonical 5-Tier Permission Model & Human Approval Center
1. **Canonical 5-Tier Permission Model (Frozen UAAP Standard):**
   All tool proposals and agent actions are classified into the canonical 5-tier permission model:

   | Tier | Name | Canonical Definition | Autonomy / Approval Rule |
   |:---:|---|---|---|
   | **1** | **Read-Only** | Autonomous read operations, read-only search, metadata lookups, queries without side effects. | Autonomous execution permitted. |
   | **2** | **Non-Binding Draft** | Autonomous drafting of messages, provisional schedules, uncommitted calculations, staging draft tickets. | Autonomous execution permitted; non-binding. |
   | **3** | **Approval-Required** | Binding or sensitive operations: financial transactions, purchase orders, binding contracts, user role changes, sensitive external communications. | **Execution strictly suspended until Dual-Control human approval is verified.** |
   | **4** | **Operational Write** | Low-risk, reversible, schema-validated operational writes (updating ephemeral cache keys, writing operational metadata, logging heartbeat tags). | Autonomous execution permitted within schema bounds. **Strictly NOT for financial or identity operations.** |
   | **5** | **Permanently Blocked** | Hard-coded safety blocks: arbitrary raw SQL execution, dropping tables, disabling auth/RLS, audit trail tampering, secret exfiltration. | **Permanently blocked.** Cannot be executed autonomously or via human approval under any circumstances. |

2. **Approval Controls Contract (`ApprovalRequest`):**
   ```python
   @dataclass(frozen=True)
   class ApprovalRequest:
       approval_id: str
       run_id: str
       tenant_id: str
       initiating_actor_id: str
       approving_actor_id: str | None
       action_name: str
       risk_tier: int  # Must equal 3 (Tier 3: Approval-Required)
       summary: str
       proposed_payload: dict[str, Any]
       payload_hash: str  # Immutable SHA-256 of proposed_payload
       single_use_token_hash: str  # SHA-256 hash only; raw token is never persisted
       created_at: datetime
       expires_at: datetime
       status: ApprovalStatus  # PENDING | APPROVED | REJECTED | EXPIRED
       rejection_reason: str | None = None
   ```

3. **Mandatory Approval Validation Rules:**
   - **Dual-Control Separation of Duties:** The approving actor must be different from the initiating actor (`approving_actor_id != initiating_actor_id`). Self-approval is rejected with `UaapError("FORBIDDEN")`.
   - **Payload Hash Immutability:** On approval submission, `hashlib.sha256(canonical_json(payload))` is verified against `payload_hash`. Any payload tampering causes immediate rejection.
   - **Token Generation & Storage:** Generate a high-entropy, one-time token using a cryptographically secure random generator (for example, `secrets.token_urlsafe(32)`). Compute `SHA-256(raw_token)` and persist only `single_use_token_hash`; never persist, log, include in audit events, or place the raw token in checkpoints. In the A3 mock flow, expose the raw token only once to the simulated authorized approval caller.
   - **Token Verification:** On approval, hash the presented token and compare it with the stored hash using a constant-time comparison (for example, `hmac.compare_digest`). Reject missing, malformed, mismatched, or already-consumed tokens.
   - **Atomic Single-Use Consumption:** Under one lock-protected transaction/critical section, verify token hash, `PENDING` status, tenant/run ownership, expiry, approver separation, and payload hash; then mark the approval token consumed and transition approval status to `APPROVED` before allowing graph resume. Verification and consumption must be indivisible. A concurrent or subsequent replay fails with `UaapError("APPROVAL_ALREADY_CONSUMED")`. A3 uses an in-memory lock; any future persistent implementation must use an equivalent atomic conditional update/transaction.
   - **Expiry Validation:** If `now > expires_at`, atomically mark the approval `EXPIRED`, invalidate/consume its token hash, reject the approval with `UaapError("APPROVAL_EXPIRED")`, and transition the run to `REJECTED`.
   - **Tenant & Run Ownership:** `approving_actor_id` must belong to the matching `tenant_id` and possess required approval roles; `run_id` must match the suspended execution.
   - **Rejection & Replay Protection:** Rejection transitions state to `REJECTED`, invalidates the stored token hash, and emits an immutable audit event containing identifiers and outcome only (never the raw token).
   - **Safe Simulation Only:** In Milestone A3, all approved Tier-3 actions are executed against mock dispatchers. Zero live ERP or financial mutations occur.

4. **Resume / Reject Endpoints:**
   - `POST /v1/runtime/runs/{run_id}/approve`: Validates approver permissions, verifies payload hash and single-use token, transitions state to `RUNNING`, and resumes execution.
   - `POST /v1/runtime/runs/{run_id}/reject`: Records rejection reason, transitions state to `REJECTED`, invalidates token, and emits an audit event.

---

## 4. Planned File Structure for Milestone A3

When authorized to code, Milestone A3 will be implemented inside `services/uaap/`:

```
services/uaap/
├── src/uaap/
│   └── runtime/
│       ├── __init__.py
│       ├── state.py              # AgentState, AgentStatus, ApprovalRequest dataclasses
│       ├── graph.py              # StateGraph definition and node execution logic
│       ├── checkpointer/
│       │   ├── __init__.py
│       │   ├── base.py           # CheckpointStore protocol & CheckpointRecord dataclass
│       │   ├── in_memory.py      # InMemoryCheckpointStore implementation
│       │   └── adapter.py        # LangGraphCheckpointSaverAdapter implementation
│       ├── memory/
│       │   ├── __init__.py
│       │   ├── working.py        # Working memory session manager & compaction
│       │   ├── long_term.py      # LongTermMemoryStore protocol & InMemoryVectorStore
│       │   └── types.py          # MemoryItem and search parameters
│       ├── approval/
│       │   ├── __init__.py
│       │   └── hooks.py          # HITL interrupt hooks and approval resolution logic
│       └── runner.py             # Agent runtime runner orchestrating graph executions
└── tests/
    └── runtime/
        ├── __init__.py
        ├── test_state_graph.py   # State transitions, cycle limits, step bounds
        ├── test_checkpointer.py  # CheckpointStore & LangGraph saver adapter round-trips
        ├── test_working_memory.py# Session isolation and compaction
        ├── test_long_term_mem.py # Tenant-filtered retrieval and mock vector search
        ├── test_approval_hooks.py# HITL pause, approve, resume, and reject workflows
        └── test_tenant_isolation.py # Cross-tenant boundary verification across runtime
```

---

## 5. Reliability & Security Test Matrix

Milestone A3 will require **100% passing automated tests** before considering completion:

| Test Suite | Targeted Assertions |
|---|---|
| **Graph Lifecycle Tests** | State progression (`PENDING` → `RUNNING` → `COMPLETED`), recursion limit halts infinite loops, typed error handling. |
| **Checkpointer Integrity** | `CheckpointStore` serialize/deserialize roundtrip, step-by-step history replay, deterministic resume, and `LangGraphCheckpointSaverAdapter` contract completeness. |
| **Memory Isolation Tests** | Tenant A cannot read Tenant B working memory or long-term items, queries without `tenant_id` fail at compile/runtime. |
| **HITL Approval Workflows** | Tier-3 action triggers interrupt (`AWAITING_APPROVAL`); dual-control enforcement rejects self-approval; payload hash mismatch aborts; single-use token consumption blocks replays; constant-time comparison verifies token hash; expiry transitions to `REJECTED`; approval resumes graph; rejection aborts cleanly. |
| **Cross-Tenant Replay Protection** | Run IDs and approval tokens cannot be hijacked across tenants; checkpoint restore validates tenant ownership. |
| **Non-Regression Baselines** | UAAP A2 tests remain 39/39 passing; Core SaaS `npm run typecheck` and Vitest remain 100% passing. |

---

## 6. Strict Milestone Exit Criteria

Milestone A3 will only be marked complete when:
1. All in-memory runtime, checkpointing, adapter, working memory, and approval modules are implemented in `services/uaap/src/uaap/runtime/`.
2. All planned runtime unit and isolation tests pass with 100% success.
3. No database has been provisioned; zero database migrations created.
4. Core SaaS and Construction ERP remain completely untouched.
5. An official `UAAP_A3_COMPLETION_REPORT.md` is delivered and Antigravity **stops** for executive authorization before Milestone A4.
