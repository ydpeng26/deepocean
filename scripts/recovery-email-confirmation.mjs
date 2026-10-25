// Fixed recovery site only. All auth traffic is synthetic and intercepted.
import { emailConfirmationMock } from "./lib/email-confirmation-mocks.mjs";
import { nativeErrorDiagnostic } from "./lib/native-error-diagnostic.mjs";
const site = "https://supdiver-recovery-test.vercel.app";
const api = "https://esovqvampbrhuhamkfcs.supabase.co";
const mainKey = "sb-esovqvampbrhuhamkfcs-auth-token";
const ownKey = "supdiver-email-confirmation-esovqvampbrhuhamkfcs";
const temporaryKeys = [ownKey, ownKey + "-user", ownKey + "-code-verifier"];
const hash = "synthetic-email-confirmation-hash",
  code = "synthetic-email-confirmation-code",
  verifier = "synthetic-email-confirmation-verifier";
function session(suffix) {
  const id = "00000000-0000-4000-8000-0000000007" + suffix;
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "synthetic-" + suffix + "@example.invalid",
    email_confirmed_at: "2026-10-25T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
  };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token =
    [
      { alg: "HS256", typ: "JWT" },
      { sub: id, aud: "authenticated", role: "authenticated", exp: expires },
    ]
      .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
      .join(".") + ".c3ludGhldGlj";
  return {
    user,
    access_token: token,
    refresh_token: "synthetic-refresh-" + suffix,
    expires_at: expires,
    expires_in: 3600,
    token_type: "bearer",
  };
}
const newSession = session("26"),
  oldSession = session("27"),
  otherSession = session("28");
const fixture = {
  api,
  hash,
  code,
  verifier,
  newSession,
  otherSession,
  sessions: [newSession, oldSession, otherSession],
};
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
const defer = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(Error("synthetic_gate_timeout")), 25000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function harness(language, initialMode, kind = "hash", seedOld = false) {
  let mode = initialMode,
    routeFailure;
  const gate = defer(),
    reached = defer();
  const release = () => {
    gate.resolve();
    releases.delete(release);
  };
  releases.add(release);
  const counts = {
    verifies: 0,
    exchanges: 0,
    userReads: 0,
    newUserReads: 0,
    completions: 0,
    forbidden: 0,
    pageErrors: 0,
    errors: [],
  };
  activeStats = counts;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: language === "en" ? "en-US" : "zh-CN",
    serviceWorkers: "block",
  });
  context.on("page", (page) =>
    page.on("pageerror", (error) => {
      counts.pageErrors++;
      if (counts.errors.length < 4)
        counts.errors.push({ stage, ...nativeErrorDiagnostic(error, publicAssets) });
    }),
  );
  await context.addInitScript(
    ({
      site,
      language,
      mainKey,
      ownKey,
      newId,
      oldSession,
      seedOld,
      kind,
      verifier,
      initialMode,
    }) => {
      if (window.location.origin !== site) return;
      localStorage.setItem("deepocean-language", language);
      if (!sessionStorage.getItem("__email-fixture")) {
        sessionStorage.setItem("__email-fixture", "initialized");
        sessionStorage.setItem("__email-deny-save", initialMode === "save-denied" ? "yes" : "no");
        sessionStorage.setItem("email-fixture-text", "synthetic session text");
        localStorage.setItem("email-fixture-text", "synthetic local text");
        if (seedOld) sessionStorage.setItem(mainKey, JSON.stringify(oldSession));
        if (kind === "code")
          sessionStorage.setItem(mainKey + "-code-verifier", JSON.stringify(verifier));
      }
      window.__emailProbe = { ownWrites: 0, cleanupAfterWrite: 0, targetWrites: 0 };
      const set = Storage.prototype.setItem,
        remove = Storage.prototype.removeItem;
      Storage.prototype.setItem = function (key, value) {
        if (this === sessionStorage && key === mainKey && JSON.parse(value)?.user?.id === newId) {
          window.__emailProbe.targetWrites++;
          if (sessionStorage.getItem("__email-deny-save") === "yes")
            throw new DOMException("Synthetic main session quota rejection", "QuotaExceededError");
        }
        const result = set.call(this, key, value);
        if (this === sessionStorage && key === ownKey) window.__emailProbe.ownWrites++;
        return result;
      };
      Storage.prototype.removeItem = function (key) {
        const result = remove.call(this, key);
        if (this === sessionStorage && key === ownKey && window.__emailProbe.ownWrites > 0)
          window.__emailProbe.cleanupAfterWrite++;
        return result;
      };
    },
    {
      site,
      language,
      mainKey,
      ownKey,
      newId: newSession.user.id,
      oldSession,
      seedOld,
      kind,
      verifier,
      initialMode,
    },
  );
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    try {
      if (url.origin === api) {
        const response = emailConfirmationMock(
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
          return route.abort();
        }
        const hold =
          (["invalid-old", "switch-verify", "timeout"].includes(mode) &&
            response.kind === "verify") ||
          (mode === "switch-save" &&
            response.kind === "user" &&
            response.isNew &&
            counts.newUserReads === 2);
        if (hold) {
          reached.resolve();
          await gate.promise;
        }
        if (response.abort) return route.abort();
        return route.fulfill({
          status: response.status,
          headers: {
            "access-control-allow-origin": site,
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers":
              request.headers()["access-control-request-headers"] ||
              "apikey,authorization,content-type,x-client-info,x-supabase-api-version",
          },
          ...(response.kind === "preflight"
            ? {}
            : { contentType: "application/json", body: JSON.stringify(response.body) }),
        });
      }
      if (
        url.origin === site &&
        request.method() === "GET" &&
        url.pathname === "/__email-complete"
      ) {
        counts.completions++;
        return route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><h1>Synthetic email confirmation completion</h1>",
        });
      }
      if (url.origin === site && ["GET", "HEAD"].includes(request.method()))
        return route.continue();
      if (
        ["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname) &&
        request.method() === "GET"
      )
        return route.continue();
      unsafe = true;
      counts.forbidden++;
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
  const confirmationUrl = () =>
    site +
    "/auth-confirmed" +
    (kind === "none"
      ? ""
      : kind === "duplicate"
        ? "?code=synthetic-a&code=synthetic-b"
        : kind === "tokens"
          ? "?next=/__email-complete#" +
            new URLSearchParams({
              access_token: newSession.access_token,
              refresh_token: newSession.refresh_token,
              type: "signup",
            })
          : kind === "code"
            ? "?next=/__email-complete&code=" + code
            : "?next=/__email-complete&token_hash=" + hash);
  const open = async () => {
    await page.goto(confirmationUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () => location.pathname === "/auth-confirmed" && !location.search && !location.hash,
    );
  };
  const safe = () =>
    check(
      !routeFailure && !counts.forbidden && !counts.pageErrors,
      routeFailure || "no_page_errors_or_forbidden_requests",
    );
  return {
    page,
    context,
    counts,
    open,
    safe,
    release,
    reached: () => bounded(reached.promise),
    setMode: (value) => {
      mode = value;
    },
  };
}
async function assertState(h, expectedOwner) {
  check(
    await h.page.evaluate(
      ({ mainKey, temporaryKeys, expectedOwner }) => {
        const saved = JSON.parse(sessionStorage.getItem(mainKey) || "null");
        return (
          (saved?.user?.id ?? null) === expectedOwner &&
          !localStorage.getItem(mainKey) &&
          temporaryKeys.every((key) => !sessionStorage.getItem(key)) &&
          sessionStorage.getItem("email-fixture-text") === "synthetic session text" &&
          localStorage.getItem("email-fixture-text") === "synthetic local text"
        );
      },
      { mainKey, temporaryKeys, expectedOwner },
    ),
    "correct_main_owner_temporary_cleanup_and_unrelated_fixture_retained",
  );
  h.safe();
}
async function failure(h, language) {
  await h.page
    .getByRole("heading", {
      name:
        language === "en" ? "This confirmation link is invalid or expired" : "验证链接无效或已过期",
      exact: true,
    })
    .waitFor();
  check(
    await h.page
      .getByRole("link", { name: language === "en" ? "Back to sign in" : "返回登录", exact: true })
      .isVisible(),
    "safe_return_link",
  );
  check(
    (await h.page
      .getByRole("button", {
        name: language === "en" ? "Enter SupDiver" : "进入 SupDiver",
        exact: true,
      })
      .count()) === 0,
    "no_enter_on_confirmation_failure",
  );
  check(
    new URL(h.page.url()).pathname === "/auth-confirmed" &&
      !new URL(h.page.url()).search &&
      !new URL(h.page.url()).hash,
    "confirmation_material_removed_from_history",
  );
}
async function success(h, language) {
  await h.page
    .getByRole("heading", {
      name: language === "en" ? "Email confirmed" : "邮箱验证成功",
      exact: true,
    })
    .waitFor();
  await assertState(h, newSession.user.id);
  await h.page.evaluate(() => {
    const button = document.querySelector("button.do-auth-submit");
    button.click();
    button.click();
  });
  await h.page.waitForURL((url) => url.origin === site && url.pathname === "/__email-complete");
  await h.page
    .getByRole("heading", { name: "Synthetic email confirmation completion", exact: true })
    .waitFor();
  check(h.counts.completions === 1, "single_verified_internal_navigation");
  h.safe();
}
try {
  check(
    process.env.GITHUB_ACTIONS === "true" &&
      process.env.GITHUB_REF === "refs/heads/codex/pc-layout-keyboard-audit",
    "isolated_cloud_branch_only",
  );
  stage = "fixed recovery bundle preflight";
  const response = await fetch(site + "/offline-assets.json", {
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  check(response.ok && new URL(response.url).origin === site, "fixed_recovery_manifest");
  const manifest = await response.json();
  for (const path of manifest)
    if (/^\/assets\/[a-zA-Z0-9_-]+\.js$/.test(path)) publicAssets.add(path);
  const texts = await Promise.all(
    [...publicAssets].map(async (path) => {
      const r = await fetch(site + path, { signal: AbortSignal.timeout(30000) });
      check(r.ok && new URL(r.url).origin === site, "fixed_recovery_public_asset");
      return r.text();
    }),
  );
  check(
    texts.some((text) =>
      text.includes("Email confirmation could not be verified. Please start again."),
    ) &&
      texts.some((text) => text.includes("supdiver-email-confirmation-")) &&
      texts.some((text) => text.includes("Session write no longer belongs to the active request")),
    "confirmation_repair_must_be_deployed_first",
  );
  pass("fixed_recovery_confirmation_request_binding_and_guarded_write_bundle_preflight");
  const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || "playwright");
  browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
  for (const language of ["zh-CN", "en"]) {
    for (const kind of ["hash", "code", "tokens"]) {
      stage = language + " normal " + kind;
      const h = await harness(language, "normal", kind);
      await h.open();
      await success(h, language);
      check(
        h.counts.verifies === (kind === "hash" ? 1 : 0) &&
          h.counts.exchanges === (kind === "code" ? 1 : 0),
        "one_explicit_verification_no_automatic_duplicate",
      );
      await h.context.close();
      h.release();
      pass(
        "actual_" +
          language +
          "_" +
          kind +
          "_verified_once_bound_session_cleanup_and_single_navigation",
      );
    }
    for (const mode of [
      "invalid-old",
      "network-error",
      "user-mismatch",
      "unconfirmed",
      "save-denied",
      "switch-verify",
      "switch-save",
      "timeout",
      "exchange-error",
      "no-link",
      "duplicate",
    ]) {
      stage = language + " " + mode + " initialization";
      const seedOld = [
        "invalid-old",
        "save-denied",
        "switch-verify",
        "switch-save",
        "timeout",
        "no-link",
        "duplicate",
      ].includes(mode);
      const kind =
        mode === "exchange-error"
          ? "code"
          : mode === "no-link"
            ? "none"
            : mode === "duplicate"
              ? "duplicate"
              : "hash";
      const h = await harness(language, mode, kind, seedOld);
      await h.open();
      let expected = seedOld ? oldSession.user.id : null;
      if (["invalid-old", "switch-verify", "switch-save", "timeout"].includes(mode)) {
        stage = language + " " + mode + " pending request";
        await h.reached();
        check(
          (await h.page
            .getByRole("heading", {
              name: language === "en" ? "Email confirmed" : "邮箱验证成功",
              exact: true,
            })
            .count()) === 0,
          "old_session_cannot_finish_pending_link",
        );
        if (mode.startsWith("switch-")) {
          await h.page.evaluate(
            ({ mainKey, otherSession }) =>
              sessionStorage.setItem(mainKey, JSON.stringify(otherSession)),
            { mainKey, otherSession },
          );
          expected = otherSession.user.id;
        }
        if (mode === "timeout") await failure(h, language);
        h.release();
        if (mode === "timeout")
          await h.page.waitForFunction(
            () => window.__emailProbe.ownWrites > 0 && window.__emailProbe.cleanupAfterWrite > 0,
          );
      }
      stage = language + " " + mode + " safe failure";
      await failure(h, language);
      await assertState(h, expected);
      if (["switch-verify", "switch-save", "timeout"].includes(mode))
        check(
          await h.page.evaluate(() => window.__emailProbe.targetWrites === 0),
          "late_result_cannot_write_main_session",
        );
      if (["no-link", "duplicate"].includes(mode))
        check(h.counts.verifies === 0 && h.counts.exchanges === 0, "invalid_input_never_verifies");
      pass("actual_" + language + "_" + mode + "_no_false_success_or_owner_overwrite");
      if (
        ["invalid-old", "network-error", "user-mismatch", "unconfirmed", "save-denied"].includes(
          mode,
        )
      ) {
        stage = language + " " + mode + " retry";
        if (mode === "save-denied") {
          await h.page.evaluate(() => sessionStorage.setItem("__email-deny-save", "no"));
          await h.page
            .getByRole("button", {
              name: language === "en" ? "Check storage again" : "重新检查存储",
              exact: true,
            })
            .click();
        }
        h.setMode("normal");
        const before = h.counts.verifies;
        await h.open();
        await success(h, language);
        check(h.counts.verifies === before + 1, "fresh_synthetic_retry_verifies_once");
        pass("actual_" + language + "_" + mode + "_fresh_synthetic_confirmation_retry");
      }
      await h.context.close();
      h.release();
    }
  }
  check(!unsafe, "no_forbidden_requests");
} catch (error) {
  failed = true;
  try {
    console.log(
      "DIAGNOSTIC: fixed_UI_flags=" +
        JSON.stringify(
          await activePage?.evaluate(() => ({
            checking:
              document.querySelector(".do-auth-result-icon")?.classList.contains("checking") ??
              false,
            success:
              document.querySelector(".do-auth-result-icon")?.classList.contains("success") ??
              false,
            error:
              document.querySelector(".do-auth-result-icon")?.classList.contains("error") ?? false,
            stripped: !location.search && !location.hash,
            completion: location.pathname === "/__email-complete",
            ownWrites: window.__emailProbe?.ownWrites ?? 0,
            cleanupAfterWrite: window.__emailProbe?.cleanupAfterWrite ?? 0,
            targetWrites: window.__emailProbe?.targetWrites ?? 0,
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
  for (const release of releases) release();
  try {
    await browser?.close();
  } catch {
    failed = true;
    console.log("INCOMPLETE: isolated_browser_cleanup");
  }
  if (!failed)
    pass(
      "isolated_contexts_closed_synthetic_state_dropped_no_real_accounts_mail_or_backend_fixtures",
    );
  console.log(
    "AUDIT: complete=" +
      (!failed && !unsafe) +
      "; recovery_only; all_confirmation_and_user_responses_mocked; no_real_links_mail_accounts_backend_writes_existing_data_changes_or_artifacts",
  );
  if (failed || unsafe) process.exitCode = 1;
}
