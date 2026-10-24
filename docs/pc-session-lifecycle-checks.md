# PC session lifecycle — diagnosis 2026-10-25

## Scope

After the user-authorized auth-boundary formal release `d6ed793`, the user requested continued inspection. This round is diagnosis only. `scripts/pc-session-lifecycle-diagnosis.mjs` runs actual current root component, authenticated layout and beforeLoad guard with synthetic sessions, plus the installed TanStack router and memory history. No network, real account, password, database, deployment or application edits are involved. User-owned `screenlog.0` remains untouched. Mobile and deferred passport/preview work remain excluded.

## Finding: auth events do not refresh the mounted protected-route context

The root auth listener clears QueryClient after owner changes but neither updates router context nor invalidates/navigates the route. The authenticated layout reads its user only from route context, keys its subtree by that id, and has no live session subscription. In the actual-component model, initial A then SIGNED_OUT or SIGNED_IN B clears the query client once, but does not rerun the guard, navigate or change the layout's A key; its member header/outlet remain mounted. In a separate installed-router memory test using the actual guard, changing the synthetic session does not automatically rerun beforeLoad or replace A's matched context. Explicit invalidation rechecks the session: B updates the context; null makes the guard request `/auth`.

Consequences: mounted local editor state and route context are not explicitly torn down/rebound when an external auth event reports signout or owner change. Query clearing alone is not an authenticated-layout reset. This does **not** establish that another account can read old server data or write through RLS, that a revoked account remains authorized, or that a particular private image stays visible after a browser logout. Query-observer rendering, real token expiry/refresh, actual cross-tab delivery and browser back-forward cache require separate recovery/native acceptance. Normal clicked logout separately navigates to auth; this finding concerns auth events not accompanied by that click's navigation.

## Controls and limits

- Fresh guard rejects absent session/session error and returns current owner when run. Same-owner refresh events do not clear query cache; listener cleanup unsubscribes.
- The inspected root/layout/router contain no pageshow/visibilitychange revalidation hook. Absence is a coverage note, not proof of a live BFCache leak.
- Installed SDK signOut clears the local session on ordinary server/network signout errors (except scope others), so ignoring a returned error is not sufficient evidence that ordinary logout leaves the session signed in. No separate logout-failure finding is claimed.
- Supabase uses tab sessionStorage here, but its installed SDK can create a BroadcastChannel. Do not infer independent-tab auth event behavior merely from storage choice.
- An initial harness asserted completed `/auth` navigation after invalidation in the unmounted memory router; it did not occur in that environment. The final test asserts guard invocation and its actual redirect request, not completed native navigation. No browser acceptance is claimed.

## Next step requiring repair approval

Keep a live, owner-aware gate around authenticated content; synchronously hide/unmount old-owner content when signed out or switched, and safely refresh router context outside synchronous auth callbacks without deadlocking SDK auth. Preserve existing one-use reset/confirmation flows and offline drafts; do not clear browser storage wholesale or remount all public auth routes on every refresh. Cover races, pending operations, same-owner refresh, signout, A→B→A, focus/pageshow and recovery error states with local checks, then seek recovery-only deployment/fixture permission and separate formal release approval. Real Safari BFCache, Edge and OAuth human sign-in remain pending.
