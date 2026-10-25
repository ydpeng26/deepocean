export function googleOAuthKeys(projectUrl: string) {
  const ref = new URL(projectUrl).hostname.split(".")[0];
  const session = `supdiver-google-oauth-${ref}`;
  return {
    session,
    verifier: `${session}-code-verifier`,
    user: `${session}-user`,
    transaction: `${session}-transaction`,
  };
}
