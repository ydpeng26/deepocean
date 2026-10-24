import { supabase } from "@/integrations/supabase/client";

type Session = { user: { id: string } } | null;
type Auth = {
  getSession(): Promise<{ data: { session: Session }; error: unknown }>;
  onAuthStateChange(callback: (event: string, session: Session) => void): {
    data: { subscription: { unsubscribe(): void } };
  };
};
export type MemberSession = {
  ownerId: string | null;
  epoch: number;
  status: "checking" | "ready" | "error";
};

// Used only by the protected layout, never by one-use public auth flows.
export function createMemberSessionGate(auth: Auth) {
  let snapshot: MemberSession = { ownerId: null, epoch: 0, status: "checking" };
  const listeners = new Set<() => void>();
  let subscription: { unsubscribe(): void } | undefined;
  let request = 0;
  function publish(ownerId: string | null, status: MemberSession["status"]) {
    if (snapshot.ownerId === ownerId && snapshot.status === status) return;
    snapshot = {
      ownerId,
      status,
      epoch: snapshot.epoch + (ownerId !== snapshot.ownerId ? 1 : 0),
    };
    listeners.forEach((listener) => listener());
  }
  async function recheck(hide = false) {
    const current = ++request;
    if (hide) publish(snapshot.ownerId, "checking");
    try {
      const { data, error } = await auth.getSession();
      if (current !== request || !listeners.size) return;
      publish(error ? null : (data.session?.user.id ?? null), error ? "error" : "ready");
    } catch {
      if (current === request && listeners.size) publish(null, "error");
    }
  }
  return {
    getSnapshot: () => snapshot,
    recheck,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        subscription = auth.onAuthStateChange((_event, session) => {
          // Synchronous notification; no nested async Auth or router calls here.
          ++request;
          publish(session?.user.id ?? null, "ready");
        }).data.subscription;
        void recheck();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          ++request;
          subscription?.unsubscribe();
          subscription = undefined;
          snapshot = { ownerId: null, epoch: snapshot.epoch + 1, status: "checking" };
        }
      };
    },
  };
}

export const memberSessionGate = createMemberSessionGate({
  getSession: () => supabase.auth.getSession(),
  onAuthStateChange: (callback) => supabase.auth.onAuthStateChange(callback),
});
