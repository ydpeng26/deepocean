// Execute actual modules/components with mocked transports, never a live server.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { webcrypto } from "node:crypto";
import { spawnSync } from "node:child_process";
import { guestFixtureRequest } from "./recovery-guest-contact.mjs";
const read = (file) => fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
function load(file, require = () => ({}), globals = {}) {
  const module = { exports: {} };
  const source = read(file).replace("if (import.meta.main)", "if (false)");
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
    {
      module,
      exports: module.exports,
      require,
      Request,
      Response,
      Headers,
      TextEncoder,
      TextDecoder,
      Uint8Array,
      AbortSignal,
      crypto: webcrypto,
      setTimeout,
      clearTimeout,
      fetch() {
        throw Error("Network forbidden");
      },
      ...globals,
    },
  );
  return module.exports;
}
const edge = load("supabase/functions/guest-contact/index.ts");
const id = "12345678-1234-1234-1234-123456789012",
  visitor = "12345678-1234-1234-1234-123456789013";
const payload = {
  id,
  visitor_key: visitor,
  category: "issue",
  body: "Synthetic guest login problem",
  reply_email: "",
  website: "",
};
const env = (key) =>
  ({ SUPABASE_URL: edge.projectUrl, SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-only-secret" })[
    key
  ];
let calls = [],
  mode;
const handler = edge.createHandler(env, async (url, options) => {
  calls.push({ url, options, body: JSON.parse(options.body) });
  if (mode === "throw") throw Error("sensitive server details");
  if (mode === "rate") return Response.json({ message: "contact_rate_limit" }, { status: 400 });
  if (mode === "conflict") return Response.json({ message: "contact_conflict" }, { status: 409 });
  if (mode === "leak")
    return Response.json({ message: "sensitive server details" }, { status: 500 });
  return Response.json(mode === "wrong" ? visitor : calls.at(-1).body.p_id);
});
const request = (body = payload, extra = {}) =>
  new Request(edge.projectUrl + "/functions/v1/guest-contact", {
    method: "POST",
    headers: {
      Origin: edge.siteOrigin,
      "Content-Type": "application/json",
      "X-Forwarded-For": "198.51.100.9",
      ...extra.headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== "headers")),
  });
for (const bad of [
  { ...payload, website: "spam" },
  { ...payload, created_at: "2000" },
  { ...payload, body: " " },
  { ...payload, body: "x".repeat(3001) },
  { ...payload, reply_email: "bad@" },
  { ...payload, user_id: id },
  { ...payload, id: "bad" },
  { ...payload, category: "public" },
]) {
  assert.equal(edge.validInput(bad), false);
  assert.equal((await handler(request(bad))).status, 400);
}
assert.equal((await handler(request("{"))).status, 400);
assert.equal((await handler(request("x".repeat(20001)))).status, 413);
assert.equal(
  (await handler(request(payload, { headers: { Origin: "https://www.supdiver.com" } }))).status,
  403,
);
assert.equal((await handler(new Request(edge.projectUrl))).status, 403);
assert.equal(
  (
    await handler(
      new Request(edge.projectUrl, { method: "GET", headers: { Origin: edge.siteOrigin } }),
    )
  ).status,
  405,
);
const preflight = await handler(
  new Request(edge.projectUrl, { method: "OPTIONS", headers: { Origin: edge.siteOrigin } }),
);
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get("access-control-allow-origin"), edge.siteOrigin);
assert.equal(calls.length, 0);
const saved = await handler(request());
assert.equal(saved.status, 200);
assert.deepEqual(await saved.json(), { code: "received", id });
assert.equal(calls[0].url, edge.projectUrl + "/rest/v1/rpc/submit_guest_contact");
assert(!calls[0].options.body.includes(visitor));
assert(!calls[0].options.body.includes("198.51.100.9"));
const firstHash = calls[0].body.p_request_hash;
assert.match(calls[0].body.p_browser_hash, /^[0-9a-f]{64}$/);
await handler(request());
assert.equal(calls.at(-1).body.p_request_hash, firstHash);
await handler(request({ ...payload, body: "Changed draft" }));
assert.notEqual(calls.at(-1).body.p_request_hash, firstHash);
for (const [value, status, code] of [
  ["rate", 429, "rate"],
  ["conflict", 409, "conflict"],
  ["leak", 503, "unavailable"],
  ["wrong", 503, "unavailable"],
  ["throw", 503, "unavailable"],
]) {
  mode = value;
  const r = await handler(request());
  assert.equal(r.status, status);
  assert.deepEqual(await r.json(), { code });
}
assert.equal((await edge.createHandler(() => undefined)(request())).status, 503);
console.log(
  "PASS: actual public Edge handler bounds methods/origins/fields/bytes; honeypot rejects; forwards only fixed RPC; HMAC hides browser/network; exact receipts and safe errors; no user auth dependency",
);
let clientCalls = [],
  clientMode;
const client = load(
  "src/lib/guest-contact.ts",
  (name) => {
    assert.equal(name, "@/integrations/supabase/client");
    return { getSupabaseProjectUrl: () => edge.projectUrl };
  },
  {
    fetch: async (url, options) => {
      clientCalls.push({ url, options });
      if (clientMode === "throw") throw Error("secret");
      if (clientMode === "rate") return Response.json({ code: "rate" }, { status: 429 });
      return Response.json({ code: "received", id: clientMode === "wrong" ? visitor : id });
    },
    localStorage: {
      getItem() {
        throw Error("Storage denied");
      },
    },
  },
);
assert.match(client.contactVisitorKey(), /^[0-9a-f-]{36}$/);
await client.sendGuestContact(id, visitor, payload);
assert.equal(clientCalls[0].options.credentials, "omit");
assert(!("Authorization" in clientCalls[0].options.headers));
assert.equal(clientCalls[0].url, edge.projectUrl + "/functions/v1/guest-contact");
for (const value of ["rate", "wrong", "throw"]) {
  clientMode = value;
  await assert.rejects(
    () => client.sendGuestContact(id, visitor, payload),
    (e) => e instanceof client.ContactError && e.code === (value === "rate" ? "rate" : "save"),
  );
}
console.log(
  "PASS: actual guest client omits credentials, survives storage denial, validates message/email and confirms exact receipt only",
);
const nodes = (tree, result = []) => {
  if (Array.isArray(tree)) tree.forEach((v) => nodes(v, result));
  else if (tree && typeof tree === "object") {
    if (tree.type) result.push(tree);
    nodes(tree.props?.children, result);
  }
  return result;
};
const jsx = (type, props) => ({ type, props });
function editor() {
  const h = { cells: [], effects: new Map(), calls: [], language: "zh-CN", writes: 0 };
  let cursor = 0;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in h.cells)) h.cells[i] = initial;
      return [
        h.cells[i],
        (v) => {
          h.writes++;
          h.cells[i] = typeof v === "function" ? v(h.cells[i]) : v;
        },
      ];
    },
    useRef(initial) {
      return (h.cells[cursor++] ??= { current: initial });
    },
    useEffect(fn, deps) {
      const i = cursor++,
        prev = h.effects.get(i);
      if (!prev || deps.some((v, n) => v !== prev.deps[n])) {
        prev?.cleanup?.();
        h.effects.set(i, { deps, cleanup: fn() });
      }
    },
  };
  const page = load(
    "src/routes/contact.tsx",
    (name) => {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "@tanstack/react-router")
        return { Link: "Link", createFileRoute: () => (o) => o };
      if (name === "@/i18n/LanguageProvider")
        return { useLanguage: () => ({ language: h.language }) };
      if (name === "@/lib/guest-contact")
        return {
          ContactError: client.ContactError,
          contactVisitorKey: () => visitor,
          sendGuestContact(request, key, values) {
            h.calls.push({ request, key, values });
            return new Promise((resolve, reject) => {
              h.deferred = { resolve, reject };
            });
          },
        };
      return {};
    },
    { crypto: { randomUUID: () => id }, document: {} },
  ).GuestContactPage;
  h.render = () => {
    cursor = 0;
    return nodes(page());
  };
  h.field = (key) => h.render().find((n) => n.props.id === key);
  h.submit = () =>
    h
      .render()
      .find((n) => n.type === "form")
      .props.onSubmit({ preventDefault() {} });
  h.unmount = () => h.effects.forEach((e) => e.cleanup?.());
  return h;
}
const h = editor();
h.field("contact-body").props.onChange({ target: { value: "Synthetic unsent draft" } });
h.field("contact-email").props.onChange({ target: { value: "reply@example.invalid" } });
const pending = h.submit();
await h.submit();
assert.equal(h.calls.length, 1);
assert(h.render().find((n) => n.type === "fieldset").props.disabled);
h.deferred.reject(Error("sensitive details"));
await pending;
assert.equal(h.field("contact-body").props.value, "Synthetic unsent draft");
assert.equal(h.field("contact-email").props.value, "reply@example.invalid");
assert(!JSON.stringify(h.render()).includes("sensitive details"));
h.language = "en";
assert.equal(h.field("contact-body").props.value, "Synthetic unsent draft");
const retry = h.submit();
assert.equal(h.calls[1].request, h.calls[0].request);
h.deferred.resolve(id);
await retry;
assert.equal(h.field("contact-body").props.value, "");
assert.equal(h.field("contact-email").props.value, "");
assert(h.render().some((n) => n.props.role === "status"));
const late = editor();
late.field("contact-body").props.onChange({ target: { value: "Late" } });
const finishing = late.submit();
late.unmount();
const writes = late.writes;
late.deferred.resolve(id);
await finishing;
assert.equal(late.writes, writes);
for (const file of ["src/routes/index.tsx", "src/routes/auth.tsx"])
  assert(read(file).includes('to="/contact"'));
assert(!read("src/routes/contact.tsx").includes("useRouteContext"));
const sql = read("supabase/migrations/20261026152628_guest_contact_messages.sql");
assert(sql.includes("ENABLE ROW LEVEL SECURITY"));
assert(!sql.includes("SECURITY DEFINER"));
assert(sql.includes("FROM PUBLIC, anon, authenticated"));
assert(sql.includes("pg_advisory_xact_lock"));
assert(sql.includes(">= 300"));
assert(sql.includes(">= 30"));
console.log(
  "PASS: actual public form has synchronous lock, retained failed draft/email, stable retry, safe errors, language continuity and unmount guard; homepage/login entrances exist; SQL source stays service-only with serialized global limits",
);
const marker = "GUEST-CONTACT-local-guard";
const fixture = { ...payload, body: marker + " generated only" };
assert(
  guestFixtureRequest(edge.projectUrl + "/functions/v1/guest-contact", "POST", fixture, marker),
);
for (const body of [
  { ...fixture, body: "Existing user text" },
  { ...fixture, user_id: id },
  { ...fixture, reply_email: "real@example.com" },
])
  assert(
    !guestFixtureRequest(edge.projectUrl + "/functions/v1/guest-contact", "POST", body, marker),
  );
assert(!guestFixtureRequest("https://www.supdiver.com/contact", "POST", fixture, marker));
const local = spawnSync(process.execPath, ["scripts/recovery-guest-contact.mjs"], {
  env: { ...process.env, GITHUB_ACTIONS: "", RECOVERY_SERVICE_ROLE_KEY: "" },
  encoding: "utf8",
});
assert.equal(local.status, 1);
assert(local.stdout.includes("github_cloud_only"));
assert(!read("scripts/recovery-guest-contact.mjs").includes("JSON.stringify(states)"));
assert(read("scripts/recovery-guest-contact.mjs").includes('form.getByRole("alert")'), "Guest form alerts must be scoped separately from global storage warnings");
console.log(
  "PASS: cloud guest runner rejects local invocation before credentials/network and forwards only fixed synthetic requests; diagnostics never contain message payloads",
);
