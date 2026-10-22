# PC dive log boundary audit — 2026-10-22

## Repair work authorized after the audit

The user subsequently authorized repairing the seven categories below, recovery first, with a separate production release confirmation. No production deployment or historical row/object cleanup is included in that authorization.

Implemented for recovery validation: strict optional numeric parsing (valid negative temperatures retained); synchronous form lock and disabled fieldset/cancel/back while pending; mount-time expected owner; stable create UUID with matching-payload confirmation on retries; immutable owner/request/content-hash upload paths with duplicate-object reuse; path-keyed media previews and unavailable-item placeholders; six-file cap across existing and new media; ordered 500-row pagination with exact count/account/duplicate checks; nonnumeric unavailable totals and list retry. Existing community placeholders remain deferred.

Local synthetic script `scripts/dive-log-regression.mjs` exercises numeric boundaries, 1017-row pagination and page failures/account switch, ambiguous create/race retries, changed payload and owner checks, stable photo/thumbnail retry, oversized video, partial signing, and the real form synchronous lock/draft/unmount behavior. Local tests passed. Production build passed; targeted semantic lint passed with the existing unformatted passport file's formatting rule excluded. Full TypeScript checking still reports pre-existing errors in `__root.tsx`, `forum-post-preview.tsx`, and `profile-preview.tsx`, not the modified dive files. Recovery cloud strict acceptance is pending; do not interpret older diagnostic green runs as repair acceptance.

### Repair recovery acceptance (completed)

- Application and strict runner commit: `14e3d1cdfaffbad25290b24b713f72807648c335`.
- Recovery-only deployment: https://vercel.com/ydpeng26s-projects/supdiver-recovery-test/9zjPLTVibvyniLmjueEKWZgicoLD — native UI verified Ready, Production environment of the **recovery project**, fixed domain `supdiver-recovery-test.vercel.app`, source `14e3d1c`. This is not the production app project.
- Strict cloud run: https://github.com/ydpeng26/deepocean/actions/runs/39810869775 — job `119936439076`, completed success; `AUDIT: complete=true findings=0 strict=true`.
- Independent invalid-field tests reject negative depth, negative/fractional duration, malformed temperatures while retaining the draft. Corrupt PNG and over-100MiB video remain rejected. Local tests also verify valid negative temperature and account-change guards.
- Rejected row-save and committed-but-lost-response retries preserve one record and exactly two uploaded private objects (main photo plus thumbnail). Synchronous double submit creates one record; pending editor and cancel are disabled.
- Missing first media remains an unavailable slot, the remaining valid PNG remains an image, and removing it removes its own reference rather than the missing slot. Existing six media cannot gain a seventh.
- Load failure displays unavailable counts rather than zero; in-page retry restores all records. After adding 1005 generated historical logs, server total and rendered cards both equal **1014** (lower than the diagnostic run because invalid/duplicate rows are no longer created). All generated rows are included.
- Baseline ordering, combined search/filter, passport/map metrics, existing country normalization, and cross-account private-log isolation still pass.
- Both disposable fixture accounts and all their generated logs/photos/thumbnails were cleaned, with absence verified. No existing human rows, legacy orphan uploads, production data, SMTP settings, credentials or database permissions changed.
- The original profile workflow was restored byte-for-byte to baseline before preparing the release branch. Dedicated dive workflow remains manual-only and strict. Local profile, certificate, forum and marine/gear regression suites also pass.

Production release was subsequently authorized and verified below. This acceptance does not extend the coverage boundaries listed below (all video formats, every browser/date case, mobile or a new full restore drill).

### Authorized production release — 2026-10-23

User confirmed release and continuing the remaining work. Main fast-forwarded from `2c7576d` to `d4a3922d61365e236a20d2e976e4f6fee188125d` with an expected-old-SHA guard, without rewriting history. Native Vercel promotion rebuilt this tested version using production environment settings. Verified Ready / Production / `www.supdiver.com` / source `d4a3922` at https://vercel.com/ydpeng26s-projects/deepocean/7SPx1xfhdZuNy5sJwBUeoGqHjWxx . The production app source is unchanged from recovery-tested `14e3d1c`; later changes only restore the profile workflow and record acceptance. No schema migration or authenticated production fixture writes were performed.

## Scope and evidence

The user approved continuing PC inspection after the forum release. Diagnosis only: no application fixes, schema/permission changes, production branch updates, or website promotions. Community counters, saved-post integration and preview-only features remain deferred; mobile is excluded.

Cloud-only script `scripts/recovery-dive-log-audit.mjs` uses two newly generated confirmed `example.invalid` accounts, generated log data and a generated 1-pixel PNG on hardcoded recovery project `esovqvampbrhuhamkfcs` and fixed recovery site. It has only the recovery service-role secret. Browser production origins are blocked. No mail, human account changes, screenshots, traces, database/photo downloads to the workstation, or published artifacts.

Initial run: https://github.com/ydpeng26/deepocean/actions/runs/39792159209 — job 119870680784, runner 5299562. Completed diagnosis with 11 findings and both fixture cleanups verified. It did not wait for the edit form's asynchronous photo controls before counting removable items, so it did not establish the removal-index result.

Final strengthened run: https://github.com/ydpeng26/deepocean/actions/runs/39797320546 — job 119887857616, runner 85c4ca9. Same unchanged application baseline 2c7576d; only the harness changed. It waited for all five alias-fixture logs and the media controls, and recorded derived count diagnostics. Completed with **12 observations**, grouped into seven categories below. A green diagnostic run is not a defect-free acceptance pass.

## Seven problem categories — not fixed

1. **Numeric validation:** negative maximum depth and duration persisted. Non-numeric temperature text and a comma decimal were silently converted to null instead of rejected. Negative temperatures themselves were not treated as invalid; the reproduced negative-value issue concerns depth/duration only.
2. **Save overlap and ambiguous retry:** two synchronous form submissions created duplicate logs. A committed save whose response was replaced by a synthetic failure created another log on retry. While saving, text fields and Cancel remained enabled. There is no stable create ID or shared synchronous form lock.
3. **Repeated media uploads:** rejected row saves left the generated photo and thumbnail privately stored; each retry uploaded new copies of the same file. The application allocates random upload paths each attempt and does not retain confirmed uploaded paths for retry. This is not a claim that old private objects should automatically be purged; retention/deletion requires separate authorization.
4. **Partial media-signing index mismatch:** an absent first MP4 path followed by an existing generated PNG resulted in the PNG URL rendered as video. Filtering empty signed URLs shifted indices relative to original paths. Editing and removing the only visible media item then removed the missing slot, leaving the displayed PNG path referenced. This changes the wrong record reference, not another user's file.
5. **Total attachment count:** a log with six existing images accepted a seventh via edit. The picker limits newly selected files to six but does not enforce six total including existing media.
6. **Load failure misleading/incomplete UI:** a failed list GET shows an error message, but overview counts still show zero logs/countries; there is no in-page retry button. The harness uses HTTP 400 to reach terminal error state without layered PostgREST 503 retries.
7. **Large-history completeness:** 1,017 generated logs existed according to exact server count metadata, but only 1,000 cards rendered. `listDives` does not paginate. Counts, durations, search results and other consumers of that list can therefore silently omit records beyond the API row limit. This is distinct from the intentionally deferred community statistics.

## Verified passes

- Three-log baseline date ordering, trimmed case-insensitive notes search, region search combined with country filter, and no-result state.
- Baseline passport and map: 3 logs, 2 countries, 130 minutes (2h 10m), maximum depth 32m; map marker counts agree with the fixture.
- Common country aliases are already normalized by database trigger `normalize_dive_country_name` (migration 20261017143000). After inserting Chinese and lowercase Indonesia labels, actual fixture count was five, with two stored countries, two displayed countries, and two map markers. Do not report the initial source-only suspicion as a defect or unnecessarily add another normalization migration.
- Blank required location fields do not save.
- Corrupt generated PNG is rejected without a row or loss of text. Generated video larger than 100 MiB is rejected without saving a row.
- A rejected save retains notes/text and commits no row (but leaves private uploads as noted).
- Another account's private generated log is not visible to the test viewer.
- Both runs removed both generated accounts and verified 404, all their log rows absent, and generated image/thumbnail files absent under exact recorded UUID prefixes. Cleanup did not search/delete human account content.

## Boundaries and next step

Not exhaustive coverage: valid MP4/MOV/WebM playback, all camera/HEIC/orientation/large-image formats, expired or cached links, all date/time-zone cases, extreme text layouts, every concurrent edit/account-switch variant, every PC browser, mobile, and a new full restore drill remain outside this run. Older basic create/edit/delete and offline sync acceptance are documented separately and are not substitutes for these newly reproduced online-form defects.

Recommended repair order, subject to user approval: input validation and reliable save/expected-account/idempotency → stable photo retry/reference mapping and total-count limit → complete paginated reads and trustworthy error/retry states. Keep historical rows and private uploaded objects intact unless a separate cleanup/migration is approved. Validate with recovery fixtures, then seek separate production release confirmation.

The registered profile workflow is restored byte-for-byte to baseline 2c7576d after dispatch. A dedicated manual-only `recovery-dive-log-audit.yml` preserves the diagnosis. Neither website nor main was changed by this audit.
