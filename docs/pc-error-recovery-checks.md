# PC error recovery — diagnosis 2026-10-25

## Scope

After formal session lifecycle release `6f2e1fa`, the user requested continued PC inspection, not implementation. `scripts/pc-error-recovery-diagnosis.mjs` transpiles/executes actual root error/not-found components, static fallback and browser reporting helper against synthetic errors, hooks and router promises. No network, real account, intentional production failure, email, secret, deployment or application change. The unrelated screenlog.0 is preserved. Mobile and deferred passport/preview features remain excluded.

## Findings

1. **Global fallback language ignores the current selection.** Root 404 and root error components emit the same English text in the local Chinese and English contexts. Neither consumes the language preference. Static server 500 HTML is also hardcoded `lang="en"` and English-only. This does not cover every per-module error state; module-level error rendering has separate behavior. Recommended repair: bilingual root fallbacks and a standalone server fallback that can safely select language without depending on the crashed app, while keeping error details out of displayed HTML.

2. **Root retry has no in-flight protection or completion sequencing.** Invoking the actual retry callback twice synchronously in the model starts two invalidate calls and calls reset twice before either promise completes. It returns undefined and exposes no disabled/pending state. This establishes missing local coordination, not that every native double click will survive component unmount or that it corrupts data. The recovery browser test should hold the actual revalidation pending and verify rendered behavior. Recommended repair: single-flight retry, pending feedback, deliberate boundary-reset sequencing and controlled retry failure rather than an unhandled rejected promise.

3. **Optional error-report hooks are not isolated.** When the synthetic captureException hook throws, actual reportLovableError throws too, and the second hook is not attempted. The runtime-report hook can independently throw. The root calls this helper from an error-boundary effect, so telemetry failure can become a new uncaught effect exception instead of remaining best effort. No live Lovable hook malfunction or recursive native crash is demonstrated. Recommended repair: separately contain each reporting hook and normalize unknown errors without a new reporting recursion or blocking recovery UI.

## Controls and coverage limits

- The static server fallback does not interpolate the triggering error. It includes reload and home actions; neither uses an arbitrary target supplied by the error.
- Absent browser hooks and SSR reporting both no-op correctly. Route context uses pathname, not the URL query/hash.
- Reporting hooks receive the raw synthetic error object/message/stack, including an intentionally fake token-like marker embedded in a synthetic URL. This is a data-minimization review note, not proof of a real credential leak, a production hook's presence or an external telemetry transmission. Do not call it a confirmed production disclosure. If repairing reporting, consider removing credential-bearing query/hash material and limiting context while retaining useful safe diagnostics; separately scope any server logging policy changes.
- Root ErrorComponent's Error-typed prop mismatch with the router's unknown error type is a previously recorded whole-project TypeScript error, not a newly introduced failure. A repair of this root component should correct that type locally; unrelated preview typing remains outside this scope.
- The synchronous retry model bypasses browser event scheduling and native focus/layout. No browser error-page, server-500 fault injection, real network recovery, Edge or Safari fallback acceptance is claimed. No live server fault should be induced solely to test this.

## Next step

Ask for authorization before app repair. After local regressions and build, seek recovery-only deployment and synthetic fault-injection permission, then separate formal release approval. Keep ordinary user text, offline drafts, authentication storage, telemetry credentials and database policies unchanged. Do not upgrade Actions runtimes or implement deferred product features as part of this error recovery task.
