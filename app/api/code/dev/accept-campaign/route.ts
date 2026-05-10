import { badRequest, notFound, success } from "@/lib/api/responses";
import { acceptCampaign, devBusEnabled } from "@/lib/code/dev-bus";

interface AcceptBody {
  campaign_id?: unknown;
  creator_handle?: unknown;
}

export async function POST(req: Request): Promise<Response> {
  if (!devBusEnabled()) {
    return new Response(
      JSON.stringify({ error: "dev-bus disabled" }),
      { status: 410, headers: { "content-type": "application/json" } },
    );
  }

  let body: AcceptBody;
  try {
    body = (await req.json()) as AcceptBody;
  } catch {
    return badRequest("Body must be valid JSON");
  }

  if (typeof body.campaign_id !== "string") {
    return badRequest("`campaign_id` is required");
  }
  let handle =
    typeof body.creator_handle === "string" ? body.creator_handle.trim() : "";
  if (!handle) return badRequest("`creator_handle` is required");
  if (!handle.startsWith("@")) handle = `@${handle}`;

  const link = acceptCampaign({
    campaign_id: body.campaign_id,
    creator_handle: handle,
  });
  if (!link) return notFound("Campaign not found");

  return success({
    link_id: link.id,
    token: link.token,
    creator_handle: link.creator_handle,
    share_url: `/r/${link.token}`,
  });
}
