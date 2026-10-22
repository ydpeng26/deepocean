# PC marine help, suggestions and forum sharing audit — 2026-10-23

## Scope

User approved starting the next remaining PC inspection. Existing author handling is manual: read suggestions, edit species name and close help. No structured accept/reject suggestion status, new taxonomy decision, moderation rule, schema change or production release is inferred from this audit. Passport/preview features and mobile remain deferred.

Two newly created confirmed `example.invalid` accounts, generated text and tiny generated images were used only on recovery project `esovqvampbrhuhamkfcs` and site `supdiver-recovery-test.vercel.app`. Browser production origins are blocked. Generated media byte comparisons occur in the cloud runner only; no human data, media, database or secrets were exported/downloaded to the workstation. No mail, screenshots, traces or artifacts were produced.

## Evidence

- Runner `346e016396cf24a77da9fd3e0ca42c1a620572f9`; application unchanged from accepted forum app `8e7da88` (production release source `d5fbdef`). `git diff d5fbdef HEAD -- src` was empty before the run. Recovery site was not promoted for this diagnosis.
- https://github.com/ydpeng26/deepocean/actions/runs/39829778582 — job `120002530005`.
- Finished diagnostic: `AUDIT: complete=true findings=4`. Green workflow status means the diagnosis completed, **not** that the feature passed.
- Registered `recovery-marine-gear.yml` was overridden only on the isolated audit branch for dispatch, then restored byte-for-byte to baseline. Separate manual-only `recovery-marine-help.yml` preserves the audit.

## Four reproduced problems

1. Two synchronous suggestion submissions save two suggestion rows. The online form lacks a synchronous submission guard, and insertion generates a fresh server UUID on every attempt.
2. A suggestion INSERT can commit but lose its response. The retained draft's retry inserts another suggestion rather than confirming the first one.
3. The suggestion textarea remains editable while a request is pending. Text typed during that request is cleared by the earlier successful response.
4. A failed share RPC can leave an uploaded private forum image at fixed path `owner/encounter-ID.jpg`. If the owner then replaces the source photo and retries, upload duplicate handling reuses that old file. The RPC reads current source metadata, so the resulting forum post has the **new species name and old photo**. Cloud byte comparison verified the shared copy matched the old generated source rather than the replacement; actual hashes or payloads were not printed. Existing source-encounter uniqueness correctly prevents duplicate posts, so this is stale-photo reuse, not duplicate forum posts.

## Passed

- Real browser owner publishes unnamed help with generated photo; species defaults to pending identification. A second account discovers open help but not the private encounter row, and has no owner edit/share controls. The test deliberately reuses an owned synthetic file in another open-help row; this case is not evidence that that file itself is private.
- Viewer submits a normal suggestion; owner reads it in the actual browser. A definitely rejected suggestion retains its draft and can be retried.
- Shared post uses current name and encyclopedia topic. Repeated share yields one post; outsider RPC share is denied.
- Owner edits name and closes help. Viewer reload no longer shows that help or its suggestions, and server rejects further suggestions. The separately shared forum post remains visible.
- Deleting the original synthetic encounter cascades its suggestions, detaches the forum source reference, and retains the independent forum post and copied photo. Viewer reload and fresh forum-photo signing still work, matching the stated product behavior.
- Both exact generated accounts were removed and verified absent; all dependent marine/suggestion/forum rows and generated images under their exact UUID prefixes in both buckets were removed and verified absent. No existing user rows or orphan files were cleaned.

## Next boundary

Suggested repair: synchronous owner-aware suggestion lock, disabled pending textarea, stable suggestion request IDs with owner/encounter/body retry confirmation; versioned immutable share-copy paths with a server-side expected-source-photo check before creating the forum post. The fourth repair requires changing/extending the database sharing function so the client and server agree on the photo version and reject stale snapshots. Seek user approval for that recovery database-function change before implementing/applying it; no permission broadening or historical post/photo rewrite is proposed. Validate on recovery first, then seek separate production approval. Structured suggestion accept/reject buttons remain a separate product decision, not an assumed requirement.

This is not complete image-format, cache revocation, large-list, cross-device concurrency, moderator or mobile coverage. Closing help does not revoke separately shared copies or previously downloaded/cached images; prior privacy limitations still apply.

## Authorized repair checkpoint

The user approved fixing all four findings and adjusting sharing functions only in recovery before separate production confirmation. Suggestions use a client request UUID with expected owner/encounter/body confirmation, including duplicate-key races; input length is validated before insertion. The real form uses the shared synchronous lock, disables pending text input, retains failed drafts/request IDs per account and encounter during the mounted page, and ignores late completion after unmount/account change. Share and delete actions now participate in the same UI lock. No structured accept/reject status is added.

New migration `20261023030000_marine_help_snapshots.sql` adds owner-only `share_marine_encounter_snapshot(uuid,text)`: lock the owned source row, confirm expected source path, derive immutable copied path from SHA-256 of that source path, require source and copied objects, then create at most one independent post. Existing shares return their unchanged post. Old fixed-path API calls may open existing shares but cannot create a new share until the old client refreshes. This intentionally prevents cached old code from silently publishing the stale temporary image. No existing post/photo rewrite, delete, new table, column, bucket policy or visibility expansion is included.

The frontend re-reads the owned current source, creates/reuses the corresponding immutable version copy, checks account identity across upload/RPC boundaries, and calls the new snapshot function. A stale source version is rejected by the server. `recovery-marine-help-schema.py` applies this exact migration transactionally only in the hardcoded recovery identity, checks stored migration source on retries and confirms anonymous RPC denial/private buckets; production connection identities and override parameters are rejected.

Local `marine-help-regression.mjs` passes API suggestion idempotency/races/invalid input/account checks, failed-share then replacement/current-source reread and stale-snapshot rejection, and real form lock/pending text/failed draft/stable retry/unmount checks. Existing marine/gear regression passes unchanged; production build and targeted marine lint pass with the existing API explicit-any rule excluded. Recovery application/schema/cloud strict acceptance is pending. Do not treat the earlier diagnostic run with four findings as acceptance.

## Completed repair acceptance — 2026-10-23

- Application and runner `185b371c4665290c08f0f12e6a9e5337415c8a4f` (implementation `e5a7f76` plus a request-ID type annotation correction). Native Vercel verified Ready / Production environment of **supdiver-recovery-test only** / fixed recovery domain / source 185b371: https://vercel.com/ydpeng26s-projects/supdiver-recovery-test/6BDrPyEgoC8N73pMGMpKpzDWcG5j .
- Cloud run https://github.com/ydpeng26/deepocean/actions/runs/39832790129, job `120013070137`: migration stage and browser stage completed success; `AUDIT: complete=true findings=0` with `MARINE_HELP_EXPECT_FIXED=true` (findings fail the job).
- Recovery-only migration source/history match, anonymous function denial and private buckets passed. Actual anonymous and outsider snapshot-RPC attempts, missing prepared version and mismatched source were denied. Preparing a copy and then changing the source path also prevented publication. Old fixed-path clients are blocked from new creation until refresh; this is intentional compatibility behavior, not a silent fallback to stale images.
- Browser suggestions: normal round-trip, rejected write/draft retry, synchronous double submit with one row, committed/lost response retry with one row, and disabled pending textarea all pass.
- Failed share followed by source replacement now yields the **new source photo bytes and current metadata**. Repeated share remains one independent encyclopedia post; outsider share remains denied.
- Owner manual rename/close hides help and suggestion rows from the other account and rejects further suggestions, without retracting the already-shared post. Original deletion removes dependent suggestions, preserves the detached forum post and independently accessible copied photo. Both browsers verified the expected retained forum behavior.
- Both disposable accounts and their generated encounters/suggestions/forum posts and all generated image objects under exact recorded UUID prefixes in both buckets were removed and verified absent. No human data, old orphan objects, SMTP configuration or production database was changed.
- Additional local forum-interaction and social-state regressions pass. Full TypeScript checking after the annotation repair shows only the previously documented root/preview errors, not new marine errors. Global repository type/lint cleanliness is not claimed.

Registered marine/gear workflow is restored byte-for-byte to baseline before release; the dedicated marine-help manual workflow retains the recovery-only schema guard and strict test. Main was re-read as `d5fbdef5cc0f602a28905f45d9e89a609c09b529`. **Production is not updated.** Release needs the user's separate confirmation to apply the exact tested function migration to production before deploying this application. No existing posts/photos should be rewritten or purged. The old-client refresh requirement should be disclosed at release.
