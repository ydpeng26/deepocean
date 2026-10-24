# PC layout, language and keyboard diagnosis

## Scope and authorization

After production release `d5b9b27`, the user requested continued PC checks and explicitly allowed disposable recovery accounts and synthetic text, with cleanup. Diagnosis only: no application source, migration, production data or fixed-site deployment changed. Mobile and the previously deferred passport/preview features remain excluded.

Recovery https://supdiver-recovery-test.vercel.app still runs the concurrency repair application's source (`e409fa8`/`c0462f2`), byte-identical in `src` to production `d5b9b27`. The isolated branch adds only manual cloud diagnosis and documentation. The registered dive workflow is temporarily redirected only on this branch, then restored before handoff.

## Method

`scripts/recovery-pc-layout.mjs` uses cloud desktop Chromium with one generated `example.invalid` account, synthetic profile/dive/forum text, no images, email, screenshots, tracing or exported artifacts. Requests to production hosts or other Supabase projects are blocked. It checks nine live routes (`/dives`, `/dives/logs`, `/dives/new`, `/profile`, `/certificates`, `/gear`, `/marine`, `/forum`, `/offline-sync`) in Chinese and English at 1440, 1280 and 1024 CSS-pixel widths: 54 combinations. Root scroll width detects horizontal page overflow; header controls outside the viewport are classified separately from controls inside intentionally horizontally scrollable navigation. This is not pixel-perfect screenshot review, every text-clipping case or an accessibility certification.

Long synthetic inputs: 80-character country, 120-character site, 2000-character notes, 300-character bio and unbroken forum title/body. The first run stress-tested a 60-character stored profile name; the repeat uses the profile form's 40-character limit to avoid attributing an out-of-UI-bound stress case to normal input. It also operates the actual shared comment dialog, actual marine editor and auth tabs with keyboard focus/Tab/Escape/ArrowRight/Enter. It does not submit comments, marine entries, registration or email.

Separately, the native desktop browser was switched to English on the signed-out recovery login page and actual Chrome zoom 200% was observed. A transient UI screenshot showed the header/panel and upper fields wrapping into a vertical layout; it was not saved/exported. This is an upper-page visual spot check, not complete 200%-zoom acceptance across authenticated pages. Zoom was restored to 100% and language to Chinese. Preview routes redirected to auth, so no preview page is represented as authenticated live acceptance.

## First cloud diagnosis

https://github.com/ydpeng26/deepocean/actions/runs/40041164843 ; job `120712330952`; runner `99f85b0db4d585357ae8ad3e2b5fefc966ae8627`: completed diagnosis, `complete=true findings=14 matrix_cases=54`. Green means the diagnostic finished, not that the product passed.

- English mode retains the primary Chinese country label on `/dives/new`, the Chinese gear page heading on `/gear`, and the Chinese new-encounter action on `/marine`.
- Comments: initial focus remains outside, Tab escapes to background controls, and Escape does not close the dialog.
- Marine editor: Tab escapes to background controls. Initial focus enters and Escape closes in this run; do **not** report those two marine behaviors as failures.
- Auth tabs do not switch selection with ArrowRight. Focus + Enter does activate Sign up normally; no account or email is submitted.
- Eight English/1024 header observations had a control outside the viewport. These are **unclassified candidates**, not confirmed defects: intentionally scrollable navigation can cause the same geometry. A follow-up distinguishes scroll ancestors and uses the 40-character name limit.
- No root horizontal overflow was detected in these 54 cases. This does not establish no hidden/clipped text, no internal overflow, or every view/zoom/browser.

Exact generated account/profile, dive and forum post were cleaned and absence checked. No human data was changed. Follow-up run https://github.com/ydpeng26/deepocean/actions/runs/40041668887 (runner `fefa8fb85902b0b46071eb2e7a841ac152e69502`) is pending at this checkpoint.

## Follow-up and final diagnosis

Follow-up https://github.com/ydpeng26/deepocean/actions/runs/40041668887 ; job `120713938502`; runner `fefa8fb85902b0b46071eb2e7a841ac152e69502`: completed, `AUDIT: complete=true findings=6 matrix_cases=54`. It reproduces all three language findings, both dialog findings and auth-tab ArrowRight behavior above. The two modal findings cover multiple keyboard behaviors, not just a count of individual failed keys.

No root horizontal overflow or header control outside the viewport **without a scroll container** was reported in the refined 54 cases. The earlier eight geometry candidates are not promoted to product defects. Because both fixture length and scroll classification changed, this repeat does not independently attribute those candidates to only one cause. No application repair took place between runs.

Exact disposable account/profile/dive/forum rows were cleaned and independently checked absent again. Application source and migrations remain byte-identical to production `d5b9b27`. The registered dive-log audit workflow is restored byte-for-byte to main; dedicated manual `recovery-pc-layout.yml` keeps the diagnostic. No fixed-site promotion, production workflow dispatch, notification/mail or credential change occurred.

Suggested repair order, requiring user authorization: shared modal focus entry/trapping/return and safe Escape handling (retain busy-operation guards), then auth tabs' roving focus/arrow navigation, then complete the live dive/gear/marine English strings and accessible labels. Do not remove existing marine Escape behavior or claim all English pages are untranslated. Retest recovery first and seek separate production approval for any implementation.

## Remaining scope

Safari/Edge, real OAuth sign-in, all keyboard controls/screens/readers, full 200% zoom on authenticated pages, every long-language string and viewport, true offline cached updates, physical-device concurrency and a fresh complete restore/config-reconstruction drill remain unaccepted. Mobile is explicitly deferred. Do not describe this diagnostic as completion of the entire PC checklist.

## Authorized repair — local verification only (2026-10-24)

The user authorized repairing the diagnosed issues. The isolated branch now adds:

- Shared comment/marine modal focus entry, forward/backward Tab containment, background-focus redirection, safe Escape handling and focus return to a connected opener. Only the top nested modal handles keys; IME composition is ignored and existing mutation locks still prevent closing during saves. Marine detail-to-editor replacement receives a fresh focus scope. This is keyboard containment, not a claim of comprehensive screen-reader/background-inert accessibility.
- Auth tabs use roving tab indexes, ArrowLeft/ArrowRight wrapping and Home/End selection, with associated panel labels. Existing submission/reset/resend locks prevent switching during requests and entered credentials are retained.
- Live dive entry, gear and marine display strings, validation guidance and accessible labels use language-aware copy. Weather/category/role values remain in their original stored representation; arbitrary user text is not translated. Client-side page titles change with language; this is not an SEO metadata overhaul or a claim that all server errors are translated.

`scripts/pc-keyboard-language-regression.mjs` executes actual transpiled application hooks/components in isolated deterministic state/DOM models. It passed translation coverage, Chinese preservation, actual editor drafts and weather/category values across language switches, modal focus/Tab/IME/busy/nesting/replacement/cleanup, and auth keyboard/busy/credential-retention checks. It performs no network requests, account creation or database mutations. Models do not replace real recovery-browser acceptance.

All 11 local suites passed: keyboard/language, dive log, PC concurrency, marine/gear, marine help, forum interaction, media, profile, certificates, forum volume and forum social. Targeted application ESLint, production client/server build, offline asset generation and scoped diff whitespace checks passed. Full TypeScript checking still fails on the previously recorded `__root.tsx`, `forum-post-preview.tsx` and `profile-preview.tsx` errors, with no diagnostic in this repair's changed modules; global type-check success is not claimed.

Recovery-only deployment permission has been requested for this repair. At this checkpoint no fixed recovery deployment or production deployment has been changed, no migration added, and no real recovery-browser acceptance of the repair has run. The registered dive audit workflow remains restored. Production release requires separate approval after recovery acceptance.
