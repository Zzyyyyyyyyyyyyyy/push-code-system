export type ApiSuccess<T> = {
  data: T;
  timestamp: string;
};

export type CodeOutcome = "won" | "lost";

export type CodeLandingRequest = {
  token: string;
};

export type CodeLandingData = {
  session_id: string;
  link: {
    creator_handle: string;
    merchant_name: string;
    merchant_handle: string;
    merchant_location?: string;
    campaign_title: string;
    prize_text: string;
    sponsored_disclosure_text: string;
  };
};

export type CodeCurrentData = {
  code: string;
  expires_at: string;
};

export type CodeSessionStatusData = {
  redeemed: boolean;
  outcome?: CodeOutcome;
  prize_text?: string;
  redeemed_at?: string;
};

const mockStartedAt = Date.now();
const mockSessionId = "mock-session-demo-zhang";
const rotationMs = 60_000;
const redemptionMs = 180_000;

function success<T>(data: T): ApiSuccess<T> {
  return {
    data,
    timestamp: new Date().toISOString(),
  };
}

function hashToken(token: string): number {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) % 1_000_000;
  }
  return hash;
}

function currentWindow(now = Date.now()): number {
  return Math.floor(now / rotationMs);
}

function codeForToken(token: string, now = Date.now()): string {
  const numeric = (hashToken(token) + currentWindow(now) * 73_919) % 1_000_000;
  return numeric.toString().padStart(6, "0");
}

function nextExpiry(now = Date.now()): string {
  const nextBoundary = Math.ceil((now + 1) / rotationMs) * rotationMs;
  return new Date(nextBoundary).toISOString();
}

export async function mockPostCodeLanding({
  token,
}: CodeLandingRequest): Promise<ApiSuccess<CodeLandingData>> {
  return success({
    session_id: `${mockSessionId}-${token}`,
    link: {
      creator_handle: "@zhangcoffee",
      merchant_name: "Canal Street Coffee",
      merchant_handle: "@canalcoffee",
      merchant_location: "Canal Street, New York",
      campaign_title: "Free latte for a 30s reel",
      prize_text: "One free house latte",
      sponsored_disclosure_text:
        "Paid creator partnership. FTC Section 255 disclosure.",
    },
  });
}

export async function mockGetCodeCurrent({
  token,
}: {
  token: string;
  sessionId: string;
}): Promise<ApiSuccess<CodeCurrentData>> {
  return success({
    code: codeForToken(token),
    expires_at: nextExpiry(),
  });
}

export async function mockGetCodeSessionStatus({
  sessionId,
}: {
  token: string;
  sessionId: string;
}): Promise<ApiSuccess<CodeSessionStatusData>> {
  const redeemed = Date.now() - mockStartedAt >= redemptionMs;

  if (!redeemed) {
    return success({ redeemed: false });
  }

  const won = sessionId.includes("zhang");

  return success({
    redeemed: true,
    outcome: won ? "won" : "lost",
    prize_text: won ? "One free house latte" : undefined,
    redeemed_at: new Date(mockStartedAt + redemptionMs).toISOString(),
  });
}
