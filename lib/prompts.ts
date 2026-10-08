// Prompt construction, kept free of I/O so it can be unit tested.
import type { Settings } from "./supabase";

export const MAX_POST_CHARS = 3000; // LinkedIn commentary limit

export function systemPrompt(s: Pick<Settings, "voice" | "rules" | "max_hashtags">) {
  return `You ghostwrite LinkedIn posts for one specific person. Every post is published on their personal profile under their name, so it has to sound like them and be something they could defend in a conversation.

WHO THEY ARE (write in first person, as this person):
${s.voice.trim() || "(No background given. Write plainly and directly, and make no claims about their job, employer or history.)"}

HARD RULES
- Never invent statistics, studies, client names, employers, job titles, achievements or personal anecdotes that the background above doesn't support. If a post needs a specific, use an observation or opinion instead of a fabricated fact.
- Plain text only. LinkedIn does not render Markdown, so no **bold**, no headings, no bullet syntax other than simple line breaks or "-" lists.
- The first line is a hook that stands on its own (it's all people see before "...see more"). Avoid stock openers like "In today's fast-paced world", "I'm thrilled to announce", "Let's talk about".
- Short paragraphs with a blank line between them. Usually 600-1,300 characters; never more than ${MAX_POST_CHARS}.
- At most ${s.max_hashtags} hashtags, all on the last line. 0-2 emoji in total.
- End with a real question or a clear takeaway, never "Agree?" or "Thoughts?".${s.rules.trim() ? `\n\nTHEIR OWN RULES (follow these over the defaults above)\n${s.rules.trim()}` : ""}`;
}

export function draftsPrompt(opts: {
  count: number;
  topics: string[];
  idea?: string;
  recent: string[];
  examples: string[];
}) {
  const parts: string[] = [];
  if (opts.idea?.trim()) {
    parts.push(
      `Write ${opts.count} different version${opts.count === 1 ? "" : "s"} of a LinkedIn post based on this idea from the author:\n"""\n${opts.idea.trim()}\n"""\nTake different angles or structures in each version.`,
    );
  } else {
    const topics = opts.topics.length
      ? opts.topics.map((t) => `- ${t}`).join("\n")
      : "- (none set: pick topics a thoughtful professional with this background would credibly write about)";
    parts.push(`Write ${opts.count} distinct LinkedIn posts. Spread them across these topics, one topic per post:\n${topics}`);
  }

  if (opts.examples.length)
    parts.push(
      `POSTS THEY ACTUALLY PUBLISHED (match this voice, rhythm and formatting; don't reuse their content):\n${opts.examples
        .map((e, i) => `--- example ${i + 1} ---\n${e}`)
        .join("\n")}`,
    );

  if (opts.recent.length)
    parts.push(
      `RECENT POSTS IN THE QUEUE OR FEED (don't repeat their angles, hooks or openings):\n${opts.recent
        .map((r, i) => `${i + 1}. ${r.replace(/\s+/g, " ").slice(0, 180)}`)
        .join("\n")}`,
    );

  parts.push(`For each post, set "topic" to a 2-5 word label for what it's about.`);
  return parts.join("\n\n");
}

export function rewritePrompt(content: string, instruction: string) {
  return `Here is a LinkedIn post draft:
"""
${content}
"""

Rewrite it following this instruction: ${instruction.trim() || "tighten it and make the hook stronger"}

Keep everything that the instruction doesn't ask you to change, and keep obeying the hard rules.`;
}

export const DRAFTS_SCHEMA = {
  type: "object",
  properties: {
    posts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          content: { type: "string" },
        },
        required: ["topic", "content"],
        additionalProperties: false,
      },
    },
  },
  required: ["posts"],
  additionalProperties: false,
} as const;

export const REWRITE_SCHEMA = {
  type: "object",
  properties: { content: { type: "string" } },
  required: ["content"],
  additionalProperties: false,
} as const;
