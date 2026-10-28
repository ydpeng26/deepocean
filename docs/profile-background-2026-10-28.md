# Personal homepage background — 2026-10-28

## Scope

- Avatar camera retains its existing avatar-only upload.
- Basic profile's duplicate avatar control becomes an independent homepage background upload.
- JPG/PNG/WebP, input up to 10 MiB, local conversion to JPEG at longest edge 1920 px.
- Display the saved background in the basic-profile thumbnail, profile preview and personal profile/passport page, with a dark overlay for readable text.
- Background saves automatically, separately from unsaved profile text and avatar.

## Data and safety

- Nullable profiles.background_url; existing profiles unchanged.
- Private avatars bucket reused with unique owner/background/UUID.jpg paths; no new public bucket or access grants.
- Owner-id database constraint prevents another account's background path.
- Existing account-deletion owner-prefix cleanup includes background files.
- Compare-and-set background update detects stale tabs. Failure readback protects an image whose update committed but response was lost.
- No production database, deployment or existing user image changed.

## Verification

- Extended scripts/profile-regression.mjs passes: independent avatar/background, unsaved text, operation locking, invalid sizes/account changes, conflicting writes and lost-response preservation.
- Production Vite build and offline-asset generation pass.
- Type checking has only existing unrelated literal-state errors in forum-post-preview.tsx and profile-preview.tsx; no errors remain in changed files.
- Recovery esovqvampbrhuhamkfcs migration applied. Temporary-table transaction checks accepted matching owner paths and rejected mismatches, then rolled back.
- Recovery security advisories inspected before and after; this change adds no policies, privileged functions or grants.
- Real browser upload/reopen acceptance passed on recovery: run 40632484732, source ded0707.

## Recovery deployment and failure-path correction

- Initial recovery Production deployment A4Dsdyvqgvamvhec4NpsLubwKxoD (68f5392) reached Ready and was bound only to supdiver-recovery-test.vercel.app after the user's email verification.
- Runs 40631142982 and 40631659780 passed independent avatar/background persistence and actual synthetic image decoding. Both stopped during the simulated background-save failure check; both cleaned their disposable account and images.
- After the second failure, inspection found a real PromiseLike compatibility issue: PostgREST query builders support then/await, not direct catch. The original fake client returned native Promises and concealed it.
- Updated the regression fake to return PromiseLike objects. It reproduced the failed orphan-cleanup assertion before the code fix, then passed after wrapping the readback builder in Promise.resolve. Functional fix source 2192e2e; matching regression source ded0707.
- Independent post-run recovery aggregate checks found zero generated background accounts and background images, preserving the four pre-existing profiles.
- Formal main remained 01fa917; no production-site update authorized or performed.

## Completed recovery acceptance

- Recovery deployment 6VX2KSjPX28k68oGqbeGkqrK5wyE is Ready / Production / Current in the **supdiver-recovery-test** Vercel project, source ded070716b315b6a93140ff21e3ea732ab90fe6e, bound to supdiver-recovery-test.vercel.app. Generated domain supdiver-recovery-test-cvy2t7pbc-ydpeng26s-projects.vercel.app. Native deployment UI verified.
- Full decoded job logs for run https://github.com/ydpeng26/deepocean/actions/runs/40632484732 (job 122631846496) confirm all five checks plus exact cleanup: avatar only; independent background save/display and actual image decoding; injected HTTP 503 preserves prior image/avatar/drafts; profile reload and passport background; temporary-user signout.
- Independent aggregate SQL after completion: temporary background accounts 0, background images 0, profiles 4, dives 3, gear items 2, existing backgrounds in use 0.
- This verifies a fresh Chromium context with generated images; it does not re-test installed-app/service-worker upgrade lifecycle or a manual desktop Safari upload. No existing private image was downloaded, and no screenshots/traces were exported.

## Release order

Do not deploy this frontend to production before applying its matching nullable-column migration there. Recovery frontend deployment and synthetic-image acceptance are complete; separate production approval remains pending.
