# Optional age and region

## User decision

Use date of birth to calculate age. Never publish date of birth. Region is optional free text (country/city, not street address). Both public switches default off and are independent. No minimum-age eligibility rule or mandatory profile-completion requirement was added.

## Implementation

- Owner-only profiles fields: birth_date, region, age_public, region_public. Existing RLS remains unchanged.
- get_public_diver_profile explicitly returns age only when opted in and region only when opted in. DOB and opt-in flags are never in its output. Signed-in active-account guard, fixed empty search path, no anonymous execution. Pending-deletion targets excluded.
- Age uses Asia/Shanghai calendar date, birthday boundaries and March 1 for leap-day birthdays in non-leap years. Supported optional DOB: 1900-01-01 through today. Region maximum 80 characters.
- Editor has independent optional fields and checkboxes, preview, pinned-baseline concurrency guards, draft-preserving image upload/cache refresh/failure behavior. Public diver page displays only server-projected fields.
- No changes to avatar/background semantics, existing data, account-deletion flow, production data or production deployment.

## Verification

- Local profile-regression.mjs passed, including birthday/leap-day/timezone/invalid-date boundaries; independent opt-ins/default privacy; draft retention; existing image/profile regressions.
- Production bundle build passed. Whole-project TypeScript check still reports existing literal-state errors only in forum-post-preview.tsx and profile-preview.tsx, no errors in changed files.
- Migration 20261028052942 applied only to recovery project esovqvampbrhuhamkfcs.
- scripts/profile-age-region-privacy.sql passed against recovery under the authenticated database role with two generated account fixtures: owner-only DOB, no cross-owner row reads/writes, both hidden defaults, each independent opt-in, hiding again, future DOB/oversized region rejection, no DOB in public RPC, anonymous execution denied. Entire fixture transaction rolled back.
- Independent metadata query: 4 existing profiles preserved, 0 synthetic accounts remaining, RLS enabled, all 4 added columns present.
- Security advisors before/after: no new findings; existing anonymous-definer findings decreased 4 to 3 by revoking anonymous profile RPC access. Existing unrelated findings remain (signed-in definer warnings 7; RLS/no-policy INFO 2; leaked-password-protection warning 1). Reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Current Supabase changelog and database-function privilege guidance reviewed. No SDK/dependency change needed.

## Release boundary

Recovery source committed with an explicit 10-file allowlist against current remote head 632994f: 280a0f38501685cd7208683d59a4c973e0fe6827. Ready preview deployment 9cEuF5QwmvUXWfDyttxqu9fjrYn7 (supdiver-recovery-test-coohuyrz7-ydpeng26s-projects.vercel.app), source 280a0f3, native UI verified. Promotion dialog verified only supdiver-recovery-test.vercel.app as destination. Promotion is now blocked by Vercel Reauthenticate / Send Code to Email; user must complete email verification. Stable recovery frontend and browser acceptance therefore remain pending. Formal main and production project were not updated.

Production feature release requires separate approval and the matching migration first. Do not publish the local historical branch wholesale: use a narrow file allowlist against the current remote head and preserve unrelated work.

## After user email verification

- Native Vercel UI confirms recovery Production deployment 4C4FuuVSXzxxrfpHyPfc8vdKM3xD is Ready, source 280a0f38501685cd7208683d59a4c973e0fe6827, built 2026-10-28 13:47 Asia/Shanghai, bound to supdiver-recovery-test.vercel.app. Generated domain supdiver-recovery-test-d2o0l3y0t-ydpeng26s-projects.vercel.app.
- Recovery /profile redirects to /auth because the browser is signed out. Closed only the blank recovery login tab and reopened it to allow the waiting service worker to update; existing formal profile tab left unchanged. Browser form acceptance requires the user to log into a recovery account. No existing profile values or visibility flags edited.
- Prior transactional permission tests remain valid; deployment Ready is not a substitute for signed-in browser acceptance. Formal website remains unchanged.

## Signed-in browser acceptance

- After the user signed into recovery, inspected /profile using native Chrome UI and a desktop screenshot. DOB/region fields render correctly; both visibility switches start unchecked; optional fields do not reduce the existing profile-completion score.
- Entered synthetic, unsaved DOB 2000-10-28 and a clearly marked temporary region. UI calculated 26 years on 2026-10-28. Age-only preview showed 26 without region; region-only preview showed region without age; enabling both showed both. Date of birth never appeared in the public-preview area.
- Did not click Save or change any persisted existing-user fields. Turned switches off, reloaded, and confirmed DOB/region empty, switches off, and prior display name, bio, certificate and tank count unchanged.
- This turn verifies signed-in field rendering and draft preview only. Persisted visibility enforcement/cross-owner access was verified separately by the rolled-back two-account authenticated SQL test above; not claimed as a new live two-browser save/reopen test.
- Recovery feature is ready for user review. Formal release remains pending separate approval.
