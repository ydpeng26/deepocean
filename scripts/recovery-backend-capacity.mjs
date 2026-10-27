// Authorized recovery-only backend benchmark. No website/CDN requests or browser.
// Cloud memory only: no token, user content, image, HAR or raw-response artifacts.
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import vm from "node:vm";
import { createRequire } from "node:module";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import os from "node:os";
import {
  CAPACITY_API as api,
  CAPACITY_STAGES,
  scopedCapacityUrl,
  capacityGrade,
} from "./lib/backend-capacity-guards.mjs";

if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.GITHUB_REPOSITORY !== "ydpeng26/deepocean" ||
  process.env.GITHUB_REF !== "refs/heads/codex/pc-layout-keyboard-audit" ||
  process.env.CAPACITY_FIXTURE_APPROVED !== "30-users-100-posts-100-dives"
)
  throw Error("cloud_scope_required");
const require = createRequire(import.meta.url);
const { createClient } = require(process.env.CAPACITY_SDK_MODULE);
const ts = require(process.env.CAPACITY_TYPESCRIPT_MODULE);
const anon = readFileSync(new URL("./recovery-browser.mjs", import.meta.url), "utf8").match(
  /const anon = '([^']+)'/,
)[1];
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
if (!admin) throw Error("missing_recovery_key");
// The existing recovery secret must itself identify this exact recovery project.
try {
  if (JSON.parse(Buffer.from(admin.split(".")[1], "base64url")).ref !== "esovqvampbrhuhamkfcs")
    throw Error();
} catch {
  throw Error("wrong_recovery_secret");
}
const marker = "CAPACITY-" + randomBytes(8).toString("hex");
const users = Array.from({ length: 30 }, (_, index) => ({
  id: randomUUID(),
  index,
  email: "capacity-" + randomBytes(16).toString("hex") + "@example.invalid",
  password: randomBytes(32).toString("base64url"),
  dives: [],
  posts: [],
  session: null,
  attempted: false,
}));
const owners = users.map((u) => u.id);
const photos = [],
  controllers = new AbortController();
const nativeFetch = globalThis.fetch;
let stage = "preflight",
  active = null,
  failed = false,
  stopping = false,
  totalRequests = 0,
  totalBytes = 0,
  httpFailures = 0,
  cleanupOK = false;
const results = [],
  failureKinds = {};
const log = (name, value) => console.log(name + ": " + JSON.stringify(value));
const check = (ok, code) => {
  if (!ok) throw Error(code);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stop = () => {
  stopping = true;
  controllers.abort();
};
const alarm = setTimeout(stop, 15 * 60 * 1000);
process.on("SIGTERM", stop);
process.on("SIGINT", stop);

async function wire(url, options = {}, { cleanup = false, measured = false } = {}) {
  check(new URL(url).origin === api, "origin");
  if (!cleanup) {
    check(!stopping, "stopped");
    check(totalRequests < 12000 && totalBytes < 180 * 1024 * 1024, "budget");
  }
  const started = performance.now();
  totalRequests++;
  if (measured && active) active.httpRequests++;
  const timeout = AbortSignal.timeout(cleanup ? 15000 : 10000);
  const signal = cleanup ? timeout : AbortSignal.any([controllers.signal, timeout]);
  try {
    const response = await nativeFetch(url, { ...options, redirect: "error", signal });
    // Consume body before stopping the clock; bounded by fixture/request budget.
    const bytes = new Uint8Array(await response.arrayBuffer());
    totalBytes += bytes.byteLength;
    if (measured && active) active.httpMs.push(performance.now() - started);
    if (response.status === 429 && !cleanup) {
      stop();
      throw Error("rate_limit_stop");
    }
    if (!response.ok && measured) {
      httpFailures++;
      active.httpErrors++;
      if (httpFailures >= 10) stop();
    }
    return new Response(bytes.byteLength ? bytes : null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    if (measured && active) active.transportErrors++;
    throw error;
  }
}
async function adminHttp(
  path,
  { method = "GET", body, token, raw, cleanup = false, allow404 = false } = {},
) {
  check(path.startsWith("/") && !path.startsWith("//"), "path");
  const response = await wire(
    api + path,
    {
      method,
      headers: {
        apikey: token ? anon : admin,
        Authorization: "Bearer " + (token || admin),
        "Content-Type": raw ? "image/png" : "application/json",
        Prefer: "return=representation",
      },
      body: raw || (body === undefined ? undefined : JSON.stringify(body)),
    },
    { cleanup },
  );
  if (allow404 && response.status === 404) return null;
  check(response.ok, "fixture_http_" + response.status);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
function loadActual(path, client) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(
    code,
    {
      exports: module.exports,
      module,
      require: (name) => {
        if (name === "@/integrations/supabase/client") return { supabase: client };
        if (name === "@/lib/images") return {};
        throw Error("unexpected_module");
      },
      Blob,
      File,
      AbortSignal,
      setTimeout,
      clearTimeout,
    },
    { filename: path },
  );
  return module.exports;
}
function png() {
  function crc(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(name, data) {
    const type = Buffer.from(name),
      n = Buffer.alloc(4),
      tail = Buffer.alloc(4);
    n.writeUInt32BE(data.length);
    tail.writeUInt32BE(crc(Buffer.concat([type, data])));
    return Buffer.concat([n, type, data, tail]);
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(128);
  head.writeUInt32BE(128, 4);
  head[8] = 8;
  head[9] = 2;
  const raw = randomBytes(128 * (1 + 128 * 3));
  for (let y = 0; y < 128; y++) raw[y * 385] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", head),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
function clientFor(user) {
  const guardedFetch = async (raw, init = {}) => {
    let url = scopedCapacityUrl(
      typeof raw === "string" ? raw : raw.url || raw.href,
      user.id,
      owners,
      user.dives,
    );
    const u = new URL(url),
      method = (init.method || "GET").toUpperCase();
    if (u.pathname.startsWith("/storage/v1/object/sign/")) {
      check(method === "POST", "sign_method");
      const bucket = u.pathname.split("/").at(-1),
        payload = JSON.parse(init.body || "{}");
      check(
        Array.isArray(payload.paths) &&
          payload.paths.length <= 6 &&
          payload.paths.every((path) =>
            photos.some(
              (p) =>
                p.bucket === bucket &&
                p.path === path &&
                (bucket === "forum-media" || p.owner === user.id),
            ),
          ),
        "sign_paths",
      );
    } else if (u.pathname.startsWith("/storage/v1/")) {
      throw Error("unapproved_storage_endpoint");
    } else if (u.pathname === "/rest/v1/rpc/get_my_community_stats") {
      check(method === "POST" && (!init.body || init.body === "{}"), "stats_body");
    } else if (method !== "GET") {
      check(
        method === "PATCH" && u.pathname === "/rest/v1/dives" && u.searchParams.has("updated_at"),
        "write_scope",
      );
      const payload = JSON.parse(init.body || "{}");
      check(payload.user_id === user.id && payload.site_name?.startsWith(marker), "write_payload");
    }
    return wire(url, init, { measured: true });
  };
  const client = createClient(api, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: "Bearer " + user.session.access_token },
      fetch: guardedFetch,
    },
  });
  // Local session lookup only; data access still uses this real user's JWT and RLS.
  client.auth.getSession = async () => ({ data: { session: user.session }, error: null });
  return {
    client,
    forum: loadActual("src/lib/forum.ts", client),
    dives: loadActual("src/lib/dives.ts", client),
  };
}
async function measured(kind, action) {
  const t = performance.now();
  try {
    const value = await action();
    active.ops.push({ kind, ok: true, ms: performance.now() - t });
    return value;
  } catch (error) {
    active.ops.push({ kind, ok: false, ms: performance.now() - t });
    const code = /^[a-z_0-9]{1,45}$/.test(error?.message || "")
      ? error.message
      : "operation_failure";
    failureKinds[code] = (failureKinds[code] || 0) + 1;
    throw Error(code);
  }
}
async function signedImage(url, user) {
  const u = new URL(url);
  const photo = photos.find(
    (p) =>
      u.pathname === "/storage/v1/object/sign/" + p.bucket + "/" + p.path &&
      (p.bucket === "forum-media" || p.owner === user.id),
  );
  check(u.origin === api && photo, "image_scope");
  const r = await wire(u.href, {}, { measured: true });
  check(r.ok, "image_http");
  check((await r.arrayBuffer()).byteLength === photo.bytes, "image_size");
}
async function runStage(count, duration, label) {
  stage = label;
  active = { ops: [], httpMs: [], httpRequests: 0, httpErrors: 0, transportErrors: 0 };
  const cycles = Array(count).fill(0),
    overruns = Array(count).fill(0),
    loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  const started = performance.now(),
    cpu = process.cpuUsage(),
    until = started + duration;
  await Promise.all(
    users.slice(0, count).map(async (user, index) => {
      const { client, forum, dives } = user.runtime;
      await sleep(index * 250);
      while (performance.now() < until && !stopping) {
        const start = performance.now();
        try {
          const posts = await measured("forum", async () => {
            const rows = await forum.listForumPosts(user.id);
            check(
              rows.length === 100 && rows.every((p) => p.title.startsWith(marker)),
              "forum_fixture_count",
            );
            return rows;
          });
          const rows = await measured("dives", async () => {
            const rows = await dives.listDives();
            check(
              rows.length === user.dives.length && rows.every((r) => user.dives.includes(r.id)),
              "dive_fixture_count",
            );
            return rows;
          });
          await measured("profile", async () => {
            const r = await client
              .from("profiles")
              .select("id,display_name,avatar_url,cert_level,tank_count,bio")
              .eq("id", user.id)
              .maybeSingle();
            check(
              !r.error && r.data?.id === user.id && r.data.display_name === marker,
              "profile_result",
            );
          });
          await measured("stats", () => forum.getMyCommunityStats(user.id));
          const images = posts
            .filter((p) => p.imageUrl)
            .slice(0, 2)
            .map((p) => p.imageUrl);
          const own = photos.find((p) => p.owner === user.id && p.bucket === "dive-photos");
          if (own) {
            const signed = await client.storage
              .from("dive-photos")
              .createSignedUrls([own.path], 60);
            check(!signed.error && signed.data?.[0]?.signedUrl, "dive_sign");
            images.push(signed.data[0].signedUrl);
          }
          for (const url of images) await measured("image", () => signedImage(url, user));
          if (cycles[index] % 2 === 0)
            await measured("save", async () => {
              const row = rows[0],
                { id, created_at, updated_at, ...payload } = row;
              payload.notes = marker + ":" + label + ":" + cycles[index];
              const saved = await dives.saveDive(payload, id, true, updated_at);
              check(saved.id === id && saved.notes === payload.notes, "saved_readback");
            });
          cycles[index]++;
        } catch {
          if (stopping || active.ops.filter((o) => !o.ok).length >= 5) stop();
        }
        const elapsed = performance.now() - start;
        if (elapsed > 45000) overruns[index]++;
        await sleep(Math.min(Math.max(0, until - performance.now()), Math.max(0, 45000 - elapsed)));
      }
    }),
  );
  loop.disable();
  const elapsed = performance.now() - started,
    used = process.cpuUsage(cpu),
    grade = capacityGrade(active.ops, cycles, count);
  const tester = {
    event_loop_p95_ms: Math.round(loop.percentile(95) / 1e6),
    cpu_core_equivalents: +((used.user + used.system) / (elapsed * 1000)).toFixed(3),
    free_ram_mb: Math.round(os.freemem() / 1024 / 1024),
    available_cpus: os.availableParallelism(),
    rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  };
  const result = {
    label,
    concurrent_sessions: count,
    elapsed_s: +(elapsed / 1000).toFixed(1),
    cycles: cycles.reduce((a, b) => a + b, 0),
    minimum_cycles_per_session: Math.min(...cycles),
    cycle_overruns: overruns.reduce((a, b) => a + b, 0),
    http_requests: active.httpRequests,
    average_http_rps: +(active.httpRequests / (elapsed / 1000)).toFixed(2),
    http_errors: active.httpErrors,
    transport_errors: active.transportErrors,
    ...grade,
    tester,
    stopped: stopping,
  };
  result.pass =
    grade.pass &&
    !stopping &&
    active.httpErrors === 0 &&
    active.transportErrors === 0 &&
    tester.event_loop_p95_ms < 100 &&
    tester.free_ram_mb > 200;
  results.push(result);
  log("CAPACITY_STAGE", result);
  return result.pass;
}
try {
  log("SCOPE", {
    backend_only: true,
    real_member_JWT_RLS: true,
    source_modules: ["forum", "dives"],
    active_session_counts: CAPACITY_STAGES,
    cycle_seconds: 45,
    threshold_forum_p95_ms: 2500,
    threshold_other_p95_ms: 1500,
    error_rate_below: 0.01,
    request_cap: 12000,
    body_budget_mb: 180,
    fixture_posts: 100,
    fixture_dives: 100,
    no_login_storm: true,
    no_Vercel_requests: true,
  });
  for (const u of users) {
    check(
      (await adminHttp("/auth/v1/admin/users/" + u.id, { allow404: true })) === null,
      "fixture_uuid_collision",
    );
    u.attempted = true;
    const account = await adminHttp("/auth/v1/admin/users", {
      method: "POST",
      body: {
        id: u.id,
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { recovery_capacity: marker },
      },
    });
    check(account.id === u.id, "fixture_owner");
    await adminHttp("/rest/v1/profiles?id=eq." + u.id, {
      method: "PATCH",
      body: { display_name: marker },
    });
    const session = await adminHttp("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email: u.email, password: u.password },
      token: anon,
    });
    check(session.user?.id === u.id && session.access_token, "fixture_session");
    session.expires_at = JSON.parse(
      Buffer.from(session.access_token.split(".")[1], "base64url"),
    ).exp;
    u.session = session;
    await sleep(500);
  }
  const image = png();
  for (const u of users.slice(0, 3))
    for (const bucket of ["forum-media", "dive-photos"]) {
      const photo = {
        bucket,
        owner: u.id,
        path: u.id + "/" + marker + ".png",
        bytes: image.length,
      };
      photos.push(photo);
      await adminHttp("/storage/v1/object/" + bucket + "/" + photo.path, {
        method: "POST",
        token: u.session.access_token,
        raw: image,
      });
    }
  for (let index = 0; index < 100; index++) {
    const u = users[index % 30],
      post = randomUUID(),
      dive = randomUUID();
    u.posts.push(post);
    u.dives.push(dive);
    const forumImage = photos.find((p) => p.owner === u.id && p.bucket === "forum-media"),
      diveImage = photos.find((p) => p.owner === u.id && p.bucket === "dive-photos");
    await adminHttp("/rest/v1/forum_posts", {
      method: "POST",
      token: u.session.access_token,
      body: {
        id: post,
        user_id: u.id,
        author_name: marker,
        title: marker + ":" + index,
        body: "Synthetic performance fixture. ".repeat(36),
        topic: "stories",
        visibility: "public",
        image_path: forumImage?.path ?? null,
      },
    });
    await adminHttp("/rest/v1/dives", {
      method: "POST",
      token: u.session.access_token,
      body: {
        id: dive,
        user_id: u.id,
        country: "Indonesia",
        site_name: marker + ":" + index,
        dive_date: "2026-10-20",
        max_depth: 28,
        duration_min: 44,
        water_temp: 23,
        dive_type: "recreational",
        photo_urls: diveImage ? [diveImage.path] : [],
        photo_thumbnail_urls: [],
        notes: marker,
      },
    });
  }
  for (const u of users) u.runtime = clientFor(u);
  log("FIXTURES_READY", {
    accounts: 30,
    posts: 100,
    dives: 100,
    images: photos.length,
    image_bytes_each: image.length,
  });
  stage = "warmup";
  const warm = users[0].runtime;
  active = { ops: [], httpMs: [], httpRequests: 0, httpErrors: 0, transportErrors: 0 };
  check((await warm.forum.listForumPosts(users[0].id)).length === 100, "warm_forum");
  check((await warm.dives.listDives()).length === users[0].dives.length, "warm_dives");
  for (const count of CAPACITY_STAGES) {
    if (!(await runStage(count, 120000, "ramp_" + count))) break;
    await sleep(5000);
  }
  if (results.length === 4 && results.every((r) => r.pass))
    await runStage(30, 180000, "confirm_30");
  check(results.length > 0 && !stopping, "test_interrupted");
} catch (error) {
  failed = true;
  const code = /^[a-z_0-9]{1,60}$/.test(error?.message || "")
    ? error.message
    : "setup_or_test_failure";
  log("INCOMPLETE", { stage, reason: code });
} finally {
  clearTimeout(alarm);
  stage = "cleanup";
  // Stop load before admin cleanup. Never enumerate or remove unrelated users.
  for (const u of users)
    if (u.session) {
      try {
        await adminHttp("/auth/v1/logout?scope=global", {
          method: "POST",
          token: u.session.access_token,
          cleanup: true,
        });
      } catch {
        failed = true;
      }
    }
  try {
    for (const photo of photos) {
      await adminHttp("/storage/v1/object/" + photo.bucket, {
        method: "DELETE",
        body: { prefixes: [photo.path] },
        cleanup: true,
      });
      const found = await adminHttp("/storage/v1/object/list/" + photo.bucket, {
        method: "POST",
        body: { prefix: photo.owner + "/", search: marker, limit: 10 },
        cleanup: true,
      });
      check(found.length === 0, "photo_cleanup");
    }
    for (const u of users.filter((u) => u.attempted)) {
      const account = await adminHttp("/auth/v1/admin/users/" + u.id, {
        cleanup: true,
        allow404: true,
      });
      if (account) {
        check(
          account.id === u.id &&
            account.email === u.email &&
            account.user_metadata?.recovery_capacity === marker,
          "cleanup_owner_guard",
        );
        for (const [table, ids] of [
          ["forum_posts", u.posts],
          ["dives", u.dives],
        ]) {
          if (ids.length)
            await adminHttp(
              "/rest/v1/" + table + "?user_id=eq." + u.id + "&id=in.(" + ids.join(",") + ")",
              { method: "DELETE", cleanup: true },
            );
          check(
            (
              await adminHttp("/rest/v1/" + table + "?select=id&user_id=eq." + u.id, {
                cleanup: true,
              })
            ).length === 0,
            "row_cleanup",
          );
        }
        await adminHttp("/auth/v1/admin/users/" + u.id, { method: "DELETE", cleanup: true });
      }
      check(
        (await adminHttp("/auth/v1/admin/users/" + u.id, { cleanup: true, allow404: true })) ===
          null,
        "auth_cleanup",
      );
      check(
        (await adminHttp("/rest/v1/profiles?select=id&id=eq." + u.id, { cleanup: true })).length ===
          0,
        "profile_cleanup",
      );
    }
    cleanupOK = true;
    log("PASS", {
      cleanup_verified: true,
      exact_generated_accounts_only: true,
      existing_data_untouched: true,
      local_private_exports: false,
    });
  } catch {
    failed = true;
    log("INCOMPLETE", {
      cleanup_verified: false,
      fixture_marker: marker,
      generated_owners: users.filter((u) => u.attempted).map((u) => u.id),
    });
  }
  log("CAPACITY_RESULT", {
    complete: !failed && cleanupOK,
    highest_stage_passed: Math.max(
      0,
      ...results.filter((r) => r.pass).map((r) => r.concurrent_sessions),
    ),
    confirmed_30: results.some((r) => r.label === "confirm_30" && r.pass),
    total_requests_including_setup_cleanup: totalRequests,
    body_mb: +(totalBytes / 1024 / 1024).toFixed(2),
    failure_kinds: failureKinds,
    backend_only: true,
    source_scope_filter_added_to_forum: true,
    no_login_upload_video_browser_render_or_Vercel_capacity_claim: true,
  });
}
if (failed || !cleanupOK) process.exitCode = 1;
