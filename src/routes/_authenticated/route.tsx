import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MemberHeader } from "@/components/MemberHeader";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <Fragment key={user.id}>
      <MemberHeader />
      <Outlet />
    </Fragment>
  );
}
