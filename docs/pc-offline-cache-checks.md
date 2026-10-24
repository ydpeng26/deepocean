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
