import { db } from "./supabase";
import { toLittleText } from "./littletext";

// LinkedIn REST versions (YYYYMM) are supported for about a year, then return 426.
export const DEFAULT_LINKEDIN_VERSION = "202608";
export const linkedinVersion = () => process.env.LINKEDIN_VERSION?.trim() || DEFAULT_LINKEDIN_VERSION;

// Whole months between a YYYYMM version and `now`; null if malformed.
export function versionAgeMonths(version: string, now = new Date()) {
  const m = /^(\d{4})(\d{2})$/.exec(version);
  if (!m || +m[2] < 1 || +m[2] > 12) return null;
  return (now.getUTCFullYear() - +m[1]) * 12 + (now.getUTCMonth() + 1 - +m[2]);
}

export const redirectUri = () => `${process.env.APP_URL}/api/linkedin/callback`;

export const postUrl = (urn: string) => `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}/`;

// `stage` says how far the request got. Anything that failed before the post
// request was sent can be retried safely; a failure on the post request itself
// may or may not have created the post.
export class LinkedInError extends Error {
  constructor(
    message: string,
    readonly status: number, // 0 = network error / no response
    readonly stage: "auth" | "image" | "post",
  ) {
    super(message);
    this.name = "LinkedInError";
  }

  // Safe to retry automatically without risking a duplicate post.
  get retryable() {
    if (this.stage !== "post") return this.status === 0 || this.status === 429 || this.status >= 500;
    // Gateway-level rejections mean the request was not processed.
    return this.status === 429 || this.status === 502 || this.status === 503 || this.status === 504;
  }

  get versionSunset() {
    return this.status === 426;
  }

  get authProblem() {
    return this.status === 401;
  }

  // A post-stage failure where LinkedIn may still have published the post.
  get outcomeUnknown() {
    return this.stage === "post" && (this.status === 0 || this.status === 500);
  }
}

async function call(stage: LinkedInError["stage"], url: string, init: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    throw new LinkedInError(`LinkedIn ${stage} request failed: ${e instanceof Error ? e.message : e}`, 0, stage);
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 500);
    throw new LinkedInError(`LinkedIn ${stage} ${res.status}: ${body}`, res.status, stage);
  }
  return res;
}

const restHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "LinkedIn-Version": linkedinVersion(),
  "X-Restli-Protocol-Version": "2.0.0",
});

export function authUrl(state: string) {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: redirectUri(),
    state,
    scope: "openid profile w_member_social",
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${p}`;
}

export async function exchangeCode(code: string) {
  const res = await call("auth", "https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });
  return (await res.json()) as { access_token: string; expires_in: number };
}

export async function fetchUserinfo(token: string) {
  const res = await call("auth", "https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()) as { sub: string; name?: string; picture?: string };
}

// Images API: initialize an upload slot, PUT the bytes, return the image URN.
export async function uploadImage(token: string, ownerUrn: string, bytes: ArrayBuffer, contentType: string) {
  const init = await call("image", "https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: restHeaders(token),
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  });
  const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } };
  await call("image", value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body: bytes,
  });
  return value.image;
}

export async function publishToLinkedIn(
  token: string,
  authorUrn: string,
  text: string,
  image?: { urn: string; alt?: string | null },
) {
  const res = await call("post", "https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: restHeaders(token),
    body: JSON.stringify({
      author: authorUrn,
      commentary: toLittleText(text),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      ...(image ? { content: { media: { id: image.urn, ...(image.alt ? { altText: image.alt.slice(0, 4000) } : {}) } } } : {}),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  return res.headers.get("x-restli-id") ?? "";
}

export type Connection = {
  member_urn: string;
  name: string | null;
  picture: string | null;
  access_token: string;
  expires_at: string;
  connected_at: string;
};

export async function getConnection() {
  const { data } = await db().from("linkedin_connection").select("*").eq("id", 1).maybeSingle();
  return data as Connection | null;
}
