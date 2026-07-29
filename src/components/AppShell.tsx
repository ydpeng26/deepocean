import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logo from "../../public/logo.png";

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link to="/dives" className="flex items-center gap-2 text-sm font-medium tracking-widest text-primary">
            <img src={logo} alt="深蓝" className="h-6 w-6" />
            深蓝 DIVE LOG
          </Link>
          <Button variant="ghost" size="sm" className="rounded-none text-muted-foreground" onClick={signOut}>
            <LogOut className="mr-1 h-4 w-4" />
            退出
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">{children}</main>
    </div>
  );
}
