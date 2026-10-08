import { db } from "./supabase";

const VERSION = process.env.LINKEDIN_VERSION || "202509";

export const redirectUri = () => `${process.env.APP_URL}/api/linkedin/callback`;

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
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
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
  if (!res.ok) throw new Error(`LinkedIn token exchange ${res.status}: ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number };
}

export async function fetchUserinfo(token: string) {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`LinkedIn userinfo ${res.status}: ${await res.text()}`);
  return (await res.json()) as { sub: string; name?: string };
}

// The Posts API parses "commentary" as LinkedIn "little text". Unescaped reserved
// characters (notably "(") can silently truncate a post. "#" is left alone so hashtags work.
export function escapeCommentary(text: string) {
  return text.replace(/[\\|{}@\[\]()<>*_~]/g, (m) => "\\" + m);
}

export async function publishToLinkedIn(token: string, authorUrn: string, text: string) {
  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: escapeCommentary(text),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (res.status !== 201) throw new Error(`LinkedIn post ${res.status}: ${await res.text()}`);
  return res.headers.get("x-restli-id") ?? "";
}

export async function getConnection() {
  const { data } = await db().from("linkedin_connection").select("*").eq("id", 1).maybeSingle();
  return data as
    | { member_urn: string; name: string | null; access_token: string; expires_at: string }
    | null;
}
