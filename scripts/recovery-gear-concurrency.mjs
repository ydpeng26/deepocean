// Cloud-only, fixed recovery site. One disposable owner, synthetic text, no media.
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gearRecoveryPreflight } from "./lib/gear-recovery-preflight.mjs";
import { gearBrowserDiagnostic } from "./lib/gear-browser-diagnostic.mjs";
import { gearFixtureToken } from "./lib/gear-fixture-session.mjs";
import { gearNotesMatch } from "./lib/gear-notes-control.mjs";
import { gearTrafficDiagnostic } from "./lib/gear-traffic-diagnostic.mjs";
import { nativeErrorDiagnostic } from "./lib/native-error-diagnostic.mjs";
import { initializeGearLanguage, isGearFontStylesheet } from "./lib/gear-browser-setup.mjs";
const api = "https://esovqvampbrhuhamkfcs.supabase.co";
const site = "https://supdiver-recovery-test.vercel.app";
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
let browser,
  user,
  failed = false,
  unsafe = false,
  timedOut = false,
  stage = "guard";
const marker = "GEAR-CONFLICT-" + randomBytes(8).toString("hex");
const fixtureId = randomUUID(),
  ids = new Set(),
  sessions = new Set();
const email = "gear-conflict-" + randomBytes(16).toString("hex") + "@example.invalid";
const password = randomBytes(32).toString("base64url");
const mainAbort = new AbortController();
let anon, alarm;
const check = (ok, code) => {
  if (!ok) {
    const e = Error(code);
    e.auditCode = code;
    throw e;
  }
};
const pass = (text) => console.log("PASS: " + text);
const advance = (text) => {
  stage = text;
  console.log("STAGE: " + text);
};
async function http(path, { method = "GET", body, token, cleanup = false } = {}) {
  check(path.startsWith("/") && !path.startsWith("//"), "fixed_recovery_path");
  const key = token ? anon : admin;
  const signal = cleanup
    ? AbortSignal.timeout(15000)
    : AbortSignal.any([mainAbort.signal, AbortSignal.timeout(20000)]);
  const r = await fetch(api + path, {
    method,
    signal,
    headers: {
      apikey: key,
      Authorization: "Bearer " + (token || key),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: r.ok, status: r.status, data };
}
async function req(path, options) {
  const r = await http(path, options);
  check(r.ok, "recovery_http_" + r.status);
  return r.data;
}
const rows = (id, cleanup = false) =>
  req("/rest/v1/gear_items?id=eq." + id + "&user_id=eq." + fixtureId + "&select=*", { cleanup });
async function row(id) {
  const data = await rows(id);
  check(data.length === 1, "exact_fixture_row");
  return data[0];
}
async function waitRow(id, predicate) {
  for (let n = 0; n < 30; n++) {
    const data = await row(id);
    if (predicate(data)) return data;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  check(false, "fixture_row_did_not_settle");
}
async function seed() {
  const id = randomUUID();
  ids.add(id);
  await req("/rest/v1/gear_items", {
    method: "POST",
    body: {
      id,
      user_id: fixtureId,
      category: "mask",
      brand: marker,
      model: "base",
      dive_count: 0,
      notes: "base",
    },
  });
  return id;
}
const copies = {
  "zh-CN": {
    email: "邮箱",
    password: "密码",
    login: "登录",
    brand: "品牌",
    model: "型号",
    notes: "备注",
    save: "保存装备",
    remove: "删除装备",
    reload: "加载最新装备记录",
    saved: "装备资料已更新",
    conflict: "装备已在其他页面修改或删除",
  },
  en: {
    email: "Email",
    password: "Password",
    login: "Sign in",
    brand: "Brand",
    model: "Model",
    notes: "Notes",
    save: "Save gear",
    remove: "Delete gear",
    reload: "Load latest gear record",
    saved: "Gear updated",
    conflict: "This gear changed or was deleted elsewhere",
  },
};
async function context(language, id) {
  const stats = {
    patches: 0,
    deletes: 0,
    mode: null,
    revision: null,
    fixtureId: id,
    errors: 0,
    blocked: 0,
    fontStubs: 0,
    errorKinds: [],
    blockedKinds: [],
  };
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: language === "en" ? "en-US" : "zh-CN",
    serviceWorkers: "block",
  });
  await c.addInitScript(initializeGearLanguage, language);
  c.on("page", (p) =>
    p.on("pageerror", (error) => {
      stats.errors++;
      if (stats.errorKinds.length < 6) {
        const diagnostic = nativeErrorDiagnostic(error);
        const reactCode =
          diagnostic.category === "react"
            ? String(error.message).match(/Minified React error #(\d{1,4})\b/)
            : null;
        stats.errorKinds.push({
          ...diagnostic,
          phase: stage,
          ...(reactCode ? { reactCode: Number(reactCode[1]) } : {}),
        });
      }
    }),
  );
  await c.route("**/*", async (route) => {
    const request = route.request(),
      u = new URL(request.url()),
      method = request.method();
    const blocked = async (reason) => {
      unsafe = true;
      stats.blocked++;
      if (stats.blockedKinds.length < 6)
        stats.blockedKinds.push({
          phase: stage,
          ...gearTrafficDiagnostic(request.url(), method, request.resourceType(), reason),
        });
      await route.abort().catch(() => {});
    };
    try {
      if (u.origin === site && ["GET", "HEAD", "OPTIONS"].includes(method)) return route.continue();
      if (isGearFontStylesheet(request.url(), method, request.resourceType())) {
        stats.fontStubs++;
        return route.fulfill({
          status: 200,
          contentType: "text/css",
          body: "/* external font omitted in isolated gear concurrency fixture */",
        });
      }
      if (u.origin !== api) {
        return blocked("foreign_origin");
      }
      if (["GET", "HEAD", "OPTIONS"].includes(method)) {
        if (
          ![
            "/rest/v1/gear_items",
            "/rest/v1/profiles",
            "/auth/v1/user",
            "/auth/v1/settings",
          ].includes(u.pathname)
        ) {
          return blocked("read_path_not_allowed");
        }
        return route.continue();
      }
      if (u.pathname === "/auth/v1/token" && method === "POST") {
        if (u.searchParams.get("grant_type") === "password")
          check(request.postDataJSON().email === email, "fixture_login_only");
        return route.continue();
      }
      if (u.pathname === "/auth/v1/logout" && method === "POST") return route.continue();
      check(
        u.pathname === "/rest/v1/gear_items" && ["PATCH", "DELETE"].includes(method),
        "fixture_mutations_only",
      );
      check(
        u.searchParams.get("id") === "eq." + id &&
          u.searchParams.get("user_id") === "eq." + fixtureId &&
          u.searchParams.has("updated_at"),
        "conditional_fixture_mutation_only",
      );
      stats.revision = u.searchParams.get("updated_at");
      if (method === "DELETE") stats.deletes++;
      else stats.patches++;
      const mode = stats.mode;
      stats.mode = null;
      if (mode === "race")
        await req("/rest/v1/gear_items?id=eq." + id + "&user_id=eq." + fixtureId, {
          method: "PATCH",
          body: { notes: "racing synthetic write" },
        });
      if (mode === "lost") {
        check(method === "PATCH", "lost_patch_only");
        const response = await route.fetch({ timeout: 20000 });
        check(response.ok(), "lost_reply_committed");
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            code: "SYNTHETIC_LOST_REPLY",
            message: "Synthetic lost response",
          }),
        });
      }
      return route.continue();
    } catch (error) {
      await blocked(error.auditCode);
    }
  });
  return { context: c, stats };
}
function reportContext(label, stats) {
  console.log(
    "DIAGNOSTIC: " +
      JSON.stringify({
        context: label,
        pageErrors: stats.errors,
        blockedRequests: stats.blocked,
        fontStylesheetsStubbed: stats.fontStubs,
        errorKinds: stats.errorKinds,
        blockedKinds: stats.blockedKinds,
      }),
  );
}
// Gear has exactly one textarea. Scope notes to that actual control rather than
// depending on implicit accessible-label resolution through nested label markup.
const field = (page, name) =>
  ["备注", "Notes"].includes(name)
    ? page.locator("fieldset textarea")
    : page.getByLabel(name, { exact: true });
const button = (page, name) => page.getByRole("button", { name, exact: true });
async function login(page, language, editor = "retry") {
  const copy = copies[language];
  advance(language + "_" + editor + "_open_login");
  await page.goto(site + "/auth?next=%2Fgear", { waitUntil: "domcontentloaded", timeout: 60000 });
  advance(language + "_" + editor + "_fill_email");
  await field(page, copy.email).fill(email);
  advance(language + "_" + editor + "_fill_password");
  await field(page, copy.password).fill(password);
  const tokenResponse = page.waitForResponse(
    (r) =>
      r.url().startsWith(api + "/auth/v1/token?grant_type=password") &&
      r.request().method() === "POST",
  );
  advance(language + "_" + editor + "_submit_login");
  await button(page, copy.login).click();
  const response = await tokenResponse;
  advance(language + "_" + editor + "_read_login_response");
  check(response.ok(), "temporary_login");
  advance(language + "_" + editor + "_await_gear_route");
  await page.waitForURL("**/gear", { timeout: 45000 });
  const token = await page.evaluate(gearFixtureToken, fixtureId);
  check(typeof token === "string" && token.length > 0, "temporary_session_owner");
  sessions.add(token);
  advance(language + "_" + editor + "_await_gear_brand");
  await field(page, copy.brand).waitFor();
  await page.waitForFunction(
    ({ label, marker }) =>
      [...document.querySelectorAll("label")].some(
        (n) => n.textContent.trim() === label && n.querySelector("input")?.value === marker,
      ),
    { label: copy.brand, marker },
  );
  check((await field(page, copy.brand).inputValue()) === marker, "fixture_editor_loaded");
}
const conflict = (page, copy) => page.getByRole("alert").filter({ hasText: copy.conflict });
async function save(page, copy) {
  const response = page.waitForResponse(
    (r) => r.url().startsWith(api + "/rest/v1/gear_items?") && r.request().method() === "PATCH",
  );
  await button(page, copy.save).click();
  check((await response).ok(), "gear_save_http");
  await page.waitForFunction(() => document.querySelector("fieldset")?.disabled === false);
  check((await conflict(page, copy).count()) === 0, "gear_save_no_conflict");
}
async function reopen(page, copy) {
  await page.goto(site + "/gear", { waitUntil: "domcontentloaded" });
  await field(page, copy.brand).waitFor();
  await page.waitForFunction(
    ({ label, marker }) =>
      [...document.querySelectorAll("label")].some(
        (n) => n.textContent.trim() === label && n.querySelector("input")?.value === marker,
      ),
    { label: copy.brand, marker },
  );
}
async function suite(language) {
  const copy = copies[language],
    id = await seed();
  const A = await context(language, id),
    B = await context(language, id);
  try {
    const a = await A.context.newPage(),
      b = await B.context.newPage();
    a.setDefaultTimeout(25000);
    b.setDefaultTimeout(25000);
    advance(language + "_independent_editors");
    await login(a, language, "A");
    await login(b, language, "B");
    advance(language + "_B_fill_stale_model");
    await field(b, copy.model).fill("stale B draft");
    advance(language + "_A_fill_new_notes");
    await a.bringToFront();
    console.log(
      "DIAGNOSTIC: " +
        JSON.stringify({
          atGear: new URL(a.url()).pathname === "/gear",
          notesLabelMatches: await a.getByLabel(copy.notes, { exact: true }).count(),
          notesControls: await field(a, copy.notes).count(),
          notesLabelVisible:
            (await a.locator("fieldset").getByText(copy.notes, { exact: true }).count()) > 0,
        }),
    );
    await field(a, copy.notes).waitFor();
    check((await field(a, copy.notes).count()) === 1, "exact_one_gear_notes_control");
    check(
      (await a.locator("fieldset").getByText(copy.notes, { exact: true }).count()) > 0,
      "gear_notes_copy_present",
    );
    await field(a, copy.notes).fill("newer A notes");
    check(
      (await field(a, copy.notes).inputValue()) === "newer A notes",
      "actual_notes_input_filled",
    );
    advance(language + "_A_save_newer_record");
    await save(a, copy);
    advance(language + "_independent_read_newer_record");
    const newer = await waitRow(id, (r) => r.notes === "newer A notes");
    advance(language + "_B_stale_save");
    await button(b, copy.save).click();
    advance(language + "_B_wait_conflict");
    await conflict(b, copy).waitFor();
    check((await field(b, copy.model).inputValue()) === "stale B draft", "conflict_draft_retained");
    check(
      (await row(id)).notes === "newer A notes" && (await row(id)).model === "base",
      "stale_write_preserved_server",
    );
    check(await button(b, copy.save).isDisabled(), "conflict_blocks_resubmit");
    pass(language + "_real_two_context_stale_edit_rejected_draft_and_newer_row_retained");
    advance(language + "_explicit_reload");
    b.once("dialog", (d) => d.dismiss());
    await button(b, copy.reload).click();
    check(
      (await field(b, copy.model).inputValue()) === "stale B draft",
      "cancel_reload_retains_draft",
    );
    b.once("dialog", (d) => d.accept());
    await button(b, copy.reload).click();
    await field(b, copy.model).waitFor();
    await b.waitForFunction(gearNotesMatch, "newer A notes");
    check(
      (await field(b, copy.notes).inputValue()) === "newer A notes",
      "explicit_reload_latest_notes",
    );
    check((await field(b, copy.model).inputValue()) === "base", "explicit_reload_latest_model");
    await field(b, copy.model).fill("fresh B");
    await save(b, copy);
    check(
      B.stats.revision === "eq." + newer.updated_at && (await row(id)).model === "fresh B",
      "explicit_reload_adopts_revision",
    );
    pass(language + "_reload_requires_confirmation_then_fresh_save_uses_new_revision");
    advance(language + "_stale_delete");
    await reopen(a, copy);
    await reopen(b, copy);
    await field(a, copy.notes).fill("latest before delete");
    await save(a, copy);
    b.once("dialog", (d) => d.accept());
    await button(b, copy.remove).click();
    await conflict(b, copy).waitFor();
    check((await row(id)).notes === "latest before delete", "stale_delete_denied");
    pass(language + "_stale_delete_cannot_remove_newer_record");
    advance(language + "_atomic_race");
    await reopen(b, copy);
    B.stats.mode = "race";
    await field(b, copy.model).fill("racing stale payload");
    await button(b, copy.save).click();
    await conflict(b, copy).waitFor();
    check(
      (await row(id)).notes === "racing synthetic write" && (await row(id)).model === "fresh B",
      "atomic_race_preserves_newer",
    );
    check(
      (await field(b, copy.model).inputValue()) === "racing stale payload",
      "atomic_race_retains_draft",
    );
    pass(language + "_real_database_conditional_patch_rejects_intercepted_concurrent_write");
    advance(language + "_deleted_record");
    await reopen(a, copy);
    await reopen(b, copy);
    await field(a, copy.model).fill("deleted record draft");
    b.once("dialog", (d) => d.accept());
    await button(b, copy.remove).click();
    await b.getByText(language === "en" ? "Gear deleted" : "装备已删除", { exact: true }).waitFor();
    await button(a, copy.save).click();
    await conflict(a, copy).waitFor();
    check((await rows(id)).length === 0, "deleted_row_not_recreated");
    check(
      (await field(a, copy.model).inputValue()) === "deleted record draft",
      "deleted_draft_retained",
    );
    pass(language + "_deleted_record_not_resurrected_unsaved_input_remains_copyable");
    check(!unsafe, "blocked_request_boundary_violation");
    check(A.stats.errors === 0 && B.stats.errors === 0, "unexpected_browser_script_error");
  } finally {
    reportContext(language + "_A", A.stats);
    reportContext(language + "_B", B.stats);
    await A.context.close();
    await B.context.close();
  }
  const retryId = await seed(),
    C = await context(language, retryId);
  try {
    const page = await C.context.newPage();
    page.setDefaultTimeout(25000);
    await login(page, language);
    advance(language + "_lost_reply_and_double_submit");
    C.stats.mode = "lost";
    await field(page, copy.notes).fill("committed with lost reply");
    await page.evaluate((name) => {
      const b = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === name);
      b.click();
      b.click();
    }, copy.save);
    const saved = await waitRow(retryId, (r) => r.notes === "committed with lost reply");
    await page.waitForFunction(() => document.querySelector("fieldset")?.disabled === false);
    check(C.stats.patches === 1, "immediate_double_click_single_patch");
    check(
      (await field(page, copy.notes).inputValue()) === "committed with lost reply",
      "lost_reply_draft_retained",
    );
    await save(page, copy);
    check(
      (await row(retryId)).updated_at === saved.updated_at,
      "identical_retry_no_second_database_update",
    );
    check(C.stats.patches === 2, "one_explicit_retry");
    await field(page, copy.model).fill("after acknowledged retry");
    await save(page, copy);
    check(
      (await row(retryId)).model === "after acknowledged retry",
      "acknowledged_revision_adopted",
    );
    check(!unsafe, "blocked_retry_request_boundary_violation");
    check(C.stats.errors === 0, "unexpected_retry_browser_script_error");
    pass(
      language +
        "_double_submit_one_patch_lost_reply_explicit_retry_confirms_without_rewrite_next_edit_passes",
    );
  } finally {
    reportContext(language + "_retry", C.stats);
    await C.context.close();
  }
  await req("/rest/v1/gear_items?id=eq." + retryId + "&user_id=eq." + fixtureId, {
    method: "DELETE",
  });
}
try {
  check(process.env.GITHUB_ACTIONS === "true" && !!admin, "github_cloud_recovery_only");
  anon = (await readFile(new URL("./recovery-browser.mjs", import.meta.url), "utf8")).match(
    /const anon = '([^']+)'/,
  )[1];
  alarm = setTimeout(() => {
    timedOut = true;
    mainAbort.abort();
    void browser?.close().catch(() => {});
  }, 360000);
  advance("fixed_site_preflight");
  await gearRecoveryPreflight(fetch, mainAbort.signal);
  pass("fixed_recovery_bundle_verified_before_creating_fixtures");
  advance("temporary_owner");
  user = { id: fixtureId };
  const created = await req("/auth/v1/admin/users", {
    method: "POST",
    body: {
      id: fixtureId,
      email,
      password,
      email_confirm: true,
      user_metadata: { recovery_gear_audit: marker },
    },
  });
  check(created.id === fixtureId, "temporary_owner_id");
  const profile = await req("/rest/v1/profiles?id=eq." + fixtureId + "&select=id");
  check(profile.length === 1, "temporary_profile_created");
  const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || "playwright");
  browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
  for (const language of ["zh-CN", "en"]) await suite(language);
} catch (error) {
  failed = true;
  console.log("DIAGNOSTIC: " + JSON.stringify(gearBrowserDiagnostic(error)));
  console.log(
    "INCOMPLETE: stage=" +
      stage +
      "; check=" +
      (error.auditCode || "browser_operation") +
      "; type=" +
      error.constructor.name +
      "; details_suppressed",
  );
} finally {
  clearTimeout(alarm);
  mainAbort.abort();
  try {
    await browser?.close();
  } catch {
    failed = true;
    console.log("INCOMPLETE: browser_cleanup");
  }
  let cleaned = !user;
  if (user)
    try {
      // Known generated id + private marker: never delete an unverified user.
      const found = await http("/auth/v1/admin/users/" + fixtureId, { cleanup: true });
      if (found.status !== 404) {
        check(
          found.ok &&
            found.data.id === fixtureId &&
            found.data.email === email &&
            found.data.user_metadata?.recovery_gear_audit === marker,
          "exact_temporary_owner_cleanup_guard",
        );
        for (const token of sessions) {
          const out = await http("/auth/v1/logout?scope=global", {
            method: "POST",
            token,
            cleanup: true,
          });
          check(out.ok || [401, 403, 404].includes(out.status), "temporary_session_revocation");
        }
        for (const id of ids)
          await req("/rest/v1/gear_items?id=eq." + id + "&user_id=eq." + fixtureId, {
            method: "DELETE",
            cleanup: true,
          });
        await req("/auth/v1/admin/users/" + fixtureId, { method: "DELETE", cleanup: true });
      }
      const absent = await http("/auth/v1/admin/users/" + fixtureId, { cleanup: true });
      const profiles = await req("/rest/v1/profiles?id=eq." + fixtureId + "&select=id", {
        cleanup: true,
      });
      const gear = await req("/rest/v1/gear_items?user_id=eq." + fixtureId + "&select=id", {
        cleanup: true,
      });
      check(
        absent.status === 404 && profiles.length === 0 && gear.length === 0,
        "temporary_account_profile_gear_absence",
      );
      cleaned = true;
      pass("exact_temporary_user_profile_gear_absence_verified_browser_closed");
    } catch {
      failed = true;
      console.log("INCOMPLETE: exact_temporary_fixture_cleanup; fixture_id=" + fixtureId);
    }
  if (!user) pass("no_temporary_account_created");
  console.log(
    "AUDIT: complete=" +
      (!failed && !unsafe && !timedOut && cleaned) +
      "; recovery_only; synthetic_text; no_mail_media_existing_user_edits_or_local_exports",
  );
  if (failed || unsafe || timedOut || !cleaned) process.exitCode = 1;
}
