import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { badRequest, notFound, success } from "@/lib/api/responses";
import { getCampaign, getMerchant, mintSession } from "@/lib/code/dev-bus";

const CODE_SESSION_COOKIE = "push_code_session";
const CODE_SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

interface LandingBody {
  token?: unknown;
}

export async function POST(req: Request): Promise<Response> {
  let body: LandingBody;
  try {
    body = (await req.json()) as LandingBody;
  } catch {
    return badRequest("Body must be valid JSON");
  }

  if (typeof body.token !== "string" || body.token.length === 0) {
    return badRequest("`token` is required");
  }

  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(CODE_SESSION_COOKIE)?.value;
  const customerCookieId = existingCookie ?? randomUUID();

  const minted = mintSession({
    token: body.token,
    customer_cookie_id: customerCookieId,
  });
  if (!minted) {
    return notFound("LINK_NOT_FOUND");
  }

  const merchant = getMerchant();
  const campaign = getCampaign(minted.link.campaign_id)!;
  const response = success({
    session_id: minted.session.id,
    link: {
      creator_handle: minted.link.creator_handle,
      merchant_name: merchant.name,
      merchant_handle: merchant.handle,
      merchant_location: "Canal Street, New York",
      campaign_title: campaign.title,
      prize_text: campaign.prize_text,
      sponsored_disclosure_text: `Sponsored by ${merchant.name}.`,
    },
  });

  if (!existingCookie) {
    response.cookies.set(CODE_SESSION_COOKIE, customerCookieId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: CODE_SESSION_COOKIE_MAX_AGE,
    });
  }

  return response;
}
