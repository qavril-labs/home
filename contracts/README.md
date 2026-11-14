# Contracts

The only files the backend and the frontend share. Everything else belongs to one side.

| File | Owner | Used by |
|---|---|---|
| `openapi.yaml` | Claude Code (backend) | Antigravity generates its typed API client and mock responses from it |
| `events.md` | Claude Code (backend) | Both: the domain events and their payloads |

Rules:

1. The backend changes a contract only in a pull request of its own, and the frontend lane reviews it.
2. The frontend never reads backend source code. If it needs a field, it opens an issue against the contract.
3. Breaking changes need a new API version (`/v2/...`) or a deprecation period stated in `openapi.yaml`.

`openapi.yaml` is written in week 1 of the build plan, from the routes in `backend/apps/api/`.
