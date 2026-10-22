# Certificate archive — PC recovery acceptance, 2026-10-22

## Scope and visibility decision

The user requested individual certificate records, agency/level/number/issue details, real front-photo management and per-record privacy. No back photo is collected. The user selected public summaries containing only agency, level and issue details: numbers and photos remain owner-private. In this implementation summaries are available to signed-in divers, not anonymous visitors. New records are private by default. Credentials are self-reported, not agency-verified. Existing profile highest-certification selection remains independent; different certification types are not automatically ranked.

Code lives on `codex/certificate-vault`, not main. The user separately authorized updating only `supdiver-recovery-test.vercel.app`. No production schema or application release is authorized by this checkpoint.

## Implementation

- `/certificates` is an authenticated, noindex archive, linked from Profile and Ocean Passport. It lists actual saved records rather than demo certificates; each record can be created, edited or removed with a short undo action.
- Agency and level are required. Optional number, valid calendar issue date and issue location are stored per record. Input length and database constraints agree.
- Front photo is optional, JPEG/PNG/WebP, up to 10 MiB. Browser conversion normalizes orientation, strips metadata and limits the longest edge to 2800 pixels. The private bucket also enforces type/size limits.
- A stable certificate UUID and content-addressed photo path make retries idempotent. No success is reported without the returned owner row. Save/upload share a synchronous guard; edits and selected file survive a failed save. Account mismatch is rejected before writes, and late callbacks do not repopulate another account's cache.
- Full rows use owner-only RLS. Private `certificate-fronts` Storage policies restrict reads/writes/deletes to the owner's UUID prefix. Owner image previews use five-minute signed URLs. The public-summary RPC deliberately returns only id, agency, level, issued_on and issued_at; it excludes archived and private records and denies anonymous execution.
- Removing a certificate is a soft removal, hiding it from the archive and public summaries. Detaching/replacing a photo does not automatically purge the old private Storage object; no background production deletion is introduced. Existing signed links can remain usable for their short lifetime.

## Verification evidence

- Six local API contract groups in `scripts/certificate-regression.mjs` passed: private defaults and input allowlist; required fields, lengths and dates; account-switch write rejection; stable retry id; missing/wrong-owner confirmation rejection; invalid photo type/size rejection.
- Existing profile's 11 local regression groups passed unchanged.
- Production build passed. Full TypeScript checking still reports pre-existing errors in `__root.tsx`, `forum-post-preview.tsx` and `profile-preview.tsx`; no new certificate/type errors remain. Targeted certificate ESLint passed. This is not a claim that repository-wide type checking is clean.
- Complete first cloud browser run: https://github.com/ydpeng26/deepocean/actions/runs/39715748332, job 119617319841, runner/application commit f4bd77f.
- Strengthened complete run: https://github.com/ydpeng26/deepocean/actions/runs/39717911790, job 119624363356, runner commit 43b8d9a. Tested application source remains f4bd77f.
- Final complete run: https://github.com/ydpeng26/deepocean/actions/runs/39718875212, job 119627454811, runner commit a2eff2d. It also replaced an already-stored photo with a different generated PNG, checked a new private path, and asserted no desktop horizontal overflow at 1440 pixels. All seven cloud check groups passed, including exact fixture cleanup.
- Both runs independently checked recovery schema RLS/private bucket/RPC output; two-account API owner isolation and forged writes; actual PC browser create, failed-save retry, photo decoding and reload; multiple records and persisted visibility; public profile safe summary; a fresh second account's empty own archive; fresh owner login; photo detachment and certificate remove/undo.
- The second run additionally sent an unfiltered hostile table read, exact other-owner read, cross-owner upsert and private-photo overwrite attempt; all were denied. Both runs verified deletion of their exact disposable example.invalid accounts, certificate rows and UUID-prefixed generated photos.

All database/photos remained in the cloud recovery project `esovqvampbrhuhamkfcs`. No human account was edited, no mail sent, no production request permitted by the browser fixture, and no database/photo/secret, trace or screenshot artifact downloaded to the workstation. The schema application helper rejects non-recovery connection identities and connection-override query parameters.

## Release boundary and remaining coverage

After the final run, the temporarily reused registered `recovery-profile.yml` was restored byte-for-byte to its prior profile-only content. The new manual-only `recovery-certificates.yml` is retained for future certificate regressions. The historical run name `Recovery PC profile editor test` is a dispatch artifact, not its actual certificate test scope. The final workflow/documentation cleanup does not change the tested application or test script.

The accepted recovery deployment is https://vercel.com/ydpeng26s-projects/supdiver-recovery-test/HcZVrcpJ6kiWbeMVhWqpGEpMSmb1 (a rebuild of application f4bd77f in the recovery project's own Production environment); it is available at https://supdiver-recovery-test.vercel.app/certificates after login. Main was independently verified still at 70dd8b7 after the tests. These results are recovery-only, not a production deployment or an additional independent backup restoration.

Production rollout requires separate user approval and an additive migration before deploying the application. Existing records/photos are not migrated into certificate records automatically. Backup code enumerates the database and all Storage objects rather than a certificate-specific allowlist, but no new full backup/restore drill was performed for this feature. Mobile acceptance remains deferred by the user. This coverage does not establish every supported image size, every browser, cross-tab concurrent edits or instant revocation of already-issued signed URLs.

## Authorized production release — 2026-10-22

The user explicitly confirmed production release. Before changing main, the production project `zmhtlhpeulhhcvlnjdrb` (dashboard name DeepOcean-Staging) was checked through its SQL Editor: the certificate table, bucket and migration version were all absent. The exact tested migration was applied in one transaction with an advisory lock, followed by a migration-history entry. No existing profile, certificate, photo or other user row was updated or deleted.

Read-only metadata checks returned true for owner RLS enabled, private photo bucket, anonymous RPC execution denied, four authenticated owner-row policies, four owner-photo policies, anonymous table read denied, default-private visibility and migration version recorded. The RPC return type was confirmed as `TABLE(id uuid, agency text, level text, issued_on date, issued_at text)`, without number or photo path. No production user payload was selected or downloaded.

GitHub main was independently confirmed at 70dd8b7 before a non-forced fast-forward to accepted release 12e8fd7. The registered profile regression workflow had already been restored, with only the dedicated certificate regression added. No published history was rewritten.

Vercel production deployment https://vercel.com/ydpeng26s-projects/deepocean/FkZFmsevBvDUyJA7eKmbhXS7mcD3 showed Ready, Production, main/12e8fd7 and current www.supdiver.com (linking to supdiver.com). Navigating to https://supdiver.com/certificates while signed out correctly returned to the normal login page. Authenticated create/edit/photo/privacy acceptance remains the three recovery runs above; no real user's certificate was created or changed as a production smoke test. This release-record commit changes documentation only, not the accepted application.
