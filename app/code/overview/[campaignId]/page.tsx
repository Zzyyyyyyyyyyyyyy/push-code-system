import { headers } from "next/headers";
import { devBusEnabled } from "@/lib/code/dev-bus";
import CodeOverviewClient from "./CodeOverviewClient";
import {
  getMockMerchantCodeOverview,
  type CodeMerchantOverviewData,
} from "./_mock";

interface CodeOverviewPageProps {
  params: Promise<{ campaignId: string }>;
}

interface ApiSuccess<T> {
  data: T;
}

async function apiBaseUrl(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}

async function getInitialData(
  campaignId: string,
): Promise<CodeMerchantOverviewData> {
  const fallback = getMockMerchantCodeOverview(campaignId);
  if (!devBusEnabled()) return fallback;

  try {
    const response = await fetch(
      `${await apiBaseUrl()}/api/code/merchant-overview?campaign_id=${encodeURIComponent(
        campaignId,
      )}`,
      { cache: "no-store" },
    );
    if (!response.ok) return fallback;

    const payload =
      (await response.json()) as ApiSuccess<CodeMerchantOverviewData>;
    return payload.data;
  } catch {
    return fallback;
  }
}

export default async function MerchantCodeOverviewPage({
  params,
}: CodeOverviewPageProps) {
  const { campaignId } = await params;
  const initialData = await getInitialData(campaignId);

  return <CodeOverviewClient initialData={initialData} />;
}
