# PC batch sync account changes and simultaneous tabs — diagnosis

## Scope — 2026-10-24

After the authorized offline-cache production release (`9ac9a99`), the user requested continued PC checks. This is diagnosis only. No application source, production branch/fixed deployment, database schema/data or credentials are changed. Mobile and deferred passport/preview features remain excluded.

`scripts/pc-batch-sync-diagnosis.mjs` transpiles and executes the actual offline sync API and `OfflineSyncWorkspace`, pinned to `9ac9a990c0595f77dcabfbd5cedfc96f4c4defea`. A serialized asynchronous storage model stands in for IndexedDB; independent module instances stand in for separate tabs; synthetic auth/row adapters model owner-scoped insert/read RLS. Network is forbidden. No account, photo, email or browser data is created. This is source-level deterministic reproduction, **not** a real two-account/two-tab browser or live RLS acceptance. Future repairs must not silently turn this historical diagnostic into a current-version regression.

## Reproduced observations

1. **Batch account is checked only at start.** `performSync` calls `getUser` once, retains A's `userId`, and continues over all drafts. Model: the first A write commits, then the session changes to B before the next item. The remaining insert still uses A's payload under B's current session. The model's RLS rejects it and the draft remains; no B row is created. This demonstrates missing cancellation/revalidation, **not** a cross-account-write exploit. A genuinely A-authenticated request already sent before a switch may legitimately complete in A; it must not later be presented as B's upload.

2. **Same-account concurrent completion is misclassified.** Two independent actual API module instances read the same draft. A creates one server row and removes the exact local draft; B then receives duplicate-key, reads the matching A-owned row and confirms identical fields. B's cleanup finds that the draft is already absent and returns false, so B reports “local content changed; new draft retained” even though local storage is empty. One cloud row and no overwrite/duplicate were observed in the model. The finding is inaccurate reconciliation/result text and absent cross-tab coordination, not demonstrated stored-draft loss. The module-global `syncInProgress` is not shared across independent instances.

3. **Old-account completion survives into the new account UI.** The actual workspace's auth callback changes displayed account from A to B while a mocked sync promise is pending. When A's result resolves, the component unconditionally refreshes/invalidate queries and renders “sync complete: one record saved to account” beneath B's displayed address. There is no latest-owner/operation-generation/mounted guard on that completion. This UI fixture does not upload anything; the preceding API model separately demonstrates the account-switch timing. Do not claim B received A's record. The auth callback also does not clear stale operation messages/selections on a change.

All observations completed with `AUDIT: local_actual_source_models_complete=true findings=3`. Successful execution of a diagnostic is not product acceptance. These group into two user-facing repair areas: account-change cancellation/late UI isolation, and simultaneous-tab sync reconciliation.

## Controls verified locally

- Initial expected-account mismatch rejects before cloud writes or local removal.
- The explicit owner-scope RLS model rejects A payloads under B and retains the rejected draft; no cross-account row is modeled.
- Stable server id/duplicate checking yields one row for concurrent identical syncs, without a replacement update or duplicate.
- Existing concurrent-editor tests separately establish exact snapshot cleanup preserves a genuinely modified in-flight draft. Do not weaken that protection merely to make the second tab report success.

## Proposed boundary — not implemented

Seek repair approval before app changes. A repair should stop/revalidate remaining items when the confirmed account/session changes; never automatically redirect the batch to B. Pending responses and UI refresh/message/progress must be scoped to the original account/operation and ignored after account changes/unmount. Retain unconfirmed/modified drafts and provide explicit retry/reconfirmation, rather than force-overwriting records.

Simultaneous instances need safe coordination and idempotent reconciliation: distinguish “already removed after verified identical sync” from “current draft genuinely changed.” Missing local data must not be blindly treated as success without confirming the intended owner/server payload. No cloud overwrite or deletion of another version is implied.

Validate locally, then with disposable recovery accounts and actual same-origin independently logged-in tabs; record per-account rows and local-store state with exact cleanup. No production writes or release without separate approval. The previous recovery site remains on accepted offline-cache source `99cdb76` (application-identical to production `9ac9a99`); it was not updated in this diagnosis.

Still separate: real cross-device/browser coverage, Safari/Edge, full authenticated 200% zoom, human OAuth and fresh complete restore/config reconstruction. This diagnosis does not finish the PC checklist.
