import { useEffect, useRef, useState } from "react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useOptionalLanguage, type Language } from "@/i18n/LanguageProvider";
import { errorCopy } from "@/lib/error-copy";
import { reportLovableError } from "@/lib/lovable-error-reporting";

function useErrorLanguage() {
  const context = useOptionalLanguage();
  const [fallback, setFallback] = useState<Language>("zh-CN");
  useEffect(() => {
    if (context) return;
    try {
      const saved = localStorage.getItem("deepocean-language");
      setFallback(
        saved === "en" || saved === "zh-CN"
          ? saved
          : navigator.language.toLowerCase().startsWith("zh")
            ? "zh-CN"
            : "en",
      );
    } catch {
      /* The fallback remains usable with blocked browser storage. */
    }
  }, [context]);
  const language = context?.language ?? fallback;
  return {
    language,
    toggle() {
      const next = language === "en" ? "zh-CN" : "en";
      if (context) context.setLanguage(next);
      else {
        setFallback(next);
        try {
          localStorage.setItem("deepocean-language", next);
        } catch {
          /* Optional preference only. */
        }
      }
    },
  };
}

export function NotFoundComponent() {
  const { language, toggle } = useErrorLanguage();
  const c = errorCopy[language];
  useEffect(() => {
    document.title = `${c.missing} · SupDiver`;
  }, [c.missing]);
  return (
    <main
      lang={language}
      className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"
    >
      <div className="max-w-md space-y-5 text-center">
        <button
          type="button"
          onClick={toggle}
          aria-label={language === "en" ? "切换到中文" : "Switch to English"}
        >
          {language === "en" ? "中文" : "EN"}
        </button>
        <p className="text-7xl font-bold">404</p>
        <h1 className="text-xl font-semibold">{c.missing}</h1>
        <p className="text-sm text-muted-foreground">{c.missingHint}</p>
        <a className="inline-flex rounded-md border px-4 py-2" href="/">
          {c.home}
        </a>
      </div>
    </main>
  );
}

export function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const { language, toggle } = useErrorLanguage();
  const c = errorCopy[language];
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  const active = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const effectGeneration = ++generation.current;
    active.current = true;
    lock.current = false;
    setPending(false);
    setFailed(false);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    return () => {
      active.current = false;
      generation.current = effectGeneration + 1;
    };
  }, [error]);
  useEffect(() => {
    document.title = `${c.title} · SupDiver`;
  }, [c.title]);
  async function retry() {
    if (lock.current || !active.current) return;
    lock.current = true;
    const operation = generation.current;
    const current = () => active.current && generation.current === operation;
    setPending(true);
    setFailed(false);
    try {
      await router.invalidate();
      if (current()) reset();
    } catch {
      if (current()) setFailed(true);
    } finally {
      if (current()) {
        lock.current = false;
        setPending(false);
      }
    }
  }
  return (
    <main
      lang={language}
      className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"
    >
      <div className="max-w-md space-y-5 text-center">
        <button
          type="button"
          onClick={toggle}
          aria-label={language === "en" ? "切换到中文" : "Switch to English"}
        >
          {language === "en" ? "中文" : "EN"}
        </button>
        <h1 className="text-xl font-semibold">{c.title}</h1>
        <p className="text-sm text-muted-foreground">{c.hint}</p>
        {failed && <p role="alert">{c.failed}</p>}
        <div className="flex flex-wrap justify-center gap-3" aria-busy={pending}>
          <button
            type="button"
            disabled={pending}
            onClick={retry}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
          >
            {pending ? c.pending : c.retry}
          </button>
          <a href="/" className="rounded-md border px-4 py-2">
            {c.home}
          </a>
        </div>
        {pending && <p role="status">{c.pending}</p>}
      </div>
    </main>
  );
}
