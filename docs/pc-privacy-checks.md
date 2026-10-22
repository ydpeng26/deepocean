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
