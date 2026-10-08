// Request-auth helpers shared by proxy.ts and the cron route. Runtime-agnostic (no node:crypto).

// Constant-time string comparison: doesn't leak how many leading characters matched.
export function safeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// HTTP Basic auth with any username and the admin password.
export function basicAuthOk(header: string | null, password: string) {
  if (!header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  return safeEqual(decoded.slice(decoded.indexOf(":") + 1), password);
}

export function bearerOk(header: string | null, secret: string | undefined) {
  return !!secret && !!header && safeEqual(header, `Bearer ${secret}`);
}

// Browsers attach cached Basic-auth credentials to cross-site requests too, so a
// malicious page could POST to /api/posts/:id/publish. Reject state-changing
// requests that a browser marks as coming from another site.
export function isCrossSiteWrite(req: {
  method: string;
  headers: { get(name: string): string | null };
  host: string;
}) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return false;
  const site = req.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host !== req.host;
    } catch {
      return true;
    }
  }
  return false; // non-browser client (curl etc.) that already passed Basic auth
}
