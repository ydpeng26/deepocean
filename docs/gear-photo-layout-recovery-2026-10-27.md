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

- Recovery source `39648ce056be16f492c17829bfb2f66aff81d325` published non-force to the isolated branch. Recovery Ready deployment `3DnwVJQbzuhuGTmTxGY5wscRJbEP` rebuilt with recovery Production environment and assigned only `supdiver-recovery-test.vercel.app`.
- Read-only checks of 67 public JavaScript assets passed: recovery backend only, original/cutout toggle and local processing bundle, removed passport copy/gear panel, compact blocked-user manager and removed trending panel. An unused legacy translation entry remains in the shared dictionary; it is not the rendered equipment panel.
- User subsequently logged in and authorized the synthetic equipment/photo acceptance below.
- Formal deployment is not authorized for this change set and has not been performed.

## Browser acceptance in progress

- Native Chrome recovery account 三节: all three log photos visibly rendered (castle rock, SHARK POINT, gato). Passport explanatory sentence absent. Forum large panels absent; compact blocked manager opens and Escape closes it without relation changes.
- Generated fixture selected via native file picker. Local cutout removes white backdrop and the original toggle restores it. Browser visual inspection caught intrinsic image overflow; follow-up `b10acfabcceb45cd7f04c699e2ed3167f69b154e` adds an absolute image inside a positioned clipped fixed-height container. Also removes auto left margin so blocked manager is adjacent to My posts.
- Synthetic record saved successfully: `f3aa7395-5557-45f8-8ece-4d276a33ad4c`, marker `临时装备验收-20261027-1118`, model `纯背景图片测试`, owner `97277c3f-3d5a-432d-b1e6-c3505215108b`.
- Exact test object: `gear-photos/97277c3f-3d5a-432d-b1e6-c3505215108b/f3aa7395-5557-45f8-8ece-4d276a33ad4c-87b431c71b917f241f933c95833aa6da87b8fdcc0ff6ec7f878ff3fb5bfa9d27.png`, verified MIME image/png, 3391 bytes. Both row and object subsequently cleaned as described below.
- New actual-component regression checks positioned/clipped equipment image and adjacent blocked control; targeted regression, ESLint, build and offline asset generation passed for follow-up.

## Final recovery acceptance

- Follow-up source b10acfa promoted only on recovery. Ready rebuild `4HQF2yqdyhCS2e5Ugy51DhgCxAcj` assigned `supdiver-recovery-test.vercel.app`, with source branch verified in Vercel. Public-resource isolation checks all passed again.
- Hard reload of equipment page confirmed saved transparent PNG renders in both list thumbnail and fixed-height editor, no form overlap. Original/cutout switch had already been visually confirmed before save. This is a synthetic light-background fixture acceptance, not a guarantee of complex-background segmentation.
- Final forum desktop screenshot confirms blocked-user button immediately after My posts, no removed sidebar panels. Existing relations unchanged.
- Deleted exactly the temporary gear via application confirmation, then exactly the generated PNG via recovery Supabase Storage UI. Independent read-only query confirmed `temporary_gear_remaining=0`, `temporary_photo_remaining=0`, `account_gear_count=2`. Original two equipment items retained. No production data, photos or release changed.
- Temporary test row and PNG are permanently removed and were disposable fixtures; no recovery needed. No background cleanup process or broad delete used.
- Remaining boundary: no mobile-device acceptance or fresh file-picker run after the containment-only change; initial native file-picker processing/toggle, saved PNG reload, and actual-component regression cover the changed flow. Formal publication still requires separate approval.
