// Actual application APIs, atomic in-memory predicates. No credentials or network.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
function fixture(table, original, file) {
  const s = {
    row: { ...original },
    owner: "owner",
    writes: 0,
    removed: [],
    lost: false,
    race: null,
    serial: 0,
  };
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: s.owner } } } }) },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async (paths) => {
          s.removed.push(...paths);
          return { error: null };
        },
      }),
    },
    from(name) {
      let action = "read",
        payload,
        predicates = [];
      const q = {
        select() {
          return q;
        },
        eq(key, value) {
          predicates.push((row) => row[key] === value);
          return q;
        },
        is(key, value) {
          predicates.push((row) => row[key] === value);
          return q;
        },
        insert(values) {
          action = "insert";
          payload = values;
          return q;
        },
        update(values) {
          action = "update";
          payload = values;
          return q;
        },
        delete() {
          action = "delete";
          return q;
        },
        async maybeSingle() {
          if (name === "profiles" && table === "marine_encounters")
            return { data: { display_name: "Synthetic" }, error: null };
          assert.equal(name, table);
          if (action !== "read") {
            const race = s.race;
            s.race = null;
            race?.();
          }
          if (action === "insert") {
            if (s.row) return { data: null, error: { code: "23505" } };
            s.row = {
              ...payload,
              deleted_at: null,
              created_at: "created",
              updated_at: "v" + ++s.serial,
            };
            s.writes++;
          } else if (!s.row || !predicates.every((test) => test(s.row)))
            return { data: null, error: null };
          else if (action === "update") {
            s.row = { ...s.row, ...payload, updated_at: "v" + ++s.serial };
            s.writes++;
          }
          const data = { ...s.row };
          if (action === "delete") {
            s.row = null;
            s.writes++;
          }
          if (action !== "read" && s.lost) {
            s.lost = false;
            return { data: null, error: Error("Lost reply") };
          }
          return { data, error: null };
        },
      };
      q.single = q.maybeSingle;
      return q;
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(new URL("../" + file, import.meta.url), "utf8"), {
      compilerOptions: { module: 1, target: 9 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require(name) {
        if (name.endsWith("/client")) return { supabase: client };
        if (name.endsWith("/images")) return { prepareWebImage: async () => ({}) };
        throw Error(name);
      },
      fetch() {
        throw Error("Network forbidden");
      },
      crypto: { randomUUID: () => "generated-avatar" },
    },
  );
  return { s, api: module.exports };
}
const profile = {
  id: "owner",
  display_name: null,
  cert_level: null,
  tank_count: 0,
  bio: null,
  avatar_url: null,
};
{
  const { s, api } = fixture("profiles", profile, "src/lib/profile.ts");
  const first = { display_name: "A", cert_level: null, tank_count: 1, bio: "A" };
  await api.updateMyProfile(first, "owner", profile);
  const count = s.writes;
  await assert.rejects(
    api.updateMyProfile({ ...first, bio: "B stale" }, "owner", profile),
    api.ProfileConflictError,
  );
  assert.equal(s.row.bio, "A");
  await api.updateMyProfile(first, "owner", profile);
  assert.equal(s.writes, count);
  const latest = { ...s.row };
  s.race = () => {
    s.row.bio = "Racing write";
  };
  await assert.rejects(api.updateMyProfile({ ...first, bio: "Race loser" }, "owner", latest));
  assert.equal(s.row.bio, "Racing write");
  s.row = null;
  await assert.rejects(api.updateMyProfile(first, "owner", latest));
  assert.equal(s.row, null);
  await assert.rejects(api.updateMyProfile(first, "owner"));
  s.owner = "other";
  await assert.rejects(api.updateMyProfile(first, "owner", latest));
  console.log(
    "PASS: profile null-aware atomic baseline, stale edit/race rejection, identical retry without rewrite, missing/deleted/changed-owner fail closed",
  );
}
{
  const { s, api } = fixture("profiles", profile, "src/lib/profile.ts");
  await api.uploadAvatar({}, "owner", null);
  assert.equal(s.row.avatar_url, "owner/generated-avatar.jpg");
  assert.equal(s.row.bio, null);
  await assert.rejects(api.uploadAvatar({}, "owner", null), api.ProfileConflictError);
  assert.equal(s.writes, 1);
  assert.equal(s.removed.length, 0);
  s.row.avatar_url = "owner/current.jpg";
  s.race = () => {
    s.row.avatar_url = "owner/newer.jpg";
  };
  await assert.rejects(
    api.uploadAvatar({}, "owner", "owner/current.jpg"),
    api.ProfileConflictError,
  );
  assert.equal(s.row.avatar_url, "owner/newer.jpg");
  console.log(
    "PASS: avatar field-only CAS rejects stale/racing replacements without overwriting text or deleting photos",
  );
}
const certInput = {
  agency: "PADI",
  level: "OW",
  certificate_number: null,
  issued_on: null,
  issued_at: null,
  is_public: false,
  front_photo_path: null,
};
{
  const { s, api } = fixture("diver_certificates", {}, "src/lib/certificates.ts");
  s.row = null;
  s.lost = true;
  await assert.rejects(api.saveCertificate("cert", certInput, "owner", null));
  await api.saveCertificate("cert", certInput, "owner", null);
  assert.equal(s.writes, 1);
  const baseline = s.row.updated_at;
  const saved = await api.saveCertificate(
    "cert",
    { ...certInput, level: "AOW" },
    "owner",
    baseline,
  );
  await assert.rejects(
    api.saveCertificate("cert", { ...certInput, level: "Stale" }, "owner", baseline),
    api.CertificateConflictError,
  );
  const writes = s.writes;
  await api.saveCertificate("cert", { ...certInput, level: "AOW" }, "owner", baseline);
  assert.equal(s.writes, writes);
  await assert.rejects(
    api.archiveCertificate("cert", true, "owner", baseline),
    api.CertificateConflictError,
  );
  const archived = await api.archiveCertificate("cert", true, "owner", saved.updated_at);
  await assert.rejects(api.saveCertificate("cert", certInput, "owner", null));
  await assert.rejects(api.saveCertificate("cert", certInput, "owner", saved.updated_at));
  await assert.rejects(api.archiveCertificate("cert", false, "owner", saved.updated_at));
  const restored = await api.archiveCertificate("cert", false, "owner", archived.updated_at);
  assert.equal(restored.deleted_at, null);
  s.row = null;
  await assert.rejects(api.saveCertificate("cert", certInput, "owner", restored.updated_at));
  assert.equal(s.row, null);
  console.log(
    "PASS: certificate insert-only stable retry, stale edit/archive/undo rejection, archived/deleted rows not resurrected, exact undo revision",
  );
}
const encounter = {
  id: "enc",
  user_id: "owner",
  author_name: "Synthetic",
  species_name: "Fish",
  location: "A",
  encountered_on: "2026-10-26",
  needs_help: false,
  photo_path: "owner/photo.jpg",
  created_at: "created",
};
{
  const { s, api } = fixture("marine_encounters", encounter, "src/lib/marine.ts");
  const input = {
    species_name: "Fish",
    location: "B",
    encountered_on: "2026-10-26",
    needs_help: false,
  };
  s.lost = true;
  await assert.rejects(api.saveEncounter(input, encounter, "enc", "owner"));
  assert.equal(s.row.location, "B");
  const writes = s.writes;
  await api.saveEncounter(input, encounter, "enc", "owner");
  assert.equal(s.writes, writes);
  await assert.rejects(
    api.saveEncounter({ ...input, location: "Stale" }, encounter, "enc", "owner"),
    api.EncounterConflictError,
  );
  await assert.rejects(api.deleteEncounter(encounter), api.EncounterConflictError);
  assert.equal(s.removed.length, 0);
  const latest = { ...s.row };
  s.race = () => {
    s.row.location = "Race";
  };
  await assert.rejects(api.saveEncounter({ ...input, location: "Loser" }, latest, "enc", "owner"));
  assert.equal(s.row.location, "Race");
  const fresh = { ...s.row };
  await api.deleteEncounter(fresh);
  assert.equal(s.row, null);
  assert.deepEqual(s.removed, ["owner/photo.jpg"]);
  await assert.rejects(api.saveEncounter(input, fresh, "enc", "owner"));
  assert.equal(s.row, null);
  console.log(
    "PASS: encounter atomic field baseline, real predicate race, lost-reply confirmation, stale delete retains photo, missing row not recreated",
  );
}
for (const comment of [false, true]) {
  const row = comment
    ? {
        id: "item",
        user_id: "owner",
        post_id: "post",
        body: "A",
        author_name: "Synthetic",
        created_at: "created",
        updated_at: "v0",
      }
    : {
        id: "item",
        user_id: "owner",
        title: "Title",
        body: "A",
        topic: "stories",
        location: null,
        linked_dive_id: null,
        updated_at: "v0",
      };
  const { s, api } = fixture(comment ? "forum_comments" : "forum_posts", row, "src/lib/forum.ts");
  const save = (body, revision) =>
    comment
      ? api.updateForumComment("item", "post", body, "owner", revision)
      : api.updateForumPost("item", { title: "Title", body, topic: "stories" }, "owner", revision);
  const remove = (revision) =>
    comment
      ? api.deleteForumComment("item", "post", "owner", revision)
      : api.deleteForumPost("item", "owner", revision);
  s.lost = true;
  await assert.rejects(save("B", "v0"));
  assert.equal(s.row.body, "B");
  const writes = s.writes;
  await save("B", "v0");
  assert.equal(s.writes, writes);
  await assert.rejects(save("Stale", "v0"), api.ForumConflictError);
  await assert.rejects(remove("v0"), api.ForumConflictError);
  const version = s.row.updated_at;
  s.race = () => {
    s.row.updated_at = "race";
    s.row.body = "Race";
  };
  await assert.rejects(save("Loser", version));
  assert.equal(s.row.body, "Race");
  await assert.rejects(save("No baseline", undefined));
  await remove("race");
  assert.equal(s.row, null);
  await assert.rejects(save("Resurrect", "race"));
  assert.equal(s.row, null);
  console.log(
    "PASS: forum " +
      (comment ? "comment" : "post") +
      " stale edit/delete/race, lost-reply idempotence, missing baseline and deleted-row non-resurrection",
  );
}
