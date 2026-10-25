export function emailConfirmationKeys(projectUrl: string) {
  const ref = new URL(projectUrl).hostname.split(".")[0];
  const session = `supdiver-email-confirmation-${ref}`;
  return {
    session,
    verifier: `${session}-code-verifier`,
    user: `${session}-user`,
    mainVerifier: `sb-${ref}-auth-token-code-verifier`,
    mainSession: `sb-${ref}-auth-token`,
  };
}
