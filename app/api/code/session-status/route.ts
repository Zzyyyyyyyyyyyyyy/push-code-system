import { NextRequest } from "next/server";
import { badRequest, success } from "@/lib/api/responses";
import { getSession, getSessionRedemption } from "@/lib/code/dev-bus";

export async function GET(req: NextRequest): Promise<Response> {
  const sessionId = req.nextUrl.searchParams.get("session");
  if (!sessionId) return badRequest("`session` is required");

  const session = getSession(sessionId);
  if (!session) return success({ redeemed: false });
  if (!session.redeemed_at) return success({ redeemed: false });

  const redemption = getSessionRedemption(sessionId);
  return success({
    redeemed: true,
    outcome: redemption?.outcome ?? null,
    prize_text: redemption?.prize_text ?? null,
    redeemed_at: session.redeemed_at,
  });
}
