import { NextRequest } from "next/server";
import { badRequest, success } from "@/lib/api/responses";
import { getMerchantOverview } from "@/lib/code/dev-bus";

export async function GET(req: NextRequest): Promise<Response> {
  const campaignId = req.nextUrl.searchParams.get("campaign_id");
  if (!campaignId) return badRequest("`campaign_id` is required");
  return success(getMerchantOverview(campaignId));
}
