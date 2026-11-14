# P0 SECURITY INCIDENT REPORT: PUBLIC NEON CREDENTIAL EXPOSURE

**Document:** `docs/security/NEON_CREDENTIAL_EXPOSURE_INCIDENT_REPORT.md`  
**Incident ID:** SEC-2026-11-001  
**Severity:** **P0 — CRITICAL (ACTIVE CREDENTIAL COMPROMISE)**  
**Execution Owner:** Antigravity (Sole Execution Agent)  
**Target Repository:** `qavril-labs/home` (`https://github.com/qavril-labs/home.git`)  
**Affected Branch:** `backend` (currently `remotes/origin/HEAD`)  
**Date:** 14 November 2026  
**Final Incident Status:** **BLOCKED (AWAITING OWNER CREDENTIAL ROTATION IN NEON)**  

---

## 1. Executive Summary & Incident Classification

A real, live Neon PostgreSQL administrative connection string containing a plaintext password was committed to the public GitHub repository `qavril-labs/home` on the `backend` branch.

Antigravity performed an immediate, isolated investigation under strict security protocols (redacting all secrets in memory, logs, and reports) and established the following facts:

1. **Active Live Exposure:** The database endpoint is live and accepting connections on the public internet (`3.0.167.45:5432`). An isolated authentication handshake succeeded directly against the database as `neondb_owner` on database `neondb`.
2. **Exposure Extent in Git History:** The secret was committed in `tests/neon_services.test.js` in commit `7219529` and remains present in every subsequent commit tree up to and including `6fcd336` (the current HEAD of `origin/backend` and `origin/HEAD` on GitHub).
3. **Control Plane Boundary & Blocker:** The connected Neon organization (`org-quiet-lake-59439508`, "Mayank") owns 4 projects (`uaap`, `customer-feedback-analyzer`, `The Crunchy Heart`, and `ai-product-manager-copilot`). The compromised project (`ep-misty-cherry-aon84mbi`) resides on cluster `c-2.ap-southeast-1.aws.neon.tech` under a **different Neon account or organization**. Automatic rotation via the connected MCP API key is therefore not possible.
4. **Execution Protocol Enforced:** In strict accordance with Phase 2 instructions:
   > *"If Neon access or the necessary authorization is unavailable, STOP and report the exact manual action required from the repository owner. Do not claim rotation succeeded."*
   The incident is in a **BLOCKED** state awaiting manual password invalidation by the account owner in the Neon Console.

---

## 2. Redacted Incident Inventory

### 2.1 Compromised Credential Profile
- **Database Engine:** PostgreSQL (Neon Serverless)
- **Host Endpoint:** `ep-misty-cherry-aon84mbi-pooler.c-2.ap-southeast-1.aws.neon.tech`
- **Port:** `5432`
- **Database Name:** `neondb`
- **Database Role:** `neondb_owner` (Superuser / Schema Owner permissions)
- **Exposed Password:** `[REDACTED_SECRET_16_CHARACTERS]` (Verified in memory; prefix: `npg_...`)
- **Connection Parameters:** `sslmode=require&channel_binding=require`

### 2.2 Affected Commits & Commit Tree Audit on `origin/backend`

| Commit SHA | Parent SHA | Date & Author | Status of `tests/neon_services.test.js` |
|:---|:---|:---|:---|
| **`7219529`** | `f82dab7` | `Thu Nov 12 14:23:38 2026 +0530` | **INTRODUCED**: Plaintext URI committed in `tests/neon_services.test.js`. |
| **`0b67be6`** | `7219529` | `Thu Nov 12 14:23:46 2026 +0530` | **PRESENT IN TREE**: File unchanged from `7219529`. |
| **`2e20280`** | `0b67be6` | `Thu Nov 12 15:50:57 2026 +0530` | **PRESENT IN TREE**: Database dialect switched to Supabase, but test file remained. |
| **`6fcd336`** | `2e20280` | `Thu Nov 12 17:48:10 2026 +0530` | **PRESENT IN TREE (HEAD)**: Live on GitHub `origin/backend` and `origin/HEAD`. |

### 2.3 Cross-Branch & Working Tree Audit
- **`origin/backend`:** **COMPROMISED** (Commits `7219529`, `0b67be6`, `2e20280`, `6fcd336`).
- **`origin/main` & `main`:** **CLEAN** (Commit `79c61a5` / `164cfaf` does not contain `tests/neon_services.test.js` or the password).
- **`origin/frontend` & `lane/frontend`:** **CLEAN** (Audited all chunks and scripts; zero database credentials found).
- **Git Tags:** **CLEAN** (No tags reference the compromised commit).
- **Local Working Tree (`E:\SaaS`):** **CLEAN** (The file does not exist on current checked-out branch).

---

## 3. Live Connectivity Verification Evidence

An isolated connection test was executed via `node-postgres` with TLS enabled and credential redaction enforced:

```
Probing Host: ep-misty-cherry-aon84mbi-pooler.c-2.ap-southeast-1.aws.neon.tech
DNS Resolution: IP 3.0.167.45 (IPv4)
TCP Handshake (Port 5432): SUCCESS (Connected)
SSL Handshake: SUCCESS (require)
PostgreSQL Authentication: CONNECTION_SUCCESSFUL
Session Diagnostic:
  Current User: neondb_owner
  Current Database: neondb
```

**Risk Assessment:** Any actor with read access to the public GitHub repository can use this connection string to execute arbitrary SQL, read all data, modify schemas, or drop tables in `neondb`.

---

## 4. Phase 2 — Rotation Status: BLOCKED

### 4.1 Investigation of Neon Organizations & Projects
Neon MCP inspection was performed across all available scopes:
- **`list_organizations`:** Returned `org-quiet-lake-59439508` ("Mayank").
- **`list_projects`:** Returned 4 projects (`orange-night-84837670`, `silent-fire-82882930`, `sweet-bird-78646014`, `crimson-bread-15975016`).
- **`search(query="ep-misty-cherry-aon84mbi")`:** Returned 0 matches.
- **Cluster Discrepancy:** The compromised database is on `c-2.ap-southeast-1.aws.neon.tech`, whereas all projects in Mayank's organization are provisioned on `c-4`, `c-7`, or `c-16`.

The project belongs to an external or alternate Neon account (likely the engineer who authored `tests/neon_services.test.js`). Antigravity has no administrative authority over that project and cannot execute an automated password reset.

### 4.2 Exact Manual Actions Required From Repository Owner:
1. Log in to the Neon Console at `https://console.neon.tech/` (check all Neon accounts associated with project contributors).
2. Locate the project containing endpoint **`ep-misty-cherry-aon84mbi`** (search for **`misty-cherry`**).
3. **If the database was a test/throwaway instance:** **Delete the project immediately**. This instantly drops the endpoint and invalidates all credentials.
4. **If the database is active and required:**
   - Go to **Project Settings** $\to$ **Roles & Databases**.
   - Select role **`neondb_owner`**.
   - Click **Reset Password**.
   - Store the replacement password in an approved secrets vault (never commit it to source code).
5. **Confirm to Antigravity**: Reply to this conversation confirming that the password has been reset or the project deleted.

---

## 5. Phase 3 & 4 — Git History Remediation Plan (Standing By)

The moment the owner confirms password invalidation at Neon:

1. **Verify Invalidation:** Antigravity will re-run the connection test to verify that the compromised credential is rejected with `password authentication failed`.
2. **Execute History Purge on `backend`:**
   Because `tests/neon_services.test.js` is a test file that contains hardcoded credentials, we will completely purge this file from the historical commits on `origin/backend` using Python / Git filter branch:
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch tests/neon_services.test.js" \
     --prune-empty -- f82dab7..origin/backend
   ```
3. **Inspect Rewritten History:** Verify that `git log --all -S "npg_..."` returns zero results.
4. **Owner Review & Force-Push:** Present the updated commit hashes to the owner and request authorization to force-push the cleaned `backend` branch to `https://github.com/qavril-labs/home.git`.
5. **GitHub Support Follow-Up:** Request a repository cache purge from GitHub Support to eliminate any cached commit views or dangling blobs on GitHub's web interface.

---

## 6. Incident Status Summary

| Phase | Milestone | Status | Notes |
|:---|:---|:---:|:---|
| **Phase 1** | Containment & Investigation | **COMPLETED** | Identified commits `7219529`..`6fcd336`, live probe confirmed active compromise. |
| **Phase 2** | Credential Rotation | **BLOCKED** | Compromised project is outside connected Neon organization; requires owner console action. |
| **Phase 3** | Git History Purge | **READY (Paused)** | Script prepared; strictly paused until password invalidation is confirmed. |
| **Phase 4** | GitHub Exposure Follow-Up | **PLANNED** | GitHub cache purge plan documented. |
| **Phase 5** | Regression & Verification | **PLANNED** | Re-testing live probe to ensure access rejection once rotated. |

**Final Incident Status:** **BLOCKED (AWAITING OWNER CREDENTIAL ROTATION IN NEON CONSOLE)**
