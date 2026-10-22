# PC forum social-state resilience — 2026-10-23

After the authorized dive-log production release, the user asked to continue the remaining PC modifications. This scope supplements ordinary like/bookmark/follow acceptance; passport counters, saved-post integration, preview-only features and mobile remain deferred.

Source-confirmed defects: `listForumPosts` previously ignored bookmark/follow/block read errors and treated failed private queries as empty sets (including failing open on blocked authors); live cached feed remained visible on query errors. Social buttons had no synchronous mutation/refresh lock. Add retries used unconditional INSERT, so committed-but-lost add replies subsequently failed with duplicate-key errors. Existing composite primary keys already prevent duplicate relationship rows; this is a retry/confirmation problem, not evidence of duplicate likes being stored.

Repair: require all feed/private-state reads to succeed; recheck account before returning; hide live feed on errors and provide bilingual retry. A synchronous owner-aware action hook locks through refresh, ignores stale/unmounted completion, and disables social buttons while pending. Like/bookmark/follow retain their desired state across retries: duplicate-key add and no-row removal are accepted only after an owner-scoped read confirms the requested presence/absence. Definite errors remain errors; no existing relationship is automatically removed or recreated outside user actions. No schema/permission changes.

Local synthetic tests: `scripts/forum-social-regression.mjs` covers each failed private read, block filtering, changed account, all three relation add/remove lost replies and retry/race cases, missing mutation confirmation and actual action hook lock/late completion. These pass, as does the earlier forum interaction regression. Production build passes; targeted lint has only the existing preview useMemo dependency warning when pre-existing API explicit-any is excluded.

Cloud strict acceptance is pending. The recovery-only interaction script now additionally injects private-state read failures and rejected/committed-but-lost relation writes using fresh disposable accounts; no human posts/media/mail/credentials are involved. Production remains the authorized dive release `d4a3922`, not this new social repair. A separate production approval will be requested after recovery acceptance.

## Recovery acceptance completed — 2026-10-23

- App and runner: `8e7da8830efcf1b9dfa875c89c899c9170d0bf42` on isolated `codex/forum-social-resilience`.
- Native Vercel verified Ready / Production environment of **supdiver-recovery-test only** / fixed recovery domain / source `8e7da88`: https://vercel.com/ydpeng26s-projects/supdiver-recovery-test/xPrmWUGyLXA4j9YLAnTm7GsWYC7V . No security or database settings were changed.
- Strict cloud run https://github.com/ydpeng26/deepocean/actions/runs/39820750117, job `119971840892`: completed success, `AUDIT: complete=true findings=0` with both `FORUM_EXPECT_FIXED` and `FORUM_SOCIAL_EXPECT_FIXED` enabled.
- Each failed bookmark/follow/block read hides the feed instead of presenting empty private state; the in-page retry restores the feed. No cached target post remains visible in the failure state.
- For likes, bookmarks and follows independently: definite rejected write leaves no relation; synchronous double-click issues one mutation; controls are disabled while pending; committed/lost add-response retry confirms exactly one existing relation; committed/lost remove-response retry confirms absence; final UI state persists after reload.
- Previous normal like/bookmark/follow, private bookmark/report/block visibility, duplicate report, comment draft/duplicate/ambiguous retry/edit/delete/read failure, own-post edit/delete, block/unblock failure and retry, and outsider write denial all pass unchanged.
- Both generated accounts and every dependent generated forum interaction row were removed and absence verified. No media upload/export or email was used. No authenticated production writes were made.
- Local dive/profile/certificate regressions also pass. Full TypeScript checking still has the previously documented root and preview-page errors, not new errors in this repair.

Production remains at authorized dive repair `d4a3922` (main rechecked), and native signed-out production `/dives/logs` correctly redirects to `/auth`. The social repair awaits separate production confirmation. This is targeted recovery PC Chromium acceptance, not every concurrent cross-device social toggle, moderator procedure, large-feed/private-state pagination, all browsers/keyboard/English cases, mobile or the deferred passport/preview features.
