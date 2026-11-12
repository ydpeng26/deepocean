import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
function load(path, imports) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
      compilerOptions: { module: 1, target: 9, jsx: 4 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (name) => {
        if (!(name in imports)) throw Error("Unexpected import: " + name);
        return imports[name];
      },
    },
  );
  return module.exports;
}
let account = "admin",
  allowed = true,
  failure = false,
  switchAccount = false;
const calls = [];
let mutation = null;
const fake = {
  auth: { getSession: async () => ({ data: { session: { user: { id: account } } } }) },
  rpc: async (name) => {
    assert.equal(name, "is_feedback_admin");
    return { data: allowed, error: failure ? {} : null };
  },
  from(table) {
    const call = { table, filters: [] };
    calls.push(call);
    return {
      select(columns, options) {
        call.columns = columns;
        call.options = options;
        return this;
      },
      order(...args) {
        (call.orders ??= []).push(args);
        return this;
      },
      eq(...args) {
        call.filters.push(args);
        return this;
      },
      ilike(...args) {
        call.search = args;
        return this;
      },
      update(values) {
        call.update = values;
        return this;
      },
      async range(...args) {
        call.range = args;
        if (switchAccount) account = "other";
        return { data: [], count: 43, error: failure ? {} : null };
      },
      async maybeSingle() {
        if (switchAccount) account = "other";
        return { data: mutation, error: failure ? {} : null };
      },
    };
  },
};
const lib = load("src/lib/admin-inbox.ts", {
  "@/integrations/supabase/client": { supabase: fake },
});
const filter = { status: "unread", source: "guest", page: 1, search: "100%_\\" };
allowed = false;
await assert.rejects(lib.loadInbox("admin", filter), (e) => e.code === "denied");
assert.equal(calls.length, 0);
allowed = true;
const result = await lib.loadInbox("admin", filter);
assert.equal(result.total, 43);
assert.deepEqual(calls.at(-1).range, [20, 39]);
assert.deepEqual(calls.at(-1).filters, [
  ["status", "unread"],
  ["source", "guest"],
]);
assert.equal(calls.at(-1).search[1], "%100\\%\\_\\\\%");
switchAccount = true;
await assert.rejects(lib.loadInbox("admin", filter), (e) => e.code === "account");
switchAccount = false;
account = "admin";
const message = { id: "same-id", source: "guest", status: "unread" };
mutation = { id: message.id, status: "resolved" };
await lib.setInboxStatus("admin", message, "resolved");
assert.equal(calls.at(-1).table, "guest_contact_messages");
assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).update)), { status: "resolved" });
assert.deepEqual(calls.at(-1).filters, [
  ["id", "same-id"],
  ["status", "unread"],
]);
await lib.setInboxStatus("admin", { ...message, source: "member" }, "resolved");
assert.equal(calls.at(-1).table, "website_feedback");
mutation = null;
await assert.rejects(
  lib.setInboxStatus("admin", message, "resolved"),
  (e) => e.code === "conflict",
);
failure = true;
await assert.rejects(lib.loadInbox("admin", filter), (e) => e.code === "load");
failure = false;
const unsafe = '<script>alert("private")</script>';
const fixture = {
  messages: [
    {
      ...message,
      category: "issue",
      body: unsafe,
      created_at: "2026-11-12T00:00:00Z",
      reply_email: "test@example.invalid",
      user_id: null,
    },
  ],
  total: 21,
};
let gate = { data: true, isPending: false, isError: false };
let language = "en",
  stateIndex = 0;
const initial = ["all", "all", "", "", 0, 0, fixture, "", false, false];
const component = load("src/routes/_authenticated/admin-inbox.tsx", {
  react: {
    useState: () => [initial[stateIndex++], () => {}],
    useEffect: () => {},
    useRef: (v) => ({ current: v }),
  },
  "react/jsx-runtime": jsx,
  "@tanstack/react-router": {
    createFileRoute: () => (options) => ({
      ...options,
      useRouteContext: () => ({ user: { id: "admin" } }),
    }),
    Link: ({ to, children }) => React.createElement("a", { href: to }, children),
  },
  "@/i18n/LanguageProvider": { useLanguage: () => ({ language }) },
  "@/hooks/useFeedbackAdmin": { useFeedbackAdmin: () => gate },
  "@/lib/admin-inbox": lib,
  "@/styles/admin-inbox.css": {},
});
function render() {
  stateIndex = 0;
  return renderToStaticMarkup(React.createElement(component.Route.component));
}
let html = render();
assert.ok(
  html.includes("User feedback") && html.includes("View message") && html.includes("1 / 2"),
);
assert.ok(html.includes("&lt;script&gt;") && !html.includes("<script>"));
language = "zh-CN";
html = render();
assert.ok(html.includes("用户反馈") && html.includes("已处理"));
gate = { data: false, isPending: false, isError: false };
html = render();
assert.ok(!html.includes("test@example.invalid") && !html.includes("查看全文"));
gate = { data: true, isPending: false, isError: true };
html = render();
assert.ok(!html.includes("test@example.invalid") && html.includes("无法核对权限"));
console.log(
  "PASS: inbox authorization, account changes, pagination, filtering, escaped search, status CAS, bilingual rendering, denied/error isolation and escaped message text",
);
