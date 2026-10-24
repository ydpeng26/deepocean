# PC true-offline cache and update diagnosis — 2026-10-24

## Scope

After the authorized PC keyboard/language production release (`2afc408`), the user requested continued PC checks. Diagnosis only: no application repair, fixed-site promotion, database/schema/credential change or production data mutation. Mobile and deferred passport/preview features remain out of scope.

`scripts/recovery-offline-cache.mjs` runs cloud desktop Chromium at 1440x1000 with real service workers allowed and actual IndexedDB, unlike the earlier concurrency test that blocked workers. It uses a fresh disposable browser context, synthetic text, no login/accounts, no service-role key, no media/mail/screenshots/traces/artifacts and no backend writes. Production hosts, other Supabase projects and non-read network requests are guarded. Browser context disposal removes its synthetic local storage.

The registered dive workflow was temporarily redirected on the isolated branch to this script and restored byte-for-byte to production afterward. A dedicated manual `recovery-offline-cache.yml` preserves the check. A stale browser target initially dispatched Cloud backup run https://github.com/ydpeng26/deepocean/actions/runs/40061404064 on isolated source `5a9de60`: its main-only guard skipped job `120775511816`; no backup executed. This is not evidence of backup success or an offline check. The correct workflow path was then explicitly rechecked before dispatch.

## Real current-version browser evidence

https://github.com/ydpeng26/deepocean/actions/runs/40062355816 ; job `120778394155`; runner `5a9de60a9caffbb046d1f392eddf02f7c5013879`. Completed `AUDIT: complete=true`:

- Real worker activates and controls the page. One build-versioned application cache contains all manifest JS/CSS assets and `/auth`, `/offline`, `/offline-sync`.
- With browser context network set offline, a hard page reload works. Actual form submission stores one draft in IndexedDB, independent readback matches fields, and another offline reload/editor read retains it.
- Injecting an IndexedDB-open `QuotaExceededError` retains unsaved fields and the previously saved snapshot. Restoring normal storage and retrying updates the same one local draft. This is injected failure handling, not measured real disk exhaustion.
- Cached auth and sync pages load offline without login/backend writes. Restoring network and reloading preserves the unsynced draft without automatic synchronization.
- Disposable context/browser closed; no backend account/row was ever created. No sync or mail requests submitted.

This accepts current-cache offline operation on this Chromium run, not a fresh unprimed browser offline, every browser/device, restart durability after OS crash, browser storage eviction, or an actual cross-release update.

## Finding: old-tab asset cache removed on version activation

`scripts/pc-offline-cache-diagnosis.mjs` executes the actual `public/sw.js` in an isolated deterministic cache/network model. It verifies cached navigation fallback, cached asset reads, cross-origin/non-GET bypass and failed-install retention of the active old cache. It then installs and activates a synthetic new build and reproduces one finding:

`skipWaiting()` activates the new worker immediately; activation deletes every other `supdiver-offline-*` cache and calls `clients.claim()`. An already-open old bundle can still request an old lazy-chunk filename. That filename is absent from the new manifest/cache and its previously cached copy was deleted. If offline, the asset request rejects. A still-in-flight old worker handler also refers to the removed old cache. New-build cached chunks remain available.

This is confirmed actual-source model behavior and a plausible old-tab offline failure, **not yet a real deployed two-release browser reproduction**. It does not demonstrate deletion of saved IndexedDB drafts; caches and draft IndexedDB are separate. No claim is made that every update always loses unsaved text or that previously saved drafts are corrupted.

Proposed repair boundary requires user approval: coordinate new-worker activation with open clients, retain needed versioned resources until safe retirement, and provide an update/reload action that does not discard unsaved input. Avoid automatic reload or clearing IndexedDB. Validate a controlled two-version browser transition in isolation before recovery-site and production release approval.

## Next unaccepted coverage

Real cross-release service-worker lifecycle, batch-sync account switch and simultaneous multi-tab sync, Safari/Edge, full authenticated 200% zoom, human OAuth, physical devices and fresh complete restore/config reconstruction remain separate work. Do not mark the entire PC checklist finished.

## Authorized implementation — local verification only

The user requested repair. Changes are confined to worker lifecycle/cache handling, root registration observation and an English/Chinese update notice. No draft IndexedDB code/schema, sync destinations, credentials or backend data are changed.

- Installation still caches the entire offline shell atomically, but no longer calls `skipWaiting()`. An update waits for existing controlled windows to close rather than forcing replacement while a user edits.
- Activation checks all same-origin windows including uncontrolled ones. Older app caches are retired only when that list is empty. With live windows, old caches are retained; they may use additional storage until a later windowless activation. Only app-prefixed caches are eligible, never IndexedDB or unrelated caches.
- Hash-addressed `/assets/` requests can fall back to retained app-version caches. Mutable HTML/navigation is not taken indiscriminately from old caches; cross-origin/non-GET bypass remains intact.
- `watchOfflineUpdates` observes existing waiting workers and successful new installs, ignores initial installation/background-check failures, and removes listeners on unmount. It never sends an activation message or reloads the document.
- `OfflineUpdateNotice` tells users to save first, close all site tabs/PWA windows and reopen. “Later” only dismisses the notice. No automatic save/refresh, force-update button, draft purge or claim that unsaved input is durable. Already-loaded legacy bundles do not retroactively acquire this notice; the first rollout must account for that transition separately.

`scripts/offline-cache-regression.mjs` passed actual worker cache/network models, failed/waiting install preservation, no forced activation, live-window old-asset fallback, unrelated-cache exclusion, windowless retirement, actual update-observer errors/cleanup/notification deduplication and actual notice English/Chinese/dismissal behavior. Historical diagnosis is pinned to production baseline `2afc408` so it still reproduces the original counterexample instead of failing against repaired source.

Existing concurrency, keyboard/language and dive-log regressions passed. Targeted application lint, production build, offline asset generation and scoped whitespace checks passed. Whole-project TypeScript still reports the known root error-component type and preview-page errors; no global type-clean claim. The added observer/notice have no reported type errors.

This is local model evidence, not real two-release browser acceptance or a guarantee about a legacy worker already running before rollout. Recovery-only deployment approval is requested next; no fixed recovery or production site has been updated for this repair. A controlled two-version browser test and current-app offline checks remain required before production approval.

## Approved recovery deployment and real lifecycle acceptance

The user explicitly approved updating only recovery with isolated browsers/synthetic local drafts. Application source `99cdb76dbb2ac39a698c73bb8d624517a3998f9b` was deployed to https://vercel.com/ydpeng26s-projects/supdiver-recovery-test/B8WfKULzbUpGs1zSR3Z6AJwRSQEP . Native UI verified Ready / Production / Current, recovery fixed domain `supdiver-recovery-test.vercel.app`, isolated branch and commit `99cdb76`. “Production” is Vercel's environment name within the recovery project, not the formal `deepocean` project.

`scripts/cloud-offline-update-lifecycle.mjs` serves a cloud-loopback synthetic HTML shell with actual repository worker/update-observer source and historical worker pinned at `2afc408`. Desktop Chromium uses real service-worker lifecycle, CacheStorage and IndexedDB. This avoids changing the live recovery site repeatedly or touching existing local drafts. It is a real two-release browser lifecycle test of those sources, **not** two full application deployments or a full-app cross-release UI acceptance.

First attempt https://github.com/ydpeng26/deepocean/actions/runs/40073688464 (job `120812395070`, source `99cdb76`) verified legacy-to-fixed waiting/input/old-resource behavior but was incomplete later. A safe-phase-instrumented repeat https://github.com/ydpeng26/deepocean/actions/runs/40075194127 (job `120816921948`, source `36760f3`) located premature cache-retirement assertion: the runner checked absence as soon as `waiting` disappeared, before activation's asynchronous cleanup completed. The runner now also waits for the browser's active worker state `activated`. These incomplete runs are not overall passes. Application source did not change after `99cdb76`.

Final run https://github.com/ydpeng26/deepocean/actions/runs/40077766613 , job `120824747293`, runner `3f91438b1d52693f77a2827f4b2b9a2b769c2b74`, passed both independent layers:

1. **Controlled real lifecycle:** legacy worker to repaired worker waits without replacing the document, erasing unsaved input or losing the old lazy chunk offline. Repaired-version update with two actual tabs shows the observer's update notice, retains both unsaved fields, remains waiting after only one tab closes, activates after the last closes, and retires old app caches after activation completes. A new page opens offline from the new cache; synthetic saved IndexedDB content survives. A later deliberately broken asset download makes installation fail without replacing the working cache/worker or changing unsaved input. No credentials, external app traffic or backend data.
2. **Current full recovery application:** the real deployed worker controls the page and its versioned cache contains the full asset manifest/offline routes. Actual offline form save, independent IndexedDB readback, offline hard reload/edit, injected storage failure with retained input/saved snapshot, one-record retry, cached auth/sync routes and reconnect without auto-sync all pass. No account/login/backend write, photos or mail. Both layers close disposable contexts/browsers; synthetic local storage is disposed, not left in a user's browser. No screenshots/traces/artifact exports.

The real lifecycle shell exercises the actual update observer, while the React notice's bilingual/dismissal behavior remains local component-tested. Already-open legacy pages cannot retroactively gain the new notice; users must save before closing all site tabs/app windows. Closing a window does not automatically save unsaved text. Browser eviction/quota and physical-device/browser coverage remain as previously limited.

Production main remains `2afc408bea57dd426a1e2c1f5ea44611bb2290cc`. The registered dive-log workflow is restored byte-identically to that baseline; a dedicated manual-only `recovery-offline-update.yml` retains the repeatable tests. No production release has been authorized for this repair. No migration, credential change or existing cloud/user data mutation occurred. Separate production approval is required.
