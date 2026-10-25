export function recoveryKeys(projectUrl: string) {
  const ref = new URL(projectUrl).hostname.split(".")[0];
  const session = `supdiver-password-recovery-${ref}`;
  return {
    session,
    user: `${session}-user`,
    verifier: `${session}-code-verifier`,
    mainSession: `sb-${ref}-auth-token`,
    mainVerifier: `sb-${ref}-auth-token-code-verifier`,
  };
}
