export type RecoveryBinding = { userId: string; accessToken: string };

// The mutation carries the verified token explicitly. A later change in the
// shared SDK session cannot redirect this request to another account.
export async function updateBoundRecoveryPassword(
  binding: RecoveryBinding,
  password: string,
  isCurrent: () => boolean,
) {
  const backend = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (
    !isCurrent() ||
    !key ||
    !binding.accessToken ||
    ![
      "https://esovqvampbrhuhamkfcs.supabase.co",
      "https://zmhtlhpeulhhcvlnjdrb.supabase.co",
    ].includes(backend)
  )
    throw new Error("Recovery authorization unavailable");
  const response = await fetch(`${backend}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: key,
      Authorization: `Bearer ${binding.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
    credentials: "omit",
  });
  if (!response.ok || !isCurrent()) throw new Error("Recovery update not confirmed");
  const user = await response.json();
  if (!isCurrent() || user.id !== binding.userId) throw new Error("Recovery account changed");
}
