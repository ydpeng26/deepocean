// Executes application API contracts against an isolated in-memory database.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { webcrypto, randomUUID } from "node:crypto";
import ts from "typescript";
function load(file, require, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL("../" + file, import.meta.url), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require,
    console,
    crypto: { subtle: webcrypto.subtle, randomUUID },
    fetch() {
      throw Error("Network forbidden");
    },
    ...globals,
  });
  return module.exports;
}
function database() {
  const state = {
    owner: "fixture-owner",
    tables: { marine_encounters: new Map(), gear_items: new Map() },
    photos: new Set(),
    removed: [],
    writes: 0,
    fail: null,
  };
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: state.owner } } } }) },
    storage: {
      from: () => ({
        upload: async (path) => {
          if (state.photos.has(path)) return { error: { statusCode: "409" } };
          state.photos.add(path);
          return { error: null };
        },
        remove: async (paths) => {
          state.removed.push(...paths);
          paths.forEach((path) => state.photos.delete(path));
          return { error: null };
        },
      }),
    },
    from(table) {
      let operation = "select",
        payload,
        filters = [];
      const execute = (single = false) => {
        if (table === "profiles") return { data: { display_name: "Fixture" }, error: null };
        const rows = state.tables[table];
        const matches = (row) => filters.every(([key, value]) => row[key] === value);
        let data;
        if (operation === "insert") {
          if (rows.has(payload.id)) return { data: null, error: { code: "23505" } };
          if (state.fail === "before") {
            state.fail = null;
            return { data: null, error: Error("synthetic failure") };
          }
          data = { ...payload };
          rows.set(data.id, data);
          state.writes++;
        } else if (operation === "update") {
          data = [...rows.values()].find(matches);
          if (data) {
            data = { ...data, ...payload };
            rows.set(data.id, data);
            state.writes++;
          }
        } else data = [...rows.values()].filter(matches);
        if (operation !== "select" && state.fail === "lost") {
          state.fail = null;
          return { data: null, error: Error("synthetic lost response") };
        }
        if (Array.isArray(data) && single) data = data[0] ?? null;
        return { data: data ?? null, error: single && !data ? Error("No returned row") : null };
      };
      const q = new Proxy(
        {},
        {
          get: (_, key) => {
            if (key === "then") return (resolve) => Promise.resolve(resolve(execute()));
            if (key === "single") return async () => execute(true);
            if (key === "maybeSingle")
              return async () => {
                const result = execute(false);
                return result.data instanceof Array ? { ...result, data: result.data[0] ?? null } : result;
              };
            return (...args) => {
              if (key === "insert" || key === "update") {
                operation = key;
                payload = args[0];
              }
              if (key === "eq") filters.push(args);
              return q;
            };
          },
        },
      );
      return q;
    },
  };
  const require = (name) =>
    name.endsWith("/client")
      ? { supabase }
      : {
          prepareWebImage: async () => ({
            arrayBuffer: async () => new TextEncoder().encode("synthetic-image").buffer,
          }),
        };
  return {
    state,
    marine: load("src/lib/marine.ts", require),
    gear: load("src/lib/gear.ts", require),
  };
}
const encounter = {
  file: { type: "image/png", size: 100 },
  species_name: "Fixture",
  encountered_on: "2026-10-21",
  location: "Fixture",
  needs_help: false,
};
const gearInput = {
  category: "mask",
  brand: "Fixture",
  model: "M",
  purchased_on: null,
  next_service_on: null,
  serial_number: null,
  dive_count: 1,
  notes: null,
  photo_path: null,
};
{
  const { state, marine } = database();
  state.fail = "lost";
  await assert.rejects(marine.saveEncounter(encounter, undefined, "stable-id", "fixture-owner"));
  const saved = state.tables.marine_encounters.get("stable-id");
  assert(saved);
  assert(state.photos.has(saved.photo_path));
  assert.equal(state.removed.length, 0);
  const retried = await marine.saveEncounter(encounter, undefined, "stable-id", "fixture-owner");
  assert.equal(retried.id, "stable-id");
  assert.equal(state.tables.marine_encounters.size, 1);
  assert.equal(state.photos.size, 1);
  assert.equal(state.writes, 1);
  await assert.rejects(
    marine.saveEncounter(
      { ...encounter, location: "Changed after ambiguous commit" },
      undefined,
      "stable-id",
      "fixture-owner",
    ),
  );
  assert.equal(state.tables.marine_encounters.get("stable-id").location, "Fixture");
  console.log(
    "PASS: marine lost response preserves referenced photo; identical retry confirms one row; changed retry rejected",
  );
}
{
  const { state, marine } = database();
  state.photos.add("fixture-owner/old.jpg");
  await assert.rejects(
    marine.saveEncounter(
      encounter,
      { id: "missing", user_id: "fixture-owner", photo_path: "fixture-owner/old.jpg" },
      "missing",
      "fixture-owner",
    ),
  );
  assert(state.photos.has("fixture-owner/old.jpg"));
  assert.equal(state.removed.length, 0);
  console.log("PASS: marine zero-row edit is an error and cannot delete old or new photo");
}
{
  const { state, marine } = database();
  state.fail = "before";
  await assert.rejects(marine.saveEncounter(encounter, undefined, "stable-id", "fixture-owner"));
  assert.equal(state.tables.marine_encounters.size, 0);
  assert.equal(state.photos.size, 1);
  await marine.saveEncounter(encounter, undefined, "stable-id", "fixture-owner");
  assert.equal(state.tables.marine_encounters.size, 1);
  assert.equal(state.photos.size, 1);
  console.log("PASS: marine definite failure retains private upload and retry reuses it");
}
{
  const { state, marine, gear } = database();
  await assert.rejects(marine.saveEncounter(encounter, undefined, "stable-id", "other-owner"));
  await assert.rejects(gear.createGear(gearInput, "stable-id", "other-owner"));
  assert.equal(state.photos.size, 0);
  assert.equal(state.writes, 0);
  console.log("PASS: expected account mismatch blocks marine and gear writes before upload");
}
{
  const { state, gear } = database();
  state.fail = "lost";
  await assert.rejects(gear.createGear(gearInput, "stable-id", "fixture-owner"));
  const saved = await gear.createGear(gearInput, "stable-id", "fixture-owner");
  assert.equal(saved.id, "stable-id");
  assert.equal(state.tables.gear_items.size, 1);
  assert.equal(state.writes, 1);
  await assert.rejects(
    gear.createGear({ ...gearInput, brand: "changed" }, "stable-id", "fixture-owner"),
  );
  await assert.rejects(gear.updateGear("missing", gearInput, "fixture-owner", "v0"));
  for (const count of [-1, 1.5, Infinity, 2147483648])
    assert.throws(() => gear.validateGear({ ...gearInput, dive_count: count }));
  console.log(
    "PASS: gear stable retry, changed retry rejection, zero-row edit failure and integer bounds",
  );
}
function nodes(value, result = []) {
  if (Array.isArray(value)) value.forEach((v) => nodes(v, result));
  else if (value && typeof value === "object") {
    if (value.type) result.push(value);
    nodes(value.props?.children, result);
  }
  return result;
}
function content(value) {
  if (Array.isArray(value)) return value.map(content).join("");
  if (value && typeof value === "object") return content(value.props?.children);
  return value == null ? "" : String(value);
}
const GearConflictError = database().gear.GearConflictError;
function gearEditor(readError = false) {
  const state = {
    items: readError
      ? undefined
      : [
          {
            ...gearInput,
            id: "fixture-gear",
            user_id: "fixture-owner",
            created_at: "2026-10-22",
            updated_at: "v0",
          },
        ],
    cells: [],
    effects: new Map(),
    readError,
    writes: [],
    saving: null,
  };
  let cursor = 0,
    effects = [],
    dirty = false;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in state.cells)) state.cells[i] = typeof initial === "function" ? initial() : initial;
      return [
        state.cells[i],
        (value) => {
          const next = typeof value === "function" ? value(state.cells[i]) : value;
          dirty ||= !Object.is(next, state.cells[i]);
          state.cells[i] = next;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      return (state.cells[i] ??= { current: initial });
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
  const jsx = (type, props) => ({ type, props });
  const component = load(
    "src/routes/_authenticated/gear.tsx",
    (name) => {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "@tanstack/react-router")
        return { createFileRoute: () => (options) => options, Link: "Link" };
      if (name === "@tanstack/react-query")
        return {
          useQuery: () => ({
            data: state.items,
            isPending: false,
            isError: state.readError,
            async refetch() {
              if (state.refetchError) return { error: Error("Read failed") };
              state.readError = false;
              return { data: state.items };
            },
          }),
          useQueryClient: () => ({
            setQueryData: (_key, fn) => {
              state.writes.push("cache");
              state.items = fn(state.items);
            },
            invalidateQueries: async () => {},
          }),
        };
      if (name === "@/hooks/useProfile")
        return {
          useProfile: () => ({
            profile: { id: "fixture-owner" },
            isPending: false,
            isError: false,
            refetch() {},
          }),
        };
      if (name === "@/lib/gear")
        return {
          GearConflictError,
          validateGear: (input) => ({ ...input }),
          updateGear: async (id, input, owner, revision) => {
            state.writes.push({ id, input, owner, revision });
            return new Promise((resolve, reject) => {
              state.saving = { resolve, reject };
            });
          },
        };
      if (name === "sonner") return { toast: { error() {}, success() {} } };
      if (name === "@/i18n/liveCopy") return { useLiveCopy: () => (x) => x };
      if (name === "@/i18n/LanguageProvider") return { useLanguage: () => ({ language: "zh-CN" }) };
      if (name === "@/hooks/useModalFocus") return { useModalFocus() {} };
      return new Proxy({}, { get: (_, key) => key });
    },
    { confirm: () => state.confirm !== false },
  ).Route.component;
  state.render = () => {
    for (let n = 0; n < 8; n++) {
      cursor = 0;
      effects = [];
      dirty = false;
      state.tree = component();
      for (const effect of effects) effect();
      if (!dirty) return;
    }
    throw Error("Unsettled editor");
  };
  state.field = (label) => {
    const associated = nodes(state.tree).find((node) => node.type === "Label" && content(node) === label);
    return nodes(state.tree).find((node) => node.props?.id === associated?.props.htmlFor && ["Input", "Textarea", "select"].includes(node.type));
  };
  state.button = (label) =>
    nodes(state.tree).find((node) => node.type === "Button" && content(node).includes(label));
  state.render();
  return state;
}
{
  const editor = gearEditor();
  for (const label of ["装备类型", "品牌", "型号", "购入日期", "下次保养日期", "累计使用次数", "备注"])
    assert(editor.field(label), "Explicit accessible label must resolve one control: " + label);
  assert.equal(nodes(editor.tree).filter((n) => n.type === "label").length, 0, "No nested native labels");
  editor.field("品牌").props.onChange({ target: { value: "Unsaved" } });
  editor.render();
  editor.items = [{ ...editor.items[0], brand: "Server refreshed" }];
  editor.render();
  assert.equal(editor.field("品牌").props.value, "Unsaved");
  const failed = gearEditor(true);
  assert(nodes(failed.tree).some((node) => node.props?.role === "alert"));
  assert.equal(failed.field("品牌"), undefined);
  console.log(
    "PASS: actual gear component preserves draft across refreshed row and blocks blank form on load error",
  );
}
{
  const editor = gearEditor();
  editor.field("品牌").props.onChange({ target: { value: "Captured" } });
  editor.render();
  const click = editor.button("保存装备").props.onClick;
  click();
  click();
  editor.render();
  assert.equal(editor.writes.length, 1);
  assert(editor.button("新增装备").props.disabled);
  assert(nodes(editor.tree).find((node) => node.type === "fieldset").props.disabled);
  editor.button("新增装备").props.onClick();
  editor.field("品牌").props.onChange({ target: { value: "Must be ignored" } });
  editor.render();
  assert.equal(editor.field("品牌").props.value, "Captured");
  editor.saving.reject(Error("Fixture failure"));
  await new Promise((resolve) => setImmediate(resolve));
  editor.render();
  assert.equal(editor.field("品牌").props.value, "Captured");
  assert.equal(editor.button("新增装备").props.disabled, false);
  editor.button("保存装备").props.onClick();
  editor.render();
  for (const effect of editor.effects.values()) effect.cleanup?.();
  editor.saving.resolve({ ...editor.items[0], brand: "Captured" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(editor.writes.filter((value) => value === "cache").length, 0);
  console.log(
    "PASS: gear shared synchronous lock, retained failure draft and no late cache write after unmount",
  );
}
console.log(
  "Scope: local mocked callbacks/API checks, no real credentials, network or data changes.",
);
{
  const editor = gearEditor();
  editor.field("品牌").props.onChange({ target: { value: "Keep stale draft" } });
  editor.render();
  editor.items = [{ ...editor.items[0], brand: "Other window", updated_at: "v1" }];
  editor.render();
  editor.button("保存装备").props.onClick();
  editor.render();
  assert.equal(
    editor.writes[0].revision,
    "v0",
    "Background refetch must not advance editor revision",
  );
  editor.saving.reject(new GearConflictError());
  await new Promise((resolve) => setImmediate(resolve));
  editor.render();
  assert.equal(editor.field("品牌").props.value, "Keep stale draft");
  assert(editor.button("保存装备").props.disabled);
  assert(nodes(editor.tree).some((n) => n.props?.role === "alert"));
  editor.confirm = false;
  editor.button("加载最新装备记录").props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  editor.render();
  assert.equal(editor.field("品牌").props.value, "Keep stale draft");
  editor.confirm = true;
  editor.refetchError = true;
  editor.button("加载最新装备记录").props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  editor.render();
  assert.equal(editor.field("品牌").props.value, "Keep stale draft");
  editor.refetchError = false;
  editor.button("加载最新装备记录").props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  editor.render();
  assert.equal(editor.field("品牌").props.value, "Other window");
  assert(!editor.button("保存装备").props.disabled);
  editor.button("保存装备").props.onClick();
  editor.render();
  assert.equal(editor.writes.at(-1).revision, "v1");
  editor.saving.reject(Error("Cleanup"));
  await new Promise((resolve) => setImmediate(resolve));
  console.log(
    "PASS: actual editor pins original revision across background refresh, retains conflict draft, confirms reload, preserves input on cancel/read failure, and adopts latest baseline only after explicit reload",
  );
}
{
  const editor = gearEditor();
  editor.field("备注").props.onChange({ target: { value: "Keep deleted-record draft" } });
  editor.render();
  editor.items = [];
  editor.render();
  assert.equal(editor.field("备注").props.value, "Keep deleted-record draft");
  assert(editor.button("保存装备").props.disabled);
  assert(nodes(editor.tree).some((n) => n.props?.role === "alert"));
  editor.button("加载最新装备记录").props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  editor.render();
  assert.equal(editor.field("备注").props.value, "Keep deleted-record draft");
  assert(editor.button("保存装备").props.disabled);
  console.log(
    "PASS: background deletion keeps visible copyable draft and never creates a replacement record",
  );
}
