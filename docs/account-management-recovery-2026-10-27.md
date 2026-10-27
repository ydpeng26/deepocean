# Account management — recovery acceptance

Scope: protected real settings page, password recovery link, language/offline controls,
local sign-out, and permanent authenticated self-deletion. The old mock settings
page redirects to real settings. Formal release is not approved by this change.

User decision: public forum post/comment text is retained anonymously; private posts,
profile, private records and uploaded images are removed. Manually written identifying
text is not automatically redacted. Offline drafts and historical backup retention are
explicitly disclosed. Exact confirmation phrase and recent server-verified sign-in
are required. Uncertain or partial cleanup never reports success.

Recovery project only: esovqvampbrhuhamkfcs. Applied migration
20261027040335_account_deletion_anonymous_forum.sql and deployed delete-account v1.
The worker is service-only in a non-exposed schema. Restrictive policies plus writer
guards prevent pending/deleted accounts from using old JWTs or legacy definer writes.
Storage bytes are removed via Storage API before Auth deletion, not SQL metadata
deletion. No service credential is shipped to the browser.

Verification so far: local production build and targeted lint passed; existing forum
any-type lint errors and preview literal-state TypeScript errors predate this change.
Rolled-back SQL fixture verified freeze, anonymous retention, private-post deletion,
old-JWT write rejection, and completed receipts. Independent checks found zero
remaining rollback users, posts or jobs. Security advisor introduced no new warning;
the private job table intentionally has no member RLS policies.

Pending: cloud acceptance using one explicitly authorized disposable recovery account,
exact fixture cleanup, recovery frontend publication and read-only UI acceptance.
Do not claim formal deployment or live destructive acceptance before these complete.

Source published to isolated branch at 33d441f5dc81f46c8115dc1098fba118ee189e42.
Vercel recovery preview 9f5yCw8pkHXdqdWHURR5JvXyDXNN is Ready; stable recovery
alias has not been promoted for this feature. All 40 local regression scripts passed.
GitHub API dispatch returned 403 without starting a run. Native workflow dialog was
then set to the isolated branch and account-deletion suite, but final Run was blocked
by the action-time irreversible-deletion confirmation gate. No disposable account was
created or deleted. Await explicit execution-time confirmation before retrying; do
not bypass the gate through another tool. Formal website remains unchanged.

After execution-time user confirmation, cloud run 40450259244 / job 122011067972
completed successfully (36s). Actual expanded step logs in Chrome confirmed:
authenticated status/worker privilege boundaries passed; synthetic private records
and images were created; real self-deletion removed Auth/private rows/images and
retained anonymous public text; old JWT uploads/post reclaim and deleted login were
denied; exact fixture account, posts, comments and images cleanup was verified.
The completed identity-cleared receipt 55b1ef6a-0baa-4a83-908d-7a18d6586a78 was
independently checked and removed. Independent recovery SQL counts then confirmed
zero fixture accounts/posts/comments/images/receipts. Existing human recovery test
account still has its original two gear and three dive records.

Recovery Promote to Production was attempted with only
supdiver-recovery-test.vercel.app listed. Vercel requires email reauthentication;
user was asked to complete it directly. New stable frontend and UI acceptance are
not yet confirmed. Formal website was not changed.

User completed Vercel email verification. Recovery deployment
4gmdE62oBJpFToFAtA6DUTpXANEe is Ready, source
33d441f5dc81f46c8115dc1098fba118ee189e42, with the stable alias
supdiver-recovery-test.vercel.app. Chrome native UI at /settings displayed real
login information, password recovery guidance, language/offline controls, sign-out
and permanent-deletion disclosures. Opening the confirmation panel did not mutate
the account; unchecked consent and empty phrase kept the final button disabled.
Cancel closed the panel normally. No confirmation phrase was entered, no existing
account was deleted and no password/reset-mail action was triggered. Real deletion
acceptance was the disposable cloud fixture above, not this human account UI check.
Formal deployment remains unapproved and unchanged.
