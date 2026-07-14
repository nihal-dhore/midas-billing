import { createHash } from "crypto";

export const SESSION_COOKIE = "midas_session";

// Session token is a hash of the shared app password, not the password
// itself, so the cookie never carries the plaintext credential.
export function sessionToken(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export function isValidSession(cookieValue: string | undefined): boolean {
  const password = process.env.MIDAS_APP_PASSWORD;
  if (!password || !cookieValue) return false;
  return cookieValue === sessionToken(password);
}
