// Fixed recovery site, isolated contexts, synthetic inputs/responses only.
import { authActionMock } from "./lib/auth-action-mocks.mjs";
import { nativeErrorDiagnostic } from "./lib/native-error-diagnostic.mjs";
const site = "https://supdiver-recovery-test.vercel.app",
  api = "https://esovqvampbrhuhamkfcs.supabase.co";
const mainKey = "sb-esovqvampbrhuhamkfcs-auth-token",
  googleKey = "supdiver-google-oauth-esovqvampbrhuhamkfcs";
const email = "synthetic-auth-action@example.invalid",
  password = "Synthetic-action-only-726";
const id = "00000000-0000-4000-8000-000000000726",
  expires = Math.floor(Date.now() / 1000) + 3600;
const token =
  [
    { alg: "HS256", typ: "JWT" },
    { sub: id, aud: "authenticated", role: "authenticated", exp: expires },
  ]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".") + ".c3ludGhldGlj";
const session = {
  user: {
    id,
    email,
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: "2026-10-25T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
  },
  access_token: token,
  refresh_token: "synthetic-action-refresh",
  expires_at: expires,
  expires_in: 3600,
  token_type: "bearer",
};
const fixture = { site, api, email, password, session };
const publicAssets = new Set(),
  releases = new Set();
let browser,
  activePage,
  activeStats,
  stage = "guard",
  failed = false,
  unsafe = false;
const check = (ok, code) => {
  if (!ok) {
    const error = Error(code);
    error.auditCode = code;
    throw error;
  }
};
const pass = (value) => console.log("PASS: " + value);
const advance = (value) => {
  stage = value;
  console.log("STAGE: " + value);
};
const defer = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
async function bounded(promise, label = "synthetic_gate_timeout", milliseconds = 25000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_r, reject) => {
        timer = setTimeout(() => {
          const error = Error(label);
          error.auditCode = label;
          reject(error);
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const evaluate = (page, fn, argument) =>
  bounded(page.evaluate(fn, argument), "browser_evaluation_timeout");
const closeContext = (context) => bounded(context.close(), "context_cleanup_timeout", 10000);
const total = (counts) =>
  ["signin", "signup", "resend", "reset", "google"].reduce((n, key) => n + counts[key], 0);
async function harness(language, view) {
  let selected,
    mode = "normal",
    gate = defer(),
    reached = defer(),
    routeFailure;
  const release = () => {
    gate.resolve();
    releases.delete(release);
  };
  const counts = {
    signin: 0,
    signup: 0,
    resend: 0,
    reset: 0,
    google: 0,
    user: 0,
    logout: 0,
    completion: 0,
    forbidden: 0,
    pageErrors: 0,
    errors: [],
  };
  activeStats = counts;
  const context = await bounded(
    browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: language === "en" ? "en-US" : "zh-CN",
      serviceWorkers: "block",
    }),
    "context_open_timeout",
  );
  context.on("page", (page) =>
    page.on("pageerror", (error) => {
      counts.pageErrors++;
      if (counts.errors.length < 4)
        counts.errors.push({ stage, ...nativeErrorDiagnostic(error, publicAssets) });
    }),
  );
  await context.addInitScript(
    ({ site, language }) => {
      if (window.location.origin !== site) return;
      localStorage.setItem("deepocean-language", language);
      if (!sessionStorage.getItem("__auth-action-fixture")) {
        sessionStorage.setItem("__auth-action-fixture", "initialized");
        sessionStorage.setItem("auth-action-fixture-text", "synthetic session text");
        localStorage.setItem("auth-action-fixture-text", "synthetic local text");
      }
      // Pause PKCE hashing before location.assign queues a navigation. Inspecting
      // an old document after holding its navigation can deadlock page.evaluate.
      // Return the original digest unchanged after the controlled checkpoint.
      window.__authActionGoogleHold = false;
      window.__authActionGoogleReached = false;
      const digest = crypto.subtle.digest.bind(crypto.subtle);
      Object.defineProperty(crypto.subtle, "digest", {
        configurable: true,
        value: async (...args) => {
          if (window.__authActionGoogleHold) {
            window.__authActionGoogleHold = false;
            window.__authActionGoogleReached = true;
            await new Promise((resolve) => {
              window.__authActionGoogleRelease = resolve;
            });
          }
          return digest(...args);
        },
      });
    },
    { site, language },
  );
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    try {
      if (url.origin === api) {
        const response = authActionMock(
          {
            url: request.url(),
            method: request.method(),
            bearer: request.headers().authorization,
            body: request.method() === "POST" ? request.postDataJSON() : undefined,
          },
          fixture,
          mode,
          counts,
        );
        if (!response) {
          unsafe = true;
          counts.forbidden++;
          return await route.abort();
        }
        if (response.kind === selected) {
          reached.resolve();
          await gate.promise;
        }
        if (response.abort) return await route.abort();
        return await route.fulfill({
          status: response.status,
          headers: {
            "access-control-allow-origin": site,
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers":
              request.headers()["access-control-request-headers"] ||
              "apikey,authorization,content-type,x-client-info,x-supabase-api-version",
            ...(response.location ? { location: response.location } : {}),
          },
          ...(["preflight", "logout", "google"].includes(response.kind)
            ? {}
            : { contentType: "application/json", body: JSON.stringify(response.body) }),
        });
      }
      if (
        url.origin === site &&
        request.method() === "GET" &&
        url.pathname === "/__auth-action-complete"
      ) {
        counts.completion++;
        return await route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><h1>Synthetic auth action completion</h1>",
        });
      }
      if (url.origin === site && ["GET", "HEAD"].includes(request.method()))
        return await route.continue();
      if (
        ["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname) &&
        request.method() === "GET"
      )
        return await route.continue();
      unsafe = true;
      counts.forbidden++;
      return await route.abort();
    } catch (error) {
      routeFailure = error.auditCode || "route_validation";
      unsafe = true;
      try {
        await route.abort();
      } catch {
        /* Context may be closing after failure. */
      }
    }
  });
  const page = await bounded(context.newPage(), "page_open_timeout");
  activePage = page;
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);
  console.log("STAGE: " + stage + " opening_auth_page");
  const safe = () =>
    check(
      !routeFailure && !counts.forbidden && !counts.pageErrors,
      routeFailure || "no_page_errors_or_forbidden_requests",
    );
  await page.goto(site + "/auth?next=/__auth-action-complete", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.locator(".do-auth-form[aria-busy='false']").waitFor();
  if (view === "signup") await page.locator("#auth-signup-tab").click();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  if (view === "signup") {
    await page.locator(".do-auth-submit").click();
    await page.locator(".do-auth-confirmation button").waitFor();
    await page.waitForFunction(
      () => document.querySelector(".do-auth-form")?.getAttribute("aria-busy") === "false",
    );
    check(counts.signup === 1, "signup_bootstrap_synthetic_only");
  }
  console.log("STAGE: " + stage + " auth_page_ready");
  return {
    page,
    context,
    counts,
    safe,
    release,
    reached: () => bounded(reached.promise),
    arm(kind, value = "normal") {
      selected = kind === "google" ? undefined : kind;
      mode = value;
      gate = defer();
      reached = defer();
      releases.add(release);
    },
    holdGoogle: () =>
      evaluate(page, () => {
        window.__authActionGoogleHold = true;
        window.__authActionGoogleReached = false;
      }),
    googleReached: () =>
      bounded(
        page.waitForFunction(() => window.__authActionGoogleReached === true),
        "google_PKCE_checkpoint_timeout",
      ),
    releaseGoogle: () =>
      evaluate(page, () => {
        window.__authActionGoogleRelease?.();
      }),
    async activate(kind) {
      // DOM activation deliberately bypasses Playwright's navigation waiting;
      // a held Google navigation keeps the prior document available for checks.
      await evaluate(
        page,
        (kind) => {
          if (kind === "signin" || kind === "signup")
            document.querySelector("form.do-auth-form").requestSubmit();
          else
            document
              .querySelector(
                kind === "google"
                  ? ".do-auth-google"
                  : kind === "reset"
                    ? ".do-auth-forgot"
                    : ".do-auth-confirmation button",
              )
              .click();
        },
        kind,
      );
    },
  };
}
async function state(h, expectedOwner = null, googleClean = true) {
  check(
    await evaluate(
      h.page,
      ({ mainKey, googleKey, id, expectedOwner, googleClean }) => {
        const current = JSON.parse(sessionStorage.getItem(mainKey) || "null");
        return (
          (current?.user?.id ?? null) === expectedOwner &&
          (!current || current.user.id === id) &&
          !localStorage.getItem(mainKey) &&
          (!googleClean ||
            [
              googleKey,
              googleKey + "-user",
              googleKey + "-transaction",
              googleKey + "-code-verifier",
            ].every((k) => !sessionStorage.getItem(k))) &&
          sessionStorage.getItem("auth-action-fixture-text") === "synthetic session text" &&
          localStorage.getItem("auth-action-fixture-text") === "synthetic local text"
        );
      },
      { mainKey, googleKey, id, expectedOwner, googleClean },
    ),
    "synthetic_owner_scoped_cleanup_and_unrelated_fixture_retained",
  );
  h.safe();
}
async function idle(h) {
  await bounded(
    h.page.waitForFunction(() => {
      const form = document.querySelector(".do-auth-form");
      const all = [
        ...document.querySelectorAll(
          ".do-auth-tabs button,.do-auth-form input,.do-auth-submit,.do-auth-google,.do-auth-forgot,.do-auth-confirmation button",
        ),
      ];
      return (
        form?.getAttribute("aria-busy") === "false" &&
        all.length >= 6 &&
        all.every((n) => !n.disabled)
      );
    }),
    "idle_UI_timeout",
  );
  h.safe();
}
async function busy(h, view) {
  await bounded(
    h.page.waitForFunction(
      () => document.querySelector(".do-auth-form")?.getAttribute("aria-busy") === "true",
    ),
    "busy_UI_timeout",
  );
  check(
    await evaluate(
      h.page,
      ({ email, password, view }) => {
        const all = [
          ...document.querySelectorAll(
            ".do-auth-tabs button,.do-auth-form input,.do-auth-submit,.do-auth-google,.do-auth-forgot,.do-auth-confirmation button",
          ),
        ];
        return (
          all.length >= 6 &&
          all.every((n) => n.disabled) &&
          document.querySelector("#email").value === email &&
          document.querySelector("#password").value === password &&
          document.querySelector("#auth-" + view + "-tab").getAttribute("aria-selected") === "true"
        );
      },
      { email, password, view },
    ),
    "all_account_controls_disabled_values_and_mode_retained",
  );
  const before = total(h.counts);
  await evaluate(h.page, () => {
    const form = document.querySelector("form.do-auth-form");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    for (const button of document.querySelectorAll(
      ".do-auth-tabs button,.do-auth-forgot,.do-auth-google,.do-auth-confirmation button",
    ))
      button.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  check(total(h.counts) === before, "blocked_competing_or_duplicate_actions_start_no_request");
  h.safe();
}
async function feedback(h, owner, language, success) {
  if (owner === "signup" && success) {
    await h.page.locator(".do-auth-confirmation button").waitFor();
    return;
  }
  const message =
    owner === "reset"
      ? success
        ? language === "en"
          ? "If this email is registered, a reset email will arrive. Check your inbox and spam."
          : "如果该邮箱已注册，你将收到找回密码邮件，请检查收件箱和垃圾邮件。"
        : language === "en"
          ? "Unable to send right now. Try again later."
          : "暂时无法发送，请稍后重试。"
      : success
        ? language === "en"
          ? "Confirmation email resent. Check your inbox and spam folder"
          : "确认邮件已重新发送，请检查收件箱和垃圾邮件"
        : "Synthetic rejected action";
  await h.page.getByText(message, { exact: true }).waitFor();
}
async function run() {
  check(
    process.env.GITHUB_ACTIONS === "true" &&
      process.env.GITHUB_REF === "refs/heads/codex/pc-layout-keyboard-audit",
    "isolated_cloud_branch_only",
  );
  advance("fixed recovery auth bundle preflight");
  const response = await fetch(site + "/offline-assets.json", {
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  check(response.ok && new URL(response.url).origin === site, "fixed_recovery_manifest");
  for (const path of await response.json())
    if (/^\/assets\/[A-Za-z0-9_-]+\.js$/.test(path)) publicAssets.add(path);
  const authAsset = [...publicAssets].find(
    (path) => path.startsWith("/assets/auth-") && !path.startsWith("/assets/auth-confirmed-"),
  );
  check(authAsset, "auth_bundle_present");
  const asset = await fetch(site + authAsset, { signal: AbortSignal.timeout(30000) });
  check(asset.ok && new URL(asset.url).origin === site, "fixed_auth_asset");
  const text = await asset.text();
  const literal = (value) =>
    ['"' + value + '"', "'" + value + "'", "`" + value + "`"].some((marker) =>
      text.includes(marker),
    );
  check(
    text.includes("aria-busy") &&
      literal("resend") &&
      literal("reset") &&
      !text.includes("auth-status"),
    "shared_auth_action_lock_and_fresh_feedback_ids_must_be_deployed_first",
  );
  pass("fixed_recovery_auth_action_lock_bundle_preflight");
  const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || "playwright");
  browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
  for (const language of ["zh-CN", "en"]) {
    for (const view of ["signin", "signup"]) {
      for (const owner of [view, view === "signin" ? "reset" : "resend"]) {
        advance(language + " " + view + " " + owner + " returned error");
        const h = await harness(language, view),
          before = total(h.counts);
        h.arm(owner, "error");
        await h.activate(owner);
        await h.reached();
        await busy(h, view);
        h.release();
        await idle(h);
        await feedback(h, owner, language, false);
        check(total(h.counts) === before + 1, "single_failed_action");
        await state(h);
        advance(language + " " + owner + " fresh successful retry");
        h.arm(owner);
        await h.activate(owner);
        await h.reached();
        await busy(h, view);
        h.release();
        if (owner === "signin") {
          await h.page.waitForURL(
            (url) => url.origin === site && url.pathname === "/__auth-action-complete",
          );
          await h.page
            .getByRole("heading", { name: "Synthetic auth action completion", exact: true })
            .waitFor();
          check(h.counts.completion === 1, "single_internal_completion_navigation");
          await state(h, id);
        } else {
          await idle(h);
          await feedback(h, owner, language, true);
          await state(h);
          if (owner === "signup")
            check(
              await h.page.locator(".do-auth-confirmation button").isVisible(),
              "signup_confirmation_available",
            );
        }
        check(total(h.counts) === before + 2, "exactly_one_retry_request");
        await closeContext(h.context);
        h.release();
        pass(
          "actual_" +
            language +
            "_" +
            view +
            "_" +
            owner +
            "_mutual_exclusion_failed_release_and_single_retry",
        );
      }
      advance(
        language + " " + view + " Google pre-navigation PKCE checkpoint and synthetic cancellation",
      );
      const h = await harness(language, view),
        before = total(h.counts);
      h.arm("google");
      await h.holdGoogle();
      await h.activate("google");
      await h.googleReached();
      await busy(h, view);
      check(h.counts.google === 0, "Google_lock_checked_before_navigation_is_queued");
      pass("actual_" + language + "_" + view + "_Google_pre_navigation_lock_checked");
      await h.releaseGoogle();
      advance(language + " " + view + " Google mock cancellation callback");
      await h.page
        .getByRole("heading", {
          name: language === "en" ? "Google sign-in did not complete" : "Google 登录未完成",
          exact: true,
        })
        .waitFor();
      await state(h);
      check(total(h.counts) === before + 1, "one_synthetic_Google_authorize_only_no_exchange");
      await h.page
        .getByRole("link", {
          name: language === "en" ? "Back to sign in" : "返回登录",
          exact: true,
        })
        .click();
      await idle(h);
      await h.page.locator("#email").fill(email);
      await h.page.locator("#password").fill(password);
      h.arm("reset");
      await h.activate("reset");
      await h.reached();
      await busy(h, "signin");
      h.release();
      await idle(h);
      await state(h);
      await feedback(h, "reset", language, true);
      check(total(h.counts) === before + 2, "fresh_action_after_mock_cancellation");
      await closeContext(h.context);
      h.release();
      pass(
        "actual_" +
          language +
          "_" +
          view +
          "_Google_pending_lock_mock_cancel_cleanup_and_fresh_action",
      );
    }
    advance(language + " synthetic reset transport failure");
    const h = await harness(language, "signin");
    h.arm("reset", "network");
    await h.activate("reset");
    await h.reached();
    await busy(h, "signin");
    h.release();
    await idle(h);
    await state(h);
    await feedback(h, "reset", language, false);
    check(h.counts.reset === 1, "one_transport_failure_request");
    h.arm("reset");
    await h.activate("reset");
    await h.reached();
    h.release();
    await idle(h);
    await state(h);
    await feedback(h, "reset", language, true);
    check(h.counts.reset === 2, "one_retry_after_transport_failure");
    await closeContext(h.context);
    h.release();
    pass("actual_" + language + "_network_failure_unlock_and_fresh_retry");
  }
  check(!unsafe, "no_forbidden_requests");
}
try {
  await bounded(run(), "overall_synthetic_audit_timeout", 240000);
} catch (error) {
  failed = true;
  // Release held requests before diagnostics, so diagnostics never wait on a
  // navigation that this harness itself is preventing from completing.
  for (const release of releases) release();
  try {
    if (activePage)
      await bounded(
        activePage.evaluate(() => {
          window.__authActionGoogleRelease?.();
        }),
        "google_checkpoint_release_timeout",
        2000,
      );
  } catch {
    /* Bounded best effort. */
  }
  try {
    console.log(
      "DIAGNOSTIC: fixed_UI_flags=" +
        JSON.stringify(
          await bounded(
            activePage?.evaluate(() => ({
              auth: location.pathname === "/auth",
              callback: location.pathname === "/oauth-callback",
              completion: location.pathname === "/__auth-action-complete",
              busy: document.querySelector(".do-auth-form")?.getAttribute("aria-busy") === "true",
              form: !!document.querySelector(".do-auth-form"),
              disabled: document.querySelector(".do-auth-submit")?.disabled ?? false,
            })),
            "diagnostic_timeout",
            5000,
          ),
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
  for (const release of releases) release();
  let cleanupFailed = false;
  try {
    await bounded(browser?.close(), "browser_cleanup_timeout", 10000);
  } catch {
    failed = true;
    cleanupFailed = true;
    console.log("INCOMPLETE: isolated_browser_cleanup");
  }
  if (!failed)
    pass(
      "isolated_contexts_closed_synthetic_sessions_and_inputs_dropped_no_real_mail_accounts_or_provider_authorization",
    );
  console.log(
    "AUDIT: complete=" +
      (!failed && !unsafe) +
      "; recovery_only; all_auth_mail_and_Google_responses_mocked; no_real_accounts_mail_password_changes_backend_writes_existing_data_changes_or_artifacts",
  );
  if (failed || unsafe) process.exitCode = 1;
  if (cleanupFailed) process.exit(1);
}
