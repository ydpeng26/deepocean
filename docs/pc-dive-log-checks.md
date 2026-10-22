# PC dive log boundary audit — 2026-10-22

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
