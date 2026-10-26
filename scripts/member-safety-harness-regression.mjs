// Execute the actual runner's read/write boundary with synthetic request data.
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import {
  fixtureReadUrl,
  validateFixtureWrite,
  recoveryOrigin,
  readOwners,
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
