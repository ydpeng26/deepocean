# PC forum volume diagnosis — 2026-10-23

Scope: next item in the agreed PC checklist, after the marine-help production synchronization. Diagnosis only; no application/schema/security/SMTP/production-data changes. Mobile and the three deferred passport/preview groups remain out of scope.

## Source inspection

`listForumPosts` reads one unpaginated batch of posts, bookmarks, follows and blocks. Search, topic and following filters only operate on this returned batch. There is no user-accessible next-page control. Failed private reads correctly reject the feed (previous repair preserved), but successful truncated reads look complete. Blocks are filtered client-side after reading posts. `listBlockedForumAuthors` and `listForumComments` also read one batch without completeness checks. Like/comment feed counters use embedded arrays; their large-volume accuracy has **not** been independently accepted by this audit.

## Actual recovery desktop browser evidence

- Runner commit: `3c86401324972492a3e57a20ee8925062c0afcb9`, isolated `codex/forum-volume-audit`.
- Run: https://github.com/ydpeng26/deepocean/actions/runs/39836448604 ; job `120025943076`.
- Recovery app was unchanged at the already tested marine-help source `185b371`; production app source `99147cf` has the same forum implementation. This audit does not infer a production API configuration from a recovery measurement.
- Generated three confirmed disposable `example.invalid` accounts, 1006+ synthetic text posts, 1006 bookmarks, 1005 comments and one follow. No mail or media. Account IDs stay in cloud memory except exact cleanup failure diagnostics if needed. No traces, screenshots, stored sessions, database files or artifacts were exported.
- An old generated post is independently readable by the same authenticated user under RLS, but missing from the PC feed. Searching its exact unique title returns no card.
- The owner's exact bookmark count is 1006. A target absent from the returned private batch was moved into the first feed page without changing the bookmark. Its card incorrectly shows unsaved; an exact owner-scoped query confirms the bookmark still exists.
- Exact comment count is 1005. The dialog renders 1000, while an authenticated offset-1000 query independently reads the remaining five. No next page is exposed.
- Logs: `AUDIT: complete=true findings=4`. **Success/green means the diagnostic run and cleanup completed, not that the product passed.**
- All three exact generated accounts were deleted, 404 verified, and their authored posts/comments/bookmarks/follows were independently checked absent. Deleting these intentionally disposable fixtures does not delete or restore human recovery/production records.

## Local synthetic boundary evidence

`scripts/forum-volume-diagnosis.mjs` transpiles and calls the actual `src/lib/forum.ts` with generated rows and a simulated server cap of 1000. It reproduces truncated feed/comments and omitted bookmarks/follows. When a blocked author lies beyond the private response cap, the real function fails to exclude that author's post and the block-management list omits that entry.

The follows/blocks cases are **simulated capped-response counterexamples**, not 1000-account real-cloud acceptance. Three cloud accounts were deliberately used instead of mass-creating over a thousand accounts. Large like counts, embedded counter accuracy, thousands of real follows/blocks, concurrent changing-page consistency and browser responsiveness across all PC browsers remain unverified.

## Handoff

No fix has been implemented or deployed. Proposed repair needs complete bounded reads or server-side filtered pagination, stable ordering, actual completeness/error handling for private state and comments, and preservation of prior account-switch/fail-closed/social-retry protections. Do not merely raise the server row limit or load unlimited rows into the DOM. A repair should first pass isolated recovery acceptance and obtain separate production approval.

The existing registered `recovery-forum-interactions.yml` was temporarily pointed at the diagnostic runner **only on this isolated branch** for the pinned run. It is restored byte-for-byte to its starting version afterwards. A dedicated manual-only `recovery-forum-volume.yml` preserves the diagnosis for future use. Neither is a scheduled production workflow. The current diagnostic script expects the known counterexamples; a repaired product requires an updated strict acceptance script, not interpreting this diagnosis as a passing regression test.
