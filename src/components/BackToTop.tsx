import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";

export function BackToTop() {
  const { language } = useLanguage();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 320);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  if (!visible) return null;
  return <button type="button" className="do-back-to-top"
    aria-label={language === "en" ? "Back to top" : "回到顶部"}
    onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}>
    <ArrowUp aria-hidden="true" /><span>{language === "en" ? "Top" : "顶部"}</span>
  </button>;
}
