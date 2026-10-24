# PC authentication return/reset boundaries — diagnosis 2026-10-25

## Scope and method

After the user-authorized Safari label/title production release `fc19a0e9216160b366a21e892d8633b0eb083b8e`, the user requested continued PC checks. This is diagnosis only. `scripts/pc-auth-boundary-diagnosis.mjs` transpiles and executes actual auth/confirmation route validators, actual reset component and authenticated route guard using deterministic React/session/URL models. Network is forbidden; only synthetic ids/tokens/password text are used in memory. No real reset request, credential update, account creation, database access, production mutation or deployment occurred. Unrelated `screenlog.0` is preserved. These findings are not live-browser exploit acceptance or proof of a production account compromise.

## Findings

1. **Two return-path validators allow a browser-normalized external destination.** Auth and auth-confirmed accept strings beginning with `/` except literal `//`. The actual validators accept a leading slash followed by backslash; URL-standard parsing resolves the representative synthetic path to a different origin. Both components subsequently assign accepted `next` directly to `window.location.href`. No external destination was visited. Ordinary absolute and literal double-slash URLs are rejected; ordinary `/offline-sync` is retained. Scope: a crafted return URL can potentially send someone to an external site after the relevant successful flow; this does not demonstrate transmission of passwords, sessions or tokens. OAuth/confirmation URL concatenation has other behavior and was not live-tested. Recommended repair: one shared same-origin internal-path policy that accounts for browser URL normalization, backslashes/control characters and safe fallback, with actual consumer tests.

2. **Reset readiness is not bound to the verified account/session through submit.** The actual reset component verifies a synthetic recovery token yielding account A and unlocks the form. In the local model, the current session then changes to B while that same component stays mounted; submit invokes `updateUser` against current B, with no owner recheck or auth-change cancellation. No real password was changed. This requires a same-tab session change while the reset page remains mounted; merely signing in independently in another sessionStorage-isolated tab is not established to cause it. Ordinary navigation to the login page may unmount the component, so UI reachability and session propagation still require recovery investigation. Recommended repair: bind readiness to verified user/session, invalidate on owner/sign-out changes, revalidate before mutation, ignore stale async verification/results on unmount/change and retain failure guidance. A mutation already sent cannot be assumed undone.

## Controls verified locally

- Missing recovery token keeps the form locked even if another account could already be signed in; no password update occurs.
- Explicitly rejected/expired synthetic token keeps the form locked. The reset route scrubs the query/hash through history replacement.
- The actual authenticated route guard redirects to auth on absent session or session-read error and accepts a present session. This is an initial guard model, not live server-token verification, expired-session refresh, back-forward cache clearing, cross-tab logout, or RLS acceptance.

Final diagnostic: `local_diagnosis_complete=true`, two finding groups and two affected validator occurrences. The initial test harness asserted the ready form before cross-realm asynchronous verification had settled; it was corrected to wait one event-loop turn and then rerun successfully. No application source was modified to satisfy these checks.

## Follow-up / boundaries

Seek user authorization before repairs. Validate locally, then request recovery-only deployment/fixtures if necessary, and separate formal release approval. Avoid real password changes and email until specifically authorized and handed off as appropriate. Native Safari control remains restricted; user-assisted screenshots are not evidence of these session/return edge cases. Full OAuth sign-in, actual expired/reused reset tokens, back/forward cache behavior, Edge and full restore/config reconstruction remain pending. Mobile and previously deferred passport features remain excluded.
