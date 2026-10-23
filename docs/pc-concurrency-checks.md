# PC concurrent editors and offline drafts — diagnosis

## Scope and evidence level

After the approved media release (`a52265d`), the user requested continued PC inspection. Diagnosis only: no application source, database, production branch, credentials or deployment changed. Mobile and the three deferred passport/preview items remain excluded.

`scripts/pc-concurrency-diagnosis.mjs` transpiles and executes the actual `offline-dives.ts`, `dives.ts` and offline form component with synthetic fields and in-memory asynchronous storage/API adapters. It forbids network. The storage adapter is not a real browser IndexedDB durability/transaction test; the API adapter is not a live RLS test. Its five counterexamples are local evidence consistent with the source, **not** actual two-browser/cloud/cross-device acceptance. The recovery website was not updated or exercised in this audit.

## Reproduced counterexamples

1. **Offline stale editor overwrites another tab's saved fields.** Two snapshots read the same local draft. A saves changed notes; B saves its older snapshot with a changed location. B's `store.put` silently restores the old notes. `saveOfflineDive` receives no expected revision and compares no current stored version.
2. **Stale offline editor recreates a removed draft.** Another tab removes a draft; an already-open editor saves that same id and recreates it without warning. The local removal stands in for the same absence that occurs after successful sync. The actual sync-then-stale-browser-save sequence has not been run in a browser.
3. **Online stale edit silently replaces newer content.** Two device snapshots of the same dive are saved in succession. A changes notes; B saves its older notes with a new location. `saveDive` rereads existence/owner but does not compare the editor's baseline; its update filters only id/user_id. B overwrites A's notes. The schema already has `updated_at` and a touch trigger, but neither the client type nor save interface uses that revision. This is a local API counterexample, not proof of any real user's lost record.
4. **Offline save callback is reentrant.** Two immediate calls to the actual form submit callback both invoke `saveOfflineDive`, with no synchronous lock or stable creation id. Distinct local UUIDs would be created for new entries. The test exercises callbacks, not a claim that every physical double click bypasses a rendered disabled button.
5. **Offline save completion clears text typed while saving.** Ordinary inputs/new-entry controls remain editable during pending save. The actual callback's successful completion calls `startNew()`, clearing text entered after the submitted snapshot. Synthetic component test confirms the new location is absent from the submitted payload and cleared from current state.

All five observations completed with `AUDIT: local_synthetic_complete=true findings=5`. A successful diagnostic process is not product acceptance.

## Controls that passed

- Existing sync cleanup compares the exact stored snapshot in a readwrite transaction before removing it. The local test edits during upload; cleanup preserves the newer draft and reports a conflict. Do not report that this specific in-flight cleanup deletes newer edits.
- Expected-account mismatch at the **start** of sync rejects before any insert or local removal. No cross-account disclosure was reproduced. Drafts are intentionally browser-local and available before login with explicit destination-account confirmation; this differs from private account records.

Not yet verified: account switch during a batch, cross-tab auth propagation/UI stale completions, simultaneous sync across separate module instances/tabs, real cross-device save race, real browser offline cached updates and storage failure, or equivalent concurrency for profiles/certificates/gear/forum. Older basic offline/same-tab account-switch acceptance does not close these cases.

## Proposed repair boundary — not implemented

- Offline draft editing: atomically compare the expected saved snapshot/revision inside the same readwrite transaction before put/delete; reject stale or missing originals, retain the editor's unsaved fields and offer explicit reread or save-as-new. Avoid silent auto-merging and silent recreation.
- Offline form: synchronous save lock/stable request identity, lock conflicting controls or preserve subsequent typed values, mounted/late callback guards, and explicit conflict guidance rather than generic storage failure.
- Online dive editing: carry the loaded revision and use an atomic conditional update against the expected revision; a zero-row conflict retains the draft and asks for review. A simple read-before-write alone does not close races. Existing database `updated_at` can be evaluated for this approach without presuming a new migration is needed.

Seek repair authorization first. Validate fixes locally, then real two-tab/disposable recovery tests before separate production approval. Do not auto-overwrite a conflicting record or discard either user's version.
