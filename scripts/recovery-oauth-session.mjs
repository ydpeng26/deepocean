// Recovery-only real-page checks with synthetic broker responses and mocked auth reads.
// No real provider authorization, accounts, credentials, backend writes or artifacts.
const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || "playwright");
const site = "https://supdiver-recovery-test.vercel.app";
const api = "https://esovqvampbrhuhamkfcs.supabase.co";
const broker = "https://oauth.lovable.app/__supdiver_synthetic_oauth";
const fixtureId = "00000000-0000-4000-8000-000000000725";
const tokenKey = "sb-esovqvampbrhuhamkfcs-auth-token";
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
let browser,
  activeAuth,
  activeStats,
  stage = "guard",
  failed = false,
  unsafe = false,
  mockedUserReads = 0;
const check = (ok, code) => {
  if (!ok) {
    const error = Error(code);
    error.auditCode = code;
    throw error;
  }
};
const pass = (message) => console.log("PASS: " + message);

async function harness(language, initialMode, topLevel = false) {
  let mode = initialMode,
    attempts = 0;
  const stats = { brokerReplies: 0, userReads: 0, preflights: 0, pageErrors: 0 };
  activeStats = stats;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: language === "en" ? "en-US" : "zh-CN",
    serviceWorkers: "block",
  });
  context.on("page", (page) =>
    page.on("pageerror", () => {
      stats.pageErrors++;
    }),
  );
  await context.addInitScript(
    ({ language, tokenKey, site, broker }) => {
      localStorage.setItem("deepocean-language", language);
      localStorage.setItem("oauth-fixture-text", "synthetic local text");
      sessionStorage.setItem("oauth-fixture-text", "synthetic session text");
      window.__oauthDenySave = false;
      window.__oauthBlockPopup = false;
      window.__oauthProbe = { opens: 0, validMessages: 0 };
      window.addEventListener("message", (event) => {
        if (
          event.origin === new URL(broker).origin &&
          event.data?.type === "authorization_response"
        )
          window.__oauthProbe.validMessages++;
      });
      const originalSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (window.__oauthDenySave && this === window.sessionStorage && key === tokenKey)
          throw new DOMException("Synthetic quota denial", "QuotaExceededError");
        return originalSet.call(this, key, value);
      };
      const originalOpen = window.open.bind(window);
      window.open = (url, ...args) => {
        window.__oauthProbe.opens++;
        if (window.__oauthBlockPopup) return null;
        // Substitute only the synthetic popup destination, preserving the SDK's
        // generated state/provider/return parameters. Never visit a real broker.
        const initiate = new URL(String(url), site);
        if (initiate.origin !== site || initiate.pathname !== "/~oauth/initiate")
          throw Error("Unexpected synthetic popup destination");
        const target = new URL(broker);
        target.search = initiate.search;
        return originalOpen(target.href, ...args);
      };
    },
    { language, tokenKey, site, broker },
  );
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === api) {
      if (request.method() === "OPTIONS" && url.pathname === "/auth/v1/user") {
        stats.preflights++;
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": site,
            "access-control-allow-methods": "GET",
            "access-control-allow-headers":
              request.headers()["access-control-request-headers"] ||
              "apikey,authorization,content-type,x-client-info,x-supabase-api-version",
          },
        });
      }
      if (request.method() === "GET" && url.pathname === "/auth/v1/user") {
        stats.userReads++;
        mockedUserReads++;
        check(request.headers().authorization === "Bearer " + jwt, "synthetic_bearer_only");
        return route.fulfill({
          status: mode === "rejected-user" ? 401 : 200,
          headers: { "access-control-allow-origin": site },
          contentType: "application/json",
          body: JSON.stringify(
            mode === "rejected-user"
              ? { code: "bad_jwt", msg: "Synthetic rejected session" }
              : {
                  id: fixtureId,
                  aud: "authenticated",
                  role: "authenticated",
                  email: "synthetic-oauth@example.invalid",
                  created_at: "2026-01-01T00:00:00Z",
                  app_metadata: {},
                  user_metadata: {},
                },
          ),
        });
      }
      unsafe = true;
      return route.abort();
    }
    if (url.origin === site && url.pathname === "/__oauth-shell")
      return route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><title>Synthetic OAuth shell</title><iframe title="Recovery auth" src="/auth?next=/__oauth-complete" style="width:1400px;height:950px"></iframe>',
      });
    if (url.origin === site && url.pathname === "/__oauth-complete")
      return route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><h1>Synthetic OAuth completion</h1>",
      });
    if (url.origin === site && url.pathname === "/~oauth/initiate") {
      attempts++;
      check(url.searchParams.get("provider") === "google", "google_provider_preserved");
      check(
        url.searchParams.get("redirect_uri") === site + "/__oauth-complete",
        "recovery_return_origin",
      );
      const state = url.searchParams.get("state");
      check(!!state, "provider_state_present");
      if (topLevel)
        return route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><h1>Synthetic redirect intercepted</h1>",
        });
      unsafe = true;
      return route.abort();
    }
    if (url.origin === new URL(broker).origin && url.pathname === new URL(broker).pathname) {
      attempts++;
      stats.brokerReplies++;
      check(url.searchParams.get("provider") === "google", "popup_google_provider_preserved");
      check(
        url.searchParams.get("redirect_uri") === site + "/__oauth-complete",
        "popup_recovery_return_origin",
      );
      check(!!url.searchParams.get("state"), "popup_state_present");
      if (mode === "cancel")
        return route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><script>window.close()</script>",
        });
      const response =
        mode === "provider-error"
          ? {
              state: url.searchParams.get("state"),
              error: "access_denied",
              error_description: "Synthetic provider refusal",
            }
          : {
              state: url.searchParams.get("state"),
              access_token: mode === "invalid-token" ? "synthetic-invalid" : jwt,
              refresh_token: "synthetic-refresh-only",
            };
      return route.fulfill({
        contentType: "text/html",
        body:
          "<!doctype html><script>window.opener.postMessage(" +
          JSON.stringify({ type: "authorization_response", response }) +
          "," +
          JSON.stringify(site) +
          ")</script>",
      });
    }
    if (
      url.hostname.endsWith(".supabase.co") ||
      url.origin === new URL(broker).origin ||
      (/(^|\.)(google\.com|googleapis\.com)$/.test(url.hostname) &&
        !url.hostname.startsWith("fonts.")) ||
      ["supdiver.com", "www.supdiver.com"].includes(url.hostname)
    ) {
      unsafe = true;
      return route.abort();
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      unsafe = true;
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(site + (topLevel ? "/auth?next=/__oauth-complete" : "/__oauth-shell"), {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  const auth = topLevel
    ? page
    : page.frames().find((frame) => new URL(frame.url()).pathname === "/auth");
  check(!!auth, "actual_auth_frame");
  activeAuth = auth;
  await auth
    .getByRole("heading", { name: language === "en" ? "Welcome back" : "欢迎回来", exact: true })
    .waitFor();
  const button = () => auth.locator(".do-auth-google");
  await button().waitFor({ state: "visible" });
  await auth.waitForFunction(() => !document.querySelector(".do-auth-panel fieldset")?.disabled);
  return {
    context,
    page,
    auth,
    button,
    setMode(value) {
      mode = value;
    },
    get attempts() {
      return attempts;
    },
  };
}

try {
  check(process.env.GITHUB_ACTIONS === "true", "cloud_only_guard");
  stage = "fixed site preflight";
  const paths = await (
    await fetch(site + "/offline-assets.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    })
  ).json();
  const scripts = await Promise.all(
    paths
      .filter((path) => /^\/assets\/[^/]+\.js$/.test(path))
      .map(async (path) => {
        const response = await fetch(site + path, { signal: AbortSignal.timeout(30000) });
        check(response.ok, "public_asset");
        return response.text();
      }),
  );
  check(
    scripts.some((text) => text.includes("OAuth session could not be established. Please retry.")),
    "fixed_site_missing_oauth_session_repair",
  );
  pass("fixed_site_bundle_contains_OAuth_session_completion_repair_before_browser_checks");
  browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
  for (const language of ["zh-CN", "en"])
    for (const failure of [
      "invalid-token",
      "rejected-user",
      "provider-error",
      "cancel",
      "blocked-popup",
      "save-denied",
    ]) {
      stage = language + " " + failure;
      const h = await harness(language, failure);
      if (failure === "blocked-popup")
        await h.auth.evaluate(() => {
          window.__oauthBlockPopup = true;
        });
      if (failure === "save-denied")
        await h.auth.evaluate(() => {
          window.__oauthDenySave = true;
        });
      stage = language + " " + failure + " failure request";
      await h.button().click();
      stage = language + " " + failure + " failure message";
      await h.auth
        .getByText(
          language === "en" ? "Google sign-in failed. Please try again" : "Google 登录失败，请重试",
          { exact: true },
        )
        .waitFor();
      check(new URL(h.auth.url()).pathname === "/auth", "failure_did_not_navigate");
      pass("actual_failure_message_" + language + "_" + failure + "_no_navigation");
      if (failure === "save-denied") {
        await h.auth
          .getByRole("alert")
          .filter({
            hasText:
              language === "en" ? "Browser session storage is unavailable" : "浏览器会话存储不可用",
          })
          .waitFor();
        await h.auth.evaluate(() => {
          window.__oauthDenySave = false;
        });
        await h.auth
          .getByRole("button", {
            name: language === "en" ? "Check storage again" : "重新检查存储",
            exact: true,
          })
          .click();
      }
      stage = language + " " + failure + " control recovery";
      await h.auth.waitForFunction(
        () =>
          !document.querySelector(".do-auth-google")?.disabled &&
          !document.querySelector(".do-auth-panel fieldset")?.disabled,
      );
      h.setMode("normal");
      await h.auth.evaluate(() => {
        window.__oauthBlockPopup = false;
      });
      const previous = h.attempts;
      stage = language + " " + failure + " retry request";
      await h.auth.evaluate(() => {
        const button = document.querySelector(".do-auth-google");
        button.click();
        button.click();
      });
      stage = language + " " + failure + " retry completion";
      await h.auth.waitForURL(
        (url) => url.origin === site && url.pathname === "/__oauth-complete",
        { timeout: 45000 },
      );
      await h.auth
        .getByRole("heading", { name: "Synthetic OAuth completion", exact: true })
        .waitFor();
      check(h.attempts === previous + 1, "duplicate_provider_request");
      stage = language + " " + failure + " saved state";
      check(
        await h.auth.evaluate(
          ({ fixtureId, tokenKey }) => {
            const saved = JSON.parse(sessionStorage.getItem(tokenKey) || "null");
            return (
              saved?.user?.id === fixtureId &&
              !localStorage.getItem(tokenKey) &&
              localStorage.getItem("oauth-fixture-text") === "synthetic local text" &&
              sessionStorage.getItem("oauth-fixture-text") === "synthetic session text"
            );
          },
          { fixtureId, tokenKey },
        ),
        "synthetic_session_tab_scoped_and_fixture_text_retained",
      );
      await h.context.close();
      pass(
        "actual_iframe_" +
          language +
          "_" +
          failure +
          "_safe_failure_unlock_retry_single_completion_with_mock_session_only",
      );
    }
  stage = "top level redirect";
  const top = await harness("zh-CN", "normal", true);
  await top.button().click();
  await top.page
    .getByRole("heading", { name: "Synthetic redirect intercepted", exact: true })
    .waitFor();
  check(top.attempts === 1, "one_top_level_redirect");
  await top.context.close();
  pass(
    "actual_top_level_provider_redirect_preserves_google_state_and_internal_recovery_return_intercepted_without_authorization",
  );
  check(mockedUserReads > 0 && !unsafe, "mocked_reads_and_no_forbidden_requests");
} catch (error) {
  failed = true;
  try {
    const flags = await activeAuth?.evaluate(() => ({
      authPanel: !!document.querySelector(".do-auth-panel"),
      googleDisabled: document.querySelector(".do-auth-google")?.disabled ?? null,
      storageDisabled: document.querySelector(".do-auth-panel fieldset")?.disabled ?? null,
      chineseError: document.body.textContent.includes("Google 登录失败，请重试"),
      englishError: document.body.textContent.includes("Google sign-in failed. Please try again"),
      syntheticCompletion:
        document.querySelector("h1")?.textContent === "Synthetic OAuth completion",
      popupOpens: window.__oauthProbe?.opens ?? 0,
      validMessages: window.__oauthProbe?.validMessages ?? 0,
    }));
    console.log("DIAGNOSTIC: fixed_UI_flags=" + JSON.stringify(flags));
    console.log("DIAGNOSTIC: synthetic_flow_counts=" + JSON.stringify(activeStats));
  } catch {
    console.log("DIAGNOSTIC: fixed_UI_flags_unavailable");
  }
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
      "isolated_browser_contexts_dropped_no_real_accounts_credentials_or_backend_fixtures_created",
    );
  console.log(
    "AUDIT: complete=" +
      (!failed && !unsafe) +
      "; recovery_only; synthetic_broker_and_mocked_auth_reads; no_real_Google_authorization_accounts_mail_backend_writes_existing_data_edits_or_artifacts",
  );
  if (failed || unsafe) process.exitCode = 1;
}
