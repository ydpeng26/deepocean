// Isolated source-level regressions. No browser, real credentials, network or DB writes.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";

function load(file, require) {
  const source = readFileSync(new URL("../" + file, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    code,
    {
      require,
      module,
      exports: module.exports,
      console,
      URL: {
        revokeObjectURL() {},
        createObjectURL() {
          return "blob:synthetic";
        },
      },
      crypto: {
        randomUUID() {
          return "synthetic-photo";
        },
      },
      fetch() {
        throw Error("Network forbidden in local profile tests");
      },
    },
    { filename: file },
  );
  return module.exports;
}
const original = () => ({
  id: "local-account-a",
  display_name: "Original",
  bio: "Original bio",
  cert_level: "OW 开放水域",
  tank_count: 3,
  avatar_url: null,
});
function nodes(tree, out = []) {
  if (Array.isArray(tree)) for (const value of tree) nodes(value, out);
  else if (tree && typeof tree === "object") {
    if (tree.type) out.push(tree);
    nodes(tree.props?.children, out);
  }
  return out;
}
function editor() {
  const state = {
    profile: original(),
    isError: false,
    isPending: false,
    cells: [],
    effects: new Map(),
    mutations: [],
    writes: [],
    messages: [],
    invalidations: [],
    refetches: 0,
    tree: null,
  };
  let cursor = 0,
    mutationCursor = 0,
    effects = [];
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in state.cells)) state.cells[i] = initial;
      return [
        state.cells[i],
        (value) => {
          state.cells[i] = typeof value === "function" ? value(state.cells[i]) : value;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      return (state.cells[i] ??= { current: initial });
    },
    useMemo(fn) {
      return fn();
    },
    useEffect(fn, deps) {
      const i = cursor++,
        previous = state.effects.get(i);
      if (!previous || deps.some((value, n) => value !== previous.deps[n])) {
        state.effects.set(i, { deps });
        effects.push(() => {
          previous?.cleanup?.();
          state.effects.get(i).cleanup = fn();
        });
      }
    },
  };
  const queryClient = {
    setQueryData(key, value) {
      state.writes.push(key);
      if (key[0] === "profile")
        state.profile = typeof value === "function" ? value(state.profile) : value;
    },
    invalidateQueries({ queryKey }) {
      state.invalidations.push(queryKey);
      return Promise.resolve();
    },
  };
  const fallback = new Proxy({}, { get: (_, key) => String(key) });
  const jsx = (type, props) => ({ type, props });
  const component = load("src/routes/_authenticated/profile.tsx", (name) => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "@tanstack/react-router")
      return {
        createFileRoute: () => (options) => options,
        useNavigate: () => () => {},
        Link: "Link",
      };
    if (name === "@tanstack/react-query")
      return {
        useQuery: () => ({ data: [] }),
        useQueryClient: () => queryClient,
        useMutation(options) {
          const i = mutationCursor++;
          const mutation = (state.mutations[i] ??= { pending: false, count: 0 });
          mutation.options = options;
          return {
            isPending: mutation.pending,
            mutate(variables) {
              assert.equal(mutation.pending, false, "Duplicate mutation bypassed the guard");
              mutation.pending = true;
              mutation.variables = variables;
              mutation.count++;
            },
          };
        },
      };
    if (name === "@/hooks/useProfile")
      return {
        useProfile: () => ({
          profile: state.profile,
          avatarUrl: null,
          isPending: state.isPending,
          isError: state.isError,
          refetch() {
            state.refetches++;
          },
        }),
      };
    if (name === "@/i18n/LanguageProvider") return { useLanguage: () => ({ language: "zh-CN" }) };
    if (name === "@/lib/profile")
      return {
        CERT_LEVELS: ["OW 开放水域", "AOW 进阶开放水域"],
        updateMyProfile() {
          throw Error("Call API tests separately");
        },
        uploadAvatar() {
          throw Error("Call API tests separately");
        },
        signedAvatarUrl: async () => "https://example.invalid/synthetic-avatar",
      };
    if (name === "@/integrations/supabase/client")
      return {
        supabase: new Proxy(
          {},
          {
            get() {
              throw Error("Network forbidden");
            },
          },
        ),
      };
    if (name === "sonner")
      return {
        toast: {
          success(message) {
            state.messages.push(message);
          },
          error(message) {
            state.messages.push(message);
          },
        },
      };
    return fallback;
  }).Route.component;
  state.render = () => {
    cursor = mutationCursor = 0;
    effects = [];
    state.tree = component();
    for (const effect of effects) effect();
    return state.tree;
  };
  state.find = (predicate) => nodes(state.tree).find(predicate);
  state.field = (type) =>
    state.find((n) =>
      type === "name"
        ? n.type === "input" && n.props.maxLength === 40
        : type === "bio"
          ? n.type === "textarea"
          : type === "cert"
            ? n.type === "select"
            : n.type === "input" && n.props.type === "number",
    );
  state.change = (field, value) => state.field(field).props.onChange({ target: { value } });
  state.save = () => state.find((n) => n.props?.className === "do-profile-save").props.onClick();
  state.upload = () =>
    state
      .find((n) => n.type === "input" && n.props.type === "file")
      .props.onChange({ target: { files: [{ name: "local-only.png" }], value: "local-only.png" } });
  state.complete = async (index, result, error) => {
    const mutation = state.mutations[index];
    try {
      if (error) await mutation.options.onError(error, mutation.variables);
      else await mutation.options.onSuccess(result, mutation.variables);
    } finally {
      await mutation.options.onSettled?.(result, error, mutation.variables);
      mutation.pending = false;
    }
    state.render();
    state.render();
  };
  state.unmount = () => {
    for (const effect of state.effects.values()) effect.cleanup?.();
  };
  state.render();
  state.render();
  return state;
}
const e = editor();
e.change("name", "Unsaved name");
e.change("bio", "Unsaved bio");
e.change("cert", "AOW 进阶开放水域");
e.change("tanks", "15");
e.render();
e.upload();
e.upload();
e.render();
assert.equal(e.mutations[1].count, 1);
for (const field of ["name", "bio", "cert", "tanks"])
  assert.equal(e.field(field).props.disabled, true);
e.save();
assert.equal(e.mutations[0].count, 0, "Save must not overlap upload");
await e.complete(1, "local-account-a/new.jpg");
for (const [field, value] of Object.entries({
  name: "Unsaved name",
  bio: "Unsaved bio",
  cert: "AOW 进阶开放水域",
  tanks: "15",
})) {
  assert.equal(e.field(field).props.value, value, "Avatar update reset unsaved " + field);
}
console.log("PASS: avatar update preserves every unsaved field and blocks overlapping actions");
e.profile = { ...e.profile, display_name: "Remote refresh" };
e.render();
e.render();
assert.equal(e.field("name").props.value, "Unsaved name");
console.log("PASS: same-account cache refresh does not overwrite unsaved text");
e.save();
e.save();
e.render();
assert.equal(e.mutations[0].count, 1);
assert.equal(e.mutations[0].variables.values.display_name, "Unsaved name");
assert.equal(e.mutations[0].variables.accountId, "local-account-a");
e.change("name", "Forbidden pending edit");
e.upload();
e.render();
assert.equal(e.field("name").props.value, "Unsaved name");
assert.equal(e.mutations[1].count, 1);
const confirmed = {
  ...e.profile,
  ...e.mutations[0].variables.values,
  display_name: "Confirmed by server",
};
await e.complete(0, confirmed);
assert.equal(e.field("name").props.value, confirmed.display_name);
assert.equal(e.profile.display_name, confirmed.display_name);
assert.ok(JSON.stringify(e.tree).includes("更改已保存"));
console.log(
  "PASS: synchronous double-save is blocked and only confirmed server values are marked saved",
);
e.change("bio", "Retry this edit");
e.render();
e.save();
e.render();
await e.complete(0, null, Error("Synthetic save failure"));
assert.equal(e.field("bio").props.value, "Retry this edit");
assert.equal(e.field("bio").props.disabled, false);
assert.ok(!JSON.stringify(e.tree).includes("更改已保存"));
e.save();
e.render();
await e.complete(0, { ...e.profile, ...e.mutations[0].variables.values });
assert.equal(e.profile.bio, "Retry this edit");
console.log("PASS: failed save retains edits, releases lock and permits successful retry");
const avatarFailure = editor();
avatarFailure.change("name", "Keep text after upload failure");
avatarFailure.render(); avatarFailure.upload(); avatarFailure.render();
await avatarFailure.complete(1, null, Error("Synthetic upload failure"));
assert.equal(avatarFailure.field("name").props.value, "Keep text after upload failure");
assert.equal(avatarFailure.field("name").props.disabled, false);
avatarFailure.upload(); avatarFailure.render();
await avatarFailure.complete(1, "local-account-a/retry.jpg");
assert.equal(avatarFailure.profile.avatar_url, "local-account-a/retry.jpg");
assert.equal(avatarFailure.field("name").props.value, "Keep text after upload failure");
console.log("PASS: failed avatar upload keeps text, releases lock and permits retry");
for (const value of ["1.5", "-1", "2147483648", "NaN"]) {
  e.change("tanks", value);
  e.render();
  const count = e.mutations[0].count;
  e.save();
  assert.equal(e.mutations[0].count, count, "Invalid tank count submitted");
}
console.log("PASS: invalid tank counts cannot reach a save mutation");
const failed = editor();
failed.isError = true;
failed.profile = null;
failed.render();
assert.ok(failed.find((n) => n.props?.role === "alert"));
assert.equal(
  nodes(failed.tree).some((n) => n.type === "input"),
  false,
);
failed.find((n) => n.type === "button").props.onClick();
assert.equal(failed.refetches, 1);
failed.isError = false;
failed.profile = original();
failed.render();
failed.render();
assert.equal(failed.field("name").props.value, "Original");
console.log(
  "PASS: profile load failure blocks the blank editor and offers a working reload action",
);
const late = editor();
late.save();
late.unmount();
late.profile = { ...original(), id: "local-account-b", display_name: "Account B" };
await late.complete(0, { ...original(), display_name: "Late account A response" });
assert.equal(late.profile.id, "local-account-b");
assert.equal(late.writes.length, 0);
console.log(
  "PASS: late completion after editor unmount cannot write an old account into query cache",
);

// Exercise the real API functions against a fake Supabase chain, never a network client.
let sessionId = "local-account-a",
  queue = [],
  queries = 0;
const fakeClient = {
  auth: {
    getSession: async () => ({
      data: { session: { user: { id: sessionId, email: "local@example.invalid" } } },
    }),
  },
  from() {
    queries++;
    const chain = {};
    for (const method of ["select", "eq", "update", "insert"]) chain[method] = () => chain;
    for (const method of ["single", "maybeSingle"])
      chain[method] = async () => {
        assert.ok(queue.length, "Unexpected database call");
        return queue.shift();
      };
    return chain;
  },
};
const api = load("src/lib/profile.ts", (name) => {
  if (name === "@/integrations/supabase/client") return { supabase: fakeClient };
  if (name === "@/lib/images")
    return {
      prepareWebImage() {
        throw Error("Unexpected image processing");
      },
    };
  throw Error("Unexpected import");
});
const input = { display_name: "Confirmed", cert_level: null, tank_count: 0, bio: null };
queue = [{ data: null, error: { code: "PGRST116" } }];
await assert.rejects(() => api.updateMyProfile(input, sessionId));
queue = [{ data: { ...original(), ...input }, error: null }];
assert.equal((await api.updateMyProfile(input, sessionId)).display_name, "Confirmed");
const before = queries;
sessionId = "local-account-b";
await assert.rejects(() => api.updateMyProfile(input, "local-account-a"));
await assert.rejects(() => api.uploadAvatar({}, "local-account-a"));
assert.equal(queries, before);
console.log(
  "PASS: no-row save fails, actual saved row is returned and account mismatch is rejected before writing",
);
sessionId = "local-account-a";
queue = [
  { data: null, error: null },
  { data: null, error: { code: "42501" } },
];
await assert.rejects(() => api.getMyProfile());
queue = [
  { data: null, error: null },
  { data: null, error: { code: "23505" } },
  { data: original(), error: null },
];
assert.equal((await api.getMyProfile()).id, sessionId);
console.log(
  "PASS: missing-profile initialization never ignores a failure and safely reads a concurrent creation",
);
const retry = () => {};
let queryIndex = 0;
const hook = load("src/hooks/useProfile.ts", (name) =>
  name === "@tanstack/react-query"
    ? {
        useQuery: () =>
          queryIndex++ === 0
            ? { data: null, isPending: false, isError: true, refetch: retry }
            : { data: null },
      }
    : { getMyProfile() {}, signedAvatarUrl() {} },
);
assert.equal(hook.useProfile().isError, true);
queryIndex = 0;
assert.equal(hook.useProfile().refetch, retry);
console.log("PASS: shared profile hook exposes loading errors and retry");
console.log(
  "Scope: local source-level callback/effect/API-contract checks, not live browser or database acceptance.",
);
