import { SignJWT, jwtVerify } from "jose";
import { authConfig } from "./env.js";

export const SESSION_COOKIE = "grelin_session";
const ISSUER = "grelin-health";

// Derive the signing key from validated config. authConfig() throws a clear
// error if JWT_SECRET is missing or too short, so we can never fall back to
// signing/verifying with an empty key.
function signingKey() {
  return new TextEncoder().encode(authConfig().jwtSecret);
}

export async function signSession(payload) {
  const { sessionTtlHours } = authConfig();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(`${sessionTtlHours}h`)
    .sign(signingKey());
}

export async function verifySession(token) {
  if (!token) return null;
  // Resolve the key first: a configuration error must propagate loudly, and
  // must not be mistaken for an invalid/expired token below.
  const key = signingKey();
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER });
    return payload;
  } catch {
    return null;
  }
}

export function cookieOptions() {
  const { sessionTtlHours } = authConfig();
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionTtlHours * 60 * 60,
  };
}
