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
