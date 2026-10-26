# Post visibility, passport statistics and saved stories

## Behavior

- Existing posts retain `public` visibility (signed-in forum members, not anonymous visitors). Create/edit supports `private` / Only me, preserves optimistic revision checks, and includes visibility in exact-payload create retries. Legacy editors omitting visibility preserve it.
- Database RLS denies other members private posts and their comments, likes and bookmark rows, including direct queries/writes and embeds. Parent constraints supplement ownership policies. Storage SELECT requires ownership or an accessible public post referencing the owned photo path. Reports on inaccessible posts cannot be inserted.
- Authors find private posts in My posts with an Only me badge. Sharing is disabled for them. Feed refresh stops rendering an open response dialog for an inaccessible/deleted post. Previously viewed/downloaded content cannot be revoked.
- Passport likes/saves count other users' interactions on the caller's public posts; self-likes/self-saves are excluded. Followers count current following relations. Private posts' historical interactions are retained but excluded until republished; deletion cascades remove interactions. No forum-wide user count is introduced.
- Public stats RPC is SECURITY INVOKER with no target-user parameter. A narrow SECURITY DEFINER aggregate is confined to non-exposed `supdiver_private`, requires auth.uid(), has empty search_path, and returns only the caller's three totals. This deliberately aggregates received saves without widening bookmark row visibility or exposing who saved which post. PUBLIC/anon execution is revoked. Unrelated definer functions are unchanged.
- Passport saved cards/count and `/saved` share complete account-guarded forum data. Inaccessible, deleted and blocked-author posts are excluded. Hidden saves reappear if republished; unsaving removes them. This reuses the 20,000-row safety ceiling, not a new large-scale pagination implementation.
- Queries are owner-keyed, refresh on mount/focus and every 45 seconds while active, and hide stale content/totals on read errors instead of a misleading zero. Interactions invalidate forum and community-stat queries. This is bounded polling, not realtime push.
- New signed image URLs last 60 seconds. Legacy one-hour URLs remain valid until expiry; already loaded/downloaded images cannot be revoked. Wait out legacy expiry before claiming the new one-minute bound. No immediate-revocation promise is made.

## Recovery-only evidence

CLI-generated source migration: `20261026164204_forum_visibility_community.sql`. Applied only to `esovqvampbrhuhamkfcs`; migration service recorded `20261026164830` / `forum_visibility_community`. Do not blindly reapply the differently versioned source file via CLI; compare name/content mapping first. Formal backend `zmhtlhpeulhhcvlnjdrb` is untouched.

`scripts/recovery-forum-visibility-transaction.sql` runs inside BEGIN/ROLLBACK with two collision-checked synthetic Auth IDs (no password, email or session), three synthetic post IDs and rolled-back storage metadata (no file upload). The initial live run passed owner/private creation, foreign private reads/writes denied, storage metadata permissions, bookmark identity privacy, self-exclusion, account-isolated statistics and private/republish transitions. The later extended cancellation/deletion test hit MCP `Invalid or expired requestState` twice; it is NOT marked passed, and no alternative mutation tool was used to bypass this failure. Only fixture records are queried. Separate absence checks after both failed reruns confirmed zero fixture users/posts/objects. Removal/deletion linkage remains pending live acceptance.

`scripts/forum-visibility-regression.mjs` executes actual library and passport components using in-memory clients: visibility create/edit/retry, preservation by legacy editors, filtering before signing, 60s URLs, owner guards, malformed/error stats and saved/error rendering. Existing local suites also pass. Production build succeeds. Whole-project TypeScript still reports eight pre-existing literal-state type errors in forum-post-preview/profile-preview; no new errors from this feature. Existing explicit-any lint debt in forum.ts is not represented as clean.

Advisor comparison added no findings for this feature. Existing unrelated advisories remain, including legacy exposed definer functions and Auth configuration; not a global security-clean claim.

## Release boundary

Formal deployment/schema changes are not part of this implementation step. Recovery browser acceptance must be verified separately; local models and role tests are not browser end-to-end acceptance. Before eventual formal publication, apply this exact migration to formal before serving code requesting visibility or stats. Do not drop data-bearing columns/tables as a website rollback.

## Recovery deployment / browser handoff

Source `f3a5d67b2bd29d2e83fe300e1f9d233f3e30626f` was non-force published only to `codex/pc-layout-keyboard-audit`. Vercel recovery preview `F6DeRukYY4aaEs4DfTFiF744Cp3G` was Ready, then rebuilt using recovery Production environment as `3vZ1nZV6CFDLztrPNUohiEwneFtd`, Ready and bound to `supdiver-recovery-test.vercel.app`; generated host `supdiver-recovery-test-kxoyu4ys1-ydpeng26s-projects.vercel.app`. The promotion dialog explicitly named only the recovery domain. Formal main/site was not changed.

Read-only online verification read 66 public JS assets and confirmed recovery-only client backend, bilingual visibility control, My posts tab, real stats RPC, saved route bundle and permission-aware saved copy. All 38 local regression suites and production build/offline asset generation pass. Targeted new-component/page lint passes; whole-project type debt remains as above.

Opening recovery `/forum` in a new Chrome tab redirected to `/auth`; no login was attempted, no password entered, and no existing form/tab was closed. Browser displayed a waiting service-worker update. User handoff requested saving any recovery drafts, reopening recovery tabs to activate the new version, then signing into their test account. Full browser acceptance and live cancellation/deletion linkage remain pending that handoff. Final fixture absence query again returned users=0, posts=0, objects=0.

## Subsequent authorized native Chrome acceptance

The user logged into recovery and separately authorized creating and cleaning one disposable test post under that test account. Only that synthetic content was changed; existing profile, dives, gear and any pre-existing forum relations were untouched. No password was read/entered/saved, no account was created and no email was sent.

- Native UI confirmed the new statistics guidance, My posts tab and dedicated `/saved` entry. One post titled `临时验收 VIS-20261027-0115` was created with Only me selected. Receipt ID was `9c9e3323-b8f8-45e5-a575-9aeba21aa070`, identified by exact synthetic title/body and the author shown in the UI. It appeared in My posts with Only me badge and Share disabled; editing retained its visibility.
- Saving it changed passport saved count from 0 to 1, produced its real card, and the card opened `/saved#post-<receipt>` containing that exact post. Unsaving removed it and returned the passport count to 0.
- Editing private to public persisted in a metadata query and reopening the editor; Share became enabled. Like count went 0 to 1, then cancelling the like returned it to 0. Saving/liking again left exactly one own bookmark and one own like on the fixture, independently confirmed by a receipt-restricted metadata query.
- Switching public back to private persisted and restored the Only me badge/disabled Share. The author still saw their own saved private post (correct owner access). Passport community totals remained 0, excluding self-interactions. English labels/guidance/cards rendered correctly; original Chinese was restored.
- The fixture alone was deleted via its native post menu and explicit confirmation. An independent database query restricted to its receipt confirmed posts=0, likes=0 and bookmarks=0. Passport saved count returned to 0 and its card disappeared. This completes actual browser save/unsave, like/unlike, visibility editing and delete-cascade linkage rather than relying on the previously failed extended SQL transaction.

Cross-account privacy and positive other-user totals are covered by the earlier rolled-back database role tests, not by a two-account browser session in this turn. Unfollow in the extended SQL script remains not executed successfully; no existing follow relation was changed. No real photo was attached, so no new signed-image delivery/expiry browser claim is made. Formal backend/site remain unchanged and require a separate release approval.
