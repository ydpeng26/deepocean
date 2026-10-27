# Approved equipment/photo/layout formal release — 2026-10-27

User explicitly confirmed formal publication after recovery acceptance.

## Released version

- Main non-force fast-forward: `1b214971e14d737be4a146b72df541f3865742a2` → `818d78ff2ba1d1f297266362ec2d4792686d18a9`.
- App source matches recovery-accepted `b10acfabcceb45cd7f04c699e2ed3167f69b154e`; intervening changes are acceptance documentation only.
- No Supabase migrations, backend functions, environment variables, or GitHub workflow changes in this release.
- Vercel project **deepocean**, Ready Production deployment `FCYzdafNi9F3Dt7vmy9XiSGzoLrh`, generated domain `deepocean-ku8tffxpe-ydpeng26s-projects.vercel.app`; formal `www.supdiver.com` domain binding and source commit verified in native Chrome.
- Previous Ready Production rollback candidate: `D7WHsu1rfRosF1JnXSjaJQjJnbE1` / `deepocean-501cydtki-ydpeng26s-projects.vercel.app`, source 1b21497. No rollback performed.

## Verification

- All 39 local regression scripts passed again before publication.
- Formal Supabase `zmhtlhpeulhhcvlnjdrb` read-only metadata: gear photo_path column exists, gear RLS enabled, gear-photos private, 10 MiB limit, PNG permitted; authenticated owner-folder policies present. No policy changes.
- Formal public assets: 67 JavaScript bundles checked in memory, no private media download. All checks passed: formal backend only (no recovery backend), original/cutout toggle, local cutout module, passport explanation removed, forum panels removed and compact manager present, final clipped equipment image class and adjacent button CSS.
- First CSS verification assumed property order and failed that check; corrected verifier to inspect the declaration independently of minifier order, then all checks passed. No application code change was required.
- Native Chrome loaded formal homepage with Contact us and Register / Sign in entrances.

## Acceptance boundary

- Native recovery write acceptance and exact cleanup recorded in `gear-photo-layout-recovery-2026-10-27.md`: original/cutout preview, actual PNG saved and visible after reload, log photos render, forum compact manager opens/reads/closes. Temporary row and image independently verified absent; original two gear items retained.
- No formal account login, fresh private photo read, equipment write/delete, or mobile-device acceptance was performed during formal publication. This is recovery functional acceptance plus formal deployment/configuration/public-assets checks, not a repeated full formal write smoke test.
- No existing user records, photos, credentials, or authentication settings modified.
- Light/white solid-background handling remains deliberately conservative; complex backgrounds retain original. Original/cutout switch applies before saving the chosen upload.
- Existing clients may need to save drafts and close/reopen all SupDiver tabs/app windows to activate a waiting service-worker update.
