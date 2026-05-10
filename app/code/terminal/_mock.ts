export type RedeemOutcome = "WIN" | "LOSE";

/**
 * Redeem via the real API (/api/code/redeem) when possible, falling back
 * to the static fixture below when:
 *   - NEXT_PUBLIC_USE_MOCK=1 is set explicitly, or
 *   - the API returns a network/JSON error (test env without the route)
 *
 * The API path drives the in-memory dev bus, so codes minted via the
 * /code playground actually redeem against live state.
 */
export async function redeemCodeViaApi(rawCode: string): Promise<RedeemResponse> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "1") {
    return redeemCodeFixture(rawCode);
  }
  try {
    const res = await fetch("/api/code/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: rawCode }),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        data: {
          outcome: "won" | "lost";
          position: number;
          prize_text: string | null;
          creator_handle: string;
          campaign_title: string;
        };
      };
      return {
        outcome: json.data.outcome === "won" ? "WIN" : "LOSE",
        position: json.data.position,
        prize: json.data.prize_text ?? undefined,
        creatorName: json.data.creator_handle,
        campaignName: json.data.campaign_title,
      };
    }
    // 4xx → parse the error code; 5xx → fall through to fixture
    const errJson = (await res.json().catch(() => ({}))) as { error?: string };
    const errCode = errJson.error;
    if (
      errCode === "CODE_NOT_FOUND" ||
      errCode === "CODE_ALREADY_USED" ||
      errCode === "CAMPAIGN_FULL"
    ) {
      return { errorCode: errCode };
    }
    return redeemCodeFixture(rawCode);
  } catch {
    return redeemCodeFixture(rawCode);
  }
}


export type RedeemErrorCode =
  | "CODE_NOT_FOUND"
  | "CODE_ALREADY_USED"
  | "CAMPAIGN_FULL";

export type RedeemSuccess = {
  outcome: RedeemOutcome;
  position: number;
  prize?: string;
  creatorName?: string;
  campaignName?: string;
};

export type RedeemFailure = {
  errorCode: RedeemErrorCode;
};

export type RedeemResponse = RedeemSuccess | RedeemFailure;

const NETWORK_DELAY_MS = 400;

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeCode(code: string) {
  return code.replace(/\D/g, "").slice(0, 6);
}

export async function redeemCodeFixture(
  code: string,
): Promise<RedeemResponse> {
  await delay(NETWORK_DELAY_MS);

  const normalized = normalizeCode(code);

  switch (normalized) {
    case "111111":
      return {
        outcome: "WIN",
        position: 3,
        prize: "Free Coffee",
        creatorName: "Maya Chen",
        campaignName: "Morning Boost",
      };
    case "222222":
      return {
        outcome: "LOSE",
        position: 7,
        creatorName: "Maya Chen",
        campaignName: "Morning Boost",
      };
    case "333333":
      return { errorCode: "CODE_ALREADY_USED" };
    case "444444":
      return { errorCode: "CODE_NOT_FOUND" };
    case "555555":
      return { errorCode: "CAMPAIGN_FULL" };
    default:
      return {
        outcome: "LOSE",
        position: 1,
        creatorName: "Test Creator",
        campaignName: "Test Campaign",
      };
  }
}
