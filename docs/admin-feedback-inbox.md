# Administrator feedback inbox

`/admin-inbox` combines existing member feedback and guest contact messages. Admins see an inbox icon in the member header and a labelled User feedback link in Settings. The page supports all/unread/read/resolved filters, source filters, body search, newest-first deterministic ordering, and 20-row pages. Status changes are explicit, shared between admins, and reversible. Opening a message does not mark it read. Resolving does not send a reply. Existing messages initially appear unread; bodies and timestamps are preserved. Member senders are identified by user ID; guest email is shown when supplied.

Authorization is a private server-maintained user-ID allowlist, with no client write grants. Provision only the operator-approved existing, confirmed, non-anonymous account; never infer membership from display names, editable metadata, or first signup. The narrow private definer helper returns only the caller's boolean permission and also requires an active, non-deleting account. The exposed wrapper and combined view use invoker permissions. Guest SELECT is column-limited and row-protected; hashes are not granted. Only status UPDATE is granted, protected by admin RLS. Existing member own-feedback reads and submission constraints remain intact. There is no delete action, reply delivery, service-role browser key, or local storage of messages.

Deployment order:

1. Apply `20261112022715_feedback_admin_inbox.sql` to the target project.
2. Provision the explicitly approved account in `supdiver_private.feedback_administrators` by selecting its existing `auth.users.id` using its verified login email. Granting is an operator action, not part of a migration or browser request. Verify exactly one confirmed match. To revoke, remove that membership row.
3. Deploy the matching frontend. The feature fails closed when permission checks fail. Direct URL navigation never substitutes for server authorization. Status writes compare the previously loaded status, report conflicts, and do not overwrite a newer concurrent status.

Validation: `node scripts/admin-inbox-regression.mjs` covers the actual client and rendered page with controlled dependencies; `scripts/admin-inbox-regression.sql` runs only against recovery, wraps synthetic rows and temporary membership in a rollback, and checks admin/member/anonymous boundaries, metadata escalation, status changes, immutability, hidden hashes, account deletion, revocation, and stale writes. Existing feedback and guest-contact regression suites also pass. No production feedback content is used in tests.

The recovery project has the migration and the approved administrator configured. Production migration, membership and release are pending deployment approval. A real signed-in browser smoke test remains necessary; automated SQL and render checks do not constitute a full browser acceptance test.
