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

## Run 39 incomplete — runner preflight bug

[Run 39](https://github.com/ydpeng26/deepocean/actions/runs/40219960333), job `121249187530`, source `ec23ed9`, completed checkout, Node setup and isolated browser installation but failed at fixed-site preflight with TypeError before any fixture creation. Safe logs confirm `PASS: no_temporary_account_created` and `AUDIT: complete=false`. This is not a branch-selection failure, not evidence of application failure, and not explained by the independent Node20 deprecation warning.

Source inspection identified `response.ok()` on a native fetch Response; its `ok` is a boolean, unlike Playwright APIResponse.ok(). The preflight now uses an extracted fixed-origin helper with the correct property and unchanged repair/backend checks. Local tests execute that actual helper against native Response objects: valid build passes; HTTP failure, invalid manifest, foreign paths, missing repair and wrong backend fail closed. No live browser/record assertions have been weakened. Runner-only follow-up leaves src/public and workflows unchanged, so a new fixed-site deployment is unnecessary; a fresh workflow dispatch on the updated isolated branch is required. The preflight now also forbids redirects. No fixture, user data or production changes occurred in response to this failure.

## Run 40 incomplete — browser operation not yet localized

[Run 40](https://github.com/ydpeng26/deepocean/actions/runs/40220871238), job `121251964208`, source `dfb6b40`, passed the fixed recovery public-bundle preflight. It created the exact disposable owner/gear fixture, then failed in `zh-CN_independent_editors` with an unclassified browser Error before the first independent-editor PASS. Exact temporary account/profile/gear absence and browser closure were confirmed in finally. `AUDIT: complete=false`; no browser case is accepted from this run.

The suppressed error does not establish a selector, network or application cause. Runner-only diagnostic follow-up splits login/navigation/field/edit/save/conflict phases and reports only fixed error categories, numeric runner source positions and an optional numeric ambiguous-locator count. Synthetic sentinel tests confirm arbitrary messages, identities and credentials are omitted. No app changes, relaxed assertions, real-user operations or new deployment are included. Another fresh dispatch is needed to localize the failure; do not blindly rerun the old source or describe this diagnostic change as a verified fix.

## Run 41 localized — unreadable browser-observed login response body

[Run 41](https://github.com/ydpeng26/deepocean/actions/runs/40221758823), job `121254638042`, source `b3cee52`, passed preflight and reached Chinese editor A's login-response read. The diagnostic classified `response_body` and identified runner line 229, the Playwright `response.json()` call. The preceding successful-response assertion passed. No equipment conflict case reached PASS; exact temporary user/profile/gear absence and browser closure were again verified. This narrows the failure to the harness's browser-response-body observation, not an established app login failure, selector timeout or Node20 warning.

The follow-up no longer reads that observed response body. It requires successful login HTTP status, actual navigation to the protected gear route, and a nonempty session token belonging to the exact generated owner in that isolated page's recovery session-storage slot. The token stays only in cloud-runner memory for temporary-session revocation and is never logged/exported. Missing/malformed/denied storage and wrong-owner values fail closed. The actual login function is locally exercised with a deliberately unreadable response body, proving it does not call response.json(); the serialized page helper is tested with synthetic storage. Record hydration now waits for the exact synthetic brand before proceeding. Save observations require the PATCH response and unlocked fields/no conflict; independent server readbacks remain unchanged, and repeated success-toast text is not used as an ambiguous selector. Actual save-function local tests cover successful/failed HTTP and persistent conflict. Application src/public and workflows remain unchanged; no new website deployment is required. Live acceptance still needs a fresh dispatch and is not claimed by these local models.
