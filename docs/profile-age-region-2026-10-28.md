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

Recovery frontend deployment/browser acceptance still pending. Production feature release requires separate approval and the matching migration first. Do not publish the local historical branch wholesale: use a narrow file allowlist against the current remote head and preserve unrelated work.
