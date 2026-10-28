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
