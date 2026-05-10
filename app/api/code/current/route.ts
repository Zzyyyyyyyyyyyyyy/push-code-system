import { NextRequest } from "next/server";
import { badRequest, notFound, success } from "@/lib/api/responses";
import { currentCodeForSession, getSession } from "@/lib/code/dev-bus";

function gone(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 410,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  const sessionId = req.nextUrl.searchParams.get("session");
  if (!sessionId) return badRequest("`session` is required");

  const session = getSession(sessionId);
  if (!session) return notFound("SESSION_NOT_FOUND");
  if (session.redeemed_at) return gone("SESSION_REDEEMED");

  return success(currentCodeForSession(session));
}
