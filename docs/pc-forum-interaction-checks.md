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
