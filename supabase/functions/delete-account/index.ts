// Authenticated self-deletion only. Never accepts a caller-supplied user ID.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const origins: Record<string, string[]> = {
  "https://esovqvampbrhuhamkfcs.supabase.co": ["https://supdiver-recovery-test.vercel.app"],
  "https://zmhtlhpeulhhcvlnjdrb.supabase.co": ["https://www.supdiver.com", "https://supdiver.com"],
};
export function createHandler(
  env: (key: string) => string | undefined,
  transport: typeof fetch = fetch,
  now = Date.now,
) {
  return async (req: Request) => {
    const url = env("SUPABASE_URL") ?? "",
      origin = req.headers.get("origin") ?? "";
    const allowed = origins[url]?.includes(origin);
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      ...(allowed
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
          }
        : {}),
    };
    const reply = (status: number, code: string, id?: string) =>
      new Response(JSON.stringify({ code, ...(id ? { id } : {}) }), { status, headers });
    if (!allowed) return reply(403, "denied");
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return reply(405, "method");
    if (req.headers.get("content-type")?.split(";")[0] !== "application/json")
      return reply(415, "invalid");
    const token = req.headers.get("authorization");
    if (!token?.startsWith("Bearer ") || token.length > 10000) return reply(401, "auth");
    const secret = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret) return reply(503, "unavailable");
    let started = false,
      requestId = "";
    const serverHeaders = {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    };
    async function api(path: string, init: RequestInit = {}) {
      // Fixed internal URLs only. Client cancellation cannot interrupt a job mid-step.
      const response = await transport(url + path, {
        ...init,
        headers: { ...serverHeaders, ...init.headers },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error("backend");
      return response.status === 204 ? null : response.json();
    }
    try {
      const reader = req.body?.getReader();
      if (!reader) return reply(400, "invalid");
      let bytes = new Uint8Array();
      const deadline = now() + 10000;
      for (;;) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const part = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(Error("body_timeout")), Math.max(1, deadline - now()));
          }),
        ]).finally(() => clearTimeout(timer));
        if (part.done) break;
        if (bytes.length + part.value.length > 512) {
          await reader.cancel();
          return reply(413, "invalid");
        }
        const next = new Uint8Array(bytes.length + part.value.length);
        next.set(bytes);
        next.set(part.value, bytes.length);
        bytes = next;
      }
      const input = JSON.parse(new TextDecoder().decode(bytes));
      if (
        !input ||
        Array.isArray(input) ||
        Object.keys(input).sort().join(",") !== "action,confirmation,request_id" ||
        !["status", "delete"].includes(input.action) ||
        typeof input.request_id !== "string" ||
        !uuid.test(input.request_id) ||
        input.confirmation !== (input.action === "delete" ? "DELETE MY ACCOUNT" : "")
      )
        return reply(400, "invalid");
      requestId = input.request_id;
      const user = await api("/auth/v1/user", { headers: { Authorization: token } });
      if (!user?.id || !uuid.test(user.id)) return reply(401, "auth");
      const owner = user.id;
      const step = (action: string) =>
        api("/rest/v1/rpc/account_deletion_step", {
          method: "POST",
          body: JSON.stringify({ p_user: owner, p_request: requestId, p_action: action }),
        });
      const prior = await step("status");
      if (!prior || !uuid.test(prior.id) || !["none", "pending"].includes(prior.status))
        throw Error("receipt");
      requestId = prior.id;
      if (input.action === "status") return reply(200, prior.status, requestId);
      if (prior.status === "none") {
        const age = now() - Date.parse(user.last_sign_in_at ?? "");
        if (!Number.isFinite(age) || age < 0 || age > 10 * 60 * 1000)
          return reply(409, "reauth", requestId);
      }
      started = true;
      const begun = await step("begin");
      if (begun?.id !== requestId || begun.status !== "pending") throw Error("receipt");
      for (let batch = 0; batch < 10; batch++) {
        const result = await step("files");
        if (result?.id !== requestId || !Array.isArray(result.files) || result.files.length > 100)
          throw Error("receipt");
        if (!result.files.length) {
          const response = await transport(url + "/auth/v1/admin/users/" + owner, {
            method: "DELETE",
            headers: serverHeaders,
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok && response.status !== 404) throw Error("auth_delete");
          const done = await step("finish");
          if (done?.id !== requestId || done.status !== "completed") throw Error("receipt");
          return reply(200, "completed", requestId);
        }
        const groups = new Map<string, string[]>();
        for (const item of result.files) {
          if (
            !item ||
            typeof item.bucket !== "string" ||
            !/^[a-z0-9-]{1,100}$/.test(item.bucket) ||
            typeof item.path !== "string" ||
            !item.path ||
            item.path.length > 1024
          )
            throw Error("object");
          groups.set(item.bucket, [...(groups.get(item.bucket) ?? []), item.path]);
        }
        for (const [bucket, paths] of groups)
          await api("/storage/v1/object/" + encodeURIComponent(bucket), {
            method: "DELETE",
            body: JSON.stringify({ prefixes: paths }),
          });
      }
      return reply(202, "pending", requestId);
    } catch {
      // Never report completion from a green HTTP response alone, or expose raw errors.
      return reply(503, started ? "pending" : "unavailable", requestId || undefined);
    }
  };
}
// Test modules import the pure handler without opening a server.
if (typeof Deno !== "undefined") Deno.serve(createHandler((key) => Deno.env.get(key)));
