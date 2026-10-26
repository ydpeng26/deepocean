# Forum presentation, signup guidance and feedback — 2026-10-26

## Scope and current state

The user selected three improvements only: remove the forum hero's orbit/person icon/number/OCEAN STORIES presentation, show persistent signup password requirements, and add a top-navigation feedback page for website suggestions. No translation, private posts, account deletion, passport aggregates, saved-post integration or preview settings/share-card release is included.

This checkpoint is local implementation, not deployment or live database acceptance. No recovery or production backend schema, credential, login policy or existing record was modified. No account, email or real feedback was submitted. The user's unrelated screenlog.0 changes are excluded.

## Implementation

- The entire hero count widget is absent from both live and preview forum markup. It is not replaced with a member count. Ordinary post likes/comments/topic counts and follow controls are unchanged.
- Signup shows a persistent bilingual description next to the password field, connected with aria-describedby. It states the existing frontend 6–72-character limits and recommends a longer unique password. It disappears in sign-in mode. Existing validation/authentication strength and backend rules are unchanged; actual recovery Auth settings must be checked before acceptance to ensure the wording does not promise unsupported backend rules.
- The shared signed-in top navigation adds Feedback / 意见反馈 and its active-page state. The navigation wraps earlier to avoid six bilingual links colliding with account controls.
- Authenticated `/feedback` has a bilingual type selector (suggestion/problem/other), 1–3000-character text area, counter, private-submission explanation, sensitive-information warning, pending state, safe errors and confirmed-success notice. Refresh/leaving does not persist an unsent draft; failure within the page retains its text. No attachment, email notification, automatic reply or administrator frontend is claimed. The owner reviews received submissions through the protected Supabase database dashboard.
- The API pins the account and one request UUID. It inserts only id/user_id/category/body, validates the returned row, checks the account around asynchronous work and refuses zero/wrong/changed-content confirmation. A previously committed identical request is confirmed without insertion. Immediate double activation is locked; late page completion cannot change unmounted state. Arbitrary backend error text is never rendered.

## Prepared database boundary, not yet applied

The installed CLI generated `20261026130330_website_feedback.sql`; it contains only a new table/index/policies/trigger. RLS limits authenticated INSERT and SELECT to the submitting owner, with no member UPDATE/DELETE or anonymous access. Administrators use protected dashboard/service access; no privileged key is added to the browser. The invoker-rights trigger serializes per-owner submissions with a transaction advisory lock, sets server time, and enforces one submission per minute and at most twenty in rolling 24 hours. Primary-key uniqueness and exact-content retry confirmation prevent repeat inserts after an ambiguous reply. Existing tables and storage policies are untouched.

Supabase skill instructions and current official insert/RLS documentation were checked. The lightweight changelog reader again rejected its Markdown content type. No SDK upgrade or new dependency is needed. CLI help initially failed because its telemetry directory was outside the sandbox; approved local CLI execution then read help and generated the empty migration. It did not connect to a cloud database.

## Verification and next boundary

All 36 local regression suites pass, including new actual feedback API/component callback models and signup-hint/navigation checks. Build and offline asset generation pass. Scoped lint on new feedback files and modified auth/navigation passes. Whole-project TypeScript checking retains only the eight previously known preview-state errors, with no remaining new feedback error. SQL guard checks are source assertions only, not executed-database evidence. Native layout, actual rate-limit concurrency, persisted feedback, owner/outsider/anonymous permissions and cleanup still require recovery acceptance.

Next requires explicit permission: apply this new table only to SupDiver-Recovery-Test, publish the recovery website, use disposable accounts and synthetic feedback, verify insert/idempotency/privacy/rate-limit guards and exact fixture cleanup. Read only safe metadata and generated fixture rows; no existing user data edits or local exports. Do not claim the feedback feature is operational until this passes. Production schema and release remain a later separately approved step.
