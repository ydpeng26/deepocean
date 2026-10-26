// Fixed recovery origin only. Every auth/password request is intercepted with
// strict synthetic inputs; no real mail, accounts, passwords or backend writes.
import { passwordRecoveryMock } from "./lib/password-recovery-mocks.mjs";
import { nativeErrorDiagnostic } from "./lib/native-error-diagnostic.mjs";
const site = "https://supdiver-recovery-test.vercel.app",
  api = "https://esovqvampbrhuhamkfcs.supabase.co";
const mainKey = "sb-esovqvampbrhuhamkfcs-auth-token",
  ownKey = "supdiver-password-recovery-esovqvampbrhuhamkfcs";
const temporaryKeys = [ownKey, ownKey + "-user", ownKey + "-code-verifier"];
const hash = "synthetic-password-recovery-hash",
  code = "synthetic-password-recovery-code",
  verifier = "synthetic-password-recovery-verifier",
  password = "SynthOnly726";
function session(suffix) {
  const id = "00000000-0000-4000-8000-0000000007" + suffix,
    expires = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "synthetic-" + suffix + "@example.invalid",
    email_confirmed_at: "2026-10-25T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
  };
  const access_token =
    [
      { alg: "HS256", typ: "JWT" },
      { sub: id, aud: "authenticated", role: "authenticated", exp: expires },
    ]
      .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
      .join(".") + ".c3ludGhldGlj";
  return {
    user,
    access_token,
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
  password,
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
    const e = Error(code);
    e.auditCode = code;
    throw e;
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
      new Promise((_r, reject) => {
        timer = setTimeout(() => reject(Error("synthetic_gate_timeout")), 25000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function harness(language, initialMode, kind = "hash") {
  let mode = initialMode,
    routeFailure;
  const gate = defer(),
    reached = defer(),
    release = () => {
      gate.resolve();
      releases.delete(release);
    };
  releases.add(release);
  const counts = {
    verifies: 0,
    exchanges: 0,
    userReads: 0,
    newUserReads: 0,
    passwords: 0,
    logouts: 0,
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
    ({ site, language, mainKey, ownKey, newId, oldSession, kind, verifier, initialMode }) => {
      if (window.location.origin !== site) return;
      localStorage.setItem("deepocean-language", language);
      if (!sessionStorage.getItem("__recovery-fixture")) {
        sessionStorage.setItem("__recovery-fixture", "initialized");
        sessionStorage.setItem(
          "__recovery-deny-save",
          initialMode === "save-denied" ? "yes" : "no",
        );
        sessionStorage.setItem("recovery-fixture-text", "synthetic session text");
        localStorage.setItem("recovery-fixture-text", "synthetic local text");
        sessionStorage.setItem(mainKey, JSON.stringify(oldSession));
        if (kind === "code")
          sessionStorage.setItem(mainKey + "-code-verifier", JSON.stringify(verifier));
      }
      window.__recoveryProbe = { ownWrites: 0, cleanupAfterWrite: 0, targetWrites: 0 };
      const set = Storage.prototype.setItem,
        remove = Storage.prototype.removeItem;
      Storage.prototype.setItem = function (key, value) {
        if (this === sessionStorage && key === mainKey && JSON.parse(value)?.user?.id === newId) {
          window.__recoveryProbe.targetWrites++;
          if (sessionStorage.getItem("__recovery-deny-save") === "yes")
            throw new DOMException("Synthetic save denial", "QuotaExceededError");
        }
        const result = set.call(this, key, value);
        if (this === sessionStorage && key === ownKey) window.__recoveryProbe.ownWrites++;
        return result;
      };
      Storage.prototype.removeItem = function (key) {
        const result = remove.call(this, key);
        if (this === sessionStorage && key === ownKey && window.__recoveryProbe.ownWrites > 0)
          window.__recoveryProbe.cleanupAfterWrite++;
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
        const response = passwordRecoveryMock(
          {
            url: request.url(),
            method: request.method(),
            bearer: request.headers().authorization,
            body: ["POST", "PUT"].includes(request.method()) ? request.postDataJSON() : undefined,
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
          (["invalid-old", "switch-verify", "timeout", "unmount"].includes(mode) &&
            response.kind === "verify") ||
          (mode === "switch-save" &&
            response.kind === "user" &&
            response.isNew &&
            counts.newUserReads === 2) ||
          (mode === "switch-password" && response.kind === "password");
        if (hold) {
          reached.resolve();
          await gate.promise;
        }
        if (response.abort) return route.abort();
        return route.fulfill({
          status: response.status,
          headers: {
            "access-control-allow-origin": site,
            "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
            "access-control-allow-headers":
              request.headers()["access-control-request-headers"] ||
              "apikey,authorization,content-type,x-client-info,x-supabase-api-version",
          },
          ...(["preflight", "logout"].includes(response.kind)
            ? {}
            : { contentType: "application/json", body: JSON.stringify(response.body) }),
        });
      }
      if (url.origin === site && request.method() === "GET" && url.pathname === "/__recovery-away")
        return route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><h1>Synthetic away page</h1>",
        });
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
  const resetUrl = () =>
    site +
    "/reset-password" +
    (kind === "none"
      ? ""
      : kind === "duplicate"
        ? "?code=synthetic-a&code=synthetic-b"
        : kind === "tokens"
          ? "#" +
            new URLSearchParams({
              access_token: newSession.access_token,
              refresh_token: newSession.refresh_token,
              type: "recovery",
            })
          : kind === "code"
            ? "?code=" + code
            : "?token_hash=" + hash);
  const open = async () => {
    await page.goto(resetUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () => location.pathname === "/reset-password" && !location.search && !location.hash,
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
          sessionStorage.getItem("recovery-fixture-text") === "synthetic session text" &&
          localStorage.getItem("recovery-fixture-text") === "synthetic local text"
        );
      },
      { mainKey, temporaryKeys, expectedOwner },
    ),
    "bound_owner_temporary_cleanup_unrelated_fixture_retained",
  );
  h.safe();
}
async function locked(h, language) {
  await h.page
    .getByRole("alert")
    .filter({
      hasText:
        language === "en"
          ? "Invalid or expired link, or the account changed."
          : "链接无效、已过期或账号已变化",
    })
    .waitFor();
  check((await h.page.locator("#new-password").count()) === 0, "no_form_on_invalid_recovery");
  check(!new URL(h.page.url()).search && !new URL(h.page.url()).hash, "link_material_removed");
}
async function ready(h) {
  await h.page.locator("#new-password").waitFor();
  await assertState(h, newSession.user.id);
}
async function submit(h) {
  await h.page.locator("#new-password").fill(password);
  await h.page.locator("#confirm-password").fill(password);
  await h.page.evaluate(() => {
    const form = document.querySelector("form.do-auth-form");
    form.requestSubmit();
    form.requestSubmit();
  });
}
async function done(h, language) {
  await h.page
    .getByRole("status")
    .filter({
      hasText:
        language === "en"
          ? "Password updated. Sign in with your new password."
          : "密码已更新，请用新密码重新登录。",
    })
    .waitFor();
  check(
    h.counts.passwords === 1 && h.counts.logouts === 1,
    "one_bound_mock_password_request_and_local_logout",
  );
  await assertState(h, null);
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
  for (const path of await response.json())
    if (/^\/assets\/[a-zA-Z0-9_-]+\.js$/.test(path)) publicAssets.add(path);
  const texts = await Promise.all(
    [...publicAssets].map(async (path) => {
      const r = await fetch(site + path, { signal: AbortSignal.timeout(30000) });
      check(r.ok && new URL(r.url).origin === site, "fixed_recovery_asset");
      return r.text();
    }),
  );
  for (const marker of [
    "Password recovery could not be verified. Request a new link.",
    "supdiver-password-recovery-",
    "Session write no longer belongs to the active request",
  ])
    check(
      texts.some((text) => text.includes(marker)),
      "recovery_repair_must_be_deployed_first",
    );
  pass("fixed_recovery_isolated_password_verification_and_guarded_write_bundle_preflight");
  const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || "playwright");
  browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
  for (const language of ["zh-CN", "en"]) {
    for (const kind of ["hash", "code", "tokens"]) {
      stage = language + " normal " + kind;
      const h = await harness(language, "normal", kind);
      await h.open();
      await ready(h);
      await submit(h);
      await done(h, language);
      check(
        h.counts.verifies === (kind === "hash" ? 1 : 0) &&
          h.counts.exchanges === (kind === "code" ? 1 : 0),
        "one_explicit_link_consumption",
      );
      await h.context.close();
      h.release();
      pass(
        "actual_" +
          language +
          "_" +
          kind +
          "_verified_once_mock_password_submit_single_flight_and_logout",
      );
    }
    for (const mode of [
      "invalid-old",
      "network-error",
      "user-mismatch",
      "save-denied",
      "switch-verify",
      "switch-save",
      "timeout",
      "exchange-error",
      "no-link",
      "duplicate",
    ]) {
      stage = language + " " + mode;
      const kind =
        mode === "exchange-error"
          ? "code"
          : mode === "no-link"
            ? "none"
            : mode === "duplicate"
              ? "duplicate"
              : "hash";
      const h = await harness(language, mode, kind);
      await h.open();
      let expected = oldSession.user.id;
      if (["invalid-old", "switch-verify", "switch-save", "timeout"].includes(mode)) {
        await h.reached();
        check(
          (await h.page.locator("#new-password").count()) === 0,
          "old_session_never_unlocks_pending_recovery",
        );
        if (mode.startsWith("switch-")) {
          await h.page.evaluate(
            ({ mainKey, otherSession }) =>
              sessionStorage.setItem(mainKey, JSON.stringify(otherSession)),
            { mainKey, otherSession },
          );
          expected = otherSession.user.id;
        }
        if (mode === "timeout") await locked(h, language);
        h.release();
        if (mode === "timeout")
          await h.page.waitForFunction(
            () =>
              window.__recoveryProbe.ownWrites > 0 && window.__recoveryProbe.cleanupAfterWrite > 0,
          );
      }
      await locked(h, language);
      await assertState(h, expected);
      check(
        h.counts.passwords === 0 && h.counts.logouts === 0,
        "no_password_request_or_wrong_account_logout",
      );
      if (["switch-verify", "switch-save", "timeout"].includes(mode))
        check(
          await h.page.evaluate(() => window.__recoveryProbe.targetWrites === 0),
          "late_result_never_writes_main_session",
        );
      if (["no-link", "duplicate"].includes(mode))
        check(h.counts.verifies === 0 && h.counts.exchanges === 0, "invalid_input_never_consumed");
      pass("actual_" + language + "_" + mode + "_locked_no_owner_overwrite_or_password_request");
      if (["invalid-old", "network-error", "user-mismatch", "save-denied"].includes(mode)) {
        if (mode === "save-denied") {
          await h.page.evaluate(() => sessionStorage.setItem("__recovery-deny-save", "no"));
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
        await ready(h);
        check(h.counts.verifies === before + 1, "fresh_modeled_retry_consumes_once");
        await submit(h);
        await done(h, language);
        pass("actual_" + language + "_" + mode + "_fresh_synthetic_link_retry");
      }
      await h.context.close();
      h.release();
    }
    for (const mode of ["update-error", "switch-password"]) {
      stage = language + " " + mode;
      const h = await harness(language, mode);
      await h.open();
      await ready(h);
      await submit(h);
      if (mode === "switch-password") {
        await h.reached();
        await h.page.evaluate(
          ({ mainKey, otherSession }) =>
            sessionStorage.setItem(mainKey, JSON.stringify(otherSession)),
          { mainKey, otherSession },
        );
        h.release();
        await locked(h, language);
        await assertState(h, otherSession.user.id);
        check(
          h.counts.passwords === 1 && h.counts.logouts === 0,
          "mock_password_bound_to_original_owner_never_logs_out_new_owner",
        );
      } else {
        await h.page
          .getByRole("alert")
          .filter({ hasText: language === "en" ? "Update failed." : "更新失败" })
          .waitFor();
        check(
          h.counts.passwords === 1 && h.counts.logouts === 0,
          "mock_update_failure_not_success",
        );
        await assertState(h, newSession.user.id);
      }
      await h.context.close();
      h.release();
      pass("actual_" + language + "_" + mode + "_no_false_completion_or_new_owner_logout");
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
            stripped: !location.search && !location.hash,
            reset: location.pathname === "/reset-password",
            form: !!document.querySelector("#new-password"),
            alert: !!document.querySelector('[role="alert"]'),
            ownWrites: window.__recoveryProbe?.ownWrites ?? 0,
            cleanupAfterWrite: window.__recoveryProbe?.cleanupAfterWrite ?? 0,
            targetWrites: window.__recoveryProbe?.targetWrites ?? 0,
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
      "isolated_contexts_closed_synthetic_state_dropped_no_real_accounts_mail_or_password_writes",
    );
  console.log(
    "AUDIT: complete=" +
      (!failed && !unsafe) +
      "; recovery_only; all_auth_password_and_logout_responses_mocked; no_real_links_mail_accounts_backend_writes_existing_data_changes_or_artifacts",
  );
  if (failed || unsafe) process.exitCode = 1;
}
