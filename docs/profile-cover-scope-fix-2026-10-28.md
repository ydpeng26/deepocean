# Personal cover must not replace the website background

## Diagnosis and scope

User reported a personal homepage background image appearing across the webpage. Confirmed the uploaded image URL was applied to the outer do-profile-page and do-passport wrappers, in addition to the intended profile cover/upload previews. This was a rendering-scope mistake, not an upload/cache failure.

## Fix

- Removed only the two dynamic wrapper background styles; restored existing stylesheet site backgrounds.
- Passport no longer consumes the resolved personal cover URL in its render function.
- Profile upload thumbnail and public-profile cover preview retain the saved personal image. Avatar, optional age/region controls, upload/storage paths and saved image references are unchanged.
- No Supabase schema/data/policy changes. No existing-user edits, image uploads or deletions.

## Verification

- Added regression supplying a synthetic resolved image URL to the actual profile component. It failed on the original wrapper background before the fix, then passed with the image still present on both intended cover previews.
- Added an AST check that the passport wrapper has no inline background override.
- Existing profile regression suite passed, including independent image operations, draft retention, concurrency, optional age/region and privacy toggles.
- Updated the recovery cloud-browser regression expectations: covers must show/decode the image, profile/passport wrappers must not contain uploaded storage image URLs. This revised cloud test has not yet been run for this fix.
- Local production build pending completion; recovery deployment/browser verification pending. Formal release requires separate approval.

## Release safety

Publish only these files against the live recovery branch: two route files, profile-regression.mjs, recovery-profile-background.mjs and this report. Do not push the stale local branch or unrelated dirty files, screenlog.0, capacity code or production data.

## Current verification and release status

- Local production build completed successfully. Whole-project TypeScript check reports only the existing unrelated literal-state errors in forum-post-preview.tsx and profile-preview.tsx; no errors in the changed routes.
- Published exact five-file recovery commit de703557cbc3b1200390963a033ccb0fda552af0 (parent 280a0f3), tree 4dcb299b6cb20b49e2270cd4b7e844abd80f0ae0, using expected-head fast-forward. Diff independently checked before branch update.
- Native Vercel recovery-project UI shows preview deployment 9AAErqDeZY1KY4aS81KMEZQ2ycdN Ready, source de70355, built 2026-10-28 15:30 Asia/Shanghai, generated URL supdiver-recovery-test-3uzrfznn1-ydpeng26s-projects.vercel.app.
- Attempt to open Promote to Production was rejected by safety review because this particular stable-recovery promotion lacks explicit user authorization. No retry or alternate publishing path used. User approval needed to promote only supdiver-recovery-test.vercel.app; existing stable recovery domain and formal www.supdiver.com have not been changed by this fix.
- Live fixed-version signed-in browser/cloud acceptance is pending promotion approval. Code-level regression/build passed; do not claim live acceptance complete.

## User approved stable recovery promotion

- User explicitly approved promotion after the safety-review handoff. Native promotion dialog verified exact source de70355 and only supdiver-recovery-test.vercel.app as alias target.
- Clicked the authorized Promote to Production button. Vercel now shows Reauthenticate / Send Code to Email. User must complete the email challenge themselves; do not request or read their verification code. No successful promotion or live acceptance claimed yet. Formal site remains unchanged.

## After email verification

- Native Vercel UI confirms recovery deployment 8eSVTGCQD7a7We5VTpaG9uGZftKo Ready / Production, exact source de703557cbc3b1200390963a033ccb0fda552af0, bound to supdiver-recovery-test.vercel.app. Generated domain supdiver-recovery-test-1oeqhiq6y-ydpeng26s-projects.vercel.app; built 2026-10-28 15:41 Asia/Shanghai in 17 seconds.
- Opening recovery /profile redirects to /auth (signed out). Closed only the blank recovery login tab and reopened it to allow the waiting service worker to activate. No formal tab or user data changed. Signed-in visual acceptance awaits the user's recovery login.
- Native browser confirmed the reopened login page is available with no waiting-update banner. Separate unauthenticated Node public-asset verification failed with a connection timeout and is not counted as passed; native deployment/source verification and prior local regressions/build remain the verified evidence.

## Signed-in visual check after recovery login

- Inspected recovery /dives and /profile through native Chrome UI, including desktop screenshots and scrolling to the profile's public-cover preview. Both outer pages retain the original dark-blue site background; the cover/upload preview areas remain intact, with the existing cave fallback illustration visible.
- Existing avatar, name, bio, certificate, tank count, optional age/region controls and page navigation still display normally. Did not click Save, upload an image, change a privacy switch or edit any existing-user fields.
- Scope: current-account read-only visual check plus the earlier regression with a synthetic resolved cover URL and successful build. Did not claim a new live upload/reload or disposable-account cloud run for this fix; the revised cloud regression has not run. The default-image screenshot alone is not proof of a saved custom-image upload path.
- Recovery fix is ready for user review. Formal website remains on d505da4 and has not received this cover-scope fix; separate formal release approval required.
