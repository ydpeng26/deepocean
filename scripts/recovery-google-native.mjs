// Recovery-only deployed-page acceptance. All authorization/API responses are
// synthetic and intercepted; no real Google request, user, email or backend write.
import { createHash } from "node:crypto";
import { nativeErrorDiagnostic } from "./lib/native-error-diagnostic.mjs";
const publicAssets = new Set();
const site = "https://supdiver-recovery-test.vercel.app";
const api = "https://esovqvampbrhuhamkfcs.supabase.co";
const tokenKey = "sb-esovqvampbrhuhamkfcs-auth-token";
const prefix = "supdiver-google-oauth-esovqvampbrhuhamkfcs";
const fixtureId = "00000000-0000-4000-8000-000000000725";
const user = {
  id: fixtureId,
  aud: "authenticated",
  role: "authenticated",
  email: "synthetic-google@example.invalid",
  created_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: {},
};
const jwt =
  [
    { alg: "HS256", typ: "JWT" },
    {
      sub: fixtureId,
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
  ]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".") + ".c3ludGhldGlj";
const syntheticCode = "synthetic-native-authorization-code";
let browser,
  activePage,
  activeStats,
  failed = false,
  unsafe = false,
  stage = "guard";
const check = (ok, code) => {
  if (!ok) {
    const error = Error(code);
    error.auditCode = code;
    throw error;
  }
};
const pass = (message) => console.log("PASS: " + message);

async function harness(language, initialMode) {
  let mode = initialMode,
    challenge,
    routeFailure;
  const stats = {
    authorize: 0,
    exchanges: 0,
    userReads: 0,
    pageErrors: 0,
    forbidden: 0,
    pageErrorDiagnostics: [],
  };
  activeStats = stats;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: language === "en" ? "en-US" : "zh-CN",
    serviceWorkers: "block",
  });
  context.on("page", (page) =>
    page.on("pageerror", (error) => {
      stats.pageErrors++;
      if (stats.pageErrorDiagnostics.length < 5) {
        const path = new URL(page.url()).pathname;
        const pageKind =
          path === "/auth"
            ? "auth"
            : path === "/oauth-callback"
              ? "callback"
              : path === "/__native-complete"
                ? "completion"
                : "other";
        stats.pageErrorDiagnostics.push({
          pageKind,
          stage,
          ...nativeErrorDiagnostic(error, publicAssets),
        });
      }
    }),
  );
  await context.addInitScript(
    ({ language, tokenKey, prefix, initialMode }) => {
      localStorage.setItem("deepocean-language", language);
      if (!sessionStorage.getItem("__native-fixture")) {
        sessionStorage.setItem("__native-fixture", "initialized");
        sessionStorage.setItem("__native-denial", initialMode);
        localStorage.setItem("native-fixture-text", "synthetic local text");
        sessionStorage.setItem("native-fixture-text", "synthetic session text");
      }
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        const denial = sessionStorage.getItem("__native-denial");
        if (
          this === sessionStorage &&
          ((denial === "save-denied" && key === tokenKey) ||
            (denial === "verifier-denied" && key === prefix + "-code-verifier"))
        )
          throw new DOMException("Synthetic storage rejection", "QuotaExceededError");
        return original.call(this, key, value);
      };
    },
    { language, tokenKey, prefix, initialMode },
  );
  const cors = (request) => ({
    "access-control-allow-origin": site,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers":
      request.headers()["access-control-request-headers"] ||
      "apikey,authorization,content-type,x-client-info,x-supabase-api-version",
  });
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    try {
      if (url.origin === api) {
        if (request.method() === "GET" && url.pathname === "/auth/v1/authorize") {
          stats.authorize++;
          check(url.searchParams.get("provider") === "google", "native_google_provider");
          check(
            url.searchParams.get("redirect_to") === site + "/oauth-callback",
            "fixed_recovery_callback",
          );
          check(
            url.searchParams.get("code_challenge_method")?.toLowerCase() === "s256",
            "native_PKCE_required",
          );
          challenge = url.searchParams.get("code_challenge");
          check(!!challenge, "PKCE_challenge_present");
          // Fulfill locally, before contacting Supabase or Google.
          return route.fulfill({
            status: 302,
            headers: {
              location:
                site +
                "/oauth-callback" +
                (mode === "cancel" ? "?error=access_denied" : "?code=" + syntheticCode),
            },
          });
        }
        if (
          request.method() === "OPTIONS" &&
          ["/auth/v1/token", "/auth/v1/user"].includes(url.pathname)
        )
          return route.fulfill({ status: 204, headers: cors(request) });
        if (
          request.method() === "POST" &&
          url.pathname === "/auth/v1/token" &&
          url.searchParams.get("grant_type") === "pkce"
        ) {
          stats.exchanges++;
          const body = request.postDataJSON();
          check(body.auth_code === syntheticCode, "synthetic_code_only");
          check(
            typeof body.code_verifier === "string" &&
              createHash("sha256").update(body.code_verifier).digest("base64url") === challenge,
            "actual_verifier_matches_native_challenge",
          );
          return route.fulfill({
            status: mode === "exchange-error" ? 400 : 200,
            headers: cors(request),
            contentType: "application/json",
            body: JSON.stringify(
              mode === "exchange-error"
                ? { error: "invalid_grant", error_description: "Synthetic exchange refusal" }
                : {
                    access_token: jwt,
                    refresh_token: "synthetic-refresh-only",
                    expires_in: 3600,
                    token_type: "bearer",
                    user,
                  },
            ),
          });
        }
        if (request.method() === "GET" && url.pathname === "/auth/v1/user") {
          stats.userReads++;
          check(request.headers().authorization === "Bearer " + jwt, "synthetic_bearer_only");
          return route.fulfill({
            status: mode === "rejected-user" ? 401 : 200,
            headers: cors(request),
            contentType: "application/json",
            body: JSON.stringify(
              mode === "rejected-user" ? { code: "bad_jwt", msg: "Synthetic rejected user" } : user,
            ),
          });
        }
        unsafe = true;
        stats.forbidden++;
        return route.abort();
      }
      if (
        url.origin === site &&
        request.method() === "GET" &&
        url.pathname === "/__native-complete"
      )
        return route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><h1>Synthetic native completion</h1>",
        });
      // Only recovery public GET/HEAD requests and static fonts can leave the harness.
      if (
        url.origin === site &&
        ["GET", "HEAD"].includes(request.method()) &&
        url.pathname !== "/~oauth/initiate"
      )
        return route.continue();
      if (
        ["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname) &&
        request.method() === "GET"
      )
        return route.continue();
      unsafe = true;
      stats.forbidden++;
      return route.abort();
    } catch (error) {
      routeFailure = error.auditCode || "route_validation";
      unsafe = true;
      await route.abort();
    }
  });
  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(20000);
  const openAuth = async () => {
    await page.goto(site + "/auth?next=/__native-complete", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page
      .getByRole("heading", { name: language === "en" ? "Welcome back" : "欢迎回来", exact: true })
      .waitFor();
    await page.waitForFunction(
      () =>
        !document.querySelector(".do-auth-panel fieldset")?.disabled &&
        !!document.querySelector(".do-auth-google") &&
        !document.querySelector(".do-auth-google").disabled,
    );
  };
  const assertSafe = () =>
    check(
      !routeFailure && stats.forbidden === 0 && stats.pageErrors === 0,
      routeFailure || "no_forbidden_requests_or_page_errors",
    );
  return {
    context,
    page,
    stats,
    openAuth,
    assertSafe,
    setMode: (value) => {
      mode = value;
    },
  };
}

async function clickTwice(page) {
  await page.evaluate(() => {
    const button = document.querySelector(".do-auth-google");
    button.click();
    button.click();
  });
}
async function assertSaved(h) {
  await h.page.waitForURL((url) => url.origin === site && url.pathname === "/__native-complete", {
    timeout: 45000,
  });
  await h.page.getByRole("heading", { name: "Synthetic native completion", exact: true }).waitFor();
  check(
    await h.page.evaluate(
      ({ tokenKey, prefix, fixtureId }) => {
        const saved = JSON.parse(sessionStorage.getItem(tokenKey) || "null");
        return (
          saved?.user?.id === fixtureId &&
          !localStorage.getItem(tokenKey) &&
          [prefix, prefix + "-code-verifier", prefix + "-user", prefix + "-transaction"].every(
            (key) => sessionStorage.getItem(key) === null,
          ) &&
          localStorage.getItem("native-fixture-text") === "synthetic local text" &&
          sessionStorage.getItem("native-fixture-text") === "synthetic session text"
        );
      },
      { tokenKey, prefix, fixtureId },
    ),
    "verified_tab_session_scoped_temporary_cleanup_and_unrelated_fixture_retained",
  );
  h.assertSafe();
}
async function callbackFailure(h, language) {
  await h.page
    .getByRole("heading", {
      name: language === "en" ? "Google sign-in did not complete" : "Google 登录未完成",
      exact: true,
    })
    .waitFor();
  check(
    new URL(h.page.url()).pathname === "/oauth-callback" &&
      !new URL(h.page.url()).search &&
      !new URL(h.page.url()).hash,
    "callback_code_and_error_stripped",
  );
  check(
    await h.page.evaluate(
      ({ tokenKey, prefix }) =>
        !sessionStorage.getItem(tokenKey) &&
        [prefix, prefix + "-code-verifier", prefix + "-user", prefix + "-transaction"].every(
          (key) => !sessionStorage.getItem(key),
        ) &&
        sessionStorage.getItem("native-fixture-text") === "synthetic session text",
      { tokenKey, prefix },
    ),
    "failed_callback_no_main_session_or_temporary_OAuth_state",
  );
  h.assertSafe();
}
async function restoreStorage(h, language) {
  await h.page.evaluate(() => sessionStorage.setItem("__native-denial", "normal"));
  const retry = h.page.getByRole("button", {
    name: language === "en" ? "Check storage again" : "重新检查存储",
    exact: true,
  });
  await retry.waitFor();
  await retry.click();
  await retry.waitFor({ state: "hidden" });
}
try {
  check(
    process.env.GITHUB_ACTIONS === "true" &&
      process.env.GITHUB_REF === "refs/heads/codex/pc-layout-keyboard-audit",
    "isolated_cloud_branch_only",
  );
  stage = "fixed recovery native bundle preflight";
  const response = await fetch(site + "/offline-assets.json", {
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  check(response.ok && new URL(response.url).origin === site, "recovery_manifest_only");
  const manifest = await response.json();
  for (const path of manifest)
    if (/^\/assets\/[a-zA-Z0-9_-]+\.js$/.test(path)) publicAssets.add(path);
  const scripts = await Promise.all(
    manifest
      .filter((path) => /^\/assets\/[^/]+\.js$/.test(path))
      .map(async (path) => {
        const r = await fetch(site + path, { signal: AbortSignal.timeout(30000) });
        check(r.ok && new URL(r.url).origin === site, "public_recovery_asset_only");
        return r.text();
      }),
  );
  check(
    scripts.some((text) =>
      text.includes("Google OAuth could not be completed. Please start again."),
    ) &&
      scripts.some((text) => text.includes("supdiver-google-oauth-")) &&
      manifest.some((path) => path.startsWith("/assets/oauth-callback-")),
    "native_entry_fix_must_be_deployed_first",
  );
  pass("fixed_recovery_deployed_native_Google_entry_and_callback_bundle_preflight");
  const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || "playwright");
  browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
  for (const language of ["zh-CN", "en"]) {
    for (const mode of [
      "normal",
      "cancel",
      "exchange-error",
      "rejected-user",
      "save-denied",
      "verifier-denied",
    ]) {
      stage = language + " " + mode + " auth initialization";
      const h = await harness(language, mode);
      await h.openAuth();
      stage = language + " " + mode + " native request";
      await clickTwice(h.page);
      if (mode === "normal") {
        stage = language + " normal completion";
        await assertSaved(h);
        check(
          h.stats.authorize === 1 && h.stats.exchanges === 1 && h.stats.userReads === 1,
          "single_native_start_exchange_and_main_save",
        );
        // A fresh load with a consumed code must not exchange again or clear the main session.
        stage = language + " consumed-code replay";
        await h.page.goto(site + "/oauth-callback?code=" + syntheticCode, {
          waitUntil: "domcontentloaded",
        });
        await h.page
          .getByRole("heading", {
            name: language === "en" ? "Google sign-in did not complete" : "Google 登录未完成",
            exact: true,
          })
          .waitFor();
        check(
          h.stats.exchanges === 1 &&
            (await h.page.evaluate(
              ({ tokenKey, fixtureId }) =>
                JSON.parse(sessionStorage.getItem(tokenKey) || "null")?.user?.id === fixtureId,
              { tokenKey, fixtureId },
            )),
          "consumed_code_no_repeat_exchange_main_session_retained",
        );
      } else {
        stage = language + " " + mode + " safe failure";
        if (mode === "verifier-denied") {
          await h.page
            .getByText(
              language === "en"
                ? "Google sign-in failed. Please try again"
                : "Google 登录失败，请重试",
              { exact: true },
            )
            .waitFor();
          check(
            new URL(h.page.url()).pathname === "/auth" &&
              h.stats.authorize === 0 &&
              h.stats.exchanges === 0,
            "denied_verifier_never_leaves_auth",
          );
        } else {
          await callbackFailure(h, language);
          check(
            h.stats.exchanges === (mode === "cancel" ? 0 : 1),
            "failure_expected_exchange_count",
          );
        }
        pass(
          "actual_native_" + language + "_" + mode + "_safe_failure_no_authenticated_navigation",
        );
        stage = language + " " + mode + " retry recovery";
        if (["save-denied", "verifier-denied"].includes(mode)) await restoreStorage(h, language);
        if (mode !== "verifier-denied") {
          await h.page
            .getByRole("link", {
              name: language === "en" ? "Back to sign in" : "返回登录",
              exact: true,
            })
            .click();
          await h.page.waitForURL((url) => url.origin === site && url.pathname === "/auth");
        }
        h.setMode("normal");
        await h.openAuth();
        const before = { ...h.stats };
        await clickTwice(h.page);
        stage = language + " " + mode + " retry completion";
        await assertSaved(h);
        check(
          h.stats.authorize === before.authorize + 1 &&
            h.stats.exchanges === before.exchanges + 1 &&
            h.stats.userReads === before.userReads + 1,
          "retry_completes_once",
        );
      }
      h.assertSafe();
      await h.context.close();
      pass(
        "actual_native_" +
          language +
          "_" +
          mode +
          "_PKCE_callback_tab_session_scoped_cleanup_and_single_completion",
      );
    }
    stage = language + " unsolicited callback";
    const h = await harness(language, "normal");
    await h.page.goto(site + "/oauth-callback?code=" + syntheticCode, {
      waitUntil: "domcontentloaded",
    });
    await callbackFailure(h, language);
    check(
      h.stats.exchanges === 0 && h.stats.authorize === 0,
      "no_exchange_without_same_tab_attempt",
    );
    await h.context.close();
    pass("actual_native_" + language + "_unsolicited_callback_rejected_without_exchange");
  }
  check(!unsafe, "no_forbidden_requests");
} catch (error) {
  failed = true;
  try {
    console.log(
      "DIAGNOSTIC: fixed_UI_flags=" +
        JSON.stringify(
          await activePage?.evaluate(() => ({
            auth: !!document.querySelector(".do-auth-panel"),
            googleDisabled: document.querySelector(".do-auth-google")?.disabled ?? null,
            alert: !!document.querySelector('[role="alert"]'),
            callback: location.pathname === "/oauth-callback",
            completion: location.pathname === "/__native-complete",
            stripped: !location.search && !location.hash,
          })),
        ),
    );
  } catch {
    console.log("DIAGNOSTIC: fixed_UI_flags_unavailable");
  }
  console.log("DIAGNOSTIC: synthetic_counts=" + JSON.stringify(activeStats));
  console.log(
    "INCOMPLETE: stage=" +
      stage +
      "; error=" +
      error.constructor.name +
      "; check=" +
      (error.auditCode || "browser_operation") +
      "; details suppressed",
  );
} finally {
  try {
    await browser?.close();
  } catch {
    failed = true;
    console.log("INCOMPLETE: isolated_browser_cleanup");
  }
  if (!failed)
    pass(
      "isolated_contexts_closed_all_synthetic_state_dropped_no_real_accounts_or_backend_fixtures",
    );
  console.log(
    "AUDIT: complete=" +
      (!failed && !unsafe) +
      "; recovery_only; native_authorize_PKCE_exchange_and_user_reads_mocked; no_real_Google_authorization_accounts_mail_backend_writes_existing_data_changes_or_artifacts",
  );
  if (failed || unsafe) process.exitCode = 1;
}
