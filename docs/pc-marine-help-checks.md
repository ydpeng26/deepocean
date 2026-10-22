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
