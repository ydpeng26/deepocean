// Cloud-only recovery acceptance; no real identities, mail or existing rows.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { initializeGearLanguage, isGearFontStylesheet } from "./lib/gear-browser-setup.mjs";
const site = "https://supdiver-recovery-test.vercel.app",
  api = "https://esovqvampbrhuhamkfcs.supabase.co";
const endpoint = api + "/functions/v1/guest-contact";
export function guestFixtureRequest(url, method, body, marker) {
  return (
    url === endpoint &&
    method === "POST" &&
    body &&
    Object.keys(body).sort().join(",") === "body,category,id,reply_email,visitor_key,website" &&
    /^[0-9a-f-]{36}$/i.test(body.id) &&
    /^[0-9a-f-]{36}$/i.test(body.visitor_key) &&
    body.category === "issue" &&
    typeof body.body === "string" &&
    body.body.startsWith(marker) &&
    body.body.length < 3000 &&
    ["", "reply@example.invalid"].includes(body.reply_email) &&
    body.website === ""
  );
}
export async function runGuestAcceptance() {
  let admin,
    anon,
    browser,
    stage = "guard",
    complete = false,
    cleaned = false,
    alarm;
  const fixtures = new Map(),
    states = [],
    marker = "GUEST-CONTACT-" + randomUUID();
  const check = (value, code) => {
    if (!value) {
      const e = Error(code);
      e.auditCode = code;
      throw e;
    }
  };
  const pass = (value) => console.log("PASS: " + value);
  const own = (id) => "/rest/v1/guest_contact_messages?id=eq." + id;
  async function http(path, { method = "GET", body, anonymous = false } = {}) {
    check(path.startsWith("/") && !path.startsWith("//"), "fixed_recovery_path");
    const key = anonymous ? anon : admin;
    const response = await fetch(api + path, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      ok: response.ok,
      status: response.status,
      data: await response.json().catch(() => null),
    };
  }
  async function rows(id) {
    const r = await http(own(id) + "&select=id,body,reply_email");
    check(r.ok && Array.isArray(r.data), "exact_fixture_read");
    return r.data;
  }
  async function publicPost(body, origin = site) {
    check(guestFixtureRequest(endpoint, "POST", body, marker), "generated_fixture_only");
    if (!fixtures.has(body.id)) fixtures.set(body.id, body);
    const r = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  }
  try {
    check(process.env.GITHUB_ACTIONS === "true", "github_cloud_only");
    admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
    check(!!admin, "recovery_key_required");
    anon = (await readFile(new URL("./recovery-browser.mjs", import.meta.url), "utf8")).match(
      /const anon = '([^']+)'/,
    )[1];
    alarm = setTimeout(() => {
      void browser?.close();
    }, 300000);
    const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || "playwright");
    browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
    for (const language of ["zh-CN", "en"]) {
      stage = language + "_public_contact";
      console.log("STAGE: " + stage);
      const en = language === "en",
        context = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
          serviceWorkers: "block",
        });
      await context.addInitScript(initializeGearLanguage, language);
      // The English case deliberately denies auth-session storage while leaving
      // language/contact storage available. Contact must not need auth storage.
      if (en)
        await context.addInitScript(() => {
          if (location.origin !== "https://supdiver-recovery-test.vercel.app") return;
          const denied = sessionStorage;
          const get = Storage.prototype.getItem,
            set = Storage.prototype.setItem;
          Storage.prototype.getItem = function (key) {
            if (this === denied || String(key).includes("auth-token"))
              throw Error("Synthetic auth storage denied");
            return get.call(this, key);
          };
          Storage.prototype.setItem = function (key, value) {
            if (this === denied || String(key).includes("auth-token"))
              throw Error("Synthetic auth storage denied");
            return set.call(this, key, value);
          };
        });
      const state = { errors: 0, blocked: 0, posts: 0, mode: null, payload: null };
      states.push(state);
      context.on("page", (page) => page.on("pageerror", () => state.errors++));
      await context.route("**/*", async (route) => {
        const request = route.request(),
          url = request.url(),
          u = new URL(url),
          method = request.method();
        try {
          if (u.origin === site && ["GET", "HEAD"].includes(method)) return route.continue();
          if (isGearFontStylesheet(url, method, request.resourceType()))
            return route.fulfill({ status: 200, contentType: "text/css", body: "/* isolated */" });
          if (url === endpoint && method === "OPTIONS") return route.continue();
          const payload = request.postDataJSON();
          check(guestFixtureRequest(url, method, payload, marker), "browser_boundary");
          if (!fixtures.has(payload.id)) fixtures.set(payload.id, payload);
          state.payload = payload;
          state.posts++;
          const mode = state.mode;
          state.mode = null;
          if (mode === "fail")
            return route.fulfill({
              status: 503,
              contentType: "application/json",
              body: '{"code":"unavailable"}',
            });
          if (mode === "lost") {
            const response = await route.fetch({ timeout: 20000 });
            check(response.ok(), "real_guest_commit");
            return route.fulfill({
              status: 503,
              contentType: "application/json",
              body: '{"code":"unavailable"}',
            });
          }
          return route.continue();
        } catch {
          state.blocked++;
          return route.abort().catch(() => {});
        }
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      await page.goto(site, { waitUntil: "domcontentloaded" });
      const name = en ? "Contact us" : "联系我们";
      await page.getByRole("link", { name, exact: true }).click();
      await page.waitForURL("**/contact");
      await page.locator("#contact-body").waitFor();
      check(page.url() === site + "/contact", "no_login_redirect");
      for (const width of [1440, 900, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        check(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          "public_contact_no_horizontal_overflow",
        );
      }
      await page.goto(site + "/auth", { waitUntil: "domcontentloaded" });
      await page.getByRole("link", { name, exact: true }).click();
      await page.waitForURL("**/contact");
      const body = page.locator("#contact-body"),
        email = page.locator("#contact-email");
      const submit = page.getByRole("button", {
        name: en ? "Send message" : "发送留言",
        exact: true,
      });
      check(await submit.isDisabled(), "blank_disabled");
      const text = marker + " " + language + " login issue";
      await body.fill(text);
      if (en) await email.fill("reply@example.invalid");
      state.mode = "fail";
      await submit.evaluate((el) => {
        el.click();
        el.click();
      });
      await page.getByRole("alert").waitFor();
      check(
        state.posts === 1 &&
          (await body.inputValue()) === text &&
          (await rows(state.payload.id)).length === 0,
        "guest_failed_double_keeps_draft",
      );
      state.mode = "lost";
      await submit.click();
      await page.getByRole("alert").waitFor();
      const original = state.payload;
      const saved = await rows(original.id);
      check(
        saved.length === 1 &&
          saved[0].body === text &&
          saved[0].reply_email === (en ? "reply@example.invalid" : null),
        "guest_real_saved_without_auth_optional_email",
      );
      await submit.click();
      await page
        .getByRole("status")
        .filter({ hasText: en ? "Message received" : "留言已收到" })
        .waitFor();
      check(
        (await body.inputValue()) === "" &&
          (await email.inputValue()) === "" &&
          (await rows(original.id)).length === 1 &&
          state.posts === 3,
        "guest_lost_reply_retry_exact_single_row",
      );
      const denied = await http(own(original.id) + "&select=id", { anonymous: true });
      check(!denied.ok, "anonymous_cannot_read_guest_row");
      const insertDenied = await http("/rest/v1/guest_contact_messages", {
        method: "POST",
        anonymous: true,
        body: { id: original.id, body: text },
      });
      check(!insertDenied.ok, "anonymous_cannot_direct_insert");
      const patchDenied = await http(own(original.id), {
        method: "PATCH",
        anonymous: true,
        body: { body: text + " altered" },
      });
      check(!patchDenied.ok, "anonymous_cannot_change");
      const deleteDenied = await http(own(original.id), { method: "DELETE", anonymous: true });
      check(!deleteDenied.ok, "anonymous_cannot_delete");
      const conflict = await publicPost({ ...original, body: text + " changed" });
      check(conflict.status === 409, "guest_changed_retry_conflict");
      const over = await publicPost({
        ...original,
        id: randomUUID(),
        body: marker + " minute limit",
      });
      check(over.status === 429, "guest_browser_minute_limit");
      const badOrigin = await publicPost(
        { ...original, id: randomUUID() },
        "https://example.invalid",
      );
      check(badOrigin.status === 403, "foreign_origin_denied");
      check((await rows(original.id))[0].body === text, "guest_denied_attempts_preserve_row");
      pass(
        language +
          "_homepage_login_entrances_public_no_session_optional_email_layout_failed_double_lost_reply_retry_privacy_and_browser_limit",
      );
      await page.waitForLoadState("networkidle");
      await context.close();
    }
    stage = "guest_browser_concurrency";
    console.log("STAGE: " + stage);
    // One fresh generated browser key races across two requests. Do not assume
    // a stable proxy IP across browser and Node transports in the cloud runner.
    const concurrentVisitor = randomUUID();
    const results = await Promise.all(
      [1, 2].map((n) =>
        publicPost({
          ...fixtures.values().next().value,
          id: randomUUID(),
          visitor_key: concurrentVisitor,
          body: marker + " concurrent " + n,
        }),
      ),
    );
    check(
      results.filter((r) => r.status === 200).length === 1 &&
        results.filter((r) => r.status === 429).length === 1,
      "browser_limit_serialized",
    );
    check(
      states.every((s) => s.errors === 0 && s.blocked === 0),
      "no_guest_browser_errors_or_boundary_blocks",
    );
    pass("real_guest_concurrent_same_browser_cap_allows_exactly_one_new_row");
    complete = true;
  } catch (error) {
    console.log(
      "INCOMPLETE: guest_contact stage=" +
        stage +
        "; check=" +
        (error.auditCode || "browser_operation") +
        "; details_suppressed",
    );
  } finally {
    clearTimeout(alarm);
    await browser?.close().catch(() => {
      complete = false;
    });
    cleaned = true;
    for (const [id, expected] of fixtures) {
      try {
        const before = await rows(id);
        check(
          before.length === 0 ||
            (before.length === 1 &&
              before[0].body === expected.body &&
              before[0].body.startsWith(marker)),
          "exact_generated_guest_cleanup_guard",
        );
        const r = await http(own(id) + "&body=eq." + encodeURIComponent(expected.body), {
          method: "DELETE",
        });
        check(r.ok, "guest_cleanup_delete");
        check((await rows(id)).length === 0, "guest_fixture_absence");
      } catch {
        cleaned = false;
        console.log("INCOMPLETE: guest_fixture_cleanup; fixture_id=" + id);
      }
    }
    if (cleaned)
      pass("all_exact_generated_guest_contact_rows_absent_browser_closed_no_accounts_or_mail");
    console.log(
      "DIAGNOSTIC: " +
        JSON.stringify(
          states.map((s) => ({
            pageErrors: s.errors,
            blockedRequests: s.blocked,
            guestPosts: s.posts,
          })),
        ),
    );
    const ok = complete && cleaned && states.every((s) => s.errors === 0 && s.blocked === 0);
    console.log(
      "AUDIT: guest_contact_complete=" +
        ok +
        "; recovery_only; no_existing_user_reads_edits_mail_auth_changes_or_local_exports",
    );
    if (!ok) process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await runGuestAcceptance();
