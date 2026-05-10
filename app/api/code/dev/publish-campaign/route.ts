import { badRequest, success } from "@/lib/api/responses";
import {
  devBusEnabled,
  publishCampaign,
  type BracketsPreset,
} from "@/lib/code/dev-bus";

interface PublishBody {
  title?: unknown;
  prize_text?: unknown;
  prize_total?: unknown;
  entry_total?: unknown;
  preset?: unknown;
}

const VALID_PRESETS: BracketsPreset[] = [
  "front-heavy",
  "even",
  "sleeper",
  "custom",
];

export async function POST(req: Request): Promise<Response> {
  if (!devBusEnabled()) {
    return new Response(
      JSON.stringify({ error: "dev-bus disabled" }),
      { status: 410, headers: { "content-type": "application/json" } },
    );
  }

  let body: PublishBody;
  try {
    body = (await req.json()) as PublishBody;
  } catch {
    return badRequest("Body must be valid JSON");
  }

  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    return badRequest("`title` is required");
  }
  if (typeof body.prize_text !== "string" || body.prize_text.trim().length === 0) {
    return badRequest("`prize_text` is required");
  }
  if (typeof body.prize_total !== "number" || body.prize_total < 1) {
    return badRequest("`prize_total` must be a positive integer");
  }
  if (typeof body.entry_total !== "number" || body.entry_total < body.prize_total) {
    return badRequest("`entry_total` must be ≥ prize_total");
  }
  if (
    typeof body.preset !== "string" ||
    !VALID_PRESETS.includes(body.preset as BracketsPreset)
  ) {
    return badRequest(`\`preset\` must be one of: ${VALID_PRESETS.join(", ")}`);
  }

  const campaign = publishCampaign({
    title: body.title.trim(),
    prize_text: body.prize_text.trim(),
    prize_total: body.prize_total,
    entry_total: body.entry_total,
    preset: body.preset as BracketsPreset,
  });

  return success({
    campaign_id: campaign.id,
    title: campaign.title,
    brackets: campaign.brackets,
    winning_positions_count: campaign.winning_positions.size,
  });
}
