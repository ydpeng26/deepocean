# Forum presentation, signup guidance and feedback — 2026-10-26

## Scope and current state

The user selected three improvements only: remove the forum hero's orbit/person icon/number/OCEAN STORIES presentation, show persistent signup password requirements, and add a top-navigation feedback page for website suggestions. No translation, private posts, account deletion, passport aggregates, saved-post integration or preview settings/share-card release is included.

The user subsequently authorized recovery-only deployment, a new private feedback table, disposable accounts, synthetic feedback and exact fixture cleanup. The recovery table is applied and the recovery fixed domain serves application commit `022b5a4f26b564e93fa96d8500b99c4d6e30225f`. Production schema, website, credentials, login policy and existing user records are unchanged. The user's unrelated screenlog.0 changes are excluded.

## Implementation

- The entire hero count widget is absent from both live and preview forum markup. It is not replaced with a member count. Ordinary post likes/comments/topic counts and follow controls are unchanged.
- Signup shows a persistent bilingual description next to the password field, connected with aria-describedby. It states the existing frontend 6–72-character limits and recommends a longer unique password. It disappears in sign-in mode. Existing validation/authentication strength and backend rules are unchanged. This task verifies displayed guidance and unchanged client limits; it does not claim a new backend password policy or an exhaustive real-signup password-strength matrix.
- The shared signed-in top navigation adds Feedback / 意见反馈 and its active-page state. The navigation wraps earlier to avoid six bilingual links colliding with account controls.
- Authenticated `/feedback` has a bilingual type selector (suggestion/problem/other), 1–3000-character text area, counter, private-submission explanation, sensitive-information warning, pending state, safe errors and confirmed-success notice. Refresh/leaving does not persist an unsent draft; failure within the page retains its text. No attachment, email notification, automatic reply or administrator frontend is claimed. The owner reviews received submissions through the protected Supabase database dashboard.
- The API pins the account and one request UUID. It inserts only id/user_id/category/body, validates the returned row, checks the account around asynchronous work and refuses zero/wrong/changed-content confirmation. A previously committed identical request is confirmed without insertion. Immediate double activation is locked; late page completion cannot change unmounted state. Arbitrary backend error text is never rendered.

## Applied recovery database boundary

The installed CLI initially generated `20261026130330_website_feedback.sql`; after authorized recovery application, its filename was aligned to the service-returned version `20261026135542_website_feedback.sql` to avoid duplicate application in future migration tooling. It contains only a new table/index/policies/trigger. RLS limits authenticated INSERT and SELECT to the submitting owner, with no member UPDATE/DELETE or anonymous access. Administrators use protected dashboard/service access; no privileged key is added to the browser. The invoker-rights trigger serializes per-owner submissions with a transaction advisory lock, sets server time, and enforces one submission per minute and at most twenty in rolling 24 hours. Primary-key uniqueness and exact-content retry confirmation prevent repeat inserts after an ambiguous reply. Existing tables and storage policies are untouched.

Supabase skill instructions and current official insert/RLS documentation were checked. The lightweight changelog reader again rejected its Markdown content type. No SDK upgrade or new dependency is needed. CLI help initially failed because its telemetry directory was outside the sandbox; approved local CLI execution then read help and generated the empty migration. It did not connect to a cloud database.

## Verification and next boundary

All 36 local regression suites pass, including new actual feedback API/component callback models and signup-hint/navigation checks. Build and offline asset generation pass. Scoped lint on new feedback files and modified auth/navigation passes. Whole-project TypeScript checking retains only the eight previously known preview-state errors, with no remaining new feedback error. Source-level SQL assertions are supplemented by the live acceptance below. Browser navigation geometry was checked at 1440/1200/900 widths; this is not a full native/mobile visual review.

Recovery project `esovqvampbrhuhamkfcs` now records migration `20261026135542_website_feedback`. Metadata confirms RLS, two owner policies, no anonymous SELECT/member UPDATE/member DELETE/client timestamp INSERT privileges, and invoker trigger rights. Recovery deployment `H8iSaYmCD8bur9WV7sciTV734oEL` is Ready and aliases only `supdiver-recovery-test.vercel.app`; its “Production” designation belongs to the recovery Vercel project, not the formal website. Security advisors report no new website_feedback finding; existing unrelated findings remain outside this task and are not a clean global security assessment.

Earlier live runner attempts were incomplete due acceptance-harness issues, not application source changes: runs `40336978589` and `40338240279` blocked the first exact-owned pre-insert lookup; run `40339772768` used a transient synthetic read failure that the SDK correctly retried and confirmed; run `40340679863` passed all bilingual UI, actual persistence, privacy and limit cases but closed the forum context before guarded reads settled. Each run verified exact fixture feedback/auth/profile absence and session revocation afterward. The harness now registers only canonical exact-owner lookup UUIDs, uses a non-retryable synthetic read error, and waits for pending forum reads before closing. No arbitrary read access or application permission was broadened.

Production schema and release remain a later separately approved step. No original dive-log audit workflow was repurposed; the dedicated manual Recovery member safety workflow runs on the isolated recovery branch only.

## Completed recovery acceptance

- Run [40341433154](https://github.com/ydpeng26/deepocean/actions/runs/40341433154), source `210fd677ad8dc3b4cf3d2e9396827a750cbfa5c5`, job `121636887830`: successful. App `src/` and `public/` are unchanged from deployed `022b5a4`.
- Both languages passed unauthenticated redirect, persistent accessible signup hint, generated-account sign-in, active feedback navigation, three viewport widths, whitespace rejection, synchronous double-submit lock, failed-save draft retention, a real committed row with a simulated lost reply, and explicit identical retry confirmation without a duplicate insert. Forum hero orbit/number/OCEAN STORIES absence passed.
- Real database calls passed owner/outsider/anonymous isolation, forged-owner rejection, member UPDATE/DELETE rejection, client timestamp rejection, minute limit, rolling 24-hour cap after twenty exact generated rows, and two concurrent authenticated requests allowing exactly one new row. Only generated rows were backdated to exercise daily limits; no rule or existing record was changed.
- Both browser contexts reported zero page errors and zero boundary blocks. `AUDIT: complete=true`. Exact generated feedback/auth/profile absence and session revocation were verified; cloud browsers closed. No mail, photos, existing-user data exports or formal-site writes occurred.
- Formal `main` independently remains `b53dc10c9f27cb194fed1e806ca170143df47a0e`. Formal deployment and migration still require separate approval.

## Follow-up: Contact us and password entry limits

The user requested renaming the entry/page to 联系我们 / Contact us and reducing the new-password maximum to twelve characters. The existing `/feedback` URL, private storage, submission type selector and suggestion workflow remain compatible. No email address, public post or new delivery channel is invented.

Current source inspection shows signup minimum six and reset minimum eight with no composition regex/pattern. Read-only recovery dashboard inspection of Email provider shows minimum six and the default no-required-characters option; Save remained disabled and no setting was changed. Formal backend configuration was not independently inspected in this follow-up. Official password-security documentation was checked; the changelog Markdown endpoint again rejected its content type.

Signup now accepts 6–12 and reset accepts 8–12 in website forms, with both HTML limits and submission-handler checks. Both explain that no letter/digit/symbol combination is mandatory, and recommend letters plus digits and avoiding reuse. Existing lower bounds remain unchanged. Sign-in keeps the prior 72-character input maximum and does not impose the new twelve-character check, so existing longer passwords are not truncated or rejected. These are website entry limits, not a new Supabase server-wide maximum; direct Auth API policies are unchanged. No user password or backend policy was modified.

All 36 local regression suites pass after the follow-up, including actual signup handler rejection of five/thirteen characters, acceptance of numeric-only, letters-only and mixed 6–12-character inputs, longer legacy sign-in, and actual reset handler rejection outside 8–12. The earlier cloud run above covers the prior wording/version; follow-up live deployment/acceptance must be recorded separately.
