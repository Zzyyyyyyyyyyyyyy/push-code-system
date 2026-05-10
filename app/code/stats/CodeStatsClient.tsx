"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared";
import {
  RecentActivity,
  type ActivityEvent,
  type ActivityEventType,
} from "@/components/shared/RecentActivity";
import "./code-stats.css";
import { CodeCampaignList } from "./sections/CodeCampaignList";
import { CodeKPIGrid } from "./sections/CodeKPIGrid";
import {
  getCodeStatsMock,
  type CodeActivityItem,
  type CodeStatsData,
  type CodeStatsRange,
} from "./_mock";

const RANGES: { key: CodeStatsRange; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "all", label: "All" },
];

interface CodeStatsClientProps {
  initialData: CodeStatsData;
}

function RangePills({
  range,
  onRangeChange,
}: {
  range: CodeStatsRange;
  onRangeChange: (range: CodeStatsRange) => void;
}) {
  return (
    <div
      className="cs-range-pills"
      role="tablist"
      aria-label="Code stats time range"
    >
      {RANGES.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={range === option.key}
          className={
            "cs-range-pill" + (range === option.key ? " is-active" : "")
          }
          onClick={() => onRangeChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function activityTitle(event: CodeActivityItem): string {
  if (event.kind === "tap") return "Code link tapped";
  if (event.kind === "visit") return "Store visit attributed";
  if (event.kind === "win") return "Prize won";
  return "Code checked";
}

function mapActivity(events: CodeActivityItem[]): ActivityEvent[] {
  const typeByKind: Record<CodeActivityItem["kind"], ActivityEventType> = {
    // Rotating-code activity is projected onto the five existing RecentActivity
    // event types: tap/loss use applicant.applied, visits use redemption.verified,
    // and wins use payment.toppedup for the champagne award treatment.
    tap: "applicant.applied",
    visit: "redemption.verified",
    win: "payment.toppedup",
    loss: "applicant.applied",
  };

  return events.map((event) => ({
    id: event.id,
    type: typeByKind[event.kind],
    timestamp: event.ts,
    title: activityTitle(event),
    meta: `${event.merchant_handle} · ${event.campaign_title}`,
  }));
}

export default function CodeStatsClient({
  initialData,
}: CodeStatsClientProps) {
  const [range, setRange] = useState<CodeStatsRange>("30d");

  const data = useMemo(
    () => (range === "30d" ? initialData : getCodeStatsMock(range)),
    [initialData, range],
  );
  const mappedEvents = useMemo(
    () => mapActivity(data.activity_feed),
    [data.activity_feed],
  );

  return (
    <div className="db-dashboard-page cs-code-stats-page anim-page">
      <PageHeader
        eyebrow="(YOUR PERFORMANCE)"
        title="Code Stats"
        subtitle="Your conversions across active campaigns."
      />

      <RangePills range={range} onRangeChange={setRange} />
      <CodeKPIGrid
        range={range}
        data={data.kpis}
        sparklines={data.sparklines}
      />
      <CodeCampaignList campaigns={data.by_campaign} />
      <RecentActivity events={mappedEvents} limit={12} eyebrow="LIVE ACTIVITY" />
    </div>
  );
}
