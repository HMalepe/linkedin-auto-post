import Anthropic from "@anthropic-ai/sdk";
import { betaJSONSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import type { Settings } from "./supabase";
import { DRAFTS_SCHEMA, MAX_POST_CHARS, REWRITE_SCHEMA, draftsPrompt, rewritePrompt, systemPrompt } from "./prompts";

let anthropic: Anthropic | null = null;
const client = () => (anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

export const model = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

// Models that accept server-side refusal fallbacks (`fallbacks: "default"`).
// If a safety classifier declines a request, the API retries it on a fallback model.
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

function fallbackParams() {
  return FALLBACK_MODELS.has(model())
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};
}

function checkStop(msg: { stop_reason: string | null }) {
  if (msg.stop_reason === "refusal") throw new Error("Claude declined to write this. Try rephrasing the topic or idea.");
  if (msg.stop_reason === "max_tokens") throw new Error("Claude's reply was cut off. Try fewer drafts at once.");
}

export type Draft = { topic: string; content: string };

export async function generateDrafts(opts: {
  count: number;
  settings: Settings;
  idea?: string;
  recent: string[];
  examples: string[];
}): Promise<Draft[]> {
  const msg = await client().beta.messages.parse({
    model: model(),
    max_tokens: 16000,
    system: systemPrompt(opts.settings),
    messages: [
      {
        role: "user",
        content: draftsPrompt({
          count: opts.count,
          topics: opts.settings.topics,
          idea: opts.idea,
          recent: opts.recent,
          examples: opts.examples,
        }),
      },
    ],
    output_config: { format: betaJSONSchemaOutputFormat(DRAFTS_SCHEMA) },
    ...fallbackParams(),
  });
  checkStop(msg);
  const posts = msg.parsed_output?.posts;
  if (!posts) throw new Error("Claude returned no drafts");
  return posts
    .map((d) => ({ topic: d.topic.trim(), content: d.content.trim().slice(0, MAX_POST_CHARS) }))
    .filter((d) => d.content);
}

export async function rewritePost(content: string, instruction: string, settings: Settings) {
  const msg = await client().beta.messages.parse({
    model: model(),
    max_tokens: 8000,
    system: systemPrompt(settings),
    messages: [{ role: "user", content: rewritePrompt(content, instruction) }],
    output_config: { format: betaJSONSchemaOutputFormat(REWRITE_SCHEMA) },
    ...fallbackParams(),
  });
  checkStop(msg);
  const out = msg.parsed_output?.content?.trim();
  if (!out) throw new Error("Claude returned an empty rewrite");
  return out.slice(0, MAX_POST_CHARS);
}
