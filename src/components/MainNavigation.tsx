import { Link, useRouterState } from "@tanstack/react-router";
import { useLanguage } from "@/i18n/LanguageProvider";

export function MainNavigation() {
  const { language } = useLanguage();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const links = [
    { to: "/dives", zh: "海洋护照", en: "Ocean passport", active: pathname === "/dives" || pathname === "/dives/" },
    { to: "/dives/logs", zh: "潜水日志", en: "Dive logs", active: pathname.startsWith("/dives/") && pathname !== "/dives/" },
    { to: "/forum", zh: "深蓝论坛", en: "Deep blue forum", active: pathname.startsWith("/forum") },
    { to: "/marine", zh: "海洋生物", en: "Ocean encounters", active: pathname.startsWith("/marine") },
    { to: "/profile", zh: "个人资料", en: "Profile", active: pathname.startsWith("/profile") },
  ] as const;
  return <nav className="do-main-navigation" aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}>{links.map(link => <Link key={link.to} to={link.to} aria-current={link.active ? "page" : undefined}>{language === "zh-CN" ? link.zh : link.en}</Link>)}</nav>;
}
