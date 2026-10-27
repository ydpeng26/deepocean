# Bounded backend capacity protocol

User authorized up to 30 disposable recovery users, 100 synthetic posts, 100 dives
and generated images, followed by exact cleanup. This protocol sends **no traffic
to Vercel**: its published policy requires platform authorization for deployment
load tests. No formal data, settings, plan or credentials are changed.

The test runs manually on the isolated GitHub branch only, using the existing
recovery secret solely inside the ephemeral cloud runner. No secret, private photo,
raw payload, browser trace or data artifact is exported to this workstation. Logs
contain only timing/count/error-category metrics and exact fixture IDs if cleanup
requires intervention. No mail is sent. Actual source modules forum.ts/dives.ts are
transpiled in memory with the installed pinned Supabase SDK and per-user real JWT.
Local getSession is supplied from each already authenticated fixture session;
backend reads/writes still enforce the real member JWT/RLS. This is not login-load
testing or a server-role database benchmark.

Recovery is Seoul, formal is Singapore. Both were read-only checked with max
connections 60 and shared_buffers 224MB; same organization Free tier. Postgres
minor versions differ (17.11 vs 17.6). This does not establish identical physical
compute, contention, disk, region latency or full configuration equivalence. Before
fixtures both had 4 profiles, 3 dives and 0 forum posts.

## Fixed workload / pass gate decided before live results

- Stages 5,10,20,30 active sessions, 120s each; 180s confirmation at 30 if all pass.
- Each distinct real member runs one sequential cycle every 45s, staggered 250ms.
  The cycle reads forum, own dives, own profile and own community stats, downloads
  two synthetic forum images (plus an own dive image for the three image owners),
  and every other cycle edits its exact seeded dive using actual revision checks.
- Shared fixture set: 100 posts with ~1KB bodies, 100 dives spread across 30 users
  (3 or 4 each), six generated 128x128 PNGs (~49KB each). Empty relation tables;
  no thousands of comments/likes/follows. Not representative of a photo/video-heavy
  or long-history user.
- Owner-filtered lists preserve original app selects, exact count, ordering,
  pagination, membership logic, aggregates and image signing. Forum requests have
  an additional generated-owner IN filter to prevent reading restored people's
  public content; this is a documented query difference from the live website.
- Pass: each session completes >=2 cycles; saves >=1/user; forum samples >=2/user;
  p95 forum <=2500ms and other operations <=1500ms, operation error rate <1%,
  no HTTP/transport errors, tester event-loop p95 <100ms and free RAM >200MB.
- Gate applies to completed operation samples including failures, not just HTTP
  responses. Dataset contents and save responses are independently validated.
  Driver CPU/RAM/event-loop and achieved RPS are reported to expose client limits.
- Hard guard: 12,000 requests and 180MiB response bodies before cleanup; any 429
  aborts; ten HTTP errors or five operation failures within a stage abort; 10s
  request timeout; 15-minute main deadline, 20-minute workflow deadline with cleanup
  outside the main AbortController. No security/rate-limit bypass configuration.
- Member token sessions are revoked, exact image paths removed via Storage API,
  tracked row IDs removed under their generated owners, then guarded generated
  Auth users removed and Auth/profile/row/file absence verified.

## Interpretation

Only a backend workload lower bound can be reported. If all 30 pass, state
"30 active backend sessions passed this scenario"; never "30 is the maximum" or
"30 people in China are guaranteed smooth on the production website". Excludes
Vercel SSR/CDN, browser rendering/interaction, domestic access, real photo throughput,
registration/login bursts, larger data volumes and hour-long stability.

Status: preparation only; no live run or capacity result yet.
