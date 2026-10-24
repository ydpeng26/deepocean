# Native Safari PC entry checks — 2026-10-24

## Scope

User requested continued PC checks after batch-sync production release `48b487f`. Read-only native Safari checks on the public formal site; no application change, deployment, account creation, credential entry, email submission, draft save or database mutation. Existing unrelated browser tabs were preserved. Mobile remains excluded. Browser-control connection was initially interrupted; no acceptance was inferred from that attempt. A subsequent connection completed the checks below.

## Observed

- `/auth` rendered the Chinese login controls. Right Arrow from the selected Sign in tab selected and focused Sign up; Home returned to Sign in. No registration was submitted.
- Switching to English rendered English headings, field labels, placeholders and actions. Clicking Forgot password with an empty address displayed `Enter a valid email first.`; no mail was requested.
- The Offline mode link reached `/offline-sync`. It displayed an empty local vault, signed-out guidance, sign-in return link and disabled sync/select-all controls. No local-storage error was displayed. This is initial read/display coverage, not draft write persistence or actual offline-network acceptance.
- The New offline entry link reached `/offline`. Country/site, native date/numeric controls, weather/type/role selectors and notes rendered. Weather opened its English options; Escape closed it retaining Not specified. No fields were filled or saved. Switching back to Chinese updated the body/controls and left the local entry count at zero.
- English body copy on `/auth`, `/offline-sync` and `/offline` retained Chinese browser tab/document titles. Source inspection confirms fixed Chinese `head` titles in those three routes. This is a low-severity language consistency finding, not a Safari-only execution failure. No repair was made.

## Limits and next scope

No assertion of full Safari compatibility, pixel-perfect layout, zoom acceptance, logged-in business operations, draft writes, cross-tab locks, service-worker lifecycle or physical-device testing. No Edge check was possible from the installed native applications inventory (Edge was absent); do not infer a pass. Next: seek authorization for disposable recovery-only account and synthetic-text Safari logged-in acceptance, exact cleanup, and separately test authenticated zoom. Human OAuth and fresh full restore/config reconstruction remain independent work. Deferred passport features remain deferred. Formal user data and credentials were untouched; Safari language was restored to Chinese.

## Authorized native logged-in recovery checks

The user approved recovery-only temporary fixtures and subsequently logged in themselves in native Safari. The observed session belonged to an existing restored account, not a new disposable fixture. Therefore this round used read-only page operations and an empty editor only; no restored profile/dive/certificate/gear/post was changed, no credential was read, and no fixture was created or required cleanup. Formal production was not visited or changed in this phase.

Nine authenticated routes loaded: `/dives` at actual size, then `/profile`, `/certificates`, `/gear`, `/dives/logs`, `/marine`, `/forum`, `/dives/new` and `/offline-sync` with Safari's actual page zoom set to 200%. The native Page Menu positively displayed 200% immediately after selection and again on the final sync route. A fast initial three-route navigation attempt returned stale certificate trees; these were not counted as passes. Each later route was read again after its actual URL and loaded page controls appeared.

- Profile loaded fields and Save; no edit or save.
- Certificates finished loading into the zero-certificate state, with Add available; no certificate or photo created.
- Gear loaded existing entries and editor controls; no save/delete.
- Dive logs loaded, and selecting Philippines reduced visible headings to the matching record. This is a local read-only filter, not a database mutation.
- Marine loaded its empty collection. Opening Record an encounter focused the species field; Escape removed the empty editor. The AX focus report after closing identified the page rather than the trigger, so successful opener-focus return is **not** claimed for Safari. No synthetic text was entered or saved.
- Forum loaded its empty feed, search, topic/order and posting controls. English switch updated the heading/search/actions, then Chinese was restored. No post/comment/follow was submitted.
- New dive form exposed location, data, buddy, notes and Save controls; no values entered or submitted.
- Sync loaded its signed-in account region, empty draft list and disabled upload/select-all actions. No sync was performed; existing local entry count stayed zero.

### Finding: icon-only sync link loses accessible name at zoom

At 200%, the shared member header's offline link was exposed as a bare recovery `/offline-sync` URL rather than the Chinese link name visible at actual size. The same state persisted on several authenticated routes. `src/components/MemberHeader.tsx` has an aria-hidden icon, a text span and no independent `aria-label`; `src/styles.css` hides that span at `max-width: 690px`. Page zoom can enter that compact CSS layout on a desktop. This is a source-backed accessible-name defect, not proof the link is unclickable or that all navigation disappears. Recommended separately authorized repair: supply a language-aware accessible name independent of the hidden span, preserve compact styling, and regression-check both languages at compact/zoom widths. No repair was made in this diagnosis.

### Evidence limits / restoration

The native Safari screenshot API returned unavailable. Consequently AX controls and route loading do not establish absence of clipping, overlap, poor contrast, image defects, or complete 200% visual acceptance. No screenshot workaround, DOM automation, injected script or alternative capture was used. A broad surface inventory request was rejected by safety review; only the specifically authorized Safari app was subsequently connected. No unrelated tabs were operated on. Final native Page Menu confirmed restoration to 100%; Chinese was restored and menus closed. Native authenticated saves, temporary-account writes, full dialog focus loop, Safari media codecs, actual offline/cross-tab persistence, Edge, human OAuth and fresh restore remain unaccepted.

## Authorized repair — local only

The user requested repair of the icon-link accessible name and three untranslated browser titles. `MemberHeader` now supplies a language-aware `aria-label` on the sync link itself, matching the visible span independently of compact CSS. The decorative icon remains hidden from accessibility; styling and the compact breakpoint are unchanged. The existing `useLiveCopy` title mechanism is now used by auth, offline log and offline sync, with three explicit English title translations; switching back restores the Chinese title. Chinese static/server metadata remains the initial fallback; this is a hydrated browser-title repair, not a server-language/SEO/Open Graph redesign or a dynamic sign-up-tab title feature. No fields, drafts, auth flows, sync ownership guards, data formats or database permissions changed.

`scripts/pc-safari-label-title-regression.mjs` transpiles the actual header and title hook: both languages' independent link label matches visible text with a decorative icon; all three routes are wired to the hook; actual language effects update titles in English, back to Chinese and on route re-entry. This is a local source/hook model, not native browser acceptance or a visual zoom test. Existing auth/workspace harnesses received no-op presentation-hook adapters only; their behavioral assertions remain unchanged. The new test's initial boolean-versus-string decorative aria attribute assertion was corrected before its passing run. MemberHeader's preexisting compressed formatting was normalized by the formatter to satisfy scoped lint.

All 14 local regression suites passed: new label/title, keyboard/language, batch sync, concurrency, offline cache, forum interaction/volume/social, marine help/gear, certificate, profile, media and dive log. Scoped application lint, client/server production build, offline asset generation and whitespace checks passed. A mistaken attempt to invoke a nonexistent `pc-offline-cache-regression.mjs` was not counted as evidence; the actual `offline-cache-regression.mjs` passed in the complete suite. No full-project type-clean claim is made. Fixed recovery deployment and native Safari recheck are pending separate approval; production remains unchanged by this repair.

## User-assisted recovery acceptance and authorized production release — 2026-10-25

The user approved recovery-only deployment of `fc19a0e9216160b366a21e892d8633b0eb083b8e`. Native browser control was subsequently rejected because app-wide reads could include unrelated tabs; a scoped Safari browser binding was unavailable and isolated browser connections timed out. These failures were not bypassed or counted as acceptance. The user promoted only the recovery project: supplied Vercel screenshots show Ready, Production, the fixed `supdiver-recovery-test.vercel.app` domain and source `fc19a0e`.

User-supplied native Safari screenshots independently show the sync title in English and back in Chinese, offline-log title in English and back in Chinese, and auth title `Sign in · SupDiver` then `登录 · SupDiver`. The enlarged authenticated header screenshot shows the compact icon-only sync entry, not its accessible name. For that final point, the user operated VoiceOver and explicitly reported it read `离线草稿与同步`. This is user-assisted native acceptance, not agent-controlled AX verification. The English accessible name additionally remains actual-component model-tested; no separate human English VoiceOver report or full visual zoom certification is claimed. No test records or credentials were created or changed during this acceptance.

The user then explicitly requested production release. Main was verified at `48b487fad0f2e118b97f10ba4f545a9847a82e47`; exact isolated source and ancestry checks passed, and a non-forced fast-forward published accepted `fc19a0e9216160b366a21e892d8633b0eb083b8e` without rewriting history. New label/title, keyboard/language and batch-sync regressions and scoped whitespace checks passed again before release.

GitHub's Vercel status for the formal `deepocean` project reported `success / Deployment has completed`, deployment [CFu7JGgQmg6MHVwPFizt8Axg7Rus](https://vercel.com/ydpeng26s-projects/deepocean/CFu7JGgQmg6MHVwPFizt8Axg7Rus). A separate GitHub ref read confirmed main's exact accepted SHA. Formal `https://www.supdiver.com/auth`, `/offline`, `/offline-sync` and `/offline-assets.json` returned 200; the manifest contains 64 resources. All 63 manifest-listed public JavaScript assets returned successfully and positively contained the three new English title strings and independent sync-link aria label. This verifies delivery from the formal custom domain, not a new authenticated production or native Safari functional run. No formal database structure, credentials, user data or photos were changed. Other PC, browser, visual, OAuth and restore coverage limitations remain as recorded above.
