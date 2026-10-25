type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const safe = safeError(error);
  bestEffort(() =>
    window.__lovableEvents?.captureException?.(
      safe,
      {
        source: "react_error_boundary",
        route: window.location.pathname,
        boundary:
          typeof context.boundary === "string" ? redact(context.boundary).slice(0, 100) : undefined,
      },
      { mechanism: "react_error_boundary", handled: false, severity: "error" },
    ),
  );
  // Isolate each optional hook, including asynchronous rejection, without
  // recursively reporting telemetry failures from the error boundary itself.
  bestEffort(() =>
    window.__lovableReportRuntimeError?.({
      message: safe.message,
      stack: safe.stack,
      filename: window.location.pathname,
    }),
  );
}

function bestEffort(run: () => unknown) {
  try {
    void Promise.resolve(run()).catch(() => {});
  } catch {
    /* Optional telemetry only. */
  }
}

function redact(value: string) {
  return value.replace(/(https?:\/\/[^\s?#]+)[?#][^\s)]*/gi, "$1?[redacted]");
}

function safeError(value: unknown): Error {
  try {
    if (value instanceof Response) return new Error(`Response ${value.status}`);
    const message =
      value instanceof Error
        ? value.message
        : typeof value === "string"
          ? value
          : "Unknown application error";
    const error = new Error(redact(message).slice(0, 1000));
    if (value instanceof Error && typeof value.stack === "string")
      error.stack = redact(value.stack).slice(0, 6000);
    return error;
  } catch {
    return new Error("Unknown application error");
  }
}
