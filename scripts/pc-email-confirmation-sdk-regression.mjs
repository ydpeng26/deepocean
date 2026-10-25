// Installed SDK in a synthetic window/storage model. Every fetch is mocked;
// no real browser, account, confirmation link, mail or backend request.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
const module = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(new URL("../src/lib/email-confirmation-flow.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: 1, target: 9 } },
  ).outputText,
  { module, exports: module.exports, require: () => ({}) },
);
const { createEmailConfirmationFlow } = module.exports;
const previous = Object.fromEntries(
  ["window", "document", "BroadcastChannel"].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]),
);
const user = {
  id: "00000000-0000-4000-8000-000000000726",
  aud: "authenticated",
  role: "authenticated",
  email: "synthetic-confirmation@example.invalid",
  email_confirmed_at: "2026-10-25T00:00:00Z",
  app_metadata: { provider: "email" },
  user_metadata: {},
};
const token =
  [
    { alg: "HS256", typ: "JWT" },
    {
      sub: user.id,
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
  ]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".") + ".c3ludGhldGlj";
try {
  Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, value: undefined });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { visibilityState: "visible", addEventListener() {}, removeEventListener() {} },
  });
  for (const kind of ["hash", "code", "tokens"]) {
    const href =
      "https://synthetic.invalid/auth-confirmed" +
      (kind === "code"
        ? "?code=synthetic-code"
        : kind === "tokens"
          ? "#access_token=synthetic-placeholder&refresh_token=synthetic-placeholder&type=signup"
          : "?token_hash=synthetic-hash");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: new URL(href), addEventListener() {}, removeEventListener() {} },
    });
    const values = new Map([["unrelated-draft", "keep"]]);
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const mainKey = "synthetic-main-" + kind,
      ownKey = "synthetic-confirmation-" + kind;
    if (kind === "code")
      storage.setItem(mainKey + "-code-verifier", JSON.stringify("synthetic-verifier"));
    const calls = { verify: 0, exchange: 0, user: 0 };
    const fetch = async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://synthetic.supabase.co");
      let body;
      if (url.pathname === "/auth/v1/user" && (!init?.method || init.method === "GET")) {
        calls.user++;
        assert.equal(new Headers(init.headers).get("authorization"), "Bearer " + token);
        body = user;
      } else {
        assert.equal(init.method, "POST");
        const data = JSON.parse(init.body);
        if (url.pathname === "/auth/v1/verify") {
          calls.verify++;
          assert.equal(data.type, "signup");
          assert.equal(data.token_hash, "synthetic-hash");
        } else {
          assert.equal(url.pathname, "/auth/v1/token");
          assert.equal(url.searchParams.get("grant_type"), "pkce");
          calls.exchange++;
          assert.equal(data.auth_code, "synthetic-code");
          assert.equal(data.code_verifier, "synthetic-verifier");
        }
        body = {
          user,
          access_token: token,
          refresh_token: "synthetic-refresh",
          expires_in: 3600,
          token_type: "bearer",
        };
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const make = (key) =>
      createClient("https://synthetic.supabase.co", "synthetic-public-key", {
        global: { fetch },
        auth: {
          storage,
          storageKey: key,
          flowType: "pkce",
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: true,
        },
      });
    const main = make(mainKey),
      confirmation = make(ownKey);
    try {
      await main.auth.initialize();
      await confirmation.auth.initialize();
      assert.deepEqual(calls, { verify: 0, exchange: 0, user: 0 });
      assert.equal(window.location.href, href);
      const flow = createEmailConfirmationFlow({
        main: main.auth,
        confirmation: confirmation.auth,
        available: () => true,
        active: () => true,
        invalidate: () => {
          throw Error("Unexpected ownership change");
        },
        cleanup: () => {
          for (const key of [ownKey, ownKey + "-user", ownKey + "-code-verifier"])
            storage.removeItem(key);
        },
        prepareCode: () => {
          const old = storage.getItem(mainKey + "-code-verifier");
          storage.setItem(ownKey + "-code-verifier", old);
          return () => {
            if (storage.getItem(mainKey + "-code-verifier") === old)
              storage.removeItem(mainKey + "-code-verifier");
          };
        },
      });
      const input =
        kind === "tokens"
          ? { kind, access_token: token, refresh_token: "synthetic-refresh" }
          : { kind, value: kind === "hash" ? "synthetic-hash" : "synthetic-code" };
      assert.equal(await flow.run(input), user.id);
      assert.equal(await flow.matches(), true);
      assert.equal(calls.verify, kind === "hash" ? 1 : 0);
      assert.equal(calls.exchange, kind === "code" ? 1 : 0);
      assert.equal(JSON.parse(storage.getItem(mainKey)).user.id, user.id);
      assert.equal(storage.getItem(ownKey), null);
      assert.equal(storage.getItem(ownKey + "-code-verifier"), null);
      assert.equal(storage.getItem(mainKey + "-code-verifier"), null);
      assert.equal(storage.getItem("unrelated-draft"), "keep");
      flow.cancel();
    } finally {
      await main.auth.stopAutoRefresh();
      await confirmation.auth.stopAutoRefresh();
    }
  }
} finally {
  for (const [name, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
console.log(
  "PASS: installed_SDK_does_not_auto_consume_confirmation_URL_manual_hash_PKCE_and_fragment_each_verify_once_transfer_verified_owner_and_clean_only_temporary_state",
);
console.log("AUDIT: all_SDK_fetches_mocked_no_real_network_browser_users_email_or_credentials");
