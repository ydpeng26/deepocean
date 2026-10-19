import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/useProfile";
import { MainNavigation } from "@/components/MainNavigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { profile, avatarUrl } = useProfile();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const name = profile?.display_name ?? "潜水员";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="do-app-header mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <Link to="/dives" className="flex items-center gap-2 text-sm font-medium tracking-widest text-primary">
            <img src="/images/supdiver-wave-mark.svg" alt="" className="h-6 w-7" />
            SupDiver
          </Link>
          <MainNavigation />
          <div className="do-app-header-actions flex items-center gap-3">
            <Link
              to="/profile"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
            >
              <Avatar className="h-7 w-7 rounded-none">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} className="rounded-none" /> : null}
                <AvatarFallback className="rounded-none bg-primary/10 text-xs text-primary">
                  {name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-24 truncate">{name}</span>
            </Link>
            <Button variant="ghost" size="sm" className="rounded-none text-muted-foreground" onClick={signOut}>
              <LogOut className="mr-1 h-4 w-4" />
              退出
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">{children}</main>
    </div>
  );
}
