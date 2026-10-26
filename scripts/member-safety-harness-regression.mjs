// Execute the actual runner's read/write boundary with synthetic request data.
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { inflateSync } from "node:zlib";
import {
  fixtureReadUrl,
  validateFixtureWrite,
  recoveryOrigin,
  readOwners,
  requireUniqueGearControl,
  memberBoundaryReason,
} from "./recovery-member-safety.mjs";
const owner = "synthetic-owner",
  known = Object.fromEntries(
    ["gear_items", "diver_certificates", "marine_encounters", "forum_posts", "forum_comments"].map(
      (t) => [t, new Set(["fixture"])],
    ),
  );
for (const [table, key] of Object.entries(readOwners)) {
  const url = new URL(
    fixtureReadUrl(recoveryOrigin + "/rest/v1/" + table + "?select=*&order=id", owner),
  );
  assert.equal(url.searchParams.get(key), "eq." + owner);
  assert.equal(url.searchParams.get("order"), "id");
  assert.throws(() =>
    fixtureReadUrl(recoveryOrigin + "/rest/v1/" + table + "?" + key + "=eq.other", owner),
  );
}
const suggestions = new URL(
  fixtureReadUrl(
    recoveryOrigin + "/rest/v1/marine_suggestions?encounter_id=eq.fixture&select=*",
    owner,
  ),
);
assert.equal(suggestions.searchParams.get("user_id"), "eq." + owner);
assert.equal(suggestions.searchParams.get("encounter_id"), "eq.fixture");
assert(!validateFixtureWrite(suggestions.href, "PATCH", {}, owner, known));
const check = (value, code) => {
  if (!value) throw Error(code);
};
let hydrated = false,
  waited = false;
await requireUniqueGearControl(
  {
    async waitFor(options) {
      assert.equal(options.state, "visible");
      waited = true;
      hydrated = true;
    },
    async count() {
      assert(waited, "Do not count before hydration");
      return hydrated ? 1 : 0;
    },
  },
  check,
);
await assert.rejects(
  requireUniqueGearControl(
    {
      async waitFor() {},
      async count() {
        return 2;
      },
    },
    check,
  ),
  /unique_accessible_gear_control/,
);
await assert.rejects(
  requireUniqueGearControl(
    {
      async waitFor() {
        throw Error("Missing control timeout");
      },
      async count() {
        throw Error("Not reached");
      },
    },
    check,
  ),
  /Missing control timeout/,
);
for (const code of ["read_origin", "read_table", "read_other_owner"])
  assert.equal(memberBoundaryReason(Error(code)), code);
assert.equal(
  memberBoundaryReason(Error("private URL, token and arbitrary message")),
  "request_boundary",
);
console.log(
  "PASS: real label helper waits for visible hydrated control before uniqueness check; missing/duplicate still fail; own-fixture suggestions read is narrowed, never writable; boundary reasons remain allowlisted",
);
for (const url of [
  "https://www.supdiver.com/rest/v1/profiles",
  "https://zmhtlhpeulhhcvlnjdrb.supabase.co/rest/v1/profiles",
  recoveryOrigin + "/rest/v1/auth_users",
  recoveryOrigin + "/rest/v1/rpc/get_public_diver_profile",
])
  assert.throws(() => fixtureReadUrl(url, owner));
for (const table of ["gear_items", "diver_certificates", "forum_posts", "forum_comments"]) {
  const url =
    recoveryOrigin +
    "/rest/v1/" +
    table +
    "?id=eq.fixture&user_id=eq." +
    owner +
    "&updated_at=eq.v0";
  assert(validateFixtureWrite(url, "PATCH", { body: "synthetic" }, owner, known));
  assert(validateFixtureWrite(url, "DELETE", null, owner, known));
  for (const bad of [
    url.replace("eq.fixture", "eq.other"),
    url.replace("eq." + owner, "eq.other"),
    url.replace("&updated_at=eq.v0", ""),
    url.replace(recoveryOrigin, "https://www.supdiver.com"),
  ])
    assert(!validateFixtureWrite(bad, "PATCH", {}, owner, known));
  assert(!validateFixtureWrite(url, "POST", {}, owner, known));
  assert(!validateFixtureWrite(url, "PATCH", { user_id: "other" }, owner, known));
}
const profile =
  recoveryOrigin +
  "/rest/v1/profiles?id=eq." +
  owner +
  "&display_name=is.null&bio=is.null&cert_level=is.null&tank_count=eq.0";
assert(validateFixtureWrite(profile, "PATCH", { bio: "Synthetic" }, owner, known));
assert(!validateFixtureWrite(profile, "PATCH", { avatar_url: "other/photo.jpg" }, owner, known));
assert(!validateFixtureWrite(profile.replace("&bio=is.null", ""), "PATCH", {}, owner, known));
const marine =
  recoveryOrigin +
  "/rest/v1/marine_encounters?id=eq.fixture&user_id=eq." +
  owner +
  "&species_name=eq.Fish&encountered_on=eq.2026-10-01&location=eq.A&needs_help=eq.false&photo_path=eq.generated&created_at=eq.created";
assert(validateFixtureWrite(marine, "PATCH", { location: "Synthetic" }, owner, known));
assert(
  !validateFixtureWrite(marine.replace("&created_at=eq.created", ""), "DELETE", null, owner, known),
);
console.log(
  "PASS: actual harness narrows all browser list reads to generated owner; rejects foreign/RPC reads, missing baseline, foreign owner/id, inserts and production writes",
);
const local = spawnSync(process.execPath, ["scripts/recovery-member-safety.mjs"], {
  encoding: "utf8",
  env: { PATH: process.env.PATH },
});
assert.equal(local.status, 1);
assert(
  local.stdout.includes("github_cloud_only") && local.stdout.includes("no_temporary_owner_created"),
);
const source = fs.readFileSync(new URL("./recovery-member-safety.mjs", import.meta.url), "utf8");
assert(
  source.indexOf('check(process.env.GITHUB_ACTIONS === "true"') <
    source.indexOf("admin = process.env.RECOVERY_SERVICE_ROLE_KEY"),
);
const png = Buffer.from(source.match(/"(iVBOR[^"\s]+)"/)[1], "base64");
assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
let offset = 8,
  inflated;
for (; offset < png.length;) {
  const length = png.readUInt32BE(offset),
    chunk = png.subarray(offset + 4, offset + 8 + length);
  let crc = 0xffffffff;
  for (const byte of chunk) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  assert.equal(
    (crc ^ 0xffffffff) >>> 0,
    png.readUInt32BE(offset + 8 + length),
    "Generated image chunk checksum",
  );
  if (chunk.subarray(0, 4).toString() === "IDAT") inflated = inflateSync(chunk.subarray(4));
  offset += length + 12;
}
assert.equal(inflated.length, 5);
assert.equal(offset, png.length);
assert(
  source.indexOf('check(process.env.GITHUB_ACTIONS === "true"') < source.indexOf("await readFile("),
);
assert(
  source.indexOf('advance("fixed_site_preflight")') < source.indexOf('advance("temporary_owner")'),
);
for (const marker of [
  "recovery_member_safety === marker",
  "session_revocation",
  "generated_image_absence",
  "fixture_rows_absent",
  "auth_absence",
  "480000",
  "native_bfcache_camera_codec_coverage_not_claimed",
])
  assert(source.includes(marker), marker);
console.log(
  "PASS: local guard fails before credentials/network; preflight before account; bounded deadline, exact owner/image/row cleanup and no native/codec overclaim",
);
