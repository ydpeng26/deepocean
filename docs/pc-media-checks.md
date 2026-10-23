# PC generated-media diagnosis — 2026-10-23

Next agreed PC checklist item after authorized forum completeness production release. Inspection only; no application fix, database/schema/permission change or site promotion. Existing formal main is `366efda18e9337840d56945caccb76f7b97b4ab0`. Recovery application has identical media code; no recovery application promotion was needed for this audit. Mobile and deferred passport/preview features remain out of scope.

## Method and boundaries

Cloud-only `scripts/recovery-media-audit.mjs` creates one confirmed disposable `example.invalid` account, synthetic canvas images and ffmpeg-generated clips in an ephemeral runner directory. The actual `src/lib/images.ts` is transpiled and executed in cloud Chromium, then actual application file input/save/reload paths are tested. No human photos, local media downloads, mail, screenshots, traces, stored sessions or exported artifacts. All Supabase traffic is pinned to recovery ref `esovqvampbrhuhamkfcs`; formal Supabase and formal domains are blocked in the cloud browser.

Samples: JPEG with EXIF orientation 6, PNG 4000×3000, WebP, MP4/H.264, MOV/H.264, WebM/VP9; a 100MiB+1 synthetic file tests the rejection boundary, not a playable >100MiB video. HEIC is generated from a synthetic JPEG using libheif/x265. Findings about one codec/container combination do not imply all MOV/MP4 codecs, iPhone HEVC, real camera color profiles, every EXIF orientation, huge compressed byte sizes, Safari or Edge are accepted. Resize dimensions are not a visual/colorimetric QA claim.

Simulated expiry returns HTTP 403 to signed object downloads. It diagnoses media failure handling; it is not a real-hour clock-expiry or revocation test. Previously issued links/cache revocation limitations remain as documented in the earlier privacy audit.

## Source observations

- `prepareWebImage` uses `createImageBitmap` with `imageOrientation: from-image`, falling back to HTML image decoding, and outputs JPEG with a maximum edge. No built-in HEIC transcoder is present; unsupported decoder failures advise JPG/PNG/WebP despite the file picker accepting `image/*`.
- Dive uploads preserve video container extension/MIME without transcoding. Images get originals and thumbnails; videos have an empty thumbnail path. Detail and edit pages use `<video>` for recognized video extensions.
- Detail has no image/video `onError` handling or in-page media reload control. Signing queries have 55-minute stale time and no window-focus refetch, not a scheduled refresh timer. Edit signing errors are swallowed. A URL can exist even when its download fails, so the missing-URL placeholder is insufficient.
- Log-list covers and passport's latest cover receive the first thumbnail or original path and use CSS background images without video-type handling. Video-only entries therefore need a video-aware cover/placeholder; this must be confirmed in the actual page before reporting as cloud-reproduced.

## First cloud attempt

Runner `977accdba2ad7775c15ba45938f723d95d0e1494`; run https://github.com/ydpeng26/deepocean/actions/runs/39924053165 ; job `120315995201`.

Passed actual image module: orientation-6 120×80→80×120; PNG 4000×3000→2400×1800; PNG/WebP→JPEG. Six mixed media saved together, three image thumbnails persisted; after reload, all generated MP4/H.264, MOV/H.264 and WebM/VP9 clips decoded their 64×48 metadata in desktop Chromium and images retained correct output dimensions. Oversized video was rejected without creating a row or losing entered text.

Confirmed finding: signed-download 403 leaves broken detail media without explicit media error/in-page retry. HEIC sample generation then failed before testing the application. This was **incomplete** (`complete=false findings=1`), not all-format acceptance. Exact generated account, rows, originals and thumbnails were cleaned and checked absent; ephemeral generated files removed.

Follow-up runner `ebb1094390a268456c0e3274b874d4f0232f57a3` adds the Ubuntu libheif x265 plugin dependency and a generated video-only list-cover probe. No application changes. Final follow-up result pending.

## Complete format/expiry diagnosis

Run https://github.com/ydpeng26/deepocean/actions/runs/39926155769 ; job `120322930004`; runner `ebb1094`: completed, `AUDIT: complete=true findings=3`. Green means the diagnostic completed, **not** that the product has no defects.

The initial image, six-file mixed upload/reload, video metadata and oversize rejection checks all passed again. Generated HEIC now encoded successfully; the application rejected it with the supported-format message. The three cloud-confirmed findings are:

1. Detail signed-download 403 leaves broken images/video without explicit media failure or in-page attachment retry.
2. Genuine HEIC can be selected via `image/*`, but the current conversion path cannot decode it in the tested Chromium environment. It gives JPG/PNG/WebP guidance; this is a format compatibility/picker mismatch, not evidence of lost existing media. Native HEIC support on every PC browser is not inferred.
3. A generated video-only log uses its MP4 URL as a CSS background image, without a video thumbnail or video-type placeholder. Detail video handling does not fix this list-cover defect. The analogous passport source path is a source observation, not separately cloud-accepted here.

The exact generated account, all generated dive rows, originals and thumbnails were deleted and independently checked absent. Temporary generated files were removed. No human recovery or production data was deleted.

Additional runner `ac33b24a06d9f5b5dded2227a95bfbbbf9e8e4c8` adds actual muted playback/time advancement for all three generated clips, not just metadata decode. No application code changes. Its result is pending.

## Actual playback and final handoff

Final run https://github.com/ydpeng26/deepocean/actions/runs/39934199168 ; job `120349602444`, source `ac33b24`: completed diagnosis, `AUDIT: complete=true findings=3`. All three generated MP4/H.264, MOV/H.264 and WebM/VP9 clips **actually played and advanced their playback time** in cloud desktop Chromium. All preceding image/conversion/upload/reload/oversize checks passed again; the same three findings were reproduced, without a new playback defect.

Exact generated account, rows, originals and thumbnails were cleaned and absence verified again. No exported media/artifacts. The original registered dive-log audit workflow is restored byte-for-byte to formal main; dedicated manual generated-media diagnosis remains only on the isolated branch. Application source and Supabase migrations are unchanged from `366efda`.

No implementation fix is authorized yet. Suggested next step: repair download-failure display/retry and video-aware list/passport covers; decide whether to provide HEIC conversion or explicitly restrict supported input types and show guidance before submit. Supporting HEIC in this browser requires an additional decoding/conversion design, not just renaming a file. Recovery-first verification and separate production approval still apply. This audit does not accept all codecs, camera files, browsers or mobile, and does not replace a real expiry/revocation test.

## Authorized repair in progress

The user requested the repair. Conservative HEIC approach: explicitly accept JPG/PNG/WebP in the dive picker, reject HEIC/HEIF before upload with bilingual conversion guidance, and retain the entered draft and existing attachments. No HEIC decoder, third-party conversion, format renaming, historic-media deletion or server migration is introduced. The shared image converter adds the same explicit HEIC guidance; non-HEIC decoding behavior outside the dive picker is preserved.

- New `DiveMedia` component handles failed image/video downloads independently from signing success. It renders clear loading/error states and explicit reload. Synchronous retry lock, owner/path/URL/version scope, late-error guard and unmount guard prevent duplicate clicks or stale callbacks affecting new media. Successful refetch changes the render version and remounts media even if the returned signed URL text is identical.
- Detail, edit, log cover and passport latest cover use this handler. Signed-query errors hide stale media, not just empty URLs. Editing media reload does not reset other form fields. Query keys include the owner; signing rechecks the expected account before and after each batch, deduplicates paths, signs at most 100 per request and preserves original empty slots/order.
- Media queries refresh every 50 minutes while active and refetch stale data on focus (45-minute stale time). This is not a guarantee that a suspended/background browser always refreshes before expiry; the error/retry path remains necessary.
- `diveCover` chooses a genuine photo and corresponding non-video thumbnail from mixed attachments. Pure-video records get an explicit video placeholder in logs and recent passport cover, not an MP4/MOV/WebM image background. No video poster extraction/transcoding is claimed. Unrelated deferred passport counters/saved-post/preview features are unchanged.
- Upload preflight validates the whole selection before hashing/uploading any sibling: invalid image format or oversized video cannot create partial new uploads from that selection. Existing ownership, immutable retry paths, six-file limit and numeric/save protections remain.
- Local `media-regression.mjs` uses the actual API/component source: input guidance, pure-video/mixed cover, sibling preflight, signing batch/order/missing-slot/owner switch, download failure, retry lock/remount/stale callback, signing error, video error/no automatic loop, pending versus failure and unmount cases pass. Existing dive-log regression also passes, including added actual-form early HEIC rejection/draft retention; certificate, marine/gear and marine-help regressions pass.
- Build and offline asset generation pass. Targeted functional lint passes with existing compressed passport-file formatting excluded; its original formatting was preserved to avoid a large unrelated rewrite. Whole-repo TypeScript retains only the previously documented root/preview errors, not errors in the changed modules.
- Strict recovery runner is prepared under `MEDIA_EXPECT_FIXED=true`: actual image/video upload/playback, simulated signed-download 403→explicit retry, edit signing failure→retry without saving/losing draft, early genuine-HEIC rejection, and video-only log/passport placeholders. This strict acceptance is **not yet run**. Updating the fixed recovery site awaits user approval; formal site stays unchanged at `366efda`.

The existing registered dive audit workflow is temporarily redirected only on the isolated media branch for pinned manual dispatch, then restored byte-for-byte to formal main. A dedicated manual-only `recovery-media-audit.yml` preserves the diagnosis. No backup or production workflow configuration is changed.
