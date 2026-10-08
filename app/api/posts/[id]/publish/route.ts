import { publishPostById } from "@/lib/publish";
import { json } from "@/lib/http";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const r = await publishPostById(id);
  return json(r, r.ok ? 200 : r.skipped ? 409 : 502);
}
