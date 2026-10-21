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

Pending: live recovery-site browser verification with disposable fixtures, followed by a separately authorized release. Save/reload/login persistence, actual photo decoding/storage and cross-browser acceptance have not been established by these local source-level tests. No real user profile or photo was edited, and no community-statistics database function was added.
