// Executes actual gear APIs against an in-memory atomic-filter model. No network.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";
const input = {
  category: "mask",
  brand: "Synthetic",
  model: "M",
  purchased_on: null,
  next_service_on: null,
  serial_number: null,
  dive_count: 0,
  notes: null,
  photo_path: null,
};
function fixture() {
  let row = { ...input, id: "item", user_id: "owner", created_at: "created", updated_at: "v0" },
    owner = "owner",
    serial = 0,
    writes = 0,
    lost = false,
    race,
    failure;
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: owner } } } }) },
    from(table) {
      assert.equal(table, "gear_items");
      let action = "read",
        payload,
        filters = [];
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          filters.push([k, v]);
          return q;
        },
        update(v) {
          action = "update";
          payload = v;
          return q;
        },
        delete() {
          action = "delete";
          return q;
        },
        async maybeSingle() {
          if (action !== "read") {
            const next = race;
            race = null;
            next?.();
          }
          if (failure) {
            const e = failure;
            failure = null;
            return { data: null, error: e };
          }
          if (!row || !filters.every(([k, v]) => row[k] === v)) return { data: null, error: null };
          let data;
          if (action === "update") {
            row = { ...row, ...payload, updated_at: "v" + ++serial };
            writes++;
            data = { ...row };
          } else if (action === "delete") {
            data = { id: row.id };
            row = null;
            writes++;
          } else data = { ...row };
          if (lost && action !== "read") {
            lost = false;
            return { data: null, error: Error("Lost response") };
          }
          return { data, error: null };
        },
      };
      return q;
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(new URL("../src/lib/gear.ts", import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require(name) {
        if (name.endsWith("/client")) return { supabase: client };
        if (name.endsWith("/images")) return {};
        throw Error(name);
      },
      fetch() {
        throw Error("Network forbidden");
      },
    },
  );
  return {
    api: exports,
    get row() {
      return row;
    },
    get writes() {
      return writes;
    },
    lost() {
      lost = true;
    },
    race(fn) {
      race = fn;
    },
    replace(v) {
      row = v;
    },
    owner(v) {
      owner = v;
    },
    fail() {
      failure = Error("Synthetic failure");
    },
  };
}
{
  const f = fixture();
  const results = await Promise.allSettled([
    f.api.updateGear("item", { ...input, notes: "writer-A" }, "owner", "v0"),
    f.api.updateGear("item", { ...input, notes: "writer-B" }, "owner", "v0"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.filter((r) => r.status === "rejected" && r.reason.name === "GearConflictError").length,
    1,
  );
  assert.equal(f.writes, 1);
  console.log("PASS: simultaneous same-baseline writers allow exactly one write");
}
{
  const f = fixture(),
    baseline = f.row.updated_at;
  await f.api.updateGear("item", { ...input, notes: "A", dive_count: 7 }, "owner", baseline);
  await assert.rejects(f.api.updateGear("item", { ...input, model: "B" }, "owner", baseline), {
    name: "GearConflictError",
  });
  assert.equal(f.row.notes, "A");
  assert.equal(f.row.dive_count, 7);
  assert.equal(f.writes, 1);
  await assert.rejects(f.api.deleteGear("item", "owner", baseline), { name: "GearConflictError" });
  assert.equal(f.writes, 1);
  console.log("PASS: stale edit and stale delete preserve the newer row");
}
{
  const f = fixture();
  f.race(() => f.replace({ ...f.row, notes: "raced", updated_at: "raced" }));
  await assert.rejects(f.api.updateGear("item", input, "owner", "v0"), {
    name: "GearConflictError",
  });
  assert.equal(f.row.notes, "raced");
  assert.equal(f.writes, 0);
  f.race(() => f.replace(null));
  await assert.rejects(f.api.updateGear("item", input, "owner", "raced"), {
    name: "GearConflictError",
  });
  assert.equal(f.row, null);
  await assert.rejects(f.api.updateGear("item", input, "owner", ""), { name: "GearConflictError" });
  console.log("PASS: atomic write predicate blocks racing updates/deletion and missing baseline");
}
{
  const f = fixture(),
    values = { ...input, notes: "committed" };
  f.lost();
  await assert.rejects(f.api.updateGear("item", values, "owner", "v0"));
  const confirmed = await f.api.updateGear("item", values, "owner", "v0");
  assert.equal(confirmed.notes, "committed");
  assert.equal(f.writes, 1);
  await assert.rejects(
    f.api.updateGear("item", { ...values, notes: "different retry" }, "owner", "v0"),
    { name: "GearConflictError" },
  );
  assert.equal(f.writes, 1);
  await f.api.updateGear("item", { ...values, model: "fresh" }, "owner", confirmed.updated_at);
  assert.equal(f.writes, 2);
  await f.api.deleteGear("item", "owner", f.row.updated_at);
  assert.equal(f.row, null);
  console.log(
    "PASS: lost-reply identical confirmation without duplicate write, changed retry denied, fresh edit/delete pass",
  );
}
{
  const f = fixture();
  f.owner("other");
  await assert.rejects(f.api.updateGear("item", input, "owner", "v0"));
  await assert.rejects(f.api.deleteGear("item", "owner", "v0"));
  assert.equal(f.writes, 0);
  f.owner("owner");
  f.fail();
  await assert.rejects(f.api.updateGear("item", input, "owner", "v0"));
  assert.equal(f.writes, 0);
  console.log("PASS: account mismatch and database error fail closed");
}
