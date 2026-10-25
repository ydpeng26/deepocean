// Serialized into an isolated cloud fixture page only. No real-user tab access.
export function gearFixtureToken(expectedOwner, storage = sessionStorage) {
  try {
    const session = JSON.parse(storage.getItem("sb-esovqvampbrhuhamkfcs-auth-token") || "null");
    return session?.user?.id === expectedOwner &&
      typeof session.access_token === "string" &&
      session.access_token.length > 0
      ? session.access_token
      : null;
  } catch {
    return null;
  }
}
