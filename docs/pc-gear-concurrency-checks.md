# Gear concurrent editing — 2026-10-26

## Scope and diagnosis

After the user deferred a new isolated full-restore drill, remaining PC coverage was reconciled against later acceptance/release records. Previously accepted Safari zoom route checks, human authentication/mail flows, offline updates and dive-log concurrency are not repeated here. This is a distinct gear-module finding.

The actual `updateGear` API, executed locally against synthetic in-memory rows, accepted a stale second editor's whole payload and overwrote the first editor's newer notes and dive count. Inspection confirmed only record/owner predicates, not a revision predicate. No actual account, gear row, photo or production record was changed by diagnosis.

## User-authorized local repair

- Add `updated_at` to the gear record type, not editable input. Keep the revision captured when the editor hydrates, even when background data refreshes. Successful save and explicit latest-record loading adopt the returned revision.
- Update and delete use record id, owner id and expected revision in the same database mutation. Missing baseline fails closed; zero-row update/delete cannot silently overwrite/recreate/delete a newer record.
- If a previous update committed but its reply was lost, a revision-mismatched retry can acknowledge identical current fields through an owner-scoped read, without another write. Different content remains a conflict. No unconditional retry/upsert is added.
- Conflicts retain copyable input and expose translated persistent guidance. Reload requires explicit discard confirmation. Cancel, failed read and an already deleted record preserve the draft; the deleted record is not recreated. Switching to a different record/new form still uses the existing unsaved-input confirmation.
- Existing synchronous action lock, account gate and unmount safety remain. Stale delete also uses the editor's original revision and cannot remove newer changes.

Supabase skill safety guidance was applied. A read-only metadata query on recovery project `esovqvampbrhuhamkfcs` confirmed the non-null revision column and enabled timestamp trigger. No user rows were queried, SQL writes executed, migration applied, credentials retrieved, or project settings changed. Existing formal and recovery projects are unchanged. No new project, plan upgrade, backup restore or deployment was performed.

## Local verification

`gear-concurrency-regression.mjs` executes actual gear APIs against an atomic-filter model: stale update/delete, simultaneous writers, mutation-time race, deleted record, absent revision, lost-reply identical confirmation without duplicate write, changed retry rejection, fresh edit/delete, account mismatch and database failure.

`marine-gear-regression.mjs` additionally exercises the actual gear component: background refresh cannot advance its original revision; conflict preserves input and blocks further save; reload cancel/error keeps the draft; explicit successful reload adopts latest content/revision; background deletion retains visible copyable input without creating a record. Earlier marine/gear failure/locking/unmount contracts remain covered.

All 32 local regression suites passed. Scoped application lint, client/server build and offline asset generation passed. Whole-project TypeScript still reports the eight pre-existing literal-state errors in forum-post-preview/profile-preview; no changed application module errors remain. User-owned `screenlog.0` is untouched.

## Not yet accepted

These are local model checks, not live two-context recovery browser or PostgreSQL race acceptance. Recovery-only deployment plus synthetic fixture verification/cleanup requires separate permission; formal release requires later approval. The repair protects current clients, not already loaded legacy clients that still make unconditional writes. It does not extend concurrency protection to profile, certificate, marine or forum editors. Timestamp-based conflict detection follows the existing dive-log design and is not a new database revision-counter guarantee.

## Recovery-only approval and preparation

The user approved updating only the recovery fixed site, one disposable account and synthetic gear, with exact cleanup. `recovery-gear-concurrency.mjs` first checks the fixed-site bundle for the new gear conflict class/English reload copy and recovery backend. It then uses independent signed-in contexts in Chinese and English to check stale edits/deletes, confirmation before reload, fresh revision adoption, a real conditional write raced by a synthetic server update, deleted-record non-resurrection, synchronous duplicate submit and committed/lost-reply retry without another server revision. Independent recovery reads verify saved values. No email, photos, existing users, screenshots, traces or local data exports.

The runner fixes the recovery origin, restricts browser writes to the known generated gear id/owner/revision and temporary auth sessions, uses a six-minute deadline and bounded HTTP calls, verifies the known temporary user id/email/private marker before cleanup, revokes temporary sessions and confirms account/profile/gear absence. A guard regression confirms local execution fails before credential reads or network calls; this is not live acceptance. The dedicated workflow is manual-only and restricted to the isolated branch. The already registered dive-log workflow is temporarily routed to this runner on that branch only, and must be restored byte-for-byte to main before any separately approved formal release. Formal main remains `340f3460599b7c8b385bafc24d54142bb10fe693`.
