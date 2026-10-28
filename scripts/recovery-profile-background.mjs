// Recovery-only browser acceptance. No screenshots, traces, credentials or user content exported.
import { randomBytes } from "node:crypto";
import { readFile, appendFile } from "node:fs/promises";
const api = "https://esovqvampbrhuhamkfcs.supabase.co";
const site = "https://supdiver-recovery-test.vercel.app";
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
function check(value, name) { if (!value) throw Error(name); }
check(process.env.GITHUB_ACTIONS === "true" &&
  process.env.GITHUB_REPOSITORY === "ydpeng26/deepocean" &&
  process.env.GITHUB_REF === "refs/heads/codex/pc-layout-keyboard-audit" && admin, "cloud_guard");
const claims = JSON.parse(Buffer.from(admin.split(".")[1], "base64url"));
check(claims.ref === "esovqvampbrhuhamkfcs" && claims.role === "service_role", "recovery_key_guard");
const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE);
const source = await readFile(new URL("./recovery-browser.mjs", import.meta.url), "utf8");
const anon = source.match(/const anon = '([^']+)'/)[1];
let browser, page, user, cleaned = false, stage = "prepare", failBackground = false;
const paths = new Set(), checks = [];
const pass = name => { checks.push(name); console.log("PASS: " + name); };
async function req(path, method = "GET", body) {
  const response = await fetch(api + path, {
    method, signal: AbortSignal.timeout(30000),
    headers: { apikey: admin, Authorization: "Bearer " + admin,
      "Content-Type": "application/json", Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  check(response.ok, "fixture_api_" + response.status);
  const text = await response.text(); return text ? JSON.parse(text) : null;
}
async function profile() {
  return (await req("/rest/v1/profiles?id=eq." + user.id +
    "&select=id,display_name,bio,avatar_url,background_url"))[0];
}
async function poll(fn, predicate) {
  for (let n = 0; n < 80; n++) {
    const result = await fn(); if (predicate(result)) return result;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw Error("condition_timeout");
}
try {
  const suffix = randomBytes(10).toString("hex");
  const email = "background-" + suffix + "@example.invalid";
  const password = "Bg7!" + randomBytes(6).toString("hex").slice(0, 8);
  user = await req("/auth/v1/admin/users", "POST", {
    email, password, email_confirm: true,
    user_metadata: { acceptance_fixture: "homepage-background" },
  });
  await req("/rest/v1/profiles?id=eq." + user.id, "PATCH", {
    display_name: "Temporary background acceptance", bio: "Synthetic baseline",
  });
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, locale: "zh-CN", serviceWorkers: "block",
  });
  await context.addInitScript(() => localStorage.setItem("deepocean-language", "zh-CN"));
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (["supdiver.com", "www.supdiver.com"].includes(url.hostname) ||
      (url.hostname.endsWith(".supabase.co") && url.origin !== api)) return route.abort();
    if (url.origin === api && url.pathname.startsWith("/storage/v1/object/avatars/") &&
      request.method() === "POST") {
      const path = decodeURIComponent(url.pathname.slice("/storage/v1/object/avatars/".length));
      check(path.startsWith(user.id + "/"), "upload_owner_boundary");
      paths.add(path);
    }
    if (url.origin === api && url.pathname === "/rest/v1/profiles" && request.method() === "PATCH") {
      check(url.searchParams.get("id") === "eq." + user.id, "profile_owner_boundary");
      const payload = request.postDataJSON();
      if (payload.background_url && failBackground)
        return route.fulfill({ status: 503, contentType: "application/json",
          body: JSON.stringify({ message: "Synthetic background save failure" }) });
    }
    return route.continue();
  });
  page = await context.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(site + "/auth", { waitUntil: "networkidle", timeout: 90000 });
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL(url => url.pathname !== "/auth", { timeout: 60000 });
  await page.goto(site + "/profile", { waitUntil: "networkidle" });
  const name = page.getByLabel("显示名称", { exact: true });
  const bio = page.getByLabel(/^个人简介/);
  const background = page.getByLabel("更换个人主页背景图", { exact: true });
  await name.waitFor();
  await page.getByRole("button", { name: "更换个人主页背景图", exact: true }).waitFor();
  check(await background.count() === 1, "independent_background_input");
  const png = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 600;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 1200, 600);
    gradient.addColorStop(0, "#086fa4"); gradient.addColorStop(1, "#15244c");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 600);
    ctx.fillStyle = "#80e5ff"; ctx.font = "40px sans-serif";
    ctx.fillText("TEMPORARY BACKGROUND ACCEPTANCE", 60, 300);
    return canvas.toDataURL("image/png").split(",")[1];
  }), "base64");
  const image = { name: "synthetic-background.png", mimeType: "image/png", buffer: png };
  stage = "avatar";
  await page.locator(".do-profile-identity-card input[type=file]").setInputFiles(image);
  await page.getByText("头像已更新", { exact: true }).waitFor();
  const avatar = (await profile()).avatar_url;
  check(avatar && !(await profile()).background_url, "avatar_must_not_set_background");
  pass("avatar_camera_keeps_avatar_only_behavior");
  stage = "background";
  await name.fill("Unsaved synthetic name");
  await bio.fill("Unsaved synthetic biography");
  await background.setInputFiles(image);
  await page.getByText("个人主页背景图已更新", { exact: true }).waitFor();
  const stored = await profile();
  check(stored.background_url?.startsWith(user.id + "/background/") &&
    stored.avatar_url === avatar, "separate_background_field");
  check(await name.inputValue() === "Unsaved synthetic name" &&
    await bio.inputValue() === "Unsaved synthetic biography" &&
    stored.bio === "Synthetic baseline", "background_preserves_unsaved_text");
  async function backgroundVisible(selector) {
    return poll(() => page.locator(selector).evaluate(el => getComputedStyle(el).backgroundImage),
      value => value.includes("/storage/v1/object/sign/avatars/") &&
        value.includes("/background/"));
  }
  await backgroundVisible(".do-profile-cover-upload-photo");
  await backgroundVisible(".do-profile-public-photo");
  await backgroundVisible(".do-profile-page");
  pass("background_saved_separately_and_visible_without_saving_text");
  stage = "failed background";
  failBackground = true;
  await background.setInputFiles(image);
  await page.getByText("Synthetic background save failure", { exact: true }).waitFor();
  check((await profile()).background_url === stored.background_url &&
    (await profile()).avatar_url === avatar &&
    await bio.inputValue() === "Unsaved synthetic biography", "failure_changed_prior_data");
  failBackground = false;
  pass("failed_background_save_keeps_previous_image_avatar_and_drafts");
  stage = "reopen";
  await page.reload({ waitUntil: "networkidle" });
  await backgroundVisible(".do-profile-cover-upload-photo");
  check((await profile()).background_url === stored.background_url &&
    (await profile()).avatar_url === avatar, "reload_changed_saved_images");
  await page.goto(site + "/dives", { waitUntil: "networkidle" });
  await backgroundVisible(".do-passport");
  pass("profile_reload_and_passport_display_saved_background");
  await page.getByRole("button", { name: "退出", exact: true }).click();
  await page.waitForURL("**/auth");
  pass("temporary_user_signed_out");
} catch (error) {
  console.error("Background acceptance incomplete at " + stage + " (" + error.constructor.name + "); details suppressed.");
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (user) {
    try {
      async function list(prefix) {
        const objects = await req("/storage/v1/object/list/avatars", "POST", { prefix, limit: 100 });
        check(objects.length < 100, "cleanup_unexpected_count");
        for (const object of objects) {
          const path = prefix + "/" + object.name;
          if (object.id) paths.add(path); else await list(path);
        }
      }
      await list(user.id);
      check([...paths].every(path => path.startsWith(user.id + "/")), "cleanup_boundary");
      if (paths.size) await req("/storage/v1/object/avatars", "DELETE", { prefixes: [...paths] });
      await req("/auth/v1/admin/users/" + user.id, "DELETE");
      const response = await fetch(api + "/auth/v1/admin/users/" + user.id, {
        signal: AbortSignal.timeout(30000), headers: { apikey: admin, Authorization: "Bearer " + admin },
      });
      check(response.status === 404 && !await profile() &&
        (await req("/storage/v1/object/list/avatars", "POST", { prefix: user.id, limit: 100 })).length === 0,
      "cleanup_incomplete");
      cleaned = true;
    } catch { process.exitCode = 1; }
  }
  console.log((cleaned ? "PASS" : "FAIL") + ": exact_temporary_account_and_images_cleanup");
  const summary = { checks, passed: !process.exitCode, cleanup_verified: cleaned,
    production_modified: false, fixture_id_for_cleanup: cleaned || !user ? null : user.id };
  await appendFile(process.env.GITHUB_STEP_SUMMARY, "\n```json\n" + JSON.stringify(summary, null, 2) + "\n```\n");
}
