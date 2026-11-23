# Backups and restore drills (PLT-21)

Status: the scripts are written and tested against a local PostgreSQL 18. **Nothing is scheduled, no S3 bucket is wired, and no backup of staging or production has been taken.** Neon's own point-in-time window is 6 hours ([product-platform-decisions.md](product-platform-decisions.md) section 2), so these logical backups are required before real customer data is loaded.

## What the scripts do

| Script | Does | Never does |
|---|---|---|
| `backend/scripts/backup/backup.mjs` | `pg_dump` in custom format (compressed), writes `erp-<UTC time>.dump` and a `.manifest.json` (SHA-256, size, applied migrations, row count per table, source address without password). With `BACKUP_S3_URI` it uploads both with the AWS CLI, server-side encrypted | Run as the application role; write a password anywhere |
| `backend/scripts/backup/restore-test.mjs` | Checks the checksum, restores into a newly created scratch database, compares the migration list and that every table has at least the manifest's rows, then drops the scratch database | Touch the source database |

Row-level security is forced on the tenant tables, so the backup role must be the database owner or have `BYPASSRLS`. The script checks this first and stops with a plain error, because a dump taken as the application role would be empty or partial and still look like a backup.

## Commands

```powershell
# Take a backup (owner connection string, direct endpoint, not the pooled one)
$env:DATABASE_URL = "<owner connection string>"
node backend/scripts/backup/backup.mjs backups

# Prove it restores (a scratch server, never production)
$env:RESTORE_ADMIN_URL = "postgres://postgres@127.0.0.1:5432/postgres"
node backend/scripts/backup/restore-test.mjs backups/erp-<time>.dump
```

Set `PG_BIN` to the folder holding `pg_dump` and `pg_restore` if they are not on `PATH`. The client tools must be the same major version as the server or newer.

## Neon notes

- Use the **direct** connection string. The pooled (`-pooler`) endpoint does not support `pg_dump`.
- `neondb_owner` can read all rows; confirm with a first backup that the script's role check passes.
- Take the dump from a read replica or a branch if the load matters; a dump of a small database finishes in seconds.

## Still to do (owner and backend)

1. **S3 bucket for backups**, in `ap-south-1`, versioning on, public access blocked, lifecycle rule (suggested: keep 35 days of daily backups, then monthly for a year), and a role the backup task can use with `s3:PutObject` on that prefix only. Not created.
2. **A scheduled run**: an ECS scheduled task (EventBridge, once a day) from an image that has the PostgreSQL client and the AWS CLI, or a GitHub Actions workflow on a schedule. Workflows and CI are the owner's files, so this needs a small PR from the owner. The task reads `DATABASE_URL` from Secrets Manager and must alert on a non-zero exit code.
3. **A restore drill on a schedule** (suggested: monthly): download the latest dump and run `restore-test.mjs` against a scratch server, and record the date and result here. A backup that has never been restored is not a backup.
4. **Encryption and access**: the S3 upload uses AES-256 server-side encryption; switch to a KMS key if the data classification requires it.
5. **What is not covered**: Redis (queues are rebuilt from the outbox, so losing it loses only in-flight jobs), the agent service's database (`qavril-agents`, run the same scripts against it), and uploaded files (no file storage exists yet, PLT-11).

## Restore drill log

| Date | Source | Result | Who |
|---|---|---|---|
| 2026-11-23 | Test database on a local server (automated test) | Pass: checksum, restore, migrations and row counts | Automated test `backend/packages/db/test/backup.test.ts` |
