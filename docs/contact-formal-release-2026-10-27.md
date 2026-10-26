# Contact/form/signup presentation formal release — 2026-10-27 (Asia/Shanghai)

## Authority and source

The user explicitly approved formal website release including the new private inbox tables and public guest submission interface. Existing user data, passwords and Auth settings are not to be changed. Source is the recovery-accepted app, including the subsequent user-requested footer copy deletion. The application src/public tree is unchanged from `6d182d6a6d360ff32a82078652a5324083a16c8d`. The complete recovery run `40354576704` passed at source `8689b50819b73739cfe00ab7a5e97e10ab09b65b`; only the reviewed copy deletion followed in application source. Thirty-seven local suites pass again.

Formal baseline main is `b53dc10c9f27cb194fed1e806ca170143df47a0e`; Vercel `deepocean` deployment `88PefMbG5DpApabyZovy7HfAmafg` is Ready/Production/Current and holds www.supdiver.com. Keep it as the known prior website version. Do not roll back/delete message tables if a later website rollback is needed: new real messages may already exist. Recovery-specific changes to the manual member-safety workflow have been restored byte-for-byte to formal baseline before release.

## Formal backend preparation

Read-only metadata confirmed formal Supabase `zmhtlhpeulhhcvlnjdrb` (dashboard name DeepOcean-Staging) ACTIVE_HEALTHY; both target tables and the guest function were absent. This is the actual formal backend, not the recovery project. Applied only the two new table/permission/function migrations; no existing tables, records, buckets or authentication settings were edited.

The migration service generates application-time versions independently per project. Formal history maps `20261026162132` / website_feedback to source `supabase/migrations/20261026135542_website_feedback.sql`, and `20261026162139` / guest_contact_messages to source `supabase/migrations/20261026152628_guest_contact_messages.sql`. These statements were already applied; do NOT blindly reapply the recovery-named version files on formal based on a CLI “pending” list. Check name/content/version mapping or perform an explicitly reviewed history alignment before future CLI migration automation. No migration history row was rewritten in this release.

Formal metadata confirms both tables have RLS; anon cannot SELECT or INSERT either table; authenticated roles cannot UPDATE/DELETE either, and cannot SELECT guest messages. The member-feedback table retains its owner-only SELECT/INSERT policies. No general browser SELECT/INSERT or public RPC permission is opened for guest messages.

`guest-contact` formal Edge function v1 is ACTIVE, deliberately public to accept login failures. The reviewed source now maps its server-provided SUPABASE_URL to an exact deployment website allowlist: formal project permits https://www.supdiver.com and https://supdiver.com only; recovery permits only https://supdiver-recovery-test.vercel.app. Unknown deployments fail closed. Requests cannot choose a backend and recovery Origin cannot invoke the formal deployment. Actual-handler models verify formal canonical/apex CORS and fixed formal RPC/key forwarding, recovery/formal isolation and unknown-project rejection. Server secret stays on the Edge server. The existing recovery function deployment is untouched.

This deployment mapping is the only functional server-source change beyond the accepted recovery implementation. The browser app and all database/abuse checks are unchanged. Changelog Markdown fetching again rejected its content type; current Supabase function configuration docs and skill security checklist were consulted.

## Released and read-only verified

- Main was non-force fast-forwarded from the known baseline to `7107a7ca5050d990604aaa431b32aee5ed5365d4`, after rechecking unchanged main, exact source/migration equality to the accepted app, byte-identical formal workflows, and the successful recovery run/job metadata. No published history was rewritten; screenlog.0 was excluded.
- Vercel `deepocean` deployment `8D2SgWS5SJuYa3y6vcvLc4qs5mXL` is Ready / Production / Current, source `7107a7c`, bound to www.supdiver.com. Native Vercel UI verified both old rollback baseline and the new current deployment.
- Read-only public HTTP checks passed homepage/login Contact us links, public contact body/email form with no-login guidance, removed technical footer, preserved quota/draft warning, bilingual Contact us copy and 6–12 signup guidance. Sixty-five current public JS assets were read in memory; the formal client contains only the formal backend and no recovery backend URL. No private rows or key exports were involved.
- Strictly invalid empty JSON requests (which return before any RPC/INSERT) returned 400/invalid from canonical and apex formal Origins; recovery Origin returned 403/denied. This verifies ingress/configuration isolation, not successful message persistence.
- Formal metadata independently confirms member-feedback policies compare auth.uid() to user_id for both SELECT and INSERT. Guest RPC EXECUTE is denied to anon and authenticated roles. Post-change security advisor has no website_feedback finding; guest inbox RLS-with-no-policy INFO is the intentional service-only deny-all design ([advisory explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). No global security-clean claim or unrelated advisor remediation is made.

## Remaining formal-write smoke boundary

Automatic safety review rejected the attempted formal synthetic-message probe BEFORE its process ran, because the child script did not embed its promised cleanup and release permission was not taken as permission to leave production test data. No synthetic formal message, profile, account or email was created; there is nothing from that rejected probe to clean up. The blocked script was not rerun or bypassed through another tool. Unaffected read-only checks above were completed instead.

Actual formal message persistence/retry/rate-limit smoke remains unverified. Recovery's complete write/cleanup acceptance and local models are evidence, not a substitute for this formal check. Request explicit user approval for one unique disposable formal message and an orchestrated exact-ID-plus-original-body cleanup with absence verification; do not run the write probe until that authority is resolved. Existing real messages must never be read or removed during that check. No real account/password changes or email are needed.
