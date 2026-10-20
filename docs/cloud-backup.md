# Cloud backups

GitHub Actions runs `Cloud backup` on main daily at 03:17 Asia/Shanghai (scheduled runs may be delayed), or manually. R2 bucket `supdiver-backups` stays private. Data is staged only in the ephemeral GitHub runner, never committed or attached as public build artifacts.

Required Actions Secrets: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `SUPABASE_DB_URL` (Session pooler, password included), `SUPABASE_SERVICE_ROLE_KEY`. Restrict R2 key to this bucket. These credentials must never be exposed to frontend code.

Each snapshot includes a consistent full PostgreSQL custom-format dump, role definitions without login password hashes, storage bucket metadata and a file manifest. Photo contents use immutable SHA256-addressed objects, so identical contents are not stored twice. Source deletions do not delete old backups. Each run currently re-downloads source files to verify actual contents; it does not assume metadata means unchanged. No retention deletion is enabled initially: watch storage usage and configure an explicit retention policy before large-scale use.

Every archive and photo is read back from R2 and SHA256 checked. `complete.json` is written last. Failed snapshots without that marker are incomplete. `pg_restore --list` checks archive readability, NOT restore feasibility. A full restore drill into a separate disposable Supabase project is still required before calling this disaster recovery validated. Never restore over production for testing. Supabase-managed schema versions, extensions (including Vault), auth encryption keys, settings, email providers and OAuth secrets need separate restore planning; database and photo copies alone do not reproduce service configuration. Concurrent photo changes/deletions may fail a run; rerun rather than accepting incomplete data.

For recovery: choose a completed snapshot, verify manifest hash in complete marker, download its dump/roles plus referenced content-addressed files in an isolated cloud recovery environment, verify SHA256, then follow the official Supabase backup/restore procedure. Recreate matching storage bucket settings and upload objects to original bucket/path. Validate row counts, auth login and private file access before switching production traffic. Do not download user data onto a developer workstation.

Check each run under repository Actions. A green run means backup export and integrity checks passed, not that an application recovery drill passed. Configure GitHub failure notifications for responsible maintainers. R2 is storage, not the task execution environment. GitHub runners execute the task.

## Isolated recovery drill — 2026-10-20

Successful run: https://github.com/ydpeng26/deepocean/actions/runs/39373614186

Snapshot `2026-10-20T02-38-24Z-39350194546` was restored into the explicitly allowlisted `SupDiver-Recovery-Test` project (`esovqvampbrhuhamkfcs`). Production credentials were not passed to the workflow. The task checks that the target contains no users, public tables or storage buckets before any writes. It refuses overwrite; rerunning against the now-populated test project intentionally fails the safety check. Do not bypass this check or delete test data without authorization.

Verified: transactional restore of account/application data, row counts for 46 tables (19 application tables), existence of 52 public RLS policies, restore of all 15 files with SHA256 after downloading from the target, and rejection of anonymous public-file access. All test buckets stay private, including avatars that were public in the source. Report is saved privately under R2 `recovery-reports/`.

The connection pooler did not apply startup trigger-mode options reliably. Recovery now explicitly sets `session_replication_role=replica` within the restoring SQL session and uses a single transaction. Platform-managed role default ACLs are excluded because hosted `postgres` cannot change them; explicit restored object grants remain. Existing target Auth/Storage platform schemas and their migration histories are preserved; application/migration objects, Auth table data and custom Auth triggers/Storage policies are selected from the archive. This is not a raw replacement of every managed platform object or role.

Not yet validated: end-to-end login, email delivery/confirmation, per-user RLS behavior, frontend navigation and signed URLs, Vault encryption root keys, external provider secrets, realtime/publication settings, or full application disaster recovery. Row counts are not a field-by-field database checksum. Photo checks are byte-level checksums. Do not describe this result as complete production recovery certification.

The `Recovery drill` workflow is manual-only after the initial implementation tests. It requires `RECOVERY_DB_URL` and `RECOVERY_SERVICE_ROLE_KEY` in addition to R2 credentials. It creates no public artifacts or local workstation backups. Keep Data API disabled on the test project until access controls are reviewed. Test data remains in the isolated cloud project after the run; cleanup requires a separate explicit decision.
