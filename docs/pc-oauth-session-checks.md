# PC OAuth session-error diagnosis — 2026-10-25

After the storage repair formal release (3467de1), the user requested continued checks, not further application changes. This is local diagnosis only. No real Google OAuth flow, account, mail, credentials, browser storage, database, deployment or production mutation occurred. User-owned screenlog.0 was preserved.

## Source review scope

Live profile bio, dive notes and comment body use ordinary JSX text interpolation. The route/link scan found no live rich-text renderer accepting these values as HTML. The shared ChartStyle has dangerouslySetInnerHTML for CSS configuration, but no application consumer was found; it is not counted as a reachable user-content exploit. This limited static review is not browser payload acceptance, a full XSS audit or evidence of complete sanitization. Existing shared auth-return policy remains in place.

## Confirmed local finding: ignored non-throwing session error in Google login completion

src/integrations/lovable/index.ts awaits supabase.auth.setSession(result.tokens) but only catches thrown exceptions. The installed SDK can resolve with {data:{session:null,user:null},error} rather than throw. The adapter drops that result and returns the provider result as though session setup succeeded. Auth.handleGoogle then calls goNext and leaves loading true. The member guard should reject absent sessions, so this is failed-login completion/error handling, not an established authentication bypass.

scripts/pc-oauth-session-diagnosis.mjs independently executes the installed SDK with malformed synthetic tokens and network disabled, confirming a returned error/null session. It then executes the actual adapter and auth component against that modeled returned result: navigation is attempted, no error toast is raised and the Google control stays disabled/busy. Normal completion, provider error, thrown session failure and redirected branches are separately modeled as controls. No raw token, password, account or production log material is used. The real Google/provider/callback/reload path has not been performed; impact is limited to the adapter branch where the provider returns tokens without redirected=true.

## Proposed next step — requires repair authorization

Handle returned setSession errors explicitly and verify successful session establishment before treating non-redirected OAuth completion as success. Preserve true redirected flows, existing return policy and per-tab auth; unlock controls and show a retryable message on failure. Cover empty/malformed/provider/session returned/thrown results locally, then seek recovery-only acceptance if needed and separate formal release approval. Human Google consent/sign-in remains separate user-assisted acceptance, with no request to send passwords or authorization links.

## User-authorized repair — local verification

The user requested repair. Added src/lib/oauth-session.ts as a non-generated policy helper; the generated Lovable adapter delegates completion to it with the existing SDK setSession function. True provider redirects and provider errors are preserved. Non-redirected token results require nonempty token strings, no returned SDK error and a returned session with nonempty user id. Missing/malformed results, null session, returned errors and thrown exceptions produce a generic failure without forwarding token-bearing SDK details. No storage replacement, credential, provider origin, auth-return policy or database permission is changed.

The Google handler now uses the existing synchronous submission ref to prevent duplicate/overlapping submission before React rerenders, reports fixed bilingual failure copy, restores loading/ref on non-redirected completion/failure and only navigates after adapter success. True redirected flows remain locked while the page leaves. Local tests include duplicate same-tick activation, explicit same-origin return handling, storage-denial early rejection, bilingual failures, no navigation on failure, retry success, missing tokens/session/user, provider refusal/throw and redirected behavior. No real Google/provider sign-in is claimed.

All 20 local regression suites passed, including actual completion/adapter/auth component tests, storage SDK initialization, session lifecycle, auth boundaries, keyboard/language, offline/cache/sync and business modules. Scoped lint, client/server production build, offline asset generation and whitespace checks passed. Whole-project TypeScript still reports the pre-existing forum/profile preview literal-state errors only, no changed module diagnostics. The historical diagnosis is now pinned to cf123a6 rather than retesting repaired app source. User-owned screenlog.0 remains untouched.

Recovery-only deployment/simulated browser acceptance permission has been requested separately; no recovery deployment, real OAuth, account fixture, mail or formal change has occurred in this repair turn. Formal release requires distinct later approval.
