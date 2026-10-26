import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Gauge, Languages, MapPin, Radio, Timer, Waves } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { landingCopy } from "@/i18n/translations";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SupDiver" },
      {
        name: "description",
        content:
          "记录独属于你的海洋人生，支持无信号日志记录、证书与装备记录管理、深蓝论坛等等。SupDiver让你在每一刻都能与大海相遇。",
      },
    ],
  }),
  component: Landing,
});

function Brand() {
  return <Link to="/" className="do-brand" aria-label="SupDiver home"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>;
}

function Landing() {
  const { language, toggleLanguage } = useLanguage();
  const copy = landingCopy[language];
  return (
    <div className="do-landing">
      <div className="do-hero-bg" aria-hidden="true" /><div className="do-overlay" aria-hidden="true" />
      <header className="do-header">
        <Brand />
        <div className="do-header-actions">
          <Link to="/contact" className="do-contact-entry">{language === "zh-CN" ? "联系我们" : "Contact us"}</Link>
          <button className="do-language" onClick={toggleLanguage} aria-label={copy.languageLabel}><Languages /><span>{language === "zh-CN" ? "EN" : "中文"}</span></button>
        </div>
      </header>
      <main id="home" className="do-main">
        <section className="do-copy">
          <p className="do-eyebrow">{copy.eyebrow}</p>
          <h1><span>{copy.titleStart}</span><span>{copy.titleMiddle} <em>{copy.titleAccent}</em></span></h1>
          <p className="do-subtitle">{copy.subtitle}</p>
          <Link to="/auth" className="do-cta">{copy.cta}<ArrowRight /></Link>
          <p className="do-offline"><Radio />{copy.offline}</p>
        </section>
        <section className="do-dive-card" aria-label="Featured dive">
          <div className="do-card-top">
            <div className="do-card-meta"><p><MapPin />{copy.cardLocation}</p><p><CalendarDays />{copy.cardDate}</p></div>
            <div className="do-card-site"><span>{copy.cardSiteLabel}</span><strong>{copy.cardSite}</strong></div>
          </div>
          <div className="do-stats"><div><Gauge /><strong>32</strong><span>{copy.maxDepth} (m)</span></div><div><Timer /><strong>60</strong><span>{copy.diveTime} ({copy.unitMinutes})</span></div><div><Waves /><strong>Air</strong><span>{copy.gasType}</span></div></div>
        </section>
      </main>
      <footer id="about" className="do-footer"><blockquote>“{copy.quote}”</blockquote><cite>{copy.quoteBy}</cite><small>{copy.copyright}</small></footer>
    </div>
  );
}
