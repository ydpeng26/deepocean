import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Keep the lock through state refresh so a second click cannot use the old state.
export function useForumAction(options: {
  ownerId?: string;
  refresh: () => Promise<unknown>;
  onSuccess: (message: string) => void;
  onError: (error: unknown) => void;
}) {
  const lock = useRef(false);
  const alive = useRef(true);
  const owner = useRef(options.ownerId);
  owner.current = options.ownerId;
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function run(action: () => Promise<unknown>, message?: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const expectedOwner = options.ownerId;
    const mountedOwner = () => alive.current && owner.current === expectedOwner;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !expectedOwner || data.session?.user.id !== expectedOwner)
        throw new Error("账号已变化，请重新打开论坛 / Account changed; reopen the forum.");
      if (!mountedOwner()) return;
      await action();
      const current = await supabase.auth.getSession();
      if (!mountedOwner() || current.data.session?.user.id !== expectedOwner) return;
      await options.refresh();
      if (mountedOwner() && message) options.onSuccess(message);
    } catch (error) {
      if (mountedOwner()) options.onError(error);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return { busy, run };
}
