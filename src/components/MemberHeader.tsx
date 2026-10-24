import { Link, useNavigate } from "@tanstack/react-router";
import { CloudOff, Languages, LogOut } from "lucide-react";
import { MainNavigation } from "@/components/MainNavigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/useProfile";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/integrations/supabase/client";

export function MemberHeader() {
  const { profile, avatarUrl } = useProfile();
  const { language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const english = language === "en";
  const name = profile?.display_name?.trim() || (english ? "Diver" : "潜水员");
  return (
    <div className="do-member-header-wrap">
      <header className="do-passport-header do-member-header">
        <Link to="/dives" className="do-brand" aria-label="SupDiver">
          <span className="do-brand-mark">
            <img src="/images/supdiver-wave-mark.svg" alt="" />
          </span>
          <b>SupDiver</b>
        </Link>
        <MainNavigation />
        <div className="do-passport-header-actions">
          <Link
            to="/offline-sync"
            className="do-passport-sync-link"
            aria-label={english ? "Offline drafts & sync" : "离线草稿与同步"}
          >
            <CloudOff aria-hidden="true" />
            <span>{english ? "Offline drafts & sync" : "离线草稿与同步"}</span>
          </Link>
          <button
            type="button"
            className="do-passport-language"
            onClick={toggleLanguage}
            aria-label={english ? "切换到中文" : "Switch to English"}
          >
            <Languages aria-hidden="true" />
            {english ? "中文" : "EN"}
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
            aria-label={english ? "Sign out" : "退出"}
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>
    </div>
  );
}
