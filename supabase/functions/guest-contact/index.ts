// Public by design: login failures must not prevent contacting administrators.
// Each deployment is pinned to its own project's explicit website allowlist.
// This endpoint never accepts caller credentials, arbitrary table
// names or user IDs, and never returns message/email rows.
export const projectUrl = "https://esovqvampbrhuhamkfcs.supabase.co";
export const siteOrigin = "https://supdiver-recovery-test.vercel.app";
export const formalProjectUrl = "https://zmhtlhpeulhhcvlnjdrb.supabase.co";
export const formalOrigins = ["https://www.supdiver.com", "https://supdiver.com"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
export function validInput(value: unknown): value is {
  id: string;
  visitor_key: string;
  category: string;
  body: string;
  reply_email: string;
  website: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    Object.keys(v).sort().join(",") === "body,category,id,reply_email,visitor_key,website" &&
    typeof v.id === "string" &&
    uuid.test(v.id) &&
    typeof v.visitor_key === "string" &&
    uuid.test(v.visitor_key) &&
    typeof v.category === "string" &&
    ["suggestion", "issue", "other"].includes(v.category) &&
    typeof v.body === "string" &&
    v.body.trim().length > 0 &&
    v.body.length <= 3000 &&
    typeof v.reply_email === "string" &&
    (v.reply_email === "" ||
      (v.reply_email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.reply_email))) &&
    v.website === ""
  );
}
export function createHandler(
  env: (key: string) => string | undefined,
  transport: typeof fetch = fetch,
) {
  const backendUrl = env("SUPABASE_URL");
  const allowedOrigins =
    backendUrl === projectUrl ? [siteOrigin] : backendUrl === formalProjectUrl ? formalOrigins : [];
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin");
    const allowed = origin !== null && allowedOrigins.includes(origin);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      ...(allowed
        ? {
            "Access-Control-Allow-Origin": origin!,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
          }
        : {}),
    };
    const reply = (status: number, code: string, id?: string) =>
      new Response(JSON.stringify(id ? { code, id } : { code }), { status, headers });
    // Origin is a browser boundary, not a substitute for authentication/rate limiting.
    if (!allowedOrigins.length) return reply(503, "unavailable");
    if (!allowed) return reply(403, "denied");
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return reply(405, "method");
    if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
      return reply(415, "invalid");
    const secret = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret) return reply(503, "unavailable");
    try {
      // Bound bytes even without Content-Length, and never log submitted data.
      const reader = req.body?.getReader();
      if (!reader) return reply(400, "invalid");
      const chunks: Uint8Array[] = [];
      let size = 0;
      const deadline = Date.now() + 10000;
      try {
        for (;;) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const read = await Promise.race([
            reader.read(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(Error("body_timeout")),
                Math.max(1, deadline - Date.now()),
              );
            }),
          ]).finally(() => clearTimeout(timer));
          const { done, value } = read;
          if (done) break;
          size += value.byteLength;
          if (size > 20000) {
            await reader.cancel();
            return reply(413, "invalid");
          }
          chunks.push(value);
        }
      } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      let input: unknown;
      try {
        input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch {
        return reply(400, "invalid");
      }
      if (!validInput(input)) return reply(400, "invalid");
      const body = input.body.trim(),
        email = input.reply_email.trim();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const digest = async (scope: string, value: string) => {
        const result = await crypto.subtle.sign(
          "HMAC",
          key,
          encoder.encode("supdiver-guest-contact-v1:" + scope + ":" + value),
        );
        return [...new Uint8Array(result)].map((v) => v.toString(16).padStart(2, "0")).join("");
      };
      const browserHash = await digest("browser", input.visitor_key.toLowerCase());
      // Proxy headers are only a supplementary limit; global caps remain enforced
      // even if the network header is missing/shared/spoofed or browser IDs rotate.
      const network = (
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for") ||
        "unknown"
      )
        .split(",")[0]
        .trim()
        .slice(0, 128);
      const requestHash = await digest(
        "request",
        JSON.stringify([input.id.toLowerCase(), browserHash, input.category, body, email]),
      );
      const response = await transport(backendUrl + "/rest/v1/rpc/submit_guest_contact", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          apikey: secret,
          Authorization: "Bearer " + secret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_id: input.id.toLowerCase(),
          p_request_hash: requestHash,
          p_browser_hash: browserHash,
          p_network_hash: await digest("network", network),
          p_category: input.category,
          p_body: body,
          p_reply_email: email || null,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (result?.message === "contact_rate_limit") {
          headers["Retry-After"] = "60";
          return reply(429, "rate");
        }
        if (result?.message === "contact_conflict") return reply(409, "conflict");
        return reply(503, "unavailable");
      }
      return result === input.id.toLowerCase()
        ? reply(200, "received", result)
        : reply(503, "unavailable");
    } catch {
      return reply(503, "unavailable");
    }
  };
}
if (import.meta.main) Deno.serve(createHandler((key) => Deno.env.get(key)));
