import { success } from "@/lib/api/responses";
import { devBusEnabled, reset } from "@/lib/code/dev-bus";

export async function POST(): Promise<Response> {
  if (!devBusEnabled()) {
    return new Response(
      JSON.stringify({ error: "dev-bus disabled" }),
      { status: 410, headers: { "content-type": "application/json" } },
    );
  }
  reset();
  return success({ ok: true, cleared_at: new Date().toISOString() });
}
