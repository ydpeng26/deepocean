// Cloud-only, fixed recovery origins. All credentials/fixtures stay in runner memory.
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { fixtureReadUrl, recoveryOrigin, recoverySite } from "./recovery-member-safety.mjs";
import { gearFixtureToken } from "./lib/gear-fixture-session.mjs";
import { initializeGearLanguage, isGearFontStylesheet } from "./lib/gear-browser-setup.mjs";
import { gearBrowserDiagnostic } from "./lib/gear-browser-diagnostic.mjs";

export function feedbackFixtureWrite(raw, method, value, owner, ids) {
  const u = new URL(raw);
  return (
    u.origin === recoveryOrigin &&
    u.pathname === "/rest/v1/website_feedback" &&
    method === "POST" &&
    value &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === "body,category,id,user_id" &&
    value.user_id === owner &&
    ids.has(value.id) &&
    ["suggestion", "issue", "other"].includes(value.category) &&
    typeof value.body === "string" &&
    value.body.startsWith("FEEDBACK-SAFETY-") &&
    value.body.length <= 3000
  );
}
export async function runFeedbackAcceptance() {
  let admin,
    anon,
    browser,
    stage = "guard",
    complete = false,
    cleanupOK = false,
    alarm;
  const accounts = [],
    contexts = [],
    abort = new AbortController();
  const marker = "FEEDBACK-SAFETY-" + randomBytes(10).toString("hex");
  const check = (ok, code) => {
    if (!ok) {
      const e = Error(code);
      e.auditCode = code;
      throw e;
    }
  };
  const advance = (name) => {
    stage = name;
    console.log("STAGE: " + name);
  };
  const pass = (name) => console.log("PASS: " + name);
  async function http(
    path,
    { method = "GET", body, token, anonymous = false, cleanup = false } = {},
  ) {
    check(path.startsWith("/") && !path.startsWith("//"), "fixed_path");
    const key = token || anonymous ? anon : admin;
    const response = await fetch(recoveryOrigin + path, {
      method,
      redirect: "error",
      signal: cleanup
        ? AbortSignal.timeout(15000)
        : AbortSignal.any([abort.signal, AbortSignal.timeout(20000)]),
      headers: {
        apikey: key,
        Authorization: "Bearer " + (token || key),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try {
      data = await response.json();
    } catch {}
    return { ok: response.ok, status: response.status, data };
  }
  async function req(path, options) {
    const r = await http(path, options);
    check(r.ok, "recovery_http_" + r.status);
    return r.data;
  }
  const own = (account, id) =>
    "/rest/v1/website_feedback?user_id=eq." + account.id + (id ? "&id=eq." + id : "");
  const rows = (account, cleanup = false) =>
    req(own(account) + "&select=id,user_id,category,body,created_at", { cleanup });
  const track = (account) => {
    const id = randomUUID();
    account.ids.add(id);
    return id;
  };
  async function makeContext(language, account) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: language === "en" ? "en-US" : "zh-CN",
      serviceWorkers: "block",
    });
    const state = {
      context,
      account,
      errors: 0,
      blocked: 0,
      posts: 0,
      mode: null,
      failedRead: false,
    };
    contexts.push(state);
    await context.addInitScript(initializeGearLanguage, language);
    context.on("page", (p) =>
      p.on("pageerror", () => {
        state.errors++;
      }),
    );
    await context.route("**/*", async (route) => {
      const request = route.request(),
        u = new URL(request.url()),
        method = request.method();
      const block = async () => {
        state.blocked++;
        await route.abort().catch(() => {});
      };
      try {
        if (u.origin === recoverySite && ["GET", "HEAD"].includes(method)) return route.continue();
        if (isGearFontStylesheet(request.url(), method, request.resourceType()))
          return route.fulfill({
            status: 200,
            contentType: "text/css",
            body: "/* isolated test omits external font */",
          });
        if (u.origin !== recoveryOrigin) return block();
        if (method === "OPTIONS") return route.continue();
        if (["GET", "HEAD"].includes(method)) {
          if (["/auth/v1/user", "/auth/v1/settings"].includes(u.pathname)) return route.continue();
          if (u.pathname === "/rest/v1/website_feedback") {
            check(
              account.ids.has(u.searchParams.get("id")?.slice(3)) &&
                u.searchParams.get("user_id") === "eq." + account.id,
              "fixture_feedback_read_only",
            );
            if (state.failedRead) {
              state.failedRead = false;
              return route.fulfill({
                status: 503,
                contentType: "application/json",
                body: '{"message":"Synthetic read failure"}',
              });
            }
            return route.continue();
          }
          if (u.pathname.startsWith("/rest/v1/")) {
            const response = await route.fetch({
              url: fixtureReadUrl(request.url(), account.id),
              timeout: 20000,
            });
            return route.fulfill({ response });
          }
          return block();
        }
        if (u.pathname === "/auth/v1/token" && method === "POST") {
          check(
            u.searchParams.get("grant_type") === "password" &&
              request.postDataJSON()?.email === account.email,
            "fixture_login_only",
          );
          return route.continue();
        }
        if (u.pathname === "/auth/v1/logout" && method === "POST") return route.continue();
        const value = request.postDataJSON();
        // Capture only this generated owner's actual form UUID before validating.
        if (value?.user_id === account.id && /^[0-9a-f-]{36}$/.test(value.id))
          account.ids.add(value.id);
        check(
          feedbackFixtureWrite(request.url(), method, value, account.id, account.ids),
          "fixture_feedback_write_only",
        );
        state.posts++;
        const mode = state.mode;
        state.mode = null;
        if (mode === "fail")
          return route.fulfill({
            status: 503,
            contentType: "application/json",
            body: '{"message":"Synthetic save failure"}',
          });
        if (mode === "lost") {
          const response = await route.fetch({ timeout: 20000 });
          check(response.ok(), "lost_commit");
          state.failedRead = true;
          return route.fulfill({
            status: 400,
            contentType: "application/json",
            body: '{"message":"Synthetic lost reply"}',
          });
        }
        return route.continue();
      } catch {
        return block();
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(18000);
    page.setDefaultNavigationTimeout(45000);
    return { ...state, page, state };
  }
  const btn = (page, name) => page.getByRole("button", { name, exact: true });
  const open = (page, path) => page.goto(recoverySite + path, { waitUntil: "domcontentloaded" });
  async function uiSuite(language, account) {
    const en = language === "en",
      { page, context, state } = await makeContext(language, account);
    advance(language + "_signup_guidance");
    await open(page, "/feedback");
    await page.waitForURL("**/auth**");
    await page.getByRole("tab", { name: en ? "Sign up" : "注册", exact: true }).click();
    const hint = page.locator("#signup-password-requirements");
    await hint.waitFor();
    check((await hint.innerText()).includes(en ? "6–72" : "至少 6"), "persistent_signup_hint");
    await page.locator("#password").fill(account.password);
    check(await hint.isVisible(), "hint_survives_typing");
    check(
      (await page.locator("#password").getAttribute("aria-describedby")) ===
        "signup-password-requirements",
      "hint_accessible",
    );
    await page.getByRole("tab", { name: en ? "Sign in" : "登录", exact: true }).click();
    check((await hint.count()) === 0, "signin_has_no_signup_hint");
    await page.locator("#email").fill(account.email);
    await page.locator("#password").fill(account.password);
    const logged = page.waitForResponse((r) =>
      r.url().startsWith(recoveryOrigin + "/auth/v1/token?grant_type=password"),
    );
    await btn(page, en ? "Sign in" : "登录").click();
    check((await logged).ok(), "fixture_login");
    await page.waitForURL((u) => u.pathname !== "/auth");
    account.token = await page.evaluate(gearFixtureToken, account.id);
    check(!!account.token, "fixture_session_owner");
    advance(language + "_feedback_submission");
    await open(page, "/feedback");
    await page.locator("#feedback-body").waitFor();
    const nav = page.getByRole("navigation", { name: en ? "Main navigation" : "主要导航" });
    const feedback = nav.getByRole("link", { name: en ? "Feedback" : "意见反馈", exact: true });
    check((await feedback.getAttribute("aria-current")) === "page", "active_feedback_navigation");
    for (const width of [1440, 1200, 900]) {
      await page.setViewportSize({ width, height: 1000 });
      const fit = await nav.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return (
          rect.left >= 0 && rect.right <= innerWidth + 1 && el.scrollWidth <= el.clientWidth + 1
        );
      });
      check(fit, "navigation_fits_viewport");
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const input = page.locator("#feedback-body"),
      submit = btn(page, en ? "Submit feedback" : "提交反馈"),
      text = marker + " " + language + " suggestion";
    await input.fill("   ");
    check(await submit.isDisabled(), "empty_feedback_disabled");
    await input.fill(text);
    state.mode = "fail";
    const failed = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.url().startsWith(recoveryOrigin + "/rest/v1/website_feedback"),
    );
    await submit.evaluate((el) => {
      el.click();
      el.click();
    });
    await failed;
    await page.getByRole("alert").waitFor();
    check(
      state.posts === 1 &&
        (await input.inputValue()) === text &&
        (await rows(account)).length === 0,
      "failed_double_submit_kept_draft_no_row",
    );
    state.mode = "lost";
    const lost = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.url().startsWith(recoveryOrigin + "/rest/v1/website_feedback"),
    );
    await submit.click();
    check((await lost).status() === 400, "lost_reply_injected");
    await page.getByRole("alert").waitFor();
    const saved = await rows(account);
    check(
      saved.length === 1 && saved[0].body === text && (await input.inputValue()) === text,
      "lost_commit_real_row_draft_kept",
    );
    const posts = state.posts;
    await submit.click();
    await page
      .getByRole("status")
      .filter({ hasText: en ? "Feedback received" : "反馈已收到" })
      .waitFor();
    check(
      (await input.inputValue()) === "" &&
        state.posts === posts &&
        (await rows(account)).length === 1,
      "identical_retry_no_duplicate_insert",
    );
    pass(
      language +
        "_signup_hint_feedback_nav_layout_failure_draft_double_submit_lost_reply_retry_real_persisted_row",
    );
    advance(language + "_forum_count_removed");
    await open(page, "/forum");
    await page.locator(".do-forum-hero").waitFor();
    check(
      (await page.locator(".do-forum-hero-orbit").count()) === 0 &&
        !(await page.locator(".do-forum-hero").innerText()).includes("OCEAN STORIES"),
      "forum_orbit_absent",
    );
    check(
      (await page
        .getByRole("navigation")
        .getByRole("link", { name: en ? "Feedback" : "意见反馈", exact: true })
        .count()) === 1,
      "feedback_nav_on_forum",
    );
    pass(language + "_forum_hero_number_presentation_removed");
    await context.close();
  }
  async function permissionSuite(account, outsider) {
    advance("feedback_api_privacy_and_limits");
    const saved = await rows(account),
      id = saved[0].id;
    for (const options of [{ token: outsider.token }, { anonymous: true }]) {
      const r = await http(own(account, id) + "&select=id", options);
      check(
        !r.ok || (Array.isArray(r.data) && r.data.length === 0),
        "other_or_anonymous_read_denied",
      );
    }
    for (const method of ["PATCH", "DELETE"]) {
      const r = await http(own(account, id), {
        method,
        token: outsider.token,
        body: method === "PATCH" ? { body: marker + " must not replace" } : undefined,
      });
      check(!r.ok || (Array.isArray(r.data) && r.data.length === 0), "outsider_write_denied");
    }
    const forgedId = track(account);
    check(
      !(
        await http("/rest/v1/website_feedback", {
          method: "POST",
          token: outsider.token,
          body: {
            id: forgedId,
            user_id: account.id,
            category: "issue",
            body: marker + " forged owner",
          },
        })
      ).ok,
      "forged_owner_denied",
    );
    const ownPatch = await http(own(account, id), {
      method: "PATCH",
      token: account.token,
      body: { body: marker + " immutable" },
    });
    check(!ownPatch.ok, "owner_update_not_granted");
    const timestampId = track(account);
    check(
      !(
        await http("/rest/v1/website_feedback", {
          method: "POST",
          token: account.token,
          body: {
            id: timestampId,
            user_id: account.id,
            category: "issue",
            body: marker + " backdate",
            created_at: "2000-01-01T00:00:00Z",
          },
        })
      ).ok,
      "client_timestamp_denied",
    );
    const rateId = track(account);
    const limited = await http("/rest/v1/website_feedback", {
      method: "POST",
      token: account.token,
      body: { id: rateId, user_id: account.id, category: "issue", body: marker + " minute limit" },
    });
    check(!limited.ok && limited.data?.message === "feedback_rate_limit", "minute_limit_enforced");
    check(
      (await rows(account)).length === 1 && (await rows(account))[0].body === saved[0].body,
      "denied_attempts_no_change",
    );
    pass(
      "real_owner_outsider_anonymous_isolation_forged_owner_immutable_rows_timestamp_and_minute_limit",
    );
    // Only generated rows are backdated by the administrator to exercise rolling
    // daily limits without waiting 20 minutes or weakening the real trigger.
    const backdate = new Date(Date.now() - 120000).toISOString();
    await req(own(account, id), { method: "PATCH", body: { created_at: backdate } });
    for (let n = 1; n < 20; n++) {
      const next = track(account);
      await req("/rest/v1/website_feedback", {
        method: "POST",
        token: account.token,
        body: {
          id: next,
          user_id: account.id,
          category: "other",
          body: marker + " daily fixture " + n,
        },
      });
      await req(own(account, next), { method: "PATCH", body: { created_at: backdate } });
    }
    const over = track(account);
    const capped = await http("/rest/v1/website_feedback", {
      method: "POST",
      token: account.token,
      body: { id: over, user_id: account.id, category: "other", body: marker + " daily excess" },
    });
    check(
      !capped.ok &&
        capped.data?.message === "feedback_rate_limit" &&
        (await rows(account)).length === 20,
      "daily_limit_enforced",
    );
    pass("real_rolling_24_hour_limit_after_twenty_exact_generated_feedback_rows_no_rule_bypass");
    const otherRows = await rows(outsider);
    check(otherRows.length === 1, "second_fixture_original_row");
    await req(own(outsider, otherRows[0].id), { method: "PATCH", body: { created_at: backdate } });
    const simultaneous = await Promise.all(
      [track(outsider), track(outsider)].map((next) =>
        http("/rest/v1/website_feedback", {
          method: "POST",
          token: outsider.token,
          body: {
            id: next,
            user_id: outsider.id,
            category: "other",
            body: marker + " simultaneous fixture",
          },
        }),
      ),
    );
    check(
      simultaneous.filter((r) => r.ok).length === 1 &&
        simultaneous.filter((r) => !r.ok && r.data?.message === "feedback_rate_limit").length ===
          1 &&
        (await rows(outsider)).length === 2,
      "concurrent_minute_limit_serialized",
    );
    pass("two_simultaneous_real_submissions_allow_exactly_one_new_row_under_minute_limit");
  }
  try {
    check(process.env.GITHUB_ACTIONS === "true", "github_cloud_only");
    admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
    check(!!admin, "recovery_credential_required");
    anon = (await readFile(new URL("./recovery-browser.mjs", import.meta.url), "utf8")).match(
      /const anon = '([^']+)'/,
    )[1];
    alarm = setTimeout(() => {
      abort.abort();
      void browser?.close().catch(() => {});
    }, 480000);
    advance("fixed_recovery_preflight");
    const manifest = await (
      await fetch(recoverySite + "/offline-assets.json", {
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      })
    ).json();
    const paths = manifest.filter((p) => /^\/assets\/[^/?#]+\.js$/.test(p));
    const scripts = await Promise.all(
      paths.map(async (p) => {
        const r = await fetch(recoverySite + p, {
          signal: AbortSignal.timeout(20000),
          redirect: "error",
        });
        check(r.ok, "asset_ok");
        return r.text();
      }),
    );
    check(
      scripts.some((s) => s.includes("FeedbackError")) &&
        scripts.some((s) => s.includes("signup-password-requirements")),
      "new_feedback_and_signup_bundle",
    );
    const client = scripts[paths.findIndex((p) => p.startsWith("/assets/client-"))];
    check(
      client?.includes("esovqvampbrhuhamkfcs.supabase.co") &&
        !client.includes("zmhtlhpeulhhcvlnjdrb.supabase.co"),
      "recovery_backend_only",
    );
    const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || "playwright");
    browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
    for (const language of ["zh-CN", "en"]) {
      const account = {
        id: randomUUID(),
        email: "feedback-" + randomBytes(16).toString("hex") + "@example.invalid",
        password: randomBytes(32).toString("base64url"),
        ids: new Set(),
        created: true,
      };
      accounts.push(account);
      const user = await req("/auth/v1/admin/users", {
        method: "POST",
        body: {
          id: account.id,
          email: account.email,
          password: account.password,
          email_confirm: true,
          user_metadata: { recovery_feedback: marker },
        },
      });
      check(user.id === account.id, "exact_generated_account");
      await req("/rest/v1/profiles?id=eq." + account.id, {
        method: "PATCH",
        body: { display_name: marker },
      });
      await uiSuite(language, account);
    }
    await permissionSuite(accounts[0], accounts[1]);
    check(
      contexts.every((s) => s.errors === 0 && s.blocked === 0),
      "no_browser_errors_or_boundary_blocks",
    );
    complete = true;
  } catch (error) {
    console.log("DIAGNOSTIC: " + JSON.stringify(gearBrowserDiagnostic(error)));
    console.log(
      "INCOMPLETE: stage=" +
        stage +
        "; check=" +
        (error.auditCode || "browser_operation") +
        "; details_suppressed",
    );
  } finally {
    clearTimeout(alarm);
    abort.abort();
    await browser?.close().catch(() => {
      complete = false;
    });
    for (const [index, state] of contexts.entries())
      console.log(
        "DIAGNOSTIC: " +
          JSON.stringify({
            context: index,
            pageErrors: state.errors,
            blockedRequests: state.blocked,
            feedbackPosts: state.posts,
          }),
      );
    cleanupOK = true;
    for (const account of accounts)
      try {
        const user = await http("/auth/v1/admin/users/" + account.id, { cleanup: true });
        if (user.status !== 404) {
          check(
            user.ok &&
              user.data?.id === account.id &&
              user.data?.email === account.email &&
              user.data?.user_metadata?.recovery_feedback === marker,
            "exact_cleanup_account_guard",
          );
          if (account.token) {
            const revoked = await http("/auth/v1/logout?scope=global", {
              method: "POST",
              token: account.token,
              cleanup: true,
            });
            check(revoked.ok || [401, 403, 404].includes(revoked.status), "session_revocation");
          }
          for (const id of account.ids)
            await req(own(account, id), { method: "DELETE", cleanup: true });
          check((await rows(account, true)).length === 0, "feedback_fixture_absence");
          await req("/auth/v1/admin/users/" + account.id, { method: "DELETE", cleanup: true });
        }
        check(
          (await http("/auth/v1/admin/users/" + account.id, { cleanup: true })).status === 404,
          "auth_absence",
        );
        check(
          (await req("/rest/v1/profiles?id=eq." + account.id + "&select=id", { cleanup: true }))
            .length === 0 && (await rows(account, true)).length === 0,
          "profile_and_feedback_absence",
        );
      } catch {
        cleanupOK = false;
        console.log("INCOMPLETE: exact_fixture_cleanup; fixture_id=" + account.id);
      }
    if (cleanupOK)
      pass("exact_generated_feedback_auth_and_profiles_absent_sessions_revoked_browser_closed");
    const ok = complete && cleanupOK && contexts.every((s) => s.errors === 0 && s.blocked === 0);
    console.log(
      "AUDIT: complete=" +
        ok +
        "; recovery_only; generated_accounts_and_feedback_only; no_mail_photos_existing_user_reads_edits_local_exports_or_production_changes",
    );
    if (!ok) process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await runFeedbackAcceptance();
