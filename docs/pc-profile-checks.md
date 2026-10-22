# PC profile editor fixes — 2026-10-22

Scope authorized by the user: fix the profile-editing defects found during the read-only PC review. Community statistics/saved-post integration remains untouched. Full certificate archives are still preview-only and are not added by this change. No production deployment or real account/database mutation was performed in this turn.

## Changes

- Hydrate editor fields once per account, not on every profile-cache update. Uploading an avatar or refreshing the same account cannot reset unsaved name, bio, certification or tank count.
- Use a synchronous shared guard for saving and avatar upload, disable editing during either request, and pass a captured payload/account ID to the mutation. Repeat activation cannot submit a second request in that editor.
- Mark only the row returned by the database as saved. A profile update affecting no accessible row fails explicitly. Failure retains the editor and allows retry.
- Reject an account mismatch before starting a profile/avatar update. Late mutation callbacks after editor unmount cannot repopulate another account's cache. The same-account token-refresh behavior is unchanged.
- Expose profile-query error/retry state. A failed or missing profile renders an error and reload action instead of an editable blank form. Missing-row initialization no longer ignores insert errors; a concurrent creation is read back.
- Validate tank count as a non-negative PostgreSQL integer before submission. The existing current-highest-certification field remains unchanged in scope.

## Verification

`scripts/profile-regression.mjs` executes the actual component callbacks/effects, hook and API helpers in isolated mocks. It does not use a browser, credentials, network, human data or a real database. It covers avatar success/failure and retries without losing text, same-account cache refresh, repeat saves and save/upload overlap, confirmed server values, save failure/retry, invalid tank counts, profile-load error/retry, late completion after unmount, missing-row save failure, expected-account checks and initialization errors/concurrent creation.

Targeted lint, the production build and offline-asset generation passed. The repository-wide TypeScript check still fails in the existing root error-component type and development-only forum/profile preview files; it reported no errors in the changed profile files. This is not a claim of a globally type-clean repository.

At the local-fix checkpoint, live recovery-site browser verification was still pending. No real user profile or photo was edited, and no community-statistics database function was added.

## Recovery-site browser verification — 2026-10-22

With explicit user approval, only the SupDiver-Recovery-Test canonical site was updated from the isolated `codex/pc-profile-recovery` branch. Vercel deployment `216CiXRPQZFKKdy2ovdSGahaB9HG` rebuilt application commit 7924166 in that test project's own Production environment (not the real deepocean project). The real site's `main` branch was not updated. The tested application files are unchanged between that deployment and the final test runner commit 1d9f1ee.

Successful complete run: https://github.com/ydpeng26/deepocean/actions/runs/39697300455 (job 119557697465, runner commit 1d9f1ee). The branch temporarily reused the registered `recovery-account-switch.yml` dispatch path to run `scripts/recovery-profile.mjs`, so the historical run/job UI names are not the test's scope. That temporary workflow override is restored before release; a separate manual-only `recovery-profile.yml` is prepared for future runs. Neither receives production database credentials.

PC Chromium at 1440x1000 verified actual UI and independent recovery API readback: initial profile-read failure shows an error without a blank editor; reload fetches the real row; uploading/decoding a generated PNG and displaying the signed stored avatar preserves unsaved name/bio/certification/tank count; upload and save controls lock while pending; an injected save failure retains edits and ignores extra button activations; retry persists the exact submitted fields without replacing the avatar; reload, Ocean Passport and authenticated public-profile views show the saved data; signout and fresh signin preserve fields and display the real stored avatar.

The disposable example.invalid account, its profile and all avatar objects under its exact UUID prefix were deleted and checked absent. No email was sent. No restored human account, photo or production record was modified, and no screenshots, traces, credentials or user payloads were downloaded to the workstation or published as test artifacts.

Earlier incomplete runs 39645782786 and 39696444725 remain recorded as incomplete, not passes, and both confirmed synthetic cleanup. The timeout was ultimately isolated to an exact-label selector for the certification dropdown (its label includes option text), before any avatar upload. Switching the fixture to the actual select element resolved the timeout without another application change. The first run did not have sufficiently granular stage names to identify that location.

Status: recovery-site acceptance passed for these profile scenarios; real-site release still requires user authorization. This does not establish every image format/size, every browser, cross-tab concurrency or full certificate-archive functionality. Community statistics/saved-post issues remain unchanged as requested.
