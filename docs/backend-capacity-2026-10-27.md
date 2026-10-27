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

## Completed live backend test

Run https://github.com/ydpeng26/deepocean/actions/runs/40511175687, job 122213185220,
source 3288b19c5811fd80d010c2850de847bf970648ea. Full safe job logs fetched through
the GitHub connector and parsed, not inferred from a green workflow status. All
five measured stages meet the predeclared pass gate. All 42 local regression
scripts and scoped ESLint pass. Application src/public/supabase diff from the
formal release 01fa917 is empty; formal main was not advanced for this test.

| Active sessions | Measured seconds | Forum p95 ms | Dive list p95 ms | Save p95 ms | Image p95 ms | HTTP errors |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | 122.8 | 1303 | 530 | 642 | 1043 | 0 |
| 10 | 122.9 | 908 | 370 | 356 | 982 | 0 |
| 20 | 122.8 | 742 | 179 | 434 | 931 | 0 |
| 30 | 126.2 | 728 | 185 | 592 | 900 | 0 |
| 30 confirmation | 183.6 | 778 | 191 | 538 | 895 | 0 |

320 complete user cycles; 191 verified saves; 3,998 measured HTTP requests across
the stages; no HTTP/transport/operation errors, cycle overruns or interrupted
stages. Peak stage-average throughput was 9.03 HTTP requests/second, not 30 RPS.
30-user forum p99 was 2617ms in the first stage and 1129ms in confirmation: tail
latency exists even with no errors. Connection/cache warm-up can explain the
slower 5-user stage; this is not proof more users improve performance. Three-minute
confirmation is not an hour-long soak or a stress test to resource exhaustion.

Tester had 4 available CPUs, event-loop p95 20-21ms, CPU usage <=0.029 core
equivalents, memory RSS <=184MiB and free RAM >=14973MiB. No evidence the test
generator was saturated. These are generator measurements, not database CPU/RAM.
Source is a GitHub-hosted cloud runner, not a mainland China residential browser.
Six PNGs were 49,363 bytes each. Setup/test/cleanup total: 4,613 requests, 82.96MiB
response bodies. This excludes request-body bytes, TLS overhead and platform's
own billing measurement; no exact cost or billed-egress claim.

Cleanup marker reports exact generated accounts/rows/images removed and temporary
sessions revoked. Independent recovery SQL afterward confirms capacity users,
profiles, posts, dives and Storage images all zero; existing profiles 4, dives 3,
gear 2 and forum posts 0. No real records were edited. Temporary data was permanently
removed as explicitly approved; no recovery of the disposable fixtures is needed.

Conclusion: **30 distinct active authenticated backend sessions passed this exact
small-data paced workload.** Maximum capacity was not reached or tested. A cautious
PC pilot can target ~20 concurrent active users as a planning margin, not a tested
production guarantee. Reassess before sustained 30+ activity, larger histories,
heavier images/video or promotion spikes. Full-site/browser/domestic-network
capacity remains unverified because no Vercel load test was performed.
Machine-readable aggregate evidence: backend-capacity-results-2026-10-27.json.
