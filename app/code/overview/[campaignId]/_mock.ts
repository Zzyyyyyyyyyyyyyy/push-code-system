export type CodeCampaignStatus = "active" | "ended";

export interface CodeCampaignSummary {
  id: string;
  title: string;
  status: CodeCampaignStatus;
  daysLeft: number;
}

export interface CodePrizeSummary {
  used: number;
  total: number;
}

export interface CodeOverviewKpis {
  taps: number;
  visits: number;
  claim_rate: number;
  win_rate: number;
  taps_series: number[];
  visits_series: number[];
  claim_rate_series: number[];
  win_rate_series: number[];
}

export interface CodeCreatorRow {
  creator_id: string;
  handle: string;
  avatar_url: string | null;
  taps: number;
  visits: number;
  wins: number;
  claim_rate: number;
}

export interface StackedCreatorVisit {
  creator_id: string;
  handle?: string;
  count: number;
}

export interface StackedDailyVisit {
  date: string;
  by_creator: StackedCreatorVisit[];
  total: number;
}

export interface CodeActivityEvent {
  id: string;
  ts: string;
  kind: "visit" | "win" | "loss";
  creator_handle: string;
  campaign_title: string;
}

export interface CodeMerchantOverviewData {
  campaign: CodeCampaignSummary;
  prizes: CodePrizeSummary;
  kpis: CodeOverviewKpis;
  top_creators: CodeCreatorRow[];
  visits_by_day_stacked: StackedDailyVisit[];
  activity_feed: CodeActivityEvent[];
}

const creators: CodeCreatorRow[] = [
  {
    creator_id: "creator-zhang",
    handle: "@zhangcoffee",
    avatar_url: null,
    taps: 510,
    visits: 236,
    wins: 11,
    claim_rate: 46.3,
  },
  {
    creator_id: "creator-li",
    handle: "@licoffee",
    avatar_url: null,
    taps: 402,
    visits: 184,
    wins: 7,
    claim_rate: 45.8,
  },
  {
    creator_id: "creator-wang",
    handle: "@wangcoffee",
    avatar_url: null,
    taps: 318,
    visits: 143,
    wins: 5,
    claim_rate: 45,
  },
  {
    creator_id: "creator-maya",
    handle: "@mayabakes",
    avatar_url: null,
    taps: 188,
    visits: 82,
    wins: 0,
    claim_rate: 43.6,
  },
  {
    creator_id: "creator-noah",
    handle: "@noahplates",
    avatar_url: null,
    taps: 174,
    visits: 70,
    wins: 0,
    claim_rate: 40.2,
  },
  {
    creator_id: "creator-ari",
    handle: "@aristops",
    avatar_url: null,
    taps: 96,
    visits: 38,
    wins: 0,
    claim_rate: 39.6,
  },
];

const dailyCounts = [
  [7, 6, 4, 2, 1],
  [9, 7, 5, 3, 2],
  [11, 9, 5, 4, 3],
  [10, 8, 6, 3, 2],
  [14, 11, 8, 5, 4],
  [13, 10, 7, 5, 3],
  [17, 13, 10, 6, 5],
  [16, 12, 9, 7, 4],
  [19, 15, 11, 7, 5],
  [22, 17, 13, 8, 6],
  [20, 16, 12, 8, 5],
  [24, 18, 14, 9, 7],
  [27, 20, 15, 10, 8],
  [29, 22, 17, 11, 8],
];

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function dateNDaysAgo(daysAgo: number): string {
  const date = new Date(Date.UTC(2026, 4, 8));
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function buildStackedVisits(): StackedDailyVisit[] {
  const topFive = creators.slice(0, 5);

  return dailyCounts.map((counts, index) => {
    const by_creator = counts.map((count, creatorIndex) => ({
      creator_id: topFive[creatorIndex].creator_id,
      handle: topFive[creatorIndex].handle,
      count,
    }));

    return {
      date: dateNDaysAgo(dailyCounts.length - 1 - index),
      by_creator,
      total: by_creator.reduce((sum, item) => sum + item.count, 0),
    };
  });
}

export function getMockMerchantCodeOverview(
  campaignId: string,
): CodeMerchantOverviewData {
  const campaignTitle = "Free latte for a 30s reel";

  return {
    campaign: {
      id: campaignId,
      title: campaignTitle,
      status: "active",
      daysLeft: 9,
    },
    prizes: {
      used: 23,
      total: 30,
    },
    kpis: {
      taps: 1688,
      visits: 753,
      claim_rate: 44.6,
      win_rate: 3.1,
      taps_series: [84, 96, 112, 101, 128, 142, 156, 149, 172, 188, 201, 218],
      visits_series: [31, 38, 46, 42, 55, 61, 68, 73, 81, 87, 95, 104],
      claim_rate_series: [37, 40, 41, 42, 43, 43, 44, 45, 44, 45, 46, 45],
      win_rate_series: [1.8, 2.1, 2.4, 2.1, 2.6, 2.8, 3.1, 3, 3.2, 3.2, 3.1],
    },
    top_creators: creators,
    visits_by_day_stacked: buildStackedVisits(),
    activity_feed: [
      {
        id: "act-001",
        ts: isoMinutesAgo(8),
        kind: "win",
        creator_handle: "@zhangcoffee",
        campaign_title: campaignTitle,
      },
      {
        id: "act-002",
        ts: isoMinutesAgo(17),
        kind: "visit",
        creator_handle: "@licoffee",
        campaign_title: campaignTitle,
      },
      {
        id: "act-003",
        ts: isoMinutesAgo(26),
        kind: "loss",
        creator_handle: "@wangcoffee",
        campaign_title: campaignTitle,
      },
      {
        id: "act-004",
        ts: isoMinutesAgo(41),
        kind: "visit",
        creator_handle: "@zhangcoffee",
        campaign_title: campaignTitle,
      },
      {
        id: "act-005",
        ts: isoMinutesAgo(63),
        kind: "win",
        creator_handle: "@licoffee",
        campaign_title: campaignTitle,
      },
      {
        id: "act-006",
        ts: isoMinutesAgo(82),
        kind: "visit",
        creator_handle: "@mayabakes",
        campaign_title: campaignTitle,
      },
      {
        id: "act-007",
        ts: isoMinutesAgo(116),
        kind: "loss",
        creator_handle: "@noahplates",
        campaign_title: campaignTitle,
      },
      {
        id: "act-008",
        ts: isoMinutesAgo(144),
        kind: "visit",
        creator_handle: "@wangcoffee",
        campaign_title: campaignTitle,
      },
      {
        id: "act-009",
        ts: isoMinutesAgo(191),
        kind: "visit",
        creator_handle: "@zhangcoffee",
        campaign_title: campaignTitle,
      },
      {
        id: "act-010",
        ts: isoMinutesAgo(244),
        kind: "loss",
        creator_handle: "@licoffee",
        campaign_title: campaignTitle,
      },
      {
        id: "act-011",
        ts: isoMinutesAgo(318),
        kind: "visit",
        creator_handle: "@aristops",
        campaign_title: campaignTitle,
      },
      {
        id: "act-012",
        ts: isoMinutesAgo(396),
        kind: "win",
        creator_handle: "@zhangcoffee",
        campaign_title: campaignTitle,
      },
    ],
  };
}
