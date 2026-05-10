"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/shared";
import {
  RecentActivity,
  type ActivityEvent,
} from "@/components/shared/RecentActivity";
import { AcceptedCreators } from "./sections/AcceptedCreators";
import { CampaignHeroStrip } from "./sections/CampaignHeroStrip";
import { CodeOverviewKPIs } from "./sections/CodeOverviewKPIs";
import { CreatorLeaderboard } from "./sections/CreatorLeaderboard";
import { RecentRedemptions } from "./sections/RecentRedemptions";
import { StackedDailyBars } from "./sections/StackedDailyBars";
import type { CodeActivityEvent, CodeMerchantOverviewData } from "./_mock";
import "./code-overview.css";

interface CodeOverviewClientProps {
  initialData: CodeMerchantOverviewData;
}

function mapActivityKind(kind: CodeActivityEvent["kind"]): ActivityEvent["type"] {
  if (kind === "visit") return "campaign.launched";
  if (kind === "win") return "payment.toppedup";
  return "redemption.verified";
}

export default function CodeOverviewClient({
  initialData,
}: CodeOverviewClientProps) {
  const { campaign, prizes } = initialData;

  const mappedEvents = useMemo<ActivityEvent[]>(
    () =>
      initialData.activity_feed.map((event) => ({
        id: event.id,
        // Code activity kinds are projected onto the existing RecentActivity
        // event taxonomy so the shared component stays unchanged.
        type: mapActivityKind(event.kind),
        timestamp: event.ts,
        title:
          event.kind === "visit"
            ? `${event.creator_handle} drove a new visit`
            : event.kind === "win"
              ? `${event.creator_handle} generated a prize win`
              : `${event.creator_handle} claim resolved without prize`,
        meta: event.campaign_title,
      })),
    [initialData.activity_feed],
  );

  return (
    <div className="db-dashboard-page co-page cv-shell anim-page">
      <PageHeader
        eyebrow="(CAMPAIGN OVERVIEW)"
        title={campaign.title}
        subtitle={`${campaign.daysLeft} days left · ${prizes.used}/${prizes.total} prizes given`}
        action={
          <Link
            href={`/merchant/campaigns/${campaign.id}`}
            className="btn-ghost"
          >
            Edit campaign
          </Link>
        }
      />

      <CampaignHeroStrip
        status={campaign.status}
        daysLeft={campaign.daysLeft}
        prizesUsed={prizes.used}
        prizesTotal={prizes.total}
      />

      <CodeOverviewKPIs kpis={initialData.kpis} />

      <AcceptedCreators campaignId={campaign.id} />

      <CreatorLeaderboard rows={initialData.top_creators} sort="visits" />

      <StackedDailyBars data={initialData.visits_by_day_stacked} />

      <RecentRedemptions campaignId={campaign.id} />

      <RecentActivity
        events={mappedEvents}
        limit={12}
        eyebrow="LIVE ACTIVITY"
      />
    </div>
  );
}
