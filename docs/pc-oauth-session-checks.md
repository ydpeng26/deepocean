# PC OAuth session-error diagnosis — 2026-10-25

After the storage repair formal release (3467de1), the user requested continued checks, not further application changes. This is local diagnosis only. No real Google OAuth flow, account, mail, credentials, browser storage, database, deployment or production mutation occurred. User-owned screenlog.0 was preserved.

## Source review scope

Live profile bio, dive notes and comment body use ordinary JSX text interpolation. The route/link scan found no live rich-text renderer accepting these values as HTML. The shared ChartStyle has dangerouslySetInnerHTML for CSS configuration, but no application consumer was found; it is not counted as a reachable user-content exploit. This limited static review is not browser payload acceptance, a full XSS audit or evidence of complete sanitization. Existing shared auth-return policy remains in place.

## Confirmed local finding: ignored non-throwing session error in Google login completion

src/integrations/lovable/index.ts awaits supabase.auth.setSession(result.tokens) but only catches thrown exceptions. The installed SDK can resolve with {data:{session:null,user:null},error} rather than throw. The adapter drops that result and returns the provider result as though session setup succeeded. Auth.handleGoogle then calls goNext and leaves loading true. The member guard should reject absent sessions, so this is failed-login completion/error handling, not an established authentication bypass.

scripts/pc-oauth-session-diagnosis.mjs independently executes the installed SDK with malformed synthetic tokens and network disabled, confirming a returned error/null session. It then executes the actual adapter and auth component against that modeled returned result: navigation is attempted, no error toast is raised and the Google control stays disabled/busy. Normal completion, provider error, thrown session failure and redirected branches are separately modeled as controls. No raw token, password, account or production log material is used. The real Google/provider/callback/reload path has not been performed; impact is limited to the adapter branch where the provider returns tokens without redirected=true.

## Proposed next step — requires repair authorization

Handle returned setSession errors explicitly and verify successful session establishment before treating non-redirected OAuth completion as success. Preserve true redirected flows, existing return policy and per-tab auth; unlock controls and show a retryable message on failure. Cover empty/malformed/provider/session returned/thrown results locally, then seek recovery-only acceptance if needed and separate formal release approval. Human Google consent/sign-in remains separate user-assisted acceptance, with no request to send passwords or authorization links.
