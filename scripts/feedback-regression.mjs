// Actual modules and React callbacks, deterministic local models only. No network or DB.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { spawnSync } from "node:child_process";
import { feedbackFixtureWrite, feedbackFixtureRead } from "./recovery-feedback.mjs";
import { recoveryOrigin } from "./recovery-member-safety.mjs";
const read = (file) => fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
function load(file, require, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(read(file), {
      compilerOptions: { module: 1, jsx: 4, target: 9 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require,
      fetch() {
        throw Error("Network forbidden");
      },
      ...globals,
    },
  );
  return module.exports;
}
const id = "12345678-1234-1234-1234-123456789012";
const state = { account: "A", rows: new Map(), inserts: 0, mode: null, readFail: false };
const supabase = {
  auth: {
    async getSession() {
      return { data: { session: { user: { id: state.account } } } };
    },
  },
  from(table) {
    assert.equal(table, "website_feedback");
    const filters = {};
    let payload;
    return {
      select(columns) {
        assert.equal(columns, "id,user_id,category,body");
        return this;
      },
      eq(key, value) {
        filters[key] = value;
        return this;
      },
      insert(values) {
        payload = values;
        return this;
      },
      async maybeSingle() {
        assert.equal(filters.user_id, "A");
        assert.equal(filters.id, id);
        if (state.readFail) return { error: { message: "private database details" }, data: null };
        const value = state.rows.get(filters.id);
        return { data: value?.user_id === filters.user_id ? value : null, error: null };
      },
      async single() {
        state.inserts++;
        if (state.mode === "fail") return { error: { message: "private details" }, data: null };
        if (state.mode === "rate") return { error: { message: "feedback_rate_limit" }, data: null };
        const row = { ...payload };
        state.rows.set(id, row);
        if (state.mode === "account-change") state.account = "B";
        if (state.mode === "lost") return { error: { message: "transport failure" }, data: null };
        if (state.mode === "wrong-row") return { data: { ...row, user_id: "B" }, error: null };
        return { data: row, error: null };
      },
    };
  },
};
const api = load("src/lib/feedback.ts", (name) => {
  assert.equal(name, "@/integrations/supabase/client");
  return { supabase };
});
const input = { category: "suggestion", body: "  A synthetic suggestion  " };
const rejects = (fn, code) =>
  assert.rejects(fn, (e) => e instanceof api.FeedbackError && e.code === code);
for (const invalid of [
  { category: "invalid", body: "x" },
  { category: "issue", body: " \n " },
  { category: "issue", body: "x".repeat(3001) },
  { category: "issue", body: null },
])
  await rejects(() => api.submitFeedback(id, invalid, "A"), "invalid");
await rejects(() => api.submitFeedback("not-a-uuid", input, "A"), "invalid");
assert.equal(state.inserts, 0);
state.account = "B";
await rejects(() => api.submitFeedback(id, input, "A"), "account");
state.account = "A";
state.readFail = true;
await rejects(() => api.submitFeedback(id, input, "A"), "save");
state.readFail = false;
assert.equal(state.inserts, 0);
for (const [mode, code] of [
  ["fail", "save"],
  ["rate", "rate"],
]) {
  state.mode = mode;
  await rejects(() => api.submitFeedback(id, input, "A"), code);
  assert.equal(state.rows.size, 0);
}
state.mode = "lost";
assert.equal(await api.submitFeedback(id, input, "A"), id);
const inserts = state.inserts;
assert.equal(await api.submitFeedback(id, input, "A"), id);
assert.equal(state.inserts, inserts, "Identical retry cannot insert again");
assert.equal(state.rows.get(id).body, input.body.trim());
await rejects(() => api.submitFeedback(id, { ...input, body: "Changed text" }, "A"), "conflict");
assert.equal(state.inserts, inserts);
state.rows.clear();
state.mode = "wrong-row";
await rejects(() => api.submitFeedback(id, input, "A"), "conflict");
state.rows.clear();
state.mode = "account-change";
await rejects(() => api.submitFeedback(id, input, "A"), "account");
console.log(
  "PASS: actual feedback API validates allowlisted fields, owner and returned row; read/save/rate errors fail closed; committed lost reply and stable retry do not duplicate; changed retry never overwrites",
);

function nodes(tree, out = []) {
  if (Array.isArray(tree)) for (const value of tree) nodes(value, out);
  else if (tree && typeof tree === "object") {
    if (tree.type) out.push(tree);
    nodes(tree.props?.children, out);
  }
  return out;
}
const jsx = (type, props) => ({ type, props });
function feedbackEditor() {
  const h = {
    cells: [],
    calls: [],
    effects: new Map(),
    language: "zh-CN",
    title: "",
    deferred: null,
    writes: 0,
  };
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
      const i = cursor++;
      return (h.cells[i] ??= { current: initial });
    },
    useEffect(fn, deps) {
      const i = cursor++,
        previous = h.effects.get(i);
      if (!previous || deps.some((v, n) => v !== previous.deps[n])) {
        previous?.cleanup?.();
        h.effects.set(i, { deps, cleanup: fn() });
      }
    },
  };
  const component = load(
    "src/routes/_authenticated/feedback.tsx",
    (name) => {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "@tanstack/react-router")
        return {
          createFileRoute: () => (o) => ({ ...o, useRouteContext: () => ({ user: { id: "A" } }) }),
        };
      if (name === "@/i18n/LanguageProvider")
        return { useLanguage: () => ({ language: h.language }) };
      if (name === "@/lib/feedback")
        return {
          FeedbackError: api.FeedbackError,
          submitFeedback(request, values, owner) {
            h.calls.push({ request, values: { ...values }, owner });
            return new Promise((resolve, reject) => {
              h.deferred = { resolve, reject };
            });
          },
        };
      return new Proxy({}, { get: (_, key) => key });
    },
    {
      crypto: { randomUUID: () => id },
      document: {
        set title(v) {
          h.title = v;
        },
      },
    },
  ).FeedbackPage;
  h.render = () => {
    cursor = 0;
    return nodes(component());
  };
  h.field = (id) => h.render().find((n) => n.props.id === id);
  h.submit = () =>
    h
      .render()
      .find((n) => n.type === "form")
      .props.onSubmit({ preventDefault() {} });
  h.unmount = () => {
    for (const effect of h.effects.values()) effect.cleanup?.();
  };
  return h;
}
const h = feedbackEditor();
h.field("feedback-body").props.onChange({ target: { value: "Keep this unsaved text" } });
const pending = h.submit();
await h.submit();
assert.equal(h.calls.length, 1, "Synchronous lock must ignore immediate double submit");
assert(h.render().find((n) => n.type === "fieldset").props.disabled);
h.deferred.reject(new Error("sensitive service details"));
await pending;
assert.equal(h.field("feedback-body").props.value, "Keep this unsaved text");
assert(h.render().some((n) => n.props.role === "alert"));
assert(!JSON.stringify(h.render()).includes("sensitive service details"));
h.language = "en";
h.render();
assert.equal(h.title, "Feedback · SupDiver");
assert.equal(h.field("feedback-body").props.value, "Keep this unsaved text");
const retry = h.submit();
assert.equal(h.calls[0].request, h.calls[1].request);
h.deferred.resolve(id);
await retry;
assert.equal(h.field("feedback-body").props.value, "");
assert(h.render().some((n) => n.props.role === "status"));
assert(!h.render().find((n) => n.type === "fieldset").props.disabled);
const late = feedbackEditor();
late.field("feedback-body").props.onChange({ target: { value: "Unmounted text" } });
const ending = late.submit();
late.unmount();
const before = late.writes;
late.deferred.resolve(id);
await ending;
assert.equal(late.writes, before, "No late state writes after unmount");
console.log(
  "PASS: actual feedback page locks submission, keeps failed and language-switched drafts, hides raw errors, reuses request id, clears only confirmed success and suppresses unmounted state updates",
);

for (const language of ["zh-CN", "en"]) {
  const nav = load("src/components/MainNavigation.tsx", (name) => {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "@tanstack/react-router")
      return {
        Link: "Link",
        useRouterState: ({ select }) => select({ location: { pathname: "/feedback" } }),
      };
    return { useLanguage: () => ({ language }) };
  }).MainNavigation;
  const link = nodes(nav()).find((n) => n.props.to === "/feedback");
  assert.equal(link.props.children, language === "en" ? "Feedback" : "意见反馈");
  assert.equal(link.props["aria-current"], "page");
}
assert(!read("src/routes/forum-preview.tsx").includes('className="do-forum-hero-orbit"'));
assert(!read("src/routes/forum-preview.tsx").includes("OCEAN STORIES"));
assert(read("src/routeTree.gen.ts").includes("'/_authenticated/feedback'"));
const sql = read("supabase/migrations/20261026135542_website_feedback.sql");
for (const boundary of [
  "ENABLE ROW LEVEL SECURITY",
  "FROM PUBLIC, anon, authenticated",
  "FOR SELECT TO authenticated",
  "FOR INSERT TO authenticated",
  "SECURITY INVOKER",
  "pg_advisory_xact_lock",
  "feedback_rate_limit",
  "interval '1 minute'",
  "interval '24 hours'",
  "NEW.created_at := pg_catalog.clock_timestamp()",
])
  assert(sql.includes(boundary), boundary);
assert(!/SECURITY DEFINER|GRANT.*(?:UPDATE|DELETE).*TO authenticated/.test(sql));
console.log(
  "PASS: feedback navigation is bilingual and active, forum count widget removed, authenticated route generated, SQL source has private owner policies and server-side limits (live SQL acceptance still pending)",
);
const fixturePayload = {
  id,
  user_id: "A",
  category: "suggestion",
  body: "FEEDBACK-SAFETY-local fixture",
};
const fixtureUrl = recoveryOrigin + "/rest/v1/website_feedback";
const readUrl = fixtureUrl + "?select=id,user_id,category,body&id=eq." + id + "&user_id=eq.A";
assert.equal(
  feedbackFixtureRead(readUrl, "A"),
  id,
  "Fresh UUID pre-insert lookup must be allowed for the generated owner",
);
for (const url of [
  readUrl.replace("eq.A", "eq.B"),
  readUrl.replace("&id=eq." + id, ""),
  readUrl.replace("select=id,user_id,category,body", "select=*"),
  readUrl + "&or=(user_id.eq.B)",
  readUrl.replace(recoveryOrigin, "https://www.supdiver.com"),
  readUrl + "&id=eq.other",
])
  assert.equal(feedbackFixtureRead(url, "A"), null);
assert(feedbackFixtureWrite(fixtureUrl, "POST", fixturePayload, "A", new Set([id])));
for (const [url, method, payload, ids] of [
  [
    fixtureUrl.replace(recoveryOrigin, "https://www.supdiver.com"),
    "POST",
    fixturePayload,
    new Set([id]),
  ],
  [fixtureUrl.replace("website_feedback", "profiles"), "POST", fixturePayload, new Set([id])],
  [fixtureUrl, "PATCH", fixturePayload, new Set([id])],
  [fixtureUrl, "POST", { ...fixturePayload, user_id: "B" }, new Set([id])],
  [fixtureUrl, "POST", { ...fixturePayload, body: "Not a synthetic fixture" }, new Set([id])],
  [fixtureUrl, "POST", { ...fixturePayload, created_at: "2000-01-01" }, new Set([id])],
  [fixtureUrl, "POST", fixturePayload, new Set()],
])
  assert(!feedbackFixtureWrite(url, method, payload, "A", ids));
const guarded = spawnSync(process.execPath, ["scripts/recovery-feedback.mjs"], {
  encoding: "utf8",
  env: { PATH: process.env.PATH },
});
assert.equal(guarded.status, 1);
assert(guarded.stdout.includes("github_cloud_only") && guarded.stdout.includes("complete=false"));
const runner = read("scripts/recovery-feedback.mjs");
assert.match(runner, /if \(state\.failedRead\)[\s\S]*?status: 400,/, "lost-reply probe must not be automatically retried by SDK");
assert(
  runner.indexOf('check(process.env.GITHUB_ACTIONS === "true"') <
    runner.indexOf("admin = process.env.RECOVERY_SERVICE_ROLE_KEY"),
);
for (const guard of [
  "exact_cleanup_account_guard",
  "session_revocation",
  "feedback_fixture_absence",
  "profile_and_feedback_absence",
  "concurrent_minute_limit_serialized",
  "daily_limit_enforced",
  "480000",
])
  assert(runner.includes(guard), guard);
console.log(
  "PASS: actual cloud feedback write boundary rejects foreign/untracked/non-synthetic/extra-field writes; local invocation fails before credentials or network; exact cleanup and deadline guards remain present",
);
