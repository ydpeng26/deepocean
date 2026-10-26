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

## Release acceptance

Pending final main fast-forward, deployment readiness and formal public-page/guest submission smoke checks. Do not count recovery acceptance as a live formal submission check. Any synthetic formal message must be tracked by exact generated ID and body, then removed and verified absent without querying or deleting existing messages. No real accounts, password changes or emails are needed for these checks.
