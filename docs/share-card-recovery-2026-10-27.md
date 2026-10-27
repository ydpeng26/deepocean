# Share keepsake — recovery implementation

Scope approved: implement keepsake cards; forum translation deferred. Existing log
list and detail have protected /share-card?dive=<id> entry points. Historical mock
redirects to real editor. Formal release is not authorized by this task.

Card uses owner's real record and supported original JPG/PNG/WebP photo, or an
explicit no-photo ocean background. Date/location/metrics toggles; note and display
name opt in, hidden by default. Custom excerpt edits image only, never the log.
Canvas PNG is 1080x1350; reviewed preview is exactly the file saved/shared. Generic
filename and file-only Web Share payload contain no private link/record ID. Native
share cancellation/fallback are explicit and never claim recipient delivery.

Private reads scope record and profile to current owner. Fresh record membership is
rechecked before private Storage download. Videos, external paths, removed paths,
oversized/failed images rejected. Same-account epoch/stamp guards, synchronous busy
lock, bounded requests, abort/unmount cleanup and object-URL revocation prevent old
previews or late results from being exported after edits/account changes. No upload,
database mutation, external image/font service or new package needed for generation.

Local build, targeted lint and 41 regression scripts pass. TypeScript reports only
eight pre-existing preview state literal-type errors outside this feature. New tests
exercise real render/data modules with synthetic canvas/storage; editor source guards
are checked separately. Live browser/export acceptance is pending, not implied by
local tests. References: MDN Canvas toBlob and Navigator share; Supabase private-file
download documentation checked.

User explicitly approved one temporary recovery dive and synthetic photo and exact
cleanup. Cloud suite uses the existing dedicated recovery test owner without changing
password, profile or existing logs/photos. A no-email generated link establishes only
its isolated test session; local-scope logout removes that session. Browser REST reads
are narrowed to exact fixture IDs; synthetic profile response avoids exposing the
human profile/name/avatar. Browser cannot write records or fetch unrelated photos;
synthetic fixture creation/cleanup stays in bounded cloud test calls. No database,
image or credential artifacts are downloaded to this workstation or uploaded as CI
artifacts. Formal origins are blocked. No account creation or deletion is performed.

Published implementation bfaba7809af2db36c6f668a6d2c28ca40a84029d to isolated branch;
Ready preview F9XAD6AJbk4SqNTotTHSK6hNfxjg. Test-only title wrapping fix 914adfa
does not change app source. User explicitly approved recovery project's Promote to
Production (not formal deepocean). Modal listed only supdiver-recovery-test.vercel.app.
Vercel email reauthentication is pending; user asked to complete it directly. Live
fixture suite has not been dispatched and no temporary dive/photo has been created.

## Completed acceptance

User completed Vercel email verification. Recovery Production rebuild
F3g3fS7j1Jp6YWCFPv6UAPNb7QBV is Ready, stable alias
supdiver-recovery-test.vercel.app, app source bfaba7809af2db36c6f668a6d2c28ca40a84029d.
Later commits through e7dd2f11822898a79db2567623ffcf7e51065ed4 only corrected
acceptance fixture/session setup, exact download endpoint allowlist and test locators;
git diff against bfaba78 for src/public/supabase is empty.

Cloud run 40491138453 / job 122145083004 succeeded (34s job, 27s acceptance step).
Read the actual expanded step output in Chrome, not just the green status:
- Real private synthetic photo generated PNG 1080x1350. Downloaded bytes exactly
  matched the reviewed preview. Filename generic, with no private link/ID.
- Opt-in excerpt/name rendered; hidden location/date/metrics/note/name did not
  appear in actual canvas text calls. Changing controls invalidated old export.
- Unsupported system-file-share fallback and simulated native AbortError worked;
  payload was files/title only. No external recipient delivery was attempted.
- Explicit no-photo background and 390px viewport without overflow passed.
- Source log note/photo references stayed unchanged; missing record failed closed.
- Browser made no formal or unrelated private requests. Exact temporary row/photo
  removal and local-scope fixture session logout completed.

Earlier runs 40487540623, 40488847893, 40489716847 and 40490503355 stopped on test
setup/assertions and verified exact cleanup each time. Independent SQL between runs
confirmed no CARD-ACCEPTANCE rows/photos remained. The first two isolated-browser
attempts blocked the SDK's alternate exact photo download endpoint; their timeout
did not establish a production-feature defect. Long fixture title wrapping and a
textbox locator were then corrected without changing app rendering. GitHub log
download endpoint returned 401; logs were instead read through the existing browser.

Native Chrome also confirmed real list entry buttons and real owned-record editor
load, without exporting existing private photos. Formal www.supdiver.com and main
were not updated for this feature. Await user acceptance/formal release approval.

## Requested white information panel layout

Layout-only revision: keep the 1080x1350 export, use the upper 780px for the
photo and a white lower panel for location, title, date, optional note and dive
metrics. Signature is right-aligned as `— display name`, not an Auth user UUID.
Photo cropping now follows the photo section's aspect ratio. Generation, save,
file sharing and opt-in privacy controls are unchanged.

Inspected actual renderer output in Chrome using a local synthetic ocean image,
ordinary content and a two-line Chinese title with a three-line note. Corrected
location/title spacing after the first visual pass; final examples have no
overlap or overflow and signature remains inside the white panel. No existing
account, dive or private photo was read or changed for this layout check.
Regression assertions cover white panel bounds, text placement, crop geometry,
dash signature and alignment, alongside existing privacy/export checks.
