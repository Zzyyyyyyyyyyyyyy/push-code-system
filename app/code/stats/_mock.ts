export type CodeStatsRange = "7d" | "30d" | "90d" | "all";

export interface CodeKPI {
  value: number;
  delta: number;
}

export interface CodeStatsKPIs {
  taps: CodeKPI;
  visits: CodeKPI;
  claim_rate: CodeKPI;
  wins: CodeKPI;
}

export interface CodeStatsSparklines {
  taps: number[];
  visits: number[];
  claim_rate_pp: number[];
  wins: number[];
}

export interface CodeCampaignStat {
  campaign_id: string;
  campaign_title: string;
  merchant_handle: string;
  status: "active" | "ended";
  days_left: number;
  taps: number;
  visits: number;
  wins: number;
  claim_rate: number;
}

export interface CodeActivityItem {
  id: string;
  ts: string;
  kind: "tap" | "visit" | "win" | "loss";
  merchant_handle: string;
  campaign_title: string;
}

export interface CodeStatsData {
  kpis: CodeStatsKPIs;
  sparklines: CodeStatsSparklines;
  by_campaign: CodeCampaignStat[];
  activity_feed: CodeActivityItem[];
}

const RANGE_MULTIPLIER: Record<CodeStatsRange, number> = {
  "7d": 0.34,
  "30d": 1,
  "90d": 2.72,
  all: 4.15,
};

const RANGE_DELTA: Record<CodeStatsRange, CodeStatsKPIs> = {
  "7d": {
    taps: { value: 0, delta: 12 },
    visits: { value: 0, delta: 18 },
    claim_rate: { value: 0, delta: 4 },
    wins: { value: 0, delta: -8 },
  },
  "30d": {
    taps: { value: 0, delta: 9 },
    visits: { value: 0, delta: 15 },
    claim_rate: { value: 0, delta: 5 },
    wins: { value: 0, delta: 11 },
  },
  "90d": {
    taps: { value: 0, delta: 22 },
    visits: { value: 0, delta: 27 },
    claim_rate: { value: 0, delta: 2 },
    wins: { value: 0, delta: 19 },
  },
  all: {
    taps: { value: 0, delta: 31 },
    visits: { value: 0, delta: 34 },
    claim_rate: { value: 0, delta: 1 },
    wins: { value: 0, delta: 24 },
  },
};

const BASE_CAMPAIGNS: CodeCampaignStat[] = [
  {
    campaign_id: "free-latte-reel",
    campaign_title: "Free latte for a 30s reel",
    merchant_handle: "@driftcoffee",
    status: "active",
    days_left: 11,
    taps: 248,
    visits: 91,
    wins: 14,
    claim_rate: 36.7,
  },
  {
    campaign_id: "matcha-soft-open",
    campaign_title: "Matcha soft-open weekend",
    merchant_handle: "@north6matcha",
    status: "active",
    days_left: 4,
    taps: 176,
    visits: 58,
    wins: 7,
    claim_rate: 33,
  },
  {
    campaign_id: "bagel-breakfast",
    campaign_title: "Breakfast rush bagel drop",
    merchant_handle: "@cornerbagel",
    status: "ended",
    days_left: 0,
    taps: 122,
    visits: 38,
    wins: 5,
    claim_rate: 31.1,
  },
];

const BASE_ACTIVITY: Omit<CodeActivityItem, "ts">[] = [
  {
    id: "act-001",
    kind: "win",
    merchant_handle: "@driftcoffee",
    campaign_title: "Free latte for a 30s reel",
  },
  {
    id: "act-002",
    kind: "visit",
    merchant_handle: "@north6matcha",
    campaign_title: "Matcha soft-open weekend",
  },
  {
    id: "act-003",
    kind: "tap",
    merchant_handle: "@cornerbagel",
    campaign_title: "Breakfast rush bagel drop",
  },
  {
    id: "act-004",
    kind: "loss",
    merchant_handle: "@driftcoffee",
    campaign_title: "Free latte for a 30s reel",
  },
  {
    id: "act-005",
    kind: "visit",
    merchant_handle: "@driftcoffee",
    campaign_title: "Free latte for a 30s reel",
  },
  {
    id: "act-006",
    kind: "tap",
    merchant_handle: "@north6matcha",
    campaign_title: "Matcha soft-open weekend",
  },
  {
    id: "act-007",
    kind: "win",
    merchant_handle: "@cornerbagel",
    campaign_title: "Breakfast rush bagel drop",
  },
  {
    id: "act-008",
    kind: "visit",
    merchant_handle: "@driftcoffee",
    campaign_title: "Free latte for a 30s reel",
  },
  {
    id: "act-009",
    kind: "loss",
    merchant_handle: "@north6matcha",
    campaign_title: "Matcha soft-open weekend",
  },
  {
    id: "act-010",
    kind: "tap",
    merchant_handle: "@driftcoffee",
    campaign_title: "Free latte for a 30s reel",
  },
  {
    id: "act-011",
    kind: "visit",
    merchant_handle: "@cornerbagel",
    campaign_title: "Breakfast rush bagel drop",
  },
  {
    id: "act-012",
    kind: "win",
    merchant_handle: "@driftcoffee",
    campaign_title: "Free latte for a 30s reel",
  },
];

function scale(value: number, range: CodeStatsRange): number {
  return Math.round(value * RANGE_MULTIPLIER[range]);
}

function series(
  seed: number,
  length: number,
  range: CodeStatsRange,
  floor = 0,
): number[] {
  return Array.from({ length }, (_, index) => {
    const wave = Math.sin((index + seed) / 2.4) * 8;
    const slope = index * (range === "7d" ? 2.1 : range === "all" ? 0.7 : 1.2);
    const value = seed * RANGE_MULTIPLIER[range] + slope + wave;
    return Math.max(floor, Math.round(value));
  });
}

function buildActivity(): CodeActivityItem[] {
  const base = Date.parse("2026-05-08T16:30:00.000Z");
  return BASE_ACTIVITY.map((event, index) => ({
    ...event,
    ts: new Date(base - index * 42 * 60_000).toISOString(),
  }));
}

export function getCodeStatsMock(range: CodeStatsRange): CodeStatsData {
  const campaigns = BASE_CAMPAIGNS.map((campaign) => ({
    ...campaign,
    taps: scale(campaign.taps, range),
    visits: scale(campaign.visits, range),
    wins: Math.max(1, scale(campaign.wins, range)),
    claim_rate:
      Math.round((campaign.claim_rate + (range === "7d" ? 2 : 0)) * 10) / 10,
  }));

  const taps = campaigns.reduce((sum, campaign) => sum + campaign.taps, 0);
  const visits = campaigns.reduce((sum, campaign) => sum + campaign.visits, 0);
  const wins = campaigns.reduce((sum, campaign) => sum + campaign.wins, 0);
  const claimRate = Math.round((visits / taps) * 1000) / 10;
  const deltas = RANGE_DELTA[range];

  return {
    kpis: {
      taps: { value: taps, delta: deltas.taps.delta },
      visits: { value: visits, delta: deltas.visits.delta },
      claim_rate: { value: claimRate, delta: deltas.claim_rate.delta },
      wins: { value: wins, delta: deltas.wins.delta },
    },
    sparklines: {
      taps: series(22, 30, range),
      visits: series(11, 30, range),
      claim_rate_pp: series(28, 30, range, 18),
      wins: series(3, 30, range),
    },
    by_campaign: campaigns,
    activity_feed: buildActivity(),
  };
}
