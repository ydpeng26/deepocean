import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Droplets,
  Languages,
  LogOut,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Thermometer,
  Waves,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/useProfile";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/integrations/supabase/client";
import { listDives, signedPhotoUrls, type Dive } from "@/lib/dives";

export const Route = createFileRoute("/_authenticated/dives/logs")({
  head: () => ({
    meta: [
      { title: "潜水日志 · SupDiver" },
      { name: "description", content: "浏览、搜索并继续记录你的每一次下潜。" },
    ],
  }),
  component: DiveLogsPage,
});

const copy = {
  "zh-CN": {
    passport: "海洋护照",
    logs: "潜水日志",
    profile: "个人资料",
    logout: "退出",
    eyebrow: "MY DIVE STORIES",
    title: "潜水日志",
    intro: "按时间重温每一次下潜，也重新遇见当时的海洋与自己。",
    add: "记录一次下潜",
    search: "搜索潜点、国家或笔记",
    all: "全部海域",
    entries: "篇潜水记录",
    countries: "个国家 / 地区",
    underwater: "水下时光",
    year: "全部记录",
    filter: "筛选日志",
    result: "当前显示",
    depth: "最大深度",
    duration: "潜水时长",
    temperature: "水温",
    guide: "潜伴 / 教练",
    story: "深蓝记忆",
    view: "查看潜水详情",
    noResult: "没有找到符合条件的潜水日志。",
    noLogs: "你还没有潜水日志，从第一次下潜开始记录吧。",
    loading: "正在读取潜水日志…",
    error: "日志暂时无法加载，请稍后重试。",
  },
  en: {
    passport: "Ocean Passport",
    logs: "Dive Logs",
    profile: "Profile",
    logout: "Sign out",
    eyebrow: "MY DIVE STORIES",
    title: "Dive Logs",
    intro: "Revisit every descent in time, and meet the ocean—and yourself—again.",
    add: "Log a dive",
    search: "Search site, country or notes",
    all: "All waters",
    entries: "dive logs",
    countries: "countries / regions",
    underwater: "underwater",
    year: "All records",
    filter: "Filter logs",
    result: "Showing",
    depth: "Max depth",
    duration: "Dive time",
    temperature: "Water",
    guide: "Buddy / guide",
    story: "Ocean memory",
    view: "View dive details",
    noResult: "No dive logs match these filters.",
    noLogs: "You have no dive logs yet. Start with your first descent.",
    loading: "Loading your dive logs…",
    error: "We couldn't load your logs. Please try again.",
  },
} as const;

function DivePhoto({ dive, index }: { dive: Dive; index: number }) {
  const path = dive.photo_urls?.[0];
  const { data: photo } = useQuery({
    queryKey: ["dive-log-photo", path],
    queryFn: async () => (await signedPhotoUrls([path!]))[0] ?? null,
    enabled: Boolean(path),
  });
  const fallback = [
    "/images/user-fish-hero-preview.jpg",
    "/images/user-cave-photo-hero-preview.jpg",
    "/images/supdiver-six-orange-fish-hero.png",
  ][index % 3];
  return (
    <div
      className="do-log-photo"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(0,8,22,.03), rgba(0,10,27,.34)), url('${photo || fallback}')`,
      }}
    >
      <span>#{String(index + 1).padStart(3, "0")}</span>
    </div>
  );
}

function DiveLogsPage() {
  const navigate = useNavigate();
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const { profile, avatarUrl } = useProfile();
  const {
    data: dives = [],
    isPending,
    isError,
  } = useQuery({ queryKey: ["dives"], queryFn: listDives });
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("all");
  const countries = useMemo(
    () => Array.from(new Set(dives.map((d) => d.country.trim()).filter(Boolean))),
    [dives],
  );
  const filtered = useMemo(
    () =>
      dives.filter((dive) => {
        const search = query.trim().toLowerCase();
        return (
          (country === "all" || dive.country === country) &&
          (!search ||
            `${dive.site_name} ${dive.country} ${dive.notes ?? ""}`.toLowerCase().includes(search))
        );
      }),
    [country, dives, query],
  );
  const totalMinutes = dives.reduce((sum, dive) => sum + (Number(dive.duration_min) || 0), 0);
  const name = profile?.display_name?.trim() || (language === "zh-CN" ? "潜水员" : "Diver");
  const dateParts = (value: string) => {
    const [year, month, day] = value.split("-");
    return {
      year,
      day,
      month:
        language === "zh-CN"
          ? `${Number(month)}月`
          : new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" })
              .format(new Date(`${value}T00:00:00Z`))
              .toUpperCase(),
    };
  };
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="do-logs-page">
      <header className="do-passport-header do-logs-header">
        <Link to="/dives" className="do-brand" aria-label="SupDiver">
          <span className="do-brand-mark">
            <img src="/images/supdiver-wave-mark.svg" alt="" />
          </span>
          <b>SupDiver</b>
        </Link>
        <nav aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}>
          <Link to="/dives">{c.passport}</Link>
          <a href="#dive-logs" aria-current="page">
            {c.logs}
          </a>
          <Link to="/profile">{c.profile}</Link>
        </nav>
        <div className="do-passport-header-actions">
          <button type="button" className="do-passport-language" onClick={toggleLanguage}>
            <Languages aria-hidden="true" />
            {language === "zh-CN" ? "EN" : "中文"}
          </button>
          <Link to="/profile" className="do-passport-account">
            <Avatar>
              <AvatarImage src={avatarUrl ?? undefined} alt={name} />
              <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span>{name}</span>
          </Link>
          <button
            type="button"
            className="do-passport-logout"
            onClick={signOut}
            aria-label={c.logout}
          >
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>
      <main id="dive-logs" className="do-logs-main">
        <section className="do-logs-intro">
          <div>
            <span>{c.eyebrow}</span>
            <h1>{c.title}</h1>
            <p>{c.intro}</p>
          </div>
          <Link to="/dives/new" className="do-logs-add">
            <Plus aria-hidden="true" />
            {c.add}
          </Link>
        </section>
        <section className="do-logs-overview">
          <div>
            <strong>{isPending ? "—" : dives.length}</strong>
            <span>{c.entries}</span>
          </div>
          <div>
            <strong>{isPending ? "—" : countries.length}</strong>
            <span>{c.countries}</span>
          </div>
          <div>
            <strong>
              {isPending ? "—" : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`}
            </strong>
            <span>{c.underwater}</span>
          </div>
          <div>
            <strong>{c.year}</strong>
            <span>SUPDIVER / LOGBOOK</span>
          </div>
        </section>
        <div className="do-logs-layout">
          <aside className="do-logs-filter-panel">
            <div className="do-logs-filter-title">
              <SlidersHorizontal aria-hidden="true" />
              <span>{c.filter}</span>
            </div>
            <label className="do-logs-search">
              <Search aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={c.search}
              />
            </label>
            <div className="do-logs-country-filters">
              <button
                type="button"
                data-active={country === "all"}
                onClick={() => setCountry("all")}
              >
                {c.all}
              </button>
              {countries.map((item) => (
                <button
                  key={item}
                  type="button"
                  data-active={country === item}
                  onClick={() => setCountry(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="do-logs-filter-result">
              <span>{c.result}</span>
              <strong>{filtered.length}</strong>
              <small>{c.entries}</small>
            </div>
            <div className="do-logs-watermark">
              <Waves aria-hidden="true" />
              <span>
                YOUR OCEAN
                <br />
                YOUR STORY
              </span>
            </div>
          </aside>
          <section className="do-logs-list" aria-live="polite">
            <div className="do-logs-year">
              <span>{c.year}</span>
              <i />
            </div>
            {isPending ? (
              <div className="do-logs-empty">
                <CalendarDays aria-hidden="true" />
                <p>{c.loading}</p>
              </div>
            ) : isError ? (
              <div className="do-logs-empty">
                <Waves aria-hidden="true" />
                <p>{c.error}</p>
              </div>
            ) : filtered.length ? (
              filtered.map((dive, index) => {
                const parts = dateParts(dive.dive_date);
                return (
                  <article className="do-log-entry" key={dive.id}>
                    <div className="do-log-date">
                      <strong>{parts.day}</strong>
                      <span>{parts.month}</span>
                      <small>{parts.year}</small>
                    </div>
                    <DivePhoto dive={dive} index={index} />
                    <div className="do-log-content">
                      <div className="do-log-place">
                        <span>
                          <MapPin aria-hidden="true" />
                          {dive.country}
                        </span>
                        <h2>
                          {dive.site_name ||
                            (language === "zh-CN" ? "未命名潜点" : "Untitled site")}
                        </h2>
                      </div>
                      <div className="do-log-metrics">
                        <span>
                          <Droplets aria-hidden="true" />
                          <b>{dive.max_depth ?? "—"}m</b>
                          <small>{c.depth}</small>
                        </span>
                        <span>
                          <Clock3 aria-hidden="true" />
                          <b>{dive.duration_min ?? "—"} min</b>
                          <small>{c.duration}</small>
                        </span>
                        <span>
                          <Thermometer aria-hidden="true" />
                          <b>{dive.water_temp ?? "—"}°C</b>
                          <small>{c.temperature}</small>
                        </span>
                      </div>
                      <div className="do-log-note">
                        <small>{c.story}</small>
                        <p>
                          {dive.notes ||
                            (language === "zh-CN"
                              ? "这次下潜还没有写下故事。"
                              : "No story has been added for this dive yet.")}
                        </p>
                      </div>
                      <div className="do-log-footer">
                        <span>
                          {c.guide} · {dive.buddy_name || "—"}
                        </span>
                        <Link to="/dives/$id" params={{ id: dive.id }}>
                          {c.view}
                          <ChevronRight aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="do-logs-empty">
                <Search aria-hidden="true" />
                <p>{dives.length ? c.noResult : c.noLogs}</p>
                {!dives.length && (
                  <Link to="/dives/new" className="do-logs-add">
                    <Plus aria-hidden="true" />
                    {c.add}
                  </Link>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
      <footer className="do-passport-footer">
        <span>SupDiver</span>
        <small>YOUR OCEAN. YOUR STORY.</small>
      </footer>
    </div>
  );
}
