// Explicit project allowlist: never enable recovery for an arbitrary backend.
const backend = import.meta.env.VITE_SUPABASE_URL;
export const isRecoveryTestProject = backend === "https://esovqvampbrhuhamkfcs.supabase.co";
export const passwordRecoveryEnabled =
  isRecoveryTestProject || backend === "https://zmhtlhpeulhhcvlnjdrb.supabase.co";
