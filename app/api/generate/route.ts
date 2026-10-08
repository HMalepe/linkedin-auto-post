import { generateIntoQueue } from "@/lib/generate";
import { fail, json, readJson } from "@/lib/http";

export const maxDuration = 120;

// Body: { count?: 1-7, idea?: string }. With an idea, Claude writes `count` versions of it.
export async function POST(req: Request) {
  const b = await readJson(req);
  const n = Math.min(Math.max(Math.trunc(Number(b.count)) || 3, 1), 7);
  const idea = typeof b.idea === "string" ? b.idea.slice(0, 4000) : undefined;
  try {
    const made = await generateIntoQueue(n, idea);
    return json({ created: made.length });
  } catch (e) {
    return fail(e);
  }
}
