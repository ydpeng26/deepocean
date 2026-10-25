// Bound only the four public account requests. Never time out database work,
// token refresh, logout or one-use Google/confirmation/recovery verification.
let pageRequests: Set<() => void> | undefined;
export const ACCOUNT_REQUEST_TIMEOUT_MS = 25_000;
export const ACCOUNT_REQUEST_TIMEOUT_MESSAGE =
  "请求等待超时，请检查网络后重试；邮件可能已发送，请先检查邮箱。 / Request timed out. Check your connection and retry; email may already have been sent, so check your inbox first.";

export function accountRequestErrorMessage(
  error: unknown,
  language: string,
  fallback: string,
  showDetails = true,
) {
  if (error instanceof Error && error.message.includes(ACCOUNT_REQUEST_TIMEOUT_MESSAGE))
    return language === "zh-CN"
      ? "请求等待超时，请检查网络后重试。邮件可能已发送，请先检查邮箱。"
      : "Request timed out. Check your connection and retry. Email may already have been sent; check your inbox first.";
  return showDetails && error instanceof Error ? error.message : fallback;
}

export function mountAccountRequestPage() {
  const owned = new Set<() => void>();
  pageRequests = owned;
  return () => {
    if (pageRequests === owned) pageRequests = undefined;
    // An old page's cleanup must not cancel a newer page's request.
    for (const cancel of owned) cancel();
  };
}

export function createAccountRequestFetch(
  projectUrl: string,
  fetcher: typeof fetch,
  timeoutMs = ACCOUNT_REQUEST_TIMEOUT_MS,
): typeof fetch {
  return async (input, init) => {
    const request = typeof Request !== "undefined" && input instanceof Request ? input : undefined;
    const url = new URL(request ? request.url : String(input));
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    if (
      url.origin !== new URL(projectUrl).origin ||
      method !== "POST" ||
      !(
        ["/auth/v1/signup", "/auth/v1/resend", "/auth/v1/recover"].includes(url.pathname) ||
        (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password")
      )
    )
      return fetcher(input, init);

    const controller = new AbortController();
    const sourceSignal = init?.signal ?? request?.signal;
    let stopped = false;
    let rejectStop!: (error: Error) => void;
    const stoppedPromise = new Promise<never>((_resolve, reject) => {
      rejectStop = reject;
    });
    const stop = (timeout = false) => {
      if (stopped) return;
      stopped = true;
      rejectStop(
        new Error(timeout ? ACCOUNT_REQUEST_TIMEOUT_MESSAGE : "Account request cancelled"),
      );
      controller.abort();
    };
    const cancel = () => stop();
    const owner = pageRequests;
    owner?.add(cancel);
    sourceSignal?.addEventListener("abort", cancel, { once: true });
    if (sourceSignal?.aborted) cancel();
    const timer = setTimeout(() => stop(true), timeoutMs);
    try {
      // Race the entire response body, not only headers. A late response/body
      // from an abort-ignoring transport must never reach the SDK session save.
      const response = await Promise.race([
        stoppedPromise,
        (async () => {
          if (stopped) throw new Error("Account request cancelled");
          const result = await fetcher(input, { ...init, signal: controller.signal });
          if (stopped) throw new Error("Account request cancelled");
          const body = await result.arrayBuffer();
          if (stopped) throw new Error("Account request cancelled");
          return new Response(body.byteLength ? body : null, {
            status: result.status,
            statusText: result.statusText,
            headers: result.headers,
          });
        })(),
      ]);
      if (stopped) throw new Error("Account request cancelled");
      return response;
    } finally {
      clearTimeout(timer);
      owner?.delete(cancel);
      sourceSignal?.removeEventListener("abort", cancel);
    }
  };
}
