import { headers } from "next/headers";
import { devBusEnabled } from "@/lib/code/dev-bus";
import CodeStatsClient from "./CodeStatsClient";
import { getCodeStatsMock, type CodeStatsData } from "./_mock";

interface ApiSuccess<T> {
  data: T;
}

async function apiBaseUrl(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}

function hasLiveStats(data: CodeStatsData): boolean {
  return (
    data.by_campaign.length > 0 ||
    data.kpis.taps.value > 0 ||
    data.kpis.visits.value > 0 ||
    data.kpis.wins.value > 0
  );
}

async function getInitialData(): Promise<CodeStatsData> {
  const fallback = getCodeStatsMock("30d");
  if (!devBusEnabled()) return fallback;

  try {
    const response = await fetch(
      `${await apiBaseUrl()}/api/code/creator-stats?creator=${encodeURIComponent(
        "@zhangcoffee",
      )}&range=30d`,
      { cache: "no-store" },
    );
    if (!response.ok) return fallback;

    const payload = (await response.json()) as ApiSuccess<CodeStatsData>;
    return hasLiveStats(payload.data) ? payload.data : fallback;
  } catch {
    return fallback;
  }
}

export default async function CreatorCodeStatsPage() {
  return <CodeStatsClient initialData={await getInitialData()} />;
}
