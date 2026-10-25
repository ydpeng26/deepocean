import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "zh-CN" | "en";
type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
};
const STORAGE_KEY = "deepocean-language";
const LanguageContext = createContext<LanguageContextValue | null>(null);

function getSavedLanguage(): Language {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "zh-CN" || saved === "en") return saved;
  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Match the server's first render, then restore the browser preference.
  const [language, setLanguage] = useState<Language>("zh-CN");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setLanguage(getSavedLanguage());
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language, ready]);
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () => setLanguage((current) => (current === "zh-CN" ? "en" : "zh-CN")),
    }),
    [language],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

// Error fallbacks must also work when the ordinary provider failed to mount.
export function useOptionalLanguage() {
  return useContext(LanguageContext);
}
