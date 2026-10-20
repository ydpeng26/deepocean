// Staged rollout: production stays unchanged until the recovery drill passes.
export const passwordRecoveryEnabled =
  import.meta.env.VITE_SUPABASE_URL === "https://esovqvampbrhuhamkfcs.supabase.co";
