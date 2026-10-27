# Gear photos and layout recovery changes — 2026-10-27

## Scope

- Remove the passport community-statistics explanatory sentence in both languages, without changing statistics calculations.
- Replace equipment-type explanation panel with a real image picker and private photo display.
- Locally process white/light solid, edge-connected backgrounds; preserve alpha in PNG. Ambiguous/complex backgrounds keep the original. Users can switch between original and cutout before saving. No external model, service, or additional photo transmission during preview.
- Correct log-cover positioning: the media component is relatively positioned internally, so give it a separate absolute wrapper and full width/height rather than conflicting positioning utilities.
- Remove forum trending/recommendation/large blocked-user side panels; put the existing private blocked-user manager next to the feed tabs, keeping its owner checks and paginated behavior.

## Storage and safety

- Existing recovery gear-photos bucket verified private, 10 MiB, PNG supported. Existing owner-folder policies retained; no database migration or policy relaxation.
- Upload only on Save; processed PNG is capped at 1600 pixels on its longest edge and 10 MiB. Original and processed previews are local and released on selection/unmount.
- Immutable object names combine the existing operation UUID and SHA-256 of the selected PNG. Retry accepts only the identical content path; no overwrite or deletion of existing photos.
- Existing user gear, logs, photos, forum relations and profile have not been edited for testing.

## Local verification

- All 39 regression scripts passed, including new generated-pixel background removal, alpha preservation, stable upload retry, account/foreign-path guards, actual cover wrapper and forum/passport structure checks.
- Touched TypeScript/TSX files passed targeted ESLint.
- Production build and offline-asset generation passed.
- TypeScript has the previously known literal-state errors in forum-post-preview/profile-preview; no new errors in touched files.

## Pending acceptance

- Recovery deployment and browser verification of actual log photos, the compact blocked-user button, and equipment original/cutout preview.
- Persistent synthetic equipment/photo test requires explicit temporary-record creation and cleanup permission; no such record has been created.
- Formal deployment is not authorized for this change set and has not been performed.
