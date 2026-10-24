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
