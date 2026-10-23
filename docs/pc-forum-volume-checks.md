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

## Authorized repair in progress

The user asked to start the repair. No new database function, schema, permissions, production data or SMTP configuration is required for this version.

- `completeForumRows` reads stable unique-key ordered batches of 500 with exact counts. Every batch rechecks the account. Changed counts, missing totals, duplicates, an unexpectedly short batch and any later-page error reject the entire result. This preserves fail-closed private-state behavior instead of returning a partial block list.
- Posts, bookmarks, follows, blocks, own likes, comment lists and block management use complete reads. Embedded like/comment aggregates provide counters rather than loading each liker/comment ID into the feed. Own like state comes from the owner's complete relation list.
- Posts are ordered by creation time and unique ID after complete reads. Comments use creation time and ID in ascending order. Search/topic/follow filtering now sees the complete fetched dataset.
- PC render windows: 40 posts, 50 comments and 50 blocked entries initially, with bilingual explicit next-window controls. Search/topic/feed/account changes reset the post window. Signing requests are bounded to 100 paths; public-profile summary RPC concurrency is at most five.
- This is a bounded complete-read repair, **not unlimited server-filtered pagination**. Each query has a 20,000-row safety ceiling and fails explicitly above it instead of silently truncating or allocating without limit. Initial network reads still fetch the complete bounded dataset before displaying it. A much larger forum should migrate to server-filtered pagination; this version does not claim arbitrary-scale or concurrent database snapshot consistency. Exact-count and duplicate detection catch common in-flight changes, not every equal-count replacement.
- New local `forum-volume-regression.mjs`: actual API module with 1017 synthetic posts/bookmarks/follows/likes/blocks, exact aggregates and complete 1005 comments; every later-page failure, account switch, changed/missing count, duplicate and short response rejects; block management includes tail entries with bounded concurrency; 20,001 rows safely reject. Existing social and comment mutation regressions still pass, including an added actual-dialog 50/100/105 rendering test.
- Targeted lint has no errors with the pre-existing API explicit-any rule excluded; the pre-existing preview useMemo dependency warning remains. Build passes. Whole-repository TypeScript still has the previously documented root and preview errors, not errors in the changed repair modules.
- Recovery browser script has a strict `FORUM_VOLUME_EXPECT_FIXED=true` branch checking old-post search/follow filters, 40→80 feed rendering, tail bookmark correctness, all 1005 comments through 50-row windows, and later bookmark-page failure/retry. **This strict cloud acceptance has not run yet.** The historical `forum-volume-diagnosis.mjs` preserves old failing counterexamples; use the new regression script for this repair.

The user explicitly approved updating the fixed recovery test site only. Production release still requires separate approval after recovery acceptance.

## Recovery deployment and acceptance attempt — 2026-10-23

- Repair application: `0ca313a7939ff2ea17b6ffa553ef2cff78d3bac2`; temporary runner workflow commit `d45a3b6468f6146e0c85d0741acad2d1f5ca253f` has no application differences.
- Native Vercel verified **Ready / Production environment of supdiver-recovery-test only / supdiver-recovery-test.vercel.app / source d45a3b6** at https://vercel.com/ydpeng26s-projects/supdiver-recovery-test/2dbECdsGwxFfquDsB4Ydf8Bc1qq3 . Formal supdiver.com was not promoted.
- First strict attempt https://github.com/ydpeng26/deepocean/actions/runs/39888035438, job `120200753657`: feed 40→80 window, old-post search, following filter and tail bookmark correctness passed. Comment stage timed out; **this is an incomplete run, not acceptance**. Three temporary accounts and dependent generated rows were cleaned and verified absent.
- Bulk fixture comments originally shared insertion timestamps within each batch. The repaired API deliberately uses ID as a deterministic tie-breaker, so comment number 0 need not appear in its first 50-row window. Runner-only commit `1a6081000780a9bbfe5ae6001adee5cbd7e3ccdb` gives generated comments distinct timestamps and finer stage labels; application source is unchanged. It also explicitly checks the feed's aggregate comment count of 1005. This corrects a fixture-order assumption, not the already deployed application.
- Fresh dispatch of the new runner: https://github.com/ydpeng26/deepocean/actions/runs/39890309437 . Results pending; do not infer success from the prior partial checks.

## Strict recovery acceptance completed

- Second attempt above, job `120208207944`, passed all 1005 comment windows and exact feed count 1005, then timed out waiting for the injected second-page HTTP 503 failure. Inspection of installed PostgREST code confirms default three 1/2/4-second retries for 503, stacked with React Query retries. That exceeds the test's 30-second wait. It remained **incomplete**, with all three exact temporary accounts and dependent rows cleaned.
- Runner-only `13915208717c9ddf74632dd5a9a1c5ed29a7e562` uses a definite HTTP 400 read rejection and verifies the second-page route was actually intercepted, rather than stacking retry policies. This checks definite later-page failure, not the exact user-visible timing for prolonged transient 503 outages. No application changes were made for either test correction.
- Final run: https://github.com/ydpeng26/deepocean/actions/runs/39898310425 ; job `120233776342`, **completed success**. Both the strict volume runner and the previous strict interaction runner returned `AUDIT: complete=true findings=0`.
- Real recovery desktop volume: 1006+ posts, 1006 bookmarks, 1005 comments; initial 40 posts and explicit next 40; old-post exact search and following filter; tail bookmark remains saved; exact aggregate comment total 1005; all 1005 comments reachable in 50-row windows, next control disappears only at actual end; second bookmark page failure hides all feed cards and explicit retry restores the feed.
- Existing interactions: failed bookmark/follow/block reads hide the feed; like/bookmark/follow pending double-click and rejected/lost add/remove reply retries remain correct; normal add/remove/reload persistence, private bookmarks/reports/blocks, comment create/draft isolation/double-submit/ambiguous retry/edit/delete/load-failure, own post edit/delete, block/unblock and outsider write denial all passed.
- Three volume and two interaction disposable accounts were deleted, exact account absence and dependent generated-row absence checked. No email, photo export, human production fixtures, permission/schema changes or production promotion occurred.
- Local 1017-row follows/blocks/private-list boundary tests remain simulation, **not** mass-account cloud acceptance. The 20,000-row safety ceiling and complete bounded initial fetch limitation are unchanged. This is not arbitrary-scale or cross-browser/mobile acceptance.
- Fixed recovery deployment remains the already verified source `d45a3b6` at https://vercel.com/ydpeng26s-projects/supdiver-recovery-test/2dbECdsGwxFfquDsB4Ydf8Bc1qq3 ; `git diff 0ca313a HEAD -- src` is empty before recording this result. Test-only commits changed no deployed application code.
- Temporary registered interaction workflow restored byte-for-byte to main's original definition. Dedicated manual volume acceptance workflow remains. Main/production must remain at `99147cfc0c40f0ab1071005eae20d61ad66c21d8` until separate release authorization.

## Authorized production release — 2026-10-23

The user explicitly requested this tested repair be released to the formal site. Rechecked remote main `99147cfc0c40f0ab1071005eae20d61ad66c21d8`, isolated branch `366efda18e9337840d56945caccb76f7b97b4ab0`, and successful strict cloud run `39898310425`. Application diff from tested `0ca313a` is empty. Database migrations, backup workflow and original interaction workflow are unchanged. The three local volume/social/comment regression scripts were rerun successfully.

Main fast-forwarded using expected-old-SHA guard, without force, from `99147cf` to `366efda18e9337840d56945caccb76f7b97b4ab0`; remote main was re-read and confirmed. This automatically triggered the correct formal project's production build, so no extra manual promotion or rebuild was needed.

Native Vercel verified **Ready / Production / Current / www.supdiver.com / main / source 366efda** at https://vercel.com/ydpeng26s-projects/deepocean/Gkn8z3FCqgVrMEhazHBX31yrHiUn . The formal domain points to this deployment. Native signed-out `https://supdiver.com/forum` correctly redirects to `https://supdiver.com/auth` and renders the email/password login form and forgot-password control.

No authenticated production fixture, user-content mutation, SQL/schema/security change, email or photo export was performed as a release test. Stateful acceptance remains the isolated recovery evidence above, not a claim of production-account end-to-end writes. The documented 20,000-row safety ceiling, simulated thousand-account relation coverage and deferred PC/mobile tasks remain unchanged. This documentation-only release record stays on the isolated branch; formal application main remains the verified `366efda`.
