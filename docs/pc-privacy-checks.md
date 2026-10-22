# PC privacy audit — 2026-10-22

## Scope and evidence

Diagnosis only. Production application, database policies, real accounts and photos were not modified. The user deferred community counters, saved-post integration and preview-only features until the remaining PC checks are complete. Mobile is excluded.

Cloud run: https://github.com/ydpeng26/deepocean/actions/runs/39733826758
Job: 119674787829. Runner commit: 5970237. Script: `scripts/recovery-privacy-audit.mjs`.

The registered profile workflow was overridden only on the isolated `codex/pc-privacy-audit` branch to execute this API-only privacy diagnostic. No application changes or recovery website promotion were needed. The workflow was restored byte-for-byte to the main baseline after the run. Main was not updated.

Two newly generated confirmed `example.invalid` accounts and a generated tiny PNG were used on hardcoded recovery project `esovqvampbrhuhamkfcs`. No human mail, screenshots, traces, artifacts or database/photo downloads to the workstation. Credentials and signed URLs are never printed. Both fixture accounts, their rows, and their exact UUID-prefixed objects were removed and verified absent.

## Verified passes

- Other accounts cannot read a private marine encounter, read/sign its photo, or update its row. Anonymous photo access denied.
- Opening help allows another authenticated account to read the encounter/photo.
- Closing help hides the original row and prevents fresh image signing through the original record.
- An eight-second signed link was fetched successfully before expiration and rejected after an eleven-second wait. This tests actual expiry, not a one-hour wait.
- The marine-to-forum RPC refuses another owner's encounter; repeated owner sharing returns the same post ID.
- Forum photos are readable by members, not anonymous users. The owner can remove the synthetic post; the removed post is no longer listed.

## Findings — not fixed

1. **Marine photo access can be reopened through a foreign reference.** Account B learned A's photo path while A's help was open. After A closed help, B could create B's own help encounter referencing that path and obtain a fresh signed link for A's photo. Source migrations permit owner-authored encounter rows without checking photo-path ownership; Storage allows a photo referenced by any visible open-help row. This was reproduced in recovery, not against production data.
2. **Deleted forum posts do not revoke fresh member access to their images.** After A deleted its shared post, B could still sign its known image path. Source Storage policy allows members to read all `forum-media` objects regardless of a current post reference. This is not merely an already-issued-link expiry delay. Automatic object garbage collection was not previously promised or tested; deleting files alone is not the only possible fix.
3. **Already-issued marine signed links survive closing help until expiry.** Observed using an eight-second test link; current application requests 3,600-second links. Expected token behavior, but privacy UI/requirements must account for the possible residual access window. Content already downloaded cannot be recalled. No immediate revocation guarantee should be claimed.

The workflow completed its diagnostic successfully **with three findings**. A green run does not mean privacy acceptance passed. Production policy equivalence has not been independently verified in this round; the current source contains the same permissive policy definitions.

## Remaining order

Priority: seek authorization for the two privacy access-control repairs, validate using recovery fixtures, then request production release separately. Do not silently change production permissions or purge existing uploads.

After privacy: full forum interactions/comment failure paths → dive input/filter/map/statistics/media edge cases → PC browser/width/zoom/keyboard/English checks → fresh restore coverage including certificates and external configuration reconstruction. Fresh full restore requires a clean isolated destination; never overwrite the populated recovery project.

Community counters, saved-post integration, and preview-only settings/share card remain deferred as requested.

## Authorized recovery-only repair — 2026-10-22

The user approved the two access-control repairs and recovery validation, not production rollout. Migration `20261022070000_photo_reference_privacy.sql` was applied only to recovery using `RECOVERY_DB_URL`, with a strict cloud/project/host/port/database guard and a transaction plus migration-history record. No production credential is available to this workflow.

- Marine and forum CHECK constraints require new/updated records' image paths to belong to their author. They are NOT VALID to avoid scanning or rewriting existing rows. Legacy invalid rows are not repaired; editing one will require correcting its photo reference. The read predicates independently require the referencing author to match the object path owner, preventing legacy foreign references from granting access.
- Member photo reads require either ownership or a currently visible, owner-matching open-help encounter/forum post. A restrictive SELECT policy prevents another permissive policy from bypassing this boundary. Other buckets are outside this new restriction.
- The original author can still read retained uploads privately. No existing photos, posts or encounters were purged, rewritten or mass-updated. Closing marine help does not retract a separately shared forum copy.
- Supporting indexes were added for exact photo-path lookups.

First repair run: https://github.com/ydpeng26/deepocean/actions/runs/39736075451 (job 119681938603, commit 6294ce5). Schema and ownership/signing checks passed, but the final direct-download assertion failed because a previously requested authenticated URL still returned 200 immediately after deletion. Both test accounts/rows/photos were cleaned and verified. Do not describe this run as an overall pass.

Follow-up complete run: https://github.com/ydpeng26/deepocean/actions/runs/39737265541 (job 119685800065, commit 6666f5a). Same migration, with an explicit distinction between previously read URLs and fresh cache-bypassing requests:

- Private marine row/photo and anonymous/outsider access checks passed.
- Normal help opening/closing, normal second-account help and owner-only idempotent forum sharing passed.
- Both INSERT and UPDATE attempts to attach another author's photo were rejected with CHECK violation, for marine encounters and forum posts.
- Unpublished forum uploads cannot be freshly signed by other members. After deleting the post, other members cannot issue fresh signed links or perform a fresh cache-bypassing authenticated download. The author retains access to their own private upload.
- An eight-second test signed URL was rejected after expiration in this tested recovery environment.
- Two generated accounts, their dependent rows, and exact UUID-prefixed generated images were cleaned and verified absent.

**Residual access boundary, not an immediate-revocation claim:** an earlier authenticated download URL still returned 200 immediately after deletion, while the same path with a new nonce returned 400. Response header was `private, no-cache`, no Age header. This is consistent with cached URL access; its expiry duration was not established. Existing signed links also survived closing help during their test validity period. Supabase documents that cached content can outlive token expiry with Smart CDN; do not infer a universal one-hour cutoff or claim all copies are immediately inaccessible. See https://supabase.com/docs/guides/storage/cdn/smart-cdn . Downloaded copies cannot be recalled. Full immediate withdrawal would require a separate design/cleanup decision, not silent deletion of retained images.

The follow-up workflow completed **with the two fresh-access exploits blocked and two residual-link/cache observations recorded**, not with zero privacy caveats. No UI source change or website redeployment was required. The registered profile workflow is restored byte-for-byte to baseline; a separate manual-only `recovery-photo-privacy.yml` preserves the repeatable repair/test procedure. Production remains unmodified and awaits separate release confirmation.
