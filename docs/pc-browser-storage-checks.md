# PC browser storage — diagnosis 2026-10-25

## Scope

After formal error recovery release d496bfe, user requested continued inspection only. scripts/pc-browser-storage-diagnosis.mjs executes actual language-provider and lazy auth-client source with synthetic Storage exceptions. No network, real browser storage, account, quota exhaustion, storage deletion, application change or deployment. User-owned screenlog.0 is preserved. Ordinary private browsing is not assumed to deny storage; platform/policy behavior requires native coverage. Previously deferred product features and mobile remain excluded.

## Findings

1. **An optional preference failure escapes the normal language provider.** getSavedLanguage directly calls localStorage.getItem in its mount effect. A modeled SecurityError escapes before language initialization/ready completion. The separate preference-write effect calls setItem before updating documentElement.lang: a modeled QuotaExceededError escapes, leaving the document language attribute at zh-CN while selected context language is en. The new standalone error fallback has its own guarded preference handling, but that does not protect the ordinary provider. These actual-function tests establish missing error containment, not a native blank-screen/recursive-crash demonstration. Recommended repair: optional persistence must be best effort; initialize from safe browser/default language, keep in-memory switching/document language working even when persistence fails, and never clear existing site storage to make room.

2. **Denied sessionStorage property access prevents auth-client initialization.** The lazy client reads window.sessionStorage outside a guard. A synthetic getter SecurityError escapes before createClient is called. This is different from ordinary SDK storage method handling and from absent storage on SSR; the current test does not establish how every browser/SDK combination handles getItem/setItem failures. Recommended repair: explicitly handle storage access and safe capability failure without falling back to persistent localStorage. Decide whether a per-tab memory-only auth session is acceptable or expose clear unavailable guidance. Preserve normal tab-scoped auth and account-change isolation; do not extend login lifetime across browser restarts or change project credentials.

## Existing controls / limits

Ordinary browser language initialization and tab sessionStorage configuration pass in the same harness. Legacy persistent-token localStorage cleanup is already inside try/catch and does not prevent initialization when removal is denied. Offline IndexedDB storage failure with retained inputs/saved snapshot was previously recovery-tested (pc-offline-cache-checks.md); it is not counted as new acceptance here. No real quota eviction, Safari/Edge private-mode matrix, native browser setting, blocked IndexedDB, or recovery full-app storage-denial acceptance is claimed by these local models.

## Next step

Seek repair approval. Implement safe preference handling and an explicit tab-auth storage policy; cover getter/method read/write denial, quota errors, SSR, reload semantics, async SDK behavior and account switches locally. Then seek recovery-only browser denial injection permission and separate formal release approval. Preserve existing local drafts and do not instruct the user to clear browser data. Do not silently use persistent localStorage for authentication.
