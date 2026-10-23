# PC concurrent editors and offline drafts — diagnosis

## Scope and evidence level

After the approved media release (`a52265d`), the user requested continued PC inspection. Diagnosis only: no application source, database, production branch, credentials or deployment changed. Mobile and the three deferred passport/preview items remain excluded.

`scripts/pc-concurrency-diagnosis.mjs` transpiles and executes the actual `offline-dives.ts`, `dives.ts` and offline form component with synthetic fields and in-memory asynchronous storage/API adapters. The historical diagnosis now reads the pinned local Git commit `a52265d`, so rerunning it cannot mistake the repaired source for the old diagnostic baseline. It forbids network. The storage adapter is not a real browser IndexedDB durability/transaction test; the API adapter is not a live RLS test. Its five counterexamples are local evidence consistent with the source, **not** actual two-browser/cloud/cross-device acceptance. The recovery website was not updated or exercised in this audit.

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

## Authorized implementation — local verification

The user subsequently requested the repair. Only the five reproduced findings and directly related stale-delete protection are changed:

- `saveDive` takes the editor's original `updated_at`. An edit without that revision fails closed. The form captures the mount-time revision paired with its field values, so background query refreshes cannot silently rebase an unsaved editor. The final update filters by id, owner **and expected updated_at**, atomically rejecting a row changed after the initial read. A changed revision can acknowledge an identical already-committed payload for lost-response retries, but never issues a replacement update in that branch. Conflicts retain entered form fields. No database migration is needed: the existing timestamp and update trigger are reused.
- Local draft edits/deletions read, compare and write/delete in one IndexedDB readwrite transaction. They compare the loaded snapshot and optional revision; a missing original cannot be silently recreated. Every newly saved version gets a random revision, so same-millisecond saves/ABA changes are distinguishable. Legacy drafts without a revision remain readable/editable with their exact original snapshot; no wholesale local-store migration or cleanup occurs.
- New offline entries use a stable per-form request id. Identical retries acknowledge the existing draft, changed-payload retries conflict. The offline form has a synchronous save/delete lock, disabled fieldset and conflicting sidebar controls, input-handler guards, and unmount/late-load completion guards. Changing language no longer rehydrates the editor and discards unsaved fields. Save failures keep fields and request identity; success resets only the submitted locked form. A sidebar refresh failure after a confirmed save does not turn that save into another new draft.
- Offline conflicts show an explicit alert retaining input. Refreshing the list does not replace the form. Loading a different snapshot after a conflict asks before discarding unsaved input; the separate save-as-new action retains every field, changes the request identity and still requires an explicit save. An old editor cannot resurrect a draft removed by a successful sync. No automatic merging or force-overwrite action is added.

`scripts/pc-concurrency-regression.mjs` passes nine groups against actual APIs/components with a serialized asynchronous transaction model: stale save/delete and missing baseline, deleted/synced resurrection rejection, legacy upgrade, stable create retry, competing writers, in-flight sync edit preservation, initial wrong-account rejection, online CAS including a mutation between read and write, lost-reply acknowledgement, synchronous form locking/draft retention, explicit copy recovery, unmount safety and mount-time online revision retained across background refresh. This remains local model evidence, not real browser IndexedDB/live-server acceptance.

Existing dive-log, media, profile, certificate, marine/gear and marine-help regressions pass. Production build and offline-asset generation pass; targeted lint is clean with the existing API explicit-any exception. Whole-project TypeScript still reports only the previously recorded `__root.tsx`, `forum-post-preview.tsx` and `profile-preview.tsx` errors, not the changed modules. No all-project lint/type-clean claim is made.

Recovery-site deployment and real two-tab acceptance have **not yet occurred**; approval was requested for recovery only. Formal main/application remains `a52265d`, with no database, credentials or user-data changes. Old already-loaded clients do not acquire these checks retroactively: refresh all test/editor tabs onto the new version before acceptance. This is current-client conflict protection, not a server-side ban on every old client or a completed audit of all other modules/cross-account batch races.
