import { cookies, headers } from "next/headers";
import CustomerCodeClient, {
  type CustomerCodeInitialData,
} from "./CustomerCodeClient";
import {
  mockGetCodeCurrent,
  mockPostCodeLanding,
  type ApiSuccess,
  type CodeCurrentData,
  type CodeLandingData,
} from "./_mock";
import "./customer-code.css";

async function isDemoConsumer(): Promise<boolean> {
  const c = await cookies();
  return c.get("push-demo-role")?.value === "consumer";
}

function mockOn(): boolean {
  // Local _mock.ts is only used when NEXT_PUBLIC_USE_MOCK=1 is explicitly
  // set (e.g. CI fixtures or component-level snapshot tests).  In normal dev
  // mode the API route already falls through to lib/code/dev-bus when no DB
  // is configured, so going through the API gives us live state shared with
  // the /code playground.  Demo cookies are still handled below.
  return process.env.NEXT_PUBLIC_USE_MOCK === "1";
}

type PageProps = {
  params: Promise<{ token: string }>;
};

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload
  ) {
    return (payload as ApiSuccess<T>).data;
  }

  return payload as T;
}

async function apiBaseUrl(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}

async function postLanding(token: string): Promise<CodeLandingData> {
  if (mockOn() || (await isDemoConsumer())) {
    return unwrap(await mockPostCodeLanding({ token }));
  }

  const headerStore = await headers();
  const response = await fetch(`${await apiBaseUrl()}/api/code/landing`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: headerStore.get("cookie") ?? "",
    },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load code landing");
  }

  return unwrap((await response.json()) as ApiSuccess<CodeLandingData>);
}

async function getCurrentCode(
  token: string,
  sessionId: string,
): Promise<CodeCurrentData> {
  if (mockOn() || (await isDemoConsumer())) {
    return unwrap(await mockGetCodeCurrent({ token, sessionId }));
  }

  const response = await fetch(
    `${await apiBaseUrl()}/api/code/current?session=${encodeURIComponent(
      sessionId,
    )}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Unable to load current code");
  }

  return unwrap((await response.json()) as ApiSuccess<CodeCurrentData>);
}

export default async function CustomerCodePage({ params }: PageProps) {
  const { token } = await params;
  const landing = await postLanding(token);
  const current = await getCurrentCode(token, landing.session_id);

  const initialData: CustomerCodeInitialData = {
    token,
    sessionId: landing.session_id,
    campaignTitle: landing.link.campaign_title,
    prizeText: landing.link.prize_text,
    merchantName: landing.link.merchant_name,
    merchantHandle: landing.link.merchant_handle,
    merchantLocation: landing.link.merchant_location ?? "New York, NY",
    creatorHandle: landing.link.creator_handle,
    sponsoredDisclosureText: landing.link.sponsored_disclosure_text,
    currentCode: current.code,
    expiresAt: current.expires_at,
  };

  return <CustomerCodeClient initialData={initialData} />;
}
