# PC forum interaction audit — 2026-10-22

## Scope

User approved continuing the PC inspection after production photo-privacy release. Diagnosis only: no application changes, schema changes, recovery website deployment, production release or human account edits. Passport community stats, saved-post integration and preview-only settings/share card remain deferred. Mobile is excluded.

Evidence: https://github.com/ydpeng26/deepocean/actions/runs/39748174297
Job 119721784847; script commit e40896f; application baseline 0893f6d unchanged.

PC Chromium at 1440x1000 on fixed recovery site `supdiver-recovery-test.vercel.app`, hardcoded Supabase project `esovqvampbrhuhamkfcs`. Only the recovery service-role secret is available. Two newly generated confirmed `example.invalid` accounts, generated names/posts/comments, no human mail or photo uploads. Browser production origins blocked. No screenshots, traces, media/database exports or downloadable artifacts.

## Verified passes

- Browser like/unlike persists; liked state survives reload.
- Browser bookmark/unbookmark persists; saved state survives reload; another account cannot read the bookmark.
- Browser follow/unfollow persists; followed state survives reload.
- Repeated UI reports produce one private report row; other members cannot read it. This is submission verification, not acceptance of an operational moderation/notification/resolution process.
- Ordinary comment submit persists and renders. A rejected write retains the draft; a normal retry succeeds.
- Own post UI edit persists; confirmed UI deletion persists and removes the card.
- Blocking an author hides their posts after reload; another account cannot read the block list.
- API checks deny another author's post edit/delete and comment edit.
- Both generated accounts were removed and verified 404; their forum posts/comments/likes/bookmarks/reports/blocks/follows were verified empty. No storage uploads were made.

## Seven reproduced observations — not fixed

1. Synchronous double activation of comment Send creates multiple rows. The comment button has no pending lock.
2. A comment committed before its response was replaced by a synthetic failure retained the draft, but retrying created a second comment. Comment insertion has no stable request ID/idempotent confirmation.
3. New text typed while the previous comment is pending is cleared by that earlier submission's success callback.
4. An unsent comment draft carries into a different post's comment dialog. Draft state is not keyed/reset by post.
5. Failed comment-list GET requests were displayed as “还没有回应。” rather than a load-error/retry state. The fixture uses terminal HTTP 400 to reach the React Query error state without additional PostgREST 503 retry delays; the source also lacks a commentsQuery.isError branch.
6. The current dialog has no own-comment edit/delete controls. Source confirms rendering only avatar/name/body. Existing backend owner UPDATE/DELETE policies do not make those actions available in the UI.
7. No visible unblock control exists on the forum after a block; source search found no implemented unblock operation or management UI. Preview-only account settings do not constitute a real management path.

The run finished successfully as a **diagnostic with seven observations**, not as a defect-free acceptance pass. The first two observations are one duplicate-comment problem with different triggers; the seven observations group into six user-facing problem categories.

## Limits and proposed next scope

Still outside this run: human moderator workflow, all social-toggle network/concurrency variants, every browser/keyboard/English case, full comment management UI (absent), and production authenticated writes. Do not mark the entire PC checklist complete.

Recommended repair order, subject to user approval: comment duplicate protection and ambiguous retry → preserve drafts during pending requests and isolate by post → comment load-error/retry → own-comment management → unblock management. These are separate from the deferred passport/preview features. Validate repairs on recovery and seek production approval separately.

The registered `recovery-profile.yml` was overridden only on this isolated audit branch for dispatch and then restored byte-for-byte to baseline. A dedicated manual-only `recovery-forum-interactions.yml` preserves the diagnostic procedure. Main and both websites remain unchanged.

## Authorized repair and recovery acceptance — 2026-10-22

The user approved repairing the six categories and updating recovery for validation, not production release. App commit `cc24cb9e9976edfc25ba1d0f7aa9e0e8009a92e2` contains the repair. No schema or permission changes were needed.

- Comment creation uses a stable request UUID with owner/post/body confirmation, including duplicate-key races and committed/lost-response retries. Changed payloads cannot silently reuse a previously committed request.
- A shared synchronous dialog lock covers create/edit/delete and disables text/close controls while pending. Failed operations retain their drafts; late completions after unmount do not write drafts or invalidate another mounted screen.
- In-memory creation drafts are keyed by account and post, retained when returning to the same post, never copied into another post. They are not persisted across a full browser reload or navigation away.
- Comment loading failures have an explicit error/reload state. A reload button is also available for verifying ambiguous submissions.
- Only one's own comments show edit/delete controls; deletion requires confirmation. API mutations filter by owner, post and comment and require an actual returned row, with account-change guards.
- A private blocked-diver panel offers reload and unblock. Names come from the existing authenticated public-summary RPC, not newly widened profile permissions. Unblock targets only the current user's own block row and requires confirmation from the returned row. Failure keeps the list visible and offers retry/reload; this restores forum visibility without changing follows.
- Added scoped bilingual controls/styles consistent with the existing forum. Deferred passport/preview features were not implemented.

Local verification: six groups in `scripts/forum-interaction-regression.mjs` passed, covering API lost-response/concurrent retries, changed payload/account rejection, owner-scoped actual-row checks, real dialog lock/draft/error callbacks and unmount guards. Existing 11 profile and six certificate groups passed unchanged. Production build and offline asset generation passed. Targeted ESLint reports no errors with the pre-existing API explicit-any rule excluded, and retains the existing preview useMemo dependency warning. Full TypeScript check still reports the previously recorded root/preview errors, not new comment/block module errors; do not claim global type/lint cleanliness.

The repair was promoted **only within Vercel project supdiver-recovery-test** to its fixed recovery domain. Native Vercel confirmed Ready / Production / `supdiver-recovery-test.vercel.app` / source cc24cb9. Recovery deployment: https://vercel.com/ydpeng26s-projects/supdiver-recovery-test/4ChPTKE3U943ym7btYP27PehKvmx . The Production label here is the test project's environment, not supdiver.com.

First repair run https://github.com/ydpeng26/deepocean/actions/runs/39763474564 (job 119773107530) passed all comment cases but stopped at blocked-author-name matching. The displayed username and short account ID share one element, so the test's exact-text username locator did not match. All fixture cleanup passed. This run remains incomplete, not an overall pass. Commit b9e39fa changed only the locator and stage diagnostics, not application code or test assertions about unblock behavior.

Complete acceptance run https://github.com/ydpeng26/deepocean/actions/runs/39764160935 (job 119775366524, runner b9e39fa, unchanged app cc24cb9) completed with **zero findings**:

- Like/bookmark/follow add/remove and refresh persistence; bookmark/report/block-list privacy.
- Ordinary comment submission and rejected-write retention/retry.
- Synchronous double-send persists one row; lost-response retry confirms one existing row without another INSERT.
- Pending input/close lock; per-post draft isolation and return-to-original-post retention.
- Comment read failure is not an empty state; reload restores actual comments.
- Own-comment edit/delete failure, retained edit draft, retry, reload, and no management controls for another account's comment; another account's comment survives owner deletion.
- Own post edit and confirmed delete remain functional.
- Blocking hides the author after refresh; unblock failure leaves the block intact, retry restores the author and persists after another reload.
- API outsider post edit/delete and comment edit remain denied.
- Both generated accounts and all dependent interaction rows were removed and verified absent. No media was uploaded.

The registered profile workflow is restored byte-for-byte to baseline 0893f6d. The dedicated manual-only interaction workflow now enables strict `FORUM_EXPECT_FIXED=true` assertions. No production branch promotion or authenticated production writes occurred; production remains at 0893f6d and awaits separate user approval. This acceptance does not cover moderator operations, every social-toggle failure variant, mobile, or the remaining PC modules.
