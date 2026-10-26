// GitHub-only acceptance: exact recovery origin, one generated owner, no real data.
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gearFixtureToken } from "./lib/gear-fixture-session.mjs";
import { initializeGearLanguage, isGearFontStylesheet } from "./lib/gear-browser-setup.mjs";
import { nativeErrorDiagnostic } from "./lib/native-error-diagnostic.mjs";
import { gearBrowserDiagnostic } from "./lib/gear-browser-diagnostic.mjs";
export const recoveryOrigin = "https://esovqvampbrhuhamkfcs.supabase.co";
export const recoverySite = "https://supdiver-recovery-test.vercel.app";
export const readOwners = {
  profiles: "id",
  dives: "user_id",
  gear_items: "user_id",
  diver_certificates: "user_id",
  marine_encounters: "user_id",
  forum_posts: "user_id",
  forum_comments: "user_id",
  forum_likes: "user_id",
  forum_bookmarks: "user_id",
  forum_follows: "follower_id",
  forum_blocks: "blocker_id",
};
// Every browser list read is narrowed before forwarding, including public forum rows.
export function fixtureReadUrl(raw, owner) {
  const u = new URL(raw);
  if (u.origin !== recoveryOrigin) throw Error("read_origin");
  const table = u.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
  if (!Object.hasOwn(readOwners, table)) throw Error("read_table");
  const key = readOwners[table];
  const existing = u.searchParams.get(key);
  if (existing && existing !== "eq." + owner) throw Error("read_other_owner");
  u.searchParams.set(key, "eq." + owner);
  return u.href;
}
export function validateFixtureWrite(raw, method, payload, owner, known) {
  const u = new URL(raw),
    table = u.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
  if (u.origin !== recoveryOrigin || !["PATCH", "DELETE"].includes(method)) return false;
  if (
    ![
      "profiles",
      "gear_items",
      "diver_certificates",
      "marine_encounters",
      "forum_posts",
      "forum_comments",
    ].includes(table)
  )
    return false;
  const id = u.searchParams.get("id");
  if (table === "profiles") {
    if (method !== "PATCH" || id !== "eq." + owner) return false;
    if (!["display_name", "cert_level", "tank_count", "bio"].every((k) => u.searchParams.has(k)))
      return false;
    if (
      !payload ||
      Object.keys(payload).some(
        (k) => !["display_name", "cert_level", "tank_count", "bio"].includes(k),
      )
    )
      return false;
  } else {
    if (
      !known[table]?.has(id?.slice(3)) ||
      !id?.startsWith("eq.") ||
      u.searchParams.get("user_id") !== "eq." + owner
    )
      return false;
    if (table === "marine_encounters") {
      if (
        ![
          "species_name",
          "encountered_on",
          "location",
          "needs_help",
          "photo_path",
          "created_at",
        ].every((k) => u.searchParams.has(k))
      )
        return false;
    } else if (!u.searchParams.has("updated_at")) return false;
    if (
      payload &&
      ((payload.user_id && payload.user_id !== owner) || (payload.id && payload.id !== id.slice(3)))
    )
      return false;
  }
  return true;
}

export async function runMemberSafety() {
  let admin;
  let anon,
    browser,
    created = false,
    complete = false,
    cleanupOK = false,
    stage = "guard",
    alarm,
    timedOut = false;
  const owner = randomUUID(),
    marker = "MEMBER-SAFETY-" + randomBytes(8).toString("hex");
  const email = "member-safety-" + randomBytes(16).toString("hex") + "@example.invalid";
  const password = randomBytes(32).toString("base64url"),
    imageName = randomUUID() + ".png";
  const imagePath = owner + "/" + imageName;
  const known = Object.fromEntries(
    ["gear_items", "diver_certificates", "marine_encounters", "forum_posts", "forum_comments"].map(
      (t) => [t, new Set()],
    ),
  );
  const sessions = new Set(),
    contexts = [],
    mainAbort = new AbortController();
  const check = (ok, code) => {
    if (!ok) {
      const e = Error(code);
      e.auditCode = code;
      throw e;
    }
  };
  const advance = (text) => {
    stage = text;
    console.log("STAGE: " + text);
  };
  const pass = (text) => console.log("PASS: " + text);
  async function http(path, { method = "GET", body, token, raw, cleanup = false } = {}) {
    check(path.startsWith("/") && !path.startsWith("//"), "fixed_path");
    const key = token ? anon : admin;
    const response = await fetch(recoveryOrigin + path, {
      method,
      redirect: "error",
      signal: cleanup
        ? AbortSignal.timeout(15000)
        : AbortSignal.any([mainAbort.signal, AbortSignal.timeout(20000)]),
      headers: {
        apikey: key,
        Authorization: "Bearer " + (token || key),
        "Content-Type": raw ? "image/png" : "application/json",
        Prefer: "return=representation",
      },
      body: raw || (body === undefined ? undefined : JSON.stringify(body)),
    });
    let data = null;
    try {
      data = await response.json();
    } catch {}
    return { ok: response.ok, status: response.status, data };
  }
  async function req(path, options) {
    const result = await http(path, options);
    check(result.ok, "recovery_http_" + result.status);
    return result.data;
  }
  const scope = (table, id) =>
    "/rest/v1/" +
    table +
    "?id=eq." +
    id +
    (table === "profiles" ? "" : "&" + readOwners[table] + "=eq." + owner);
  const readRows = (table, id, cleanup = false) =>
    req(
      (id ? scope(table, id) : "/rest/v1/" + table + "?" + readOwners[table] + "=eq." + owner) +
        "&select=*",
      { cleanup },
    );
  async function row(table, id) {
    const values = await readRows(table, id);
    check(values.length === 1, "fixture_row_present");
    return values[0];
  }
  async function seed(table, values) {
    const id = randomUUID();
    known[table].add(id);
    await req("/rest/v1/" + table, { method: "POST", body: { id, user_id: owner, ...values } });
    return id;
  }
  const btn = (p, name) => p.getByRole("button", { name, exact: true });
  const waitValue = (locator, value) =>
    locator.evaluate((el, expected) => el.value === expected, value);
  async function expectValue(locator, expected) {
    await locator.waitFor();
    for (let i = 0; i < 40; i++) {
      if (await waitValue(locator, expected)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    check(false, "fixture_field_value");
  }
  async function mutate(page, table, action) {
    const response = page.waitForResponse(
      (r) =>
        r.url().startsWith(recoveryOrigin + "/rest/v1/" + table + "?") &&
        ["PATCH", "DELETE"].includes(r.request().method()),
    );
    await action();
    const result = await response;
    check(result.ok(), "browser_mutation_http");
  }
  async function open(page, path) {
    await page.goto(recoverySite + path, { waitUntil: "domcontentloaded" });
  }
  async function login(page, language) {
    advance(language + "_login");
    await open(page, "/auth?next=%2Fgear");
    await page.getByLabel(language === "en" ? "Email" : "邮箱", { exact: true }).fill(email);
    await page.getByLabel(language === "en" ? "Password" : "密码", { exact: true }).fill(password);
    const response = page.waitForResponse((r) =>
      r.url().startsWith(recoveryOrigin + "/auth/v1/token?grant_type=password"),
    );
    await btn(page, language === "en" ? "Sign in" : "登录").click();
    check((await response).ok(), "fixture_login");
    await page.waitForURL("**/gear");
    const token = await page.evaluate(gearFixtureToken, owner);
    check(!!token, "fixture_session_owner");
    sessions.add(token);
  }
  async function makeContext(language) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: language === "en" ? "en-US" : "zh-CN",
      serviceWorkers: "block",
    });
    const stats = {
      errors: 0,
      blocked: 0,
      fonts: 0,
      patches: 0,
      mode: null,
      errorKinds: [],
      blockedKinds: [],
    };
    const state = { context, stats };
    contexts.push(state);
    await context.addInitScript(initializeGearLanguage, language);
    context.on("page", (page) =>
      page.on("pageerror", (error) => {
        stats.errors++;
        if (stats.errorKinds.length < 6)
          stats.errorKinds.push({ phase: stage, ...nativeErrorDiagnostic(error) });
      }),
    );
    await context.route("**/*", async (route) => {
      const request = route.request(),
        u = new URL(request.url()),
        method = request.method();
      const block = async (reason) => {
        stats.blocked++;
        if (stats.blockedKinds.length < 6)
          stats.blockedKinds.push({
            phase: stage,
            method,
            reason: /^[a-z_]+$/.test(reason) ? reason : "boundary",
          });
        await route.abort().catch(() => {});
      };
      try {
        if (u.origin === recoverySite && ["GET", "HEAD"].includes(method)) return route.continue();
        if (isGearFontStylesheet(request.url(), method, request.resourceType())) {
          stats.fonts++;
          return route.fulfill({
            status: 200,
            contentType: "text/css",
            body: "/* external font omitted in isolated acceptance */",
          });
        }
        if (u.origin !== recoveryOrigin) return block("foreign_origin");
        if (["GET", "HEAD"].includes(method)) {
          if (u.pathname.startsWith("/rest/v1/")) {
            const response = await route.fetch({
              url: fixtureReadUrl(request.url(), owner),
              timeout: 20000,
            });
            return route.fulfill({ response });
          }
          if (["/auth/v1/user", "/auth/v1/settings"].includes(u.pathname)) return route.continue();
          if (u.pathname === "/storage/v1/object/sign/marine-photos/" + imagePath)
            return route.continue();
          return block("read_path");
        }
        if (method === "OPTIONS") return route.continue();
        if (u.pathname === "/auth/v1/token" && method === "POST") {
          if (u.searchParams.get("grant_type") === "password")
            check(request.postDataJSON().email === email, "fixture_login_only");
          return route.continue();
        }
        if (u.pathname === "/auth/v1/logout" && method === "POST") return route.continue();
        if (u.pathname === "/storage/v1/object/sign/marine-photos" && method === "POST") {
          const paths = request.postDataJSON()?.paths;
          check(
            Array.isArray(paths) && paths.every((p) => p === imagePath),
            "fixture_image_sign_only",
          );
          return route.continue();
        }
        const payload = method === "PATCH" ? request.postDataJSON() : null;
        check(
          validateFixtureWrite(request.url(), method, payload, owner, known),
          "fixture_conditional_write_only",
        );
        if (method === "PATCH") stats.patches++;
        const mode = stats.mode;
        stats.mode = null;
        if (mode === "lost") {
          const response = await route.fetch({ timeout: 20000 });
          check(response.ok(), "lost_reply_commit");
          return route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ code: "SYNTHETIC_LOST_REPLY", message: "Synthetic lost reply" }),
          });
        }
        return route.continue();
      } catch (error) {
        return block(error.auditCode || "request_boundary");
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(18000);
    page.setDefaultNavigationTimeout(45000);
    return { ...state, page };
  }
  async function profileSuite(A, B, en) {
    advance((en ? "en" : "zh") + "_profile_stale_edit");
    await req("/rest/v1/profiles?id=eq." + owner, {
      method: "PATCH",
      body: { display_name: marker, bio: "base", tank_count: 0 },
    });
    await open(A.page, "/profile");
    await open(B.page, "/profile");
    const bio = (p) => p.locator(".do-profile-fields textarea");
    await expectValue(bio(A.page), "base");
    await expectValue(bio(B.page), "base");
    await bio(B.page).fill("kept stale draft");
    await bio(A.page).fill("newer profile");
    const save = (p) => btn(p, en ? "Save profile" : "保存个人资料");
    const before = A.stats.patches;
    await mutate(A.page, "profiles", () =>
      save(A.page).evaluate((el) => {
        el.click();
        el.click();
      }),
    );
    await A.page.getByText(en ? "Changes saved" : "更改已保存", { exact: true }).waitFor();
    check(A.stats.patches === before + 1, "profile_double_submit_single_patch");
    await mutate(B.page, "profiles", () => save(B.page).click());
    await B.page
      .getByRole("alert")
      .filter({ hasText: en ? "Profile changed elsewhere" : "资料已在其他页面修改" })
      .waitFor();
    check(
      (await bio(B.page).inputValue()) === "kept stale draft" && (await save(B.page).isDisabled()),
      "profile_conflict_keeps_draft",
    );
    check((await row("profiles", owner)).bio === "newer profile", "profile_newer_server_value");
    const reload = btn(B.page, en ? "Reload profile" : "重新加载");
    B.page.once("dialog", (d) => d.dismiss());
    await reload.click();
    check((await bio(B.page).inputValue()) === "kept stale draft", "profile_reload_cancel");
    B.page.once("dialog", (d) => d.accept());
    await reload.click();
    await expectValue(bio(B.page), "newer profile");
    await bio(B.page).fill("fresh profile");
    await mutate(B.page, "profiles", () => save(B.page).click());
    check((await row("profiles", owner)).bio === "fresh profile", "profile_fresh_save");
    pass(
      (en ? "en" : "zh") +
        "_profile_two_context_conflict_copyable_draft_confirmed_reload_fresh_save_double_submit",
    );
  }
  async function certificateSuite(A, B, en) {
    advance((en ? "en" : "zh") + "_certificate_stale_edit");
    const id = await seed("diver_certificates", {
      agency: "PADI",
      level: marker,
      is_public: false,
    });
    const edit = async (p) => {
      await open(p, "/certificates");
      await btn(p, en ? "Edit certificate" : "编辑证书").click();
      await expectValue(p.getByLabel(en ? "Certification" : "证书等级", { exact: true }), marker);
    };
    await edit(A.page);
    await edit(B.page);
    const field = (p) =>
      p.getByLabel(en ? "Certificate number (private)" : "证书编号（仅本人可见）", { exact: true });
    await field(B.page).fill("kept-stale-number");
    await field(A.page).fill("newer-number");
    const save = (p) => btn(p, en ? "Save certificate" : "保存证书");
    await mutate(A.page, "diver_certificates", () => save(A.page).click());
    await save(A.page).waitFor({ state: "hidden" });
    await mutate(B.page, "diver_certificates", () => save(B.page).click());
    await B.page
      .getByRole("alert")
      .filter({ hasText: en ? "Certificate changed or was removed" : "证书已在其他页面修改或移除" })
      .waitFor();
    check(
      (await field(B.page).inputValue()) === "kept-stale-number" &&
        (await save(B.page).isDisabled()),
      "certificate_retained_draft",
    );
    check(
      (await row("diver_certificates", id)).certificate_number === "newer-number",
      "certificate_server_newer",
    );
    const latest = await row("diver_certificates", id);
    await req(scope("diver_certificates", id), { method: "DELETE" });
    // Existing draft must not become an insert after the row disappears.
    check(
      (await field(B.page).inputValue()) === "kept-stale-number",
      "certificate_deleted_draft_retained",
    );
    check(
      (await readRows("diver_certificates", id)).length === 0 && !!latest.updated_at,
      "certificate_revision_and_absence",
    );
    pass(
      (en ? "en" : "zh") +
        "_certificate_stale_edit_rejected_private_draft_retained_no_upsert_resurrection",
    );
    advance((en ? "en" : "zh") + "_invalid_image_keeps_certificate_draft");
    await open(A.page, "/certificates");
    await btn(A.page, en ? "Add certificate" : "新增证书").click();
    const level = A.page.getByLabel(en ? "Certification" : "证书等级", { exact: true });
    await level.fill("kept invalid-image draft");
    await A.page
      .locator("input[type=file]")
      .setInputFiles({
        name: "generated-invalid.png",
        mimeType: "image/png",
        buffer: Buffer.from([1, 2, 3]),
      });
    const before = A.stats.patches;
    await save(A.page).click();
    await A.page
      .getByText(
        en ? /Save failed\. Your edits and selected photo are kept/ : /保存失败，修改与照片仍保留/,
      )
      .waitFor();
    check(
      (await level.inputValue()) === "kept invalid-image draft" &&
        A.stats.patches === before &&
        (await readRows("diver_certificates", null)).length === 0,
      "invalid_image_no_row_kept_input",
    );
    pass(
      (en ? "en" : "zh") + "_undecodable_generated_image_rejected_no_upload_or_save_draft_retained",
    );
  }
  async function marineSuite(A, B, en) {
    advance((en ? "en" : "zh") + "_marine_stale_edit");
    const id = await seed("marine_encounters", {
      species_name: marker,
      encountered_on: "2026-10-01",
      location: "base",
      photo_path: imagePath,
      needs_help: false,
    });
    const edit = async (p) => {
      await open(p, "/marine");
      await p.locator(".do-marine-card").filter({ hasText: marker }).click();
      await btn(p, en ? "Edit encounter / turn off help" : "编辑名称与记录 / 关闭求助").click();
      await expectValue(p.getByLabel(en ? "Location" : "相遇地点", { exact: true }), "base");
    };
    await edit(A.page);
    await edit(B.page);
    const field = (p) => p.getByLabel(en ? "Location" : "相遇地点", { exact: true });
    await field(B.page).fill("kept-stale-location");
    await field(A.page).fill("newer-location");
    const save = (p) =>
      p
        .getByRole("dialog")
        .getByRole("button", { name: en ? "Save encounter" : "保存相遇", exact: true });
    await mutate(A.page, "marine_encounters", () => save(A.page).click());
    await A.page.getByRole("dialog").waitFor({ state: "hidden" });
    await mutate(B.page, "marine_encounters", () => save(B.page).click());
    await B.page
      .getByRole("alert")
      .filter({
        hasText: en ? "Encounter changed or was deleted" : "相遇记录已在其他页面修改或删除",
      })
      .waitFor();
    check(
      (await field(B.page).inputValue()) === "kept-stale-location" &&
        (await save(B.page).isDisabled()),
      "marine_draft_kept",
    );
    check(
      (await row("marine_encounters", id)).location === "newer-location",
      "marine_newer_server",
    );
    pass(
      (en ? "en" : "zh") + "_marine_two_context_conflict_retains_text_and_existing_generated_photo",
    );
    await req(scope("marine_encounters", id), { method: "DELETE" });
  }
  async function forumSuite(A, B, en) {
    advance((en ? "en" : "zh") + "_forum_stale_edit");
    const id = await seed("forum_posts", { title: marker, body: "base", topic: "stories" });
    const edit = async (p) => {
      await open(p, "/forum");
      const article = p.locator("article").filter({ hasText: marker });
      await article.locator(".do-forum-more-trigger").click();
      await p.getByRole("menuitem", { name: en ? "Edit post" : "编辑帖子", exact: true }).click();
      await expectValue(p.getByRole("dialog").locator("textarea"), "base");
    };
    await edit(A.page);
    await edit(B.page);
    const field = (p) => p.getByRole("dialog").locator("textarea");
    const save = (p) =>
      p
        .getByRole("dialog")
        .getByRole("button", { name: en ? "Save changes" : "保存修改", exact: true });
    await field(B.page).fill("kept stale forum draft");
    await field(A.page).fill("newer forum body");
    await mutate(A.page, "forum_posts", () => save(A.page).click());
    await A.page.getByRole("dialog").waitFor({ state: "hidden" });
    await mutate(B.page, "forum_posts", () => save(B.page).click());
    await B.page.getByRole("dialog").getByRole("alert").waitFor();
    check((await field(B.page).inputValue()) === "kept stale forum draft", "forum_draft_kept");
    check((await row("forum_posts", id)).body === "newer forum body", "forum_server_newer");
    // Lost response: fresh editor, real commit, synthetic transport failure, same retry.
    await open(A.page, "/forum");
    const article = A.page.locator("article").filter({ hasText: marker });
    await article.locator(".do-forum-more-trigger").click();
    await A.page
      .getByRole("menuitem", { name: en ? "Edit post" : "编辑帖子", exact: true })
      .click();
    await field(A.page).fill("committed reply lost");
    A.stats.mode = "lost";
    const lost = A.page.waitForResponse(
      (r) =>
        r.url().startsWith(recoveryOrigin + "/rest/v1/forum_posts?") &&
        r.request().method() === "PATCH",
    );
    await save(A.page).click();
    check((await lost).status() === 400, "lost_reply_delivered");
    await A.page.getByRole("dialog").getByRole("alert").waitFor();
    const committed = await row("forum_posts", id);
    check(committed.body === "committed reply lost", "lost_commit_readback");
    await save(A.page).click();
    await A.page.getByRole("dialog").waitFor({ state: "hidden" });
    check(
      (await row("forum_posts", id)).updated_at === committed.updated_at,
      "lost_retry_no_rewrite",
    );
    pass(
      (en ? "en" : "zh") +
        "_forum_stale_edit_retains_draft_lost_reply_retry_confirms_without_rewrite",
    );
    advance((en ? "en" : "zh") + "_comment_stale_edit_deleted_draft");
    const commentId = await seed("forum_comments", { post_id: id, body: "base comment" });
    for (const p of [A.page, B.page]) {
      await open(p, "/forum");
      await p.locator("article").filter({ hasText: marker }).locator(".do-forum-read").click();
      await btn(p, en ? "Edit response" : "编辑回应").click();
    }
    const editComment = (p) =>
      p.getByLabel(en ? "Edit response text" : "编辑回应内容", { exact: true });
    await editComment(B.page).fill("retained stale comment");
    await editComment(A.page).fill("newer comment");
    const saveComment = (p) => btn(p, en ? "Save response changes" : "保存回应修改");
    await mutate(A.page, "forum_comments", () => saveComment(A.page).click());
    await A.page.getByRole("dialog").getByText("newer comment", { exact: true }).waitFor();
    await mutate(B.page, "forum_comments", () => saveComment(B.page).click());
    await B.page.getByRole("dialog").getByRole("alert").waitFor();
    check(
      (await editComment(B.page).inputValue()) === "retained stale comment" &&
        (await row("forum_comments", commentId)).body === "newer comment",
      "comment_stale_kept",
    );
    await req(scope("forum_comments", commentId), { method: "DELETE" });
    await btn(B.page, en ? "Reload responses" : "重新加载回应").click();
    const retained = B.page.getByLabel(en ? "Retained response draft" : "保留的回应草稿", {
      exact: true,
    });
    await expectValue(retained, "retained stale comment");
    check((await retained.getAttribute("readonly")) !== null, "deleted_comment_copyable");
    pass(
      (en ? "en" : "zh") +
        "_comment_two_context_conflict_and_remote_deletion_retains_copyable_draft",
    );
    await req(scope("forum_posts", id), { method: "DELETE" });
  }
  async function labelsAndPrivacy(A, en) {
    advance((en ? "en" : "zh") + "_labels_pagehide");
    await open(A.page, "/gear");
    for (const name of en
      ? ["Category", "Brand", "Model", "Purchase date", "Next service date", "Dive count", "Notes"]
      : ["装备类型", "品牌", "型号", "购入日期", "下次保养日期", "累计使用次数", "备注"]) {
      const control = A.page.getByLabel(name, { exact: true });
      check((await control.count()) === 1, "unique_accessible_gear_control");
      await control.waitFor();
    }
    const hidden = await A.page.evaluate(() => {
      const root = document.querySelector("[data-private-member-root]");
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      return root?.hidden === true;
    });
    check(hidden, "pagehide_hides_synchronously");
    await A.page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
    );
    await A.page.locator("[data-private-member-root]").waitFor({ state: "visible" });
    pass(
      (en ? "en" : "zh") +
        "_seven_accessible_gear_labels_pagehide_synchronous_mask_return_revalidation_not_native_bfcache_certification",
    );
  }
  try {
    check(process.env.GITHUB_ACTIONS === "true", "github_cloud_only");
    admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
    check(!!admin, "recovery_credential_required");
    anon = (await readFile(new URL("./recovery-browser.mjs", import.meta.url), "utf8")).match(
      /const anon = '([^']+)'/,
    )[1];
    alarm = setTimeout(() => {
      timedOut = true;
      mainAbort.abort();
      void browser?.close().catch(() => {});
    }, 480000);
    advance("fixed_site_preflight");
    const manifestResponse = await fetch(recoverySite + "/offline-assets.json", {
      signal: AbortSignal.timeout(20000),
      redirect: "error",
      cache: "no-store",
    });
    check(manifestResponse.ok, "public_manifest");
    const manifest = await manifestResponse.json();
    check(Array.isArray(manifest), "manifest_array");
    const paths = manifest.filter(
      (p) => typeof p === "string" && /^\/assets\/[^/?#]+\.js$/.test(p),
    );
    check(paths.length > 0, "scripts_present");
    const scripts = await Promise.all(
      paths.map(async (p) => {
        const r = await fetch(recoverySite + p, {
          signal: AbortSignal.timeout(20000),
          redirect: "error",
        });
        check(r.ok, "public_script");
        return r.text();
      }),
    );
    for (const name of [
      "ProfileConflictError",
      "CertificateConflictError",
      "EncounterConflictError",
      "ForumConflictError",
      "data-private-member-root",
      "gear-notes",
    ])
      check(
        scripts.some((s) => s.includes(name)),
        "fixed_bundle_" + name,
      );
    const client = scripts[paths.findIndex((p) => p.startsWith("/assets/client-"))];
    check(
      client?.includes("esovqvampbrhuhamkfcs.supabase.co") &&
        !client.includes("zmhtlhpeulhhcvlnjdrb.supabase.co"),
      "recovery_backend_only",
    );
    pass("fixed_recovery_bundle_and_backend_verified_before_fixture_creation");
    advance("temporary_owner");
    created = true;
    const account = await req("/auth/v1/admin/users", {
      method: "POST",
      body: {
        id: owner,
        email,
        password,
        email_confirm: true,
        user_metadata: { recovery_member_safety: marker },
      },
    });
    check(account.id === owner, "exact_generated_owner");
    await req("/rest/v1/profiles?id=eq." + owner, {
      method: "PATCH",
      body: { display_name: marker },
    });
    await req("/storage/v1/object/marine-photos/" + imagePath, {
      method: "POST",
      raw: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgaDjxHwAEFAJIjGIHSwAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await seed("gear_items", { category: "mask", brand: marker, model: "base", dive_count: 0 });
    const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || "playwright");
    browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
    for (const language of ["zh-CN", "en"]) {
      const en = language === "en",
        A = await makeContext(language),
        B = await makeContext(language);
      await login(A.page, language);
      await login(B.page, language);
      await profileSuite(A, B, en);
      await certificateSuite(A, B, en);
      await marineSuite(A, B, en);
      await forumSuite(A, B, en);
      await labelsAndPrivacy(A, en);
      await A.context.close();
      await B.context.close();
    }
    check(
      contexts.every((c) => c.stats.errors === 0 && c.stats.blocked === 0),
      "browser_errors_or_boundary",
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
    mainAbort.abort();
    await browser?.close().catch(() => {
      complete = false;
    });
    for (const [index, { stats }] of contexts.entries())
      console.log(
        "DIAGNOSTIC: " +
          JSON.stringify({
            context: index,
            pageErrors: stats.errors,
            blockedRequests: stats.blocked,
            fontStubs: stats.fonts,
            errorKinds: stats.errorKinds,
            blockedKinds: stats.blockedKinds,
          }),
      );
    if (!created) {
      cleanupOK = true;
      pass("no_temporary_owner_created");
    } else
      try {
        const account = await http("/auth/v1/admin/users/" + owner, { cleanup: true });
        if (account.status !== 404) {
          check(
            account.ok &&
              account.data.id === owner &&
              account.data.email === email &&
              account.data.user_metadata?.recovery_member_safety === marker,
            "exact_cleanup_owner_guard",
          );
          for (const token of sessions) {
            const result = await http("/auth/v1/logout?scope=global", {
              method: "POST",
              token,
              cleanup: true,
            });
            check(result.ok || [401, 403, 404].includes(result.status), "session_revocation");
          }
          for (const table of [
            "forum_comments",
            "forum_posts",
            "marine_encounters",
            "diver_certificates",
            "gear_items",
          ])
            for (const id of known[table])
              await req(scope(table, id), { method: "DELETE", cleanup: true });
          await req("/storage/v1/object/marine-photos", {
            method: "DELETE",
            body: { prefixes: [imagePath] },
            cleanup: true,
          });
          const objects = await req("/storage/v1/object/list/marine-photos", {
            method: "POST",
            body: { prefix: owner + "/", limit: 10 },
            cleanup: true,
          });
          check(Array.isArray(objects) && objects.length === 0, "generated_image_absence");
          await req("/auth/v1/admin/users/" + owner, { method: "DELETE", cleanup: true });
        }
        check(
          (await http("/auth/v1/admin/users/" + owner, { cleanup: true })).status === 404,
          "auth_absence",
        );
        for (const table of ["profiles", ...Object.keys(known)])
          check((await readRows(table, null, true)).length === 0, "fixture_rows_absent");
        cleanupOK = true;
        pass(
          "exact_temporary_account_profile_all_rows_generated_image_absence_verified_sessions_revoked_browser_closed",
        );
      } catch {
        console.log("INCOMPLETE: fixture_cleanup; fixture_id=" + owner);
      }
    const ok =
      complete &&
      cleanupOK &&
      !timedOut &&
      contexts.every((c) => c.stats.errors === 0 && c.stats.blocked === 0);
    console.log(
      "AUDIT: complete=" +
        ok +
        "; recovery_only; synthetic_text_and_tiny_generated_png; no_mail_existing_user_reads_edits_or_local_exports; native_bfcache_camera_codec_coverage_not_claimed",
    );
    if (!ok) process.exitCode = 1;
  }
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1])
  await runMemberSafety();
