// Signed session cookie for the dashboard. Runtime-agnostic: Web Crypto only (works in the proxy and in route handlers).
// Token = "<expiresAtMs>.<hex HMAC-SHA256 of 'v1.<expiresAtMs>'>", keyed by ADMIN_PASSWORD.
// Changing ADMIN_PASSWORD therefore signs everyone out.
import { safeEqual } from "./auth";

export const SESSION_COOKIE = "ap_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

async function sign(secret: string, expires: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`v1.${expires}`)));
}

export async function createSession(secret: string, now = Date.now(), ttlMs = SESSION_TTL_MS) {
  const expires = now + ttlMs;
  return `${expires}.${await sign(secret, expires)}`;
}

export async function verifySession(token: string | undefined | null, secret: string, now = Date.now()) {
  if (!token || !secret) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expires = Number(token.slice(0, dot));
  if (!Number.isFinite(expires) || expires <= now) return false;
  return safeEqual(token.slice(dot + 1), await sign(secret, expires));
}

// Only same-site relative paths are allowed as a post-login destination (no open redirect).
export function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith("/login") || next.startsWith("/api/")) return "/";
  return next;
}
