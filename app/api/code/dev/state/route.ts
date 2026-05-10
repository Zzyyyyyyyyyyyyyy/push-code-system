import { success } from "@/lib/api/responses";
import { devBusEnabled, dumpState } from "@/lib/code/dev-bus";

export async function GET(): Promise<Response> {
  if (!devBusEnabled()) {
    return new Response(
      JSON.stringify({ error: "dev-bus disabled (production or DB configured)" }),
      { status: 410, headers: { "content-type": "application/json" } },
    );
  }
  return success(dumpState());
}
