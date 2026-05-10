import { badRequest, success } from "@/lib/api/responses";
import { redeemCode } from "@/lib/code/dev-bus";

interface RedeemBody {
  code?: unknown;
}

export async function POST(req: Request): Promise<Response> {
  let body: RedeemBody;
  try {
    body = (await req.json()) as RedeemBody;
  } catch {
    return badRequest("Body must be valid JSON");
  }
  if (typeof body.code !== "string") return badRequest("`code` is required");

  const result = redeemCode(body.code);
  if (result.ok) return success(result.data);
  return badRequest(result.code);
}
