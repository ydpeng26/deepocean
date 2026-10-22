# Marine and gear resilience — PC recovery checks, 2026-10-22

## Authority and boundary

The user approved repairing the marine photo/save failures and gear draft/load failures, then verifying on the recovery site. Work is isolated to `codex/marine-gear-resilience`; production main remains outside the release authority for this turn. No schema migration, permission change, production credential, existing-user mutation or mail is needed.

## Changes

- Marine create uses one request UUID retained by the open editor. Normalized JPEG uploads use that UUID plus the SHA-256 content hash, so identical retries reuse a private object without overwriting another image. A prior saved row must match owner and submitted contents before retry is accepted. A changed payload after an ambiguous commit is rejected rather than silently replacing the original.
- Marine save never deletes newly uploaded or replaced photos in response to an error or success. A lost HTTP response may conceal an already committed row; deleting its file is unsafe. Old and failed-upload objects remain private until separately authorized maintenance; this change does not add automatic garbage collection. Normal explicit record deletion behavior remains separate.
- Marine updates request and verify an actual returned owner row. Zero-row updates fail, keep the editor open and do not delete photos. An expected account is checked before saving/uploading. The editor snapshots fields, synchronously blocks overlapping saves, disables fields/close/new-record controls while saving and ignores late callbacks after unmount. Failed saves keep text and the selected file.
- Gear hydrates a selected record once per id, not whenever its cached object changes. A background refresh cannot replace unsaved fields. Save/delete share a synchronous lock; fields, selection and new-record controls lock while pending. Account id and submitted fields are captured. Late callbacks are ignored after unmount; success uses the returned row rather than the local draft.
- Gear query/profile errors show an alert and retry, not an empty collection and blank form. Failed saves retain edits. New records retain a stable id and verify a matching prior row before retry. Updates/deletes require returned-row confirmation. Usage count must fit a non-negative PostgreSQL integer. Changing selected gear asks before discarding edits.

## Local verification

`scripts/marine-gear-regression.mjs` passed seven isolated application/API groups: lost-response marine create keeps the referenced image and retries without a duplicate; changed retries are rejected; zero-row edit fails without deleting old/new images; ordinary failure reuses a retained private upload; account mismatch blocks writes; gear lost-response retry, zero-row rejection and integer bounds. The actual gear component was also executed with mocked hooks: refreshed rows preserve drafts; load errors render an alert without a blank editor; save locks fields/new/selection and blocks synchronous extra activation; failure retains the draft; completion after unmount does not update cache. No real network or database is involved in those local checks.

The existing 11 profile and six certificate local groups passed unchanged. Build passed. Full type checking still reports the previously recorded errors in `__root.tsx`, `forum-post-preview.tsx` and `profile-preview.tsx`, not these changed modules. Targeted ESLint passed with the pre-existing marine API explicit-any rule excluded; no repository-wide lint/type-clean claim is made.

## Recovery acceptance

The recovery deployment uses the fixed site's own environment and application commit 49392b2; later runner-only changes do not change the application. The cloud fixture is hardcoded to `esovqvampbrhuhamkfcs` and `supdiver-recovery-test.vercel.app`. It blocks production site and non-recovery Supabase requests and creates one fresh confirmed example.invalid account, generated PNGs and synthetic gear/marine rows only. It emits stage names, not real payloads, screenshots, traces or downloadable artifacts.

Complete targeted browser acceptance passed: https://github.com/ydpeng26/deepocean/actions/runs/39728628229, job 119658272976, runner ff04db2, unchanged application 49392b2. PC Chromium at 1440x1000 independently read back fixture rows and Storage state. Nine groups passed:

1. Marine rejected save preserves text and its private upload; fields lock and synchronous extra submit is ignored.
2. Server-committed/lost-response save retains its referenced image; retry confirms the same row without another insert, and reload decodes the stored image.
3. Failed photo replacement leaves the old row and both private images intact; retry updates the exact existing row.
4. An actual zero-row edit after deleting only the synthetic row fails without closing the editor or deleting photos.
5. Gear read failure displays an error/retry, not an empty collection or blank form; retry loads the actual fixture.
6. After cache staleness, actual offline/online reconnection returns changed server data while preserving the unsaved local brand.
7. Gear pending save locks fields/new-record controls; injected failure retains draft; retry and reload show the exact saved value.
8. Gear server-committed/lost-response create retries without another insert or duplicate record.
9. Exact synthetic account, gear/marine rows and UUID-prefixed photos were deleted and verified absent.

The registered profile-workflow path was temporarily overridden on this branch only for dispatch; it is restored byte-for-byte to f13cb9e before handoff. The dedicated `recovery-marine-gear.yml` remains the long-term manual regression entry. The final workflow/documentation cleanup does not change the tested application or runner script. No production database rows, files or settings were modified, and the tested recovery account was not a restored human account.

Earlier incomplete cloud runs https://github.com/ydpeng26/deepocean/actions/runs/39727407844 and https://github.com/ydpeng26/deepocean/actions/runs/39728102044 passed the four marine groups and verified fixture cleanup, but did not complete gear acceptance. The second run's bounded diagnostic showed 14 gear GET attempts, a loading state, no error heading and no runtime errors at its 30-second timeout. Installed PostgREST client source confirms internal retries for idempotent 503 requests, on top of query-layer retries. The harness now uses a terminal 400 read failure to exercise the error/retry UI deterministically; application retry settings remain unchanged. These two runs remain incomplete, not overall passes.

## Remaining limits

This is not a full PC product acceptance, every browser/image size, cross-tab edit arbitration, every marine suggestion/share flow or abandoned-image cleanup. No new public sharing scope is added. Community counts/saved-post work and mobile acceptance remain deferred. Production release requires the user's separate confirmation after recovery acceptance.

## Authorized production release — 2026-10-22

The user explicitly confirmed production release after recovery acceptance. Main was independently checked at f13cb9e, and the tested application modules/styles were confirmed identical between recovery application 49392b2 and release 182554d. The seven local marine/gear groups passed again before a non-forced fast-forward of main to 182554d. The temporary profile-workflow override is absent from the final tree; no published history was rewritten.

Vercel production deployment https://vercel.com/ydpeng26s-projects/deepocean/FVTHtYDA4psDGkzZMobG6saKUpaZ showed Ready, Production, latest main/182554d and current www.supdiver.com (linking to supdiver.com). This is the production deployment, not the earlier successful branch preview BVriyT3cnU1x8a38amPpRaeEERyT. Signed-out production entry checks for /gear and /marine return to the normal login page; stateful fault/row/photo checks remain the recovery run above, not production user writes.

No database migration, permissions/settings change, real-user edit or photo cleanup was performed during release. Old/uncertain marine uploads remain private rather than being automatically deleted during saves. This release-record commit changes documentation only.
