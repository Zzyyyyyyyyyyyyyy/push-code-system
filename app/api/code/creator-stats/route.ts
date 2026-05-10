import { NextRequest } from "next/server";
import { badRequest, success } from "@/lib/api/responses";
import {
  getCreatorAnalytics,
  type DevBusStatsRange,
} from "@/lib/code/dev-bus";

const RANGES = new Set<DevBusStatsRange>(["7d", "30d", "90d", "all"]);

export async function GET(req: NextRequest): Promise<Response> {
  const rangeParam = req.nextUrl.searchParams.get("range") ?? "30d";
  if (!RANGES.has(rangeParam as DevBusStatsRange)) {
    return badRequest("`range` must be one of 7d, 30d, 90d, all");
  }
  const handle = req.nextUrl.searchParams.get("creator") ?? "@zhangcoffee";
  return success(getCreatorAnalytics(handle, rangeParam as DevBusStatsRange));
}
