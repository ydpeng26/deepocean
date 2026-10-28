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
- Real browser upload/reopen acceptance is still pending deployment to the recovery website.

## Release order

Do not deploy this frontend to production before applying its matching nullable-column migration there. Recovery frontend deployment, synthetic-image acceptance and separate production approval remain pending.
