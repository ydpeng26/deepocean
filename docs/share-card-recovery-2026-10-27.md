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
