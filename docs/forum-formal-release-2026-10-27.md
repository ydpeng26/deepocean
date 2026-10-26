# Approved formal forum visibility / community release

Date: 2026-10-27 (Asia/Shanghai). User explicitly approved formal release after recovery database-role tests and authorized native Chrome acceptance with exact synthetic cleanup.

## Source and deployment

- Prior formal main: `7107a7ca5050d990604aaa431b32aee5ed5365d4`. Prior Ready deployment `8D2SgWS5SJuYa3y6vcvLc4qs5mXL` is the website rollback reference; do not drop the visibility column or delete real messages/posts if reverting website code.
- Accepted functional source: `f3a5d67b2bd29d2e83fe300e1f9d233f3e30626f`, recovery Ready deployment `3vZ1nZV6CFDLztrPNUohiEwneFtd`.
- Formal release: `1b214971e14d737be4a146b72df541f3865742a2`, adding acceptance documentation only to that functional source. Verified zero src/public/migration drift and byte-identical formal workflows before release. Explicit release-path allowlist and repeated main-ref checks passed. Dirty screenlog.0 and the earlier local contact-release documentation were excluded.
- Main was advanced by non-force fast-forward only after backend migration and permission readback succeeded. No published history was rewritten.
- Vercel `deepocean` deployment `D7WHsu1rfRosF1JnXSjaJQjJnbE1` is Ready / Production / Current, source 1b21497 on main, bound to www.supdiver.com. Native Vercel UI confirmed these fields. Generated domain: `deepocean-501cydtki-ydpeng26s-projects.vercel.app`.

## Formal backend

Applied the tested source `supabase/migrations/20261026164204_forum_visibility_community.sql` only to formal project `zmhtlhpeulhhcvlnjdrb`, with transaction-local lock/statement timeouts. The migration service recorded version `20261026173022` / `forum_visibility_community`; recovery recorded `20261026164830`. Compare name/content mapping rather than blindly reapplying source filenames via CLI.

Existing posts default to public; no existing post body, profile, like/bookmark relation, Auth setting or password was changed/deleted. New restrictive parent-visibility policies, storage read restrictions and own-total aggregation match the recovery-tested SQL.

Readback confirmed non-null visibility with public default, all five restrictive boundaries, anon stats EXECUTE denied, authenticated stats EXECUTE allowed, SECURITY INVOKER public wrapper and empty-search-path private aggregate. The narrowly scoped private SECURITY DEFINER aggregate returns only auth.uid()'s totals without exposing bookmark identities. Security advisor comparison retained the same pre-existing finding counts and added no feature-related finding; not a global security-clean claim.

## Post-release verification and limits

Read-only HTTP verification of www.supdiver.com inspected 66 public JS assets in memory and passed: formal-only backend client, bilingual visibility selector, My posts tab, real community stats RPC, saved-page bundle and permission-aware saved copy. No key export, formal login, synthetic production post/account, or production write smoke was performed in this release turn. Recovery native acceptance and database role tests remain the write-path evidence; no formal end-to-end write claim is made.

Old browser tabs/PWA installations may need their normal save-close-reopen update flow. New image URLs last 60 seconds, but previously issued legacy one-hour URLs remain valid until expiry; previously downloaded content cannot be revoked. Stats/feed refresh on mount/focus and bounded polling, not realtime push.
