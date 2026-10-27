// Real source modules, synthetic data/canvas only; no private photos or network.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";
const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
function load(path, require = () => ({}), globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(read(path), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      require,
      Blob,
      File,
      AbortSignal,
      setTimeout,
      clearTimeout,
      ...globals,
    },
  );
  return module.exports;
}
const owner = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
const dive = {
  id,
  user_id: owner,
  country: "PRIVATE-COUNTRY",
  region: "PRIVATE-REGION",
  site_name: "PRIVATE-SITE",
  dive_date: "2026-10-20",
  max_depth: 0,
  duration_min: 48,
  water_temp: -2,
  notes: "PRIVATE-NOTE",
  photo_urls: [owner + "/synthetic.png"],
};
let drawn = [],
  drawPositions = [],
  fills = [],
  revoked = [],
  encoded = true,
  imageWidth = 1600;
const canvas = {
  width: 0,
  height: 0,
  getContext() {
    return {
      drawImage() {},
      createLinearGradient() {
        return { addColorStop() {} };
      },
      fillRect(...bounds) {
        fills.push({ color: this.fillStyle, bounds });
      },
      strokeRect() {},
      fillText(text, x, y) {
        drawn.push(text);
        drawPositions.push({ text, x, y, align: this.textAlign });
      },
      measureText(text) {
        return { width: Array.from(text).length * 25 };
      },
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
    };
  },
  toBlob(callback, type) {
    callback(encoded ? new Blob(["synthetic PNG"], { type }) : null);
  },
};
const renderer = load("src/lib/share-card.ts", () => ({}), {
  document: {
    createElement() {
      return canvas;
    },
  },
  Image: class {
    naturalWidth = imageWidth;
    naturalHeight = 1000;
    async decode() {}
  },
  URL: {
    createObjectURL() {
      return "blob:synthetic";
    },
    revokeObjectURL(url) {
      revoked.push(url);
    },
  },
});
const opts = { ...renderer.defaultCardOptions };
assert.equal(opts.note, false);
assert.equal(opts.signature, false);
let lines = renderer.cardLines(dive, opts, "PRIVATE-NOTE", "PRIVATE-NAME", false);
assert.equal(lines.stats[0].value, "0 m");
assert.equal(lines.stats[2].value, "-2 °C");
assert.equal(lines.note, "");
assert.equal(lines.signature, "");
lines = renderer.cardLines(
  { ...dive, max_depth: null },
  { ...opts, location: false, data: false, date: false, note: false, signature: false },
  "PRIVATE-NOTE",
  "PRIVATE-NAME",
  true,
);
assert.equal(lines.title, "OCEAN MEMORY");
assert.equal(lines.location, "");
assert.equal(lines.date, "");
assert.equal(lines.stats.length, 0);
assert.equal(renderer.cardText("a\n\u202eb"), "a  b");
assert.equal(Array.from(renderer.cardText("😀".repeat(300))).length, 160);
const left = renderer.coverCrop(2000, 1000, "left"),
  right = renderer.coverCrop(2000, 1000, "right");
assert.equal(left[0], 0);
assert.equal(right[0], 2000 - (1000 * 1080) / 780);
assert.equal(right[2], (1000 * 1080) / 780);
const signal = new AbortController().signal;
const file = await renderer.renderShareCard(
  new Blob(["synthetic"]),
  dive,
  { ...opts, location: false, date: false, data: false },
  "PRIVATE-NOTE",
  "PRIVATE-NAME",
  false,
  signal,
);
assert.equal(file.name, "SupDiver-memory.png");
assert.equal(file.type, "image/png");
assert.equal(canvas.width, 1080);
assert.equal(canvas.height, 1350);
assert.ok(drawn.includes("OCEAN MEMORY"));
assert.ok(!drawn.some((s) => s.includes("PRIVATE")));
assert.deepEqual(revoked, ["blob:synthetic"]);
drawn = [];
drawPositions = [];
await renderer.renderShareCard(
  null,
  dive,
  { ...opts, note: true, signature: true },
  "長い文章".repeat(50),
  "合成用户",
  false,
  signal,
);
assert.ok(drawn.some((s) => s.includes("合成用户")));
assert.ok(!drawn.some((s) => Array.from(s).length > 50));
assert.ok(fills.some((f) => f.color === "#ffffff" && f.bounds.join(",") === "0,780,1080,570"));
assert.ok(
  drawPositions
    .filter((p) => !["SUPDIVER", "YOUR OCEAN. YOUR STORY."].includes(p.text))
    .every((p) => p.y > 780 && p.y < 1350),
);
const signature = drawPositions.find((p) => p.text.includes("合成用户"));
assert.equal(signature.text, "— 合成用户");
assert.equal(signature.align, "right");
assert.equal(signature.x, 1010);
assert.ok(!drawn.some((s) => s.startsWith("DIVER ·")));
const place = drawPositions.find((p) => p.text === "PRIVATE-COUNTRY · PRIVATE-REGION"),
  title = drawPositions.find((p) => p.text === "PRIVATE-SITE");
assert.ok(title.y - place.y >= 54, "location/title must not overlap at real title font size");
encoded = false;
await assert.rejects(renderer.renderShareCard(null, dive, opts, "", "", true, signal));
encoded = true;
const abort = new AbortController();
abort.abort();
await assert.rejects(renderer.renderShareCard(null, dive, opts, "", "", true, abort.signal));
imageWidth = 50_000;
await assert.rejects(renderer.renderShareCard(new Blob(["x"]), dive, opts, "", "", true, signal));
console.log(
  "PASS: actual PNG renderer uses exact 1080x1350 bitmap, strips hidden fields/control text, wraps long Unicode, preserves real zero/negative/missing values, crops and rejects abort/encode/oversize",
);

let account = owner,
  row = { ...dive },
  queries = [],
  downloads = 0,
  failed = false;
const sb = {
  from(table) {
    const q = {
      select() {
        return q;
      },
      eq(k, v) {
        queries.push([table, k, v]);
        return q;
      },
      abortSignal() {
        return q;
      },
      async maybeSingle() {
        return { data: row, error: failed ? Error("synthetic") : null };
      },
    };
    return q;
  },
  storage: {
    from(bucket) {
      assert.equal(bucket, "dive-photos");
      return {
        async download(path) {
          downloads++;
          assert.equal(path, owner + "/synthetic.png");
          return {
            data: new Blob(["synthetic"], { type: "image/png" }),
            error: failed ? Error("synthetic") : null,
          };
        },
      };
    },
  },
};
const data = load("src/lib/share-card-data.ts", (name) =>
  name.endsWith("/client")
    ? { supabase: sb }
    : {
        PHOTO_BUCKET: "dive-photos",
        requireDiveOwner: async (expected) => {
          if (account !== expected) throw Error("wrong account");
          return account;
        },
      },
);
assert.equal(
  data
    .cardPhotoPaths({
      ...dive,
      photo_urls: [
        owner + "/synthetic.png",
        owner + "/video.mp4",
        "other/x.jpg",
        "https://foreign/x.png",
        owner + "/../x.png",
        owner + "/x.jpg?token=x",
      ],
    })
    .join("|"),
  owner + "/synthetic.png",
);
assert.equal((await data.loadCardPhoto(id, owner, owner + "/synthetic.png", signal)).dive.id, id);
assert.ok(queries.some(([t, k, v]) => t === "dives" && k === "user_id" && v === owner));
await assert.rejects(data.loadCardPhoto(id, owner, "other/x.png", signal));
assert.equal(downloads, 1);
row = { ...dive, photo_urls: [] };
await assert.rejects(data.loadCardPhoto(id, owner, owner + "/synthetic.png", signal));
assert.equal(downloads, 1);
row = { ...dive, user_id: "other" };
await assert.rejects(data.loadCardDive(id, owner));
row = { ...dive };
account = "other";
await assert.rejects(data.loadCardDive(id, owner));
account = owner;
failed = true;
await assert.rejects(data.loadCardDive(id, owner));
failed = false;
console.log(
  "PASS: actual loader scopes record to owner, rechecks membership before Storage read, filters videos/foreign paths, and fails closed on missing/removed/changed-account/read errors",
);
const ui = read("src/routes/_authenticated/share-card.tsx");
for (const guard of [
  "lock.current",
  "stampRef.current !== startedStamp",
  "session.ownerId !== owner",
  "session.epoch !== epoch",
  "URL.revokeObjectURL",
  "controller.current?.abort()",
  "disabled={!ready || busy}",
  "navigator.canShare",
  'navigator.share({ files: [current.file], title: "SupDiver" })',
])
  assert.ok(ui.includes(guard), guard);
assert.ok(!/navigator\.share\([^)]*url:/s.test(ui));
assert.ok(!/\.upload\(|\.insert\(|\.update\(/.test(ui));
assert.ok(read("src/routes/_authenticated/dives/$id.tsx").includes('to="/share-card"'));
assert.ok(read("src/routes/_authenticated/dives/logs.tsx").includes('to="/share-card"'));
console.log(
  "PASS: editor source has synchronous lock, unmount/abort/owner/epoch/stamp guards, generic file-only system share with fallback, two real log entry points and no data writes",
);
