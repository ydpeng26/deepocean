// Recovery-only audit. Generated accounts/media only; no exports, mail or human data.
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || "playwright");
const api = "https://esovqvampbrhuhamkfcs.supabase.co",
  site = "https://supdiver-recovery-test.vercel.app";
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
const anon = (await readFile(new URL("./recovery-browser.mjs", import.meta.url), "utf8")).match(
  /const anon = '([^']+)'/,
)[1];
const users = [],
  findings = [];
const fixed = process.env.MARINE_HELP_EXPECT_FIXED === "true";
let browser,
  stage = "guard",
  failed = false,
  productionTraffic = false;
const check = (ok, message) => {
  if (!ok) throw Error(message);
};
const pass = (message) => console.log("PASS: " + message);
const finding = (message) => {
  findings.push(message);
  console.log("FINDING: " + message);
  if (fixed) throw Error(message);
};
async function request(path, { method = "GET", body, token = admin, binary = false } = {}) {
  check(path.startsWith("/") && !path.startsWith("//"), "Relative recovery path");
  const response = await fetch(api + path, {
    method,
    headers: {
      apikey: token === admin ? admin : anon,
      Authorization: "Bearer " + token,
      "Content-Type": binary ? "image/png" : "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : binary ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}
async function req(path, options) {
  const result = await request(path, options);
  check(result.ok, "Recovery HTTP " + result.status);
  return result.data;
}
async function poll(fn, predicate) {
  for (let i = 0; i < 80; i++) {
    const result = await fn();
    if (predicate(result)) return result;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error("Fixture did not settle");
}
async function photoHash(bucket, path) {
  const response = await fetch(
    api + "/storage/v1/object/authenticated/" + bucket + "/" + path + "?audit=" + randomUUID(),
    {
      headers: { apikey: admin, Authorization: "Bearer " + admin },
      signal: AbortSignal.timeout(45000),
    },
  );
  check(response.ok, "Generated media read");
  return createHash("sha256")
    .update(Buffer.from(await response.arrayBuffer()))
    .digest("hex");
}
try {
  check(process.env.GITHUB_ACTIONS === "true" && admin, "Cloud recovery guard");
  const marker = "HELP-" + randomBytes(6).toString("hex");
  for (let i = 0; i < 2; i++) {
    const email = "marine-help-" + randomBytes(12).toString("hex") + "@example.invalid",
      password = randomBytes(32).toString("base64url");
    const user = await req("/auth/v1/admin/users", {
      method: "POST",
      body: { email, password, email_confirm: true },
    });
    users.push(user);
    const session = await req("/auth/v1/token?grant_type=password", {
      method: "POST",
      token: anon,
      body: { email, password },
    });
    Object.assign(user, { email, password, token: session.access_token });
    await req("/rest/v1/profiles?id=eq." + user.id, {
      method: "PATCH",
      body: { display_name: marker + "-" + i },
    });
  }
  const [a, b] = users;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9S8AAAAASUVORK5CYII=",
    "base64",
  );
  browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
  async function signedIn(user) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: "zh-CN",
    });
    await context.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (
        (u.hostname.endsWith(".supabase.co") && u.origin !== api) ||
        ["supdiver.com", "www.supdiver.com"].includes(u.hostname)
      ) {
        productionTraffic = true;
        return route.abort();
      }
      return route.continue();
    });
    await context.addInitScript(() => localStorage.setItem("deepocean-language", "zh-CN"));
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(site + "/auth", { waitUntil: "networkidle", timeout: 90000 });
    await page.getByLabel("邮箱", { exact: true }).fill(user.email);
    await page.getByLabel("密码", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForURL((u) => u.pathname !== "/auth", { timeout: 60000 });
    return { context, page };
  }
  const owner = await signedIn(a),
    viewer = await signedIn(b);
  const A = owner.page,
    B = viewer.page;
  const dialog = (page) => page.getByRole("dialog");
  const cards = (page) => page.locator(".do-marine-card");
  const encounters = () => req("/rest/v1/marine_encounters?user_id=eq." + a.id + "&select=*");
  stage = "owner publishes help";
  await A.goto(site + "/marine", { waitUntil: "networkidle" });
  await A.getByRole("button", { name: "记录一次相遇", exact: true }).click();
  await dialog(A)
    .getByLabel("相遇地点", { exact: true })
    .fill(marker + "-LOCATION");
  await dialog(A).getByLabel("寻求其他潜水员帮助识别", { exact: true }).check();
  await dialog(A)
    .locator("input[type=file]")
    .setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: png });
  await dialog(A).getByRole("button", { name: "保存相遇", exact: true }).click();
  await dialog(A).waitFor({ state: "hidden" });
  const [main] = await poll(encounters, (rows) => rows.length === 1);
  check(main.needs_help && main.species_name === "待识别", "Unnamed help default");
  const privatePath = a.id + "/private-" + randomUUID() + ".png";
  await req("/storage/v1/object/marine-photos/" + privatePath, {
    method: "POST",
    token: a.token,
    binary: true,
    body: png,
  });
  const [privateRow, otherHelp] = await req("/rest/v1/marine_encounters", {
    method: "POST",
    token: a.token,
    body: [
      {
        user_id: a.id,
        species_name: marker + "-PRIVATE",
        encountered_on: "2026-10-20",
        location: marker,
        photo_path: privatePath,
        needs_help: false,
      },
      {
        user_id: a.id,
        species_name: marker + "-OTHER",
        encountered_on: "2026-10-20",
        location: marker,
        photo_path: privatePath,
        needs_help: true,
      },
    ],
  });
  await B.goto(site + "/marine", { waitUntil: "networkidle" });
  check((await cards(B).count()) === 0, "Viewer own wall empty");
  await B.getByRole("button", { name: "帮助识别", exact: true }).click();
  await poll(
    () => cards(B).count(),
    (n) => n >= 2,
  );
  check(
    (await cards(B)
      .filter({ hasText: marker + "-PRIVATE" })
      .count()) === 0,
    "Private encounter hidden",
  );
  await cards(B)
    .filter({ hasText: marker + "-LOCATION" })
    .click();
  check(
    (await dialog(B)
      .getByRole("button", { name: "编辑名称与记录 / 关闭求助", exact: true })
      .count()) === 0 &&
      (await dialog(B).getByRole("button", { name: "转发至深蓝论坛", exact: true }).count()) === 0,
    "Viewer cannot edit/share owner record",
  );
  check(
    (
      await req("/rest/v1/marine_encounters?id=eq." + privateRow.id + "&select=id", {
        token: b.token,
      })
    ).length === 0,
    "Private row API hidden",
  );
  pass("owner_creates_unnamed_help_viewer_discovers_only_open_help_and_has_no_owner_controls");
  const suggestions = () =>
    req("/rest/v1/marine_suggestions?encounter_id=eq." + main.id + "&select=id,body,user_id");
  const textarea = () =>
    dialog(B).getByPlaceholder("你认为是什么生物？可以补充识别特征与依据。", { exact: true });
  const send = () => dialog(B).getByRole("button", { name: "发送建议", exact: true });
  stage = "normal suggestion";
  await textarea().fill(marker + "-NORMAL");
  await send().click();
  await poll(suggestions, (rows) => rows.some((r) => r.body === marker + "-NORMAL"));
  await poll(
    () => textarea().inputValue(),
    (v) => v === "",
  );
  await A.reload({ waitUntil: "networkidle" });
  await cards(A)
    .filter({ hasText: marker + "-LOCATION" })
    .click();
  await dialog(A)
    .getByText(marker + "-NORMAL", { exact: true })
    .waitFor();
  pass("viewer_suggestion_persists_and_owner_reads_it_in_real_browser");
  await dialog(A).getByRole("button", { name: "关闭", exact: true }).click();
  let mode = "pass",
    writes = 0;
  await viewer.context.route(api + "/rest/v1/marine_suggestions*", async (route) => {
    if (route.request().method() === "POST") {
      writes++;
      await new Promise((r) => setTimeout(r, 1000));
      if (mode === "reject")
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"message":"Synthetic rejected suggestion"}',
        });
      if (mode === "lost") {
        const response = await route.fetch();
        check(response.ok(), "Synthetic suggestion committed");
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"message":"Synthetic lost suggestion reply"}',
        });
      }
    }
    return route.continue();
  });
  stage = "suggestion rejected retry";
  mode = "reject";
  await textarea().fill(marker + "-REJECT");
  const beforeReject = (await suggestions()).length;
  await send().click();
  await poll(
    () => send().count(),
    (n) => n === 1,
  );
  check(
    (await textarea().inputValue()) === marker + "-REJECT" &&
      (await suggestions()).length === beforeReject,
    "Rejected suggestion keeps draft",
  );
  mode = "pass";
  await send().click();
  await poll(
    () => textarea().inputValue(),
    (v) => v === "",
  );
  pass("rejected_suggestion_retains_draft_and_retry_saves");
  stage = "suggestion duplicate submit";
  const beforeDouble = (await suggestions()).length;
  await textarea().fill(marker + "-DOUBLE");
  await textarea().evaluate((input) => {
    input.form.requestSubmit();
    input.form.requestSubmit();
  });
  await poll(suggestions, (rows) => rows.length >= beforeDouble + 1);
  await poll(
    () => send().count(),
    (n) => n === 1,
  );
  await B.waitForTimeout(500);
  if ((await suggestions()).length > beforeDouble + 1)
    finding("synchronous_suggestion_submits_create_duplicate_rows");
  else pass("double_suggestion_submit_has_one_row");
  stage = "suggestion lost response";
  mode = "lost";
  const beforeLost = (await suggestions()).length;
  await textarea().fill(marker + "-LOST");
  await send().click();
  await poll(suggestions, (rows) => rows.length === beforeLost + 1);
  await poll(
    () => send().count(),
    (n) => n === 1,
  );
  mode = "pass";
  await send().click();
  await poll(
    () => textarea().inputValue(),
    (v) => v === "",
  );
  if ((await suggestions()).length > beforeLost + 1)
    finding("committed_suggestion_lost_reply_retry_creates_duplicate");
  else pass("suggestion_lost_reply_retry_has_one_row");
  stage = "pending suggestion text";
  await textarea().fill(marker + "-PENDING");
  await send().click();
  if (await textarea().isEnabled()) {
    await textarea().fill(marker + "-NEW-DRAFT");
    await poll(
      () => send().count(),
      (n) => n === 1,
    );
    if ((await textarea().inputValue()) === "")
      finding("pending_suggestion_text_is_editable_and_new_text_is_cleared_by_prior_success");
  } else {
    await poll(
      () => send().count(),
      (n) => n === 1,
    );
    pass("suggestion_text_locked_while_pending");
  }
  await dialog(B).getByRole("button", { name: "关闭", exact: true }).click();
  stage = "share failed then image replacement";
  await cards(A)
    .filter({ hasText: marker + "-LOCATION" })
    .click();
  let shareMode = "reject";
  if (fixed) {
    const rpc = "/rest/v1/rpc/share_marine_encounter_snapshot";
    check(
      !(
        await request(rpc, {
          method: "POST",
          token: anon,
          body: { target_id: main.id, expected_photo_path: main.photo_path },
        })
      ).ok,
      "Anonymous snapshot RPC denied",
    );
    check(
      !(
        await request(rpc, {
          method: "POST",
          token: b.token,
          body: { target_id: main.id, expected_photo_path: main.photo_path },
        })
      ).ok,
      "Outsider snapshot RPC denied",
    );
    check(
      !(
        await request(rpc, {
          method: "POST",
          token: a.token,
          body: { target_id: main.id, expected_photo_path: privatePath },
        })
      ).ok,
      "Wrong source snapshot denied",
    );
    check(
      !(
        await request(rpc, {
          method: "POST",
          token: a.token,
          body: { target_id: main.id, expected_photo_path: main.photo_path },
        })
      ).ok,
      "Unprepared version copy denied",
    );
    check(
      !(
        await request("/rest/v1/rpc/share_marine_encounter", {
          method: "POST",
          token: a.token,
          body: { target_id: main.id },
        })
      ).ok,
      "Legacy fixed-path creation must require refresh",
    );
    const version = createHash("sha256").update(privatePath).digest("hex");
    const preparedPath = a.id + "/encounter-" + otherHelp.id + "-" + version + ".jpg";
    await req("/storage/v1/object/forum-media/" + preparedPath, {
      method: "POST",
      token: a.token,
      binary: true,
      body: png,
    });
    await req("/rest/v1/marine_encounters?id=eq." + otherHelp.id, {
      method: "PATCH",
      token: a.token,
      body: { photo_path: main.photo_path },
    });
    check(
      !(
        await request(rpc, {
          method: "POST",
          token: a.token,
          body: { target_id: otherHelp.id, expected_photo_path: privatePath },
        })
      ).ok,
      "Photo changed after copy preparation must reject stale snapshot",
    );
    check(
      (await req("/rest/v1/forum_posts?source_encounter_id=eq." + otherHelp.id + "&select=id"))
        .length === 0,
      "Stale snapshot must not create a post",
    );
    await req("/rest/v1/marine_encounters?id=eq." + otherHelp.id, {
      method: "PATCH",
      token: a.token,
      body: { photo_path: privatePath },
    });
    pass("snapshot_rpc_anonymous_outsider_missing_copy_stale_source_and_legacy_creation_guards");
  }
  await owner.context.route(api + "/rest/v1/rpc/share_marine_encounter*", (route) =>
    shareMode === "reject"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"message":"Synthetic share failure"}',
        })
      : route.continue(),
  );
  await dialog(A).getByRole("button", { name: "转发至深蓝论坛", exact: true }).click();
  await poll(
    () => dialog(A).getByRole("button", { name: "转发至深蓝论坛", exact: true }).isEnabled(),
    Boolean,
  );
  check(
    (await req("/rest/v1/forum_posts?user_id=eq." + a.id + "&select=id")).length === 0,
    "Rejected share has no post",
  );
  const oldHash = await photoHash("marine-photos", main.photo_path);
  await dialog(A).getByRole("button", { name: "编辑名称与记录 / 关闭求助", exact: true }).click();
  const replacement = await A.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ee7733";
    ctx.fillRect(0, 0, 2, 2);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await dialog(A)
    .getByLabel("生物名称", { exact: true })
    .fill(marker + "-IDENTIFIED");
  await dialog(A)
    .locator("input[type=file]")
    .setInputFiles({
      name: "replacement.png",
      mimeType: "image/png",
      buffer: Buffer.from(replacement, "base64"),
    });
  await dialog(A).getByRole("button", { name: "保存相遇", exact: true }).click();
  await dialog(A).waitFor({ state: "hidden" });
  const updated = (await encounters()).find((row) => row.id === main.id);
  check(updated.photo_path !== main.photo_path, "Photo replacement persisted");
  await cards(A)
    .filter({ hasText: marker + "-IDENTIFIED" })
    .click();
  shareMode = "pass";
  await dialog(A).getByRole("button", { name: "转发至深蓝论坛", exact: true }).click();
  await dialog(A).getByRole("link", { name: "查看论坛帖子 →", exact: true }).waitFor();
  const [shared] = await req(
    "/rest/v1/forum_posts?source_encounter_id=eq." + main.id + "&select=*",
  );
  check(
    shared.topic === "encyclopedia" && shared.body.includes(marker + "-IDENTIFIED"),
    "Shared current species metadata",
  );
  const copiedHash = await photoHash("forum-media", shared.image_path),
    currentHash = await photoHash("marine-photos", updated.photo_path);
  if (copiedHash !== currentHash && copiedHash === oldHash)
    finding(
      "failed_share_upload_is_reused_after_photo_replacement_so_forum_has_old_photo_with_new_metadata",
    );
  else check(copiedHash === currentHash, "Shared photo must match source");
  if (fixed)
    pass("failed_share_then_photo_replacement_uses_current_photo_bytes_and_current_metadata");
  await dialog(A).getByRole("button", { name: "转发至深蓝论坛", exact: true }).click();
  await poll(
    () => dialog(A).getByRole("button", { name: "转发至深蓝论坛", exact: true }).isEnabled(),
    Boolean,
  );
  check(
    (await req("/rest/v1/forum_posts?source_encounter_id=eq." + main.id + "&select=id")).length ===
      1,
    "Repeat share duplicated",
  );
  const forged = await request("/rest/v1/rpc/share_marine_encounter", {
    method: "POST",
    token: b.token,
    body: { target_id: main.id },
  });
  check(!forged.ok, "Viewer shares owner encounter");
  pass("forum_share_metadata_topic_repeat_idempotency_and_owner_only_rpc");
  stage = "author identifies and closes help";
  await dialog(A).getByRole("button", { name: "编辑名称与记录 / 关闭求助", exact: true }).click();
  await dialog(A).getByLabel("寻求其他潜水员帮助识别", { exact: true }).uncheck();
  await dialog(A).getByRole("button", { name: "保存相遇", exact: true }).click();
  await dialog(A).waitFor({ state: "hidden" });
  check(!(await encounters()).find((r) => r.id === main.id).needs_help, "Owner closes help");
  await B.reload({ waitUntil: "networkidle" });
  await B.getByRole("button", { name: "帮助识别", exact: true }).click();
  await cards(B)
    .filter({ hasText: marker + "-OTHER" })
    .waitFor();
  check(
    (await cards(B)
      .filter({ hasText: marker + "-IDENTIFIED" })
      .count()) === 0,
    "Closed help hidden from viewer",
  );
  check(
    (
      await req("/rest/v1/marine_suggestions?encounter_id=eq." + main.id + "&select=id", {
        token: b.token,
      })
    ).length === 0,
    "Closed suggestions hidden",
  );
  const closedWrite = await request("/rest/v1/marine_suggestions", {
    method: "POST",
    token: b.token,
    body: { encounter_id: main.id, user_id: b.id, body: "SYNTHETIC CLOSED" },
  });
  check(!closedWrite.ok, "Closed help must reject suggestions");
  check(
    (await req("/rest/v1/forum_posts?id=eq." + shared.id + "&select=id", { token: b.token }))
      .length === 1,
    "Forum share independently retained",
  );
  await B.goto(site + "/forum", { waitUntil: "networkidle" });
  await B.locator("#post-" + shared.id).waitFor();
  pass(
    "owner_manual_identification_close_hides_help_and_suggestions_rejects_new_reply_but_keeps_forum_copy",
  );
  stage = "deleting original preserves shared forum post";
  await cards(A)
    .filter({ hasText: marker + "-IDENTIFIED" })
    .click();
  await dialog(A).getByRole("button", { name: "删除记录", exact: true }).click();
  await dialog(A).waitFor({ state: "hidden" });
  check(
    (await req("/rest/v1/marine_suggestions?encounter_id=eq." + main.id + "&select=id")).length ===
      0,
    "Original suggestions cascade",
  );
  const [retained] = await req(
    "/rest/v1/forum_posts?id=eq." + shared.id + "&select=id,source_encounter_id",
    { token: b.token },
  );
  check(
    retained?.id === shared.id && retained.source_encounter_id === null,
    "Independent post remains with detached source",
  );
  check(
    (
      await request("/storage/v1/object/sign/forum-media/" + shared.image_path, {
        method: "POST",
        token: b.token,
        body: { expiresIn: 60 },
      })
    ).ok,
    "Independent forum photo remains available",
  );
  await B.reload({ waitUntil: "networkidle" });
  await B.locator("#post-" + shared.id).waitFor();
  pass("delete_original_cascades_suggestions_but_keeps_independent_forum_post_and_photo");
  check(!productionTraffic, "Production traffic prohibited");
} catch (error) {
  failed = true;
  console.error(
    "INCOMPLETE: marine help stage=" +
      stage +
      " type=" +
      error.constructor.name +
      " reason=" +
      error.message.slice(0, 150),
  );
} finally {
  await browser?.close();
  for (const user of users)
    try {
      await req("/auth/v1/admin/users/" + user.id, { method: "DELETE" });
      check(
        (await request("/auth/v1/admin/users/" + user.id)).status === 404,
        "Fixture account remains",
      );
      for (const [table, column] of [
        ["marine_encounters", "user_id"],
        ["marine_suggestions", "user_id"],
        ["forum_posts", "user_id"],
      ])
        check(
          (await req("/rest/v1/" + table + "?" + column + "=eq." + user.id + "&select=id"))
            .length === 0,
          "Fixture rows remain",
        );
      for (const bucket of ["marine-photos", "forum-media"]) {
        const prefix = user.id + "/";
        const objects = await req("/storage/v1/object/list/" + bucket, {
          method: "POST",
          body: { prefix, limit: 1000 },
        });
        const paths = objects.filter((object) => object.id).map((object) => prefix + object.name);
        check(
          paths.every((path) => path.startsWith(prefix) && !path.includes("..")),
          "Exact generated prefix",
        );
        if (paths.length)
          await req("/storage/v1/object/" + bucket, {
            method: "DELETE",
            body: { prefixes: paths },
          });
        check(
          (
            await req("/storage/v1/object/list/" + bucket, {
              method: "POST",
              body: { prefix, limit: 1000 },
            })
          ).filter((object) => object.id).length === 0,
          "Fixture media remains",
        );
      }
      pass(
        "disposable_account_encounters_suggestions_forum_posts_and_generated_photos_cleanup_verified",
      );
    } catch (error) {
      failed = true;
      console.error(
        "INCOMPLETE: marine help cleanup account=" + user.id + " type=" + error.constructor.name,
      );
    }
}
console.log("AUDIT: complete=" + !failed + " findings=" + findings.length);
if (failed || (fixed && findings.length)) process.exitCode = 1;
