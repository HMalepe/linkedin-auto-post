import { NextResponse } from "next/server";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const fail = (e: unknown, status = 500) => json({ error: errorMessage(e) }, status);

// Parses a JSON object body; anything else becomes {}.
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const b = await req.json().catch(() => null);
  return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
}
