import Anthropic from "@anthropic-ai/sdk";
import type { Settings } from "./supabase";

const client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type Draft = { topic: string; content: string };

export async function generateDrafts(
  count: number,
  s: Settings,
  recent: string[],
): Promise<Draft[]> {
  const topics = s.topics.length ? s.topics.join("\n- ") : "(none set; pick sensible professional topics)";
  const prompt = `Write ${count} distinct LinkedIn posts for one person's personal profile.

TOPICS (spread across these, one topic per post):
- ${topics}

VOICE / BACKGROUND (write as this person, first person):
${s.voice || "(none provided: plain, direct, specific)"}

RECENT POSTS (do not repeat their angles or openings):
${recent.length ? recent.map((r, i) => `${i + 1}. ${r.slice(0, 160)}`).join("\n") : "(none yet)"}

RULES
- First line is a hook that stands alone; no "In today's fast-paced world" style openers.
- 600 to 1,200 characters. Short paragraphs, blank line between them.
- Concrete and specific. Do NOT invent statistics, client names, employers, or personal claims that the voice notes above don't support.
- At most 3 hashtags, at the end. No emoji spam (0 to 2 total).
- End with a genuine question or a clear takeaway, not "Agree?".

Respond with ONLY a JSON array, no markdown fences: [{"topic":"...","content":"..."}]`;

  const msg = await client().messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    max_tokens: 6000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < 0) throw new Error("Claude did not return a JSON array");
  const parsed = JSON.parse(text.slice(start, end + 1)) as Draft[];
  return parsed
    .filter((d) => d && typeof d.content === "string" && d.content.trim())
    .map((d) => ({ topic: String(d.topic ?? ""), content: d.content.trim() }));
}
