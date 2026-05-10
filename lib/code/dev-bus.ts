/**
 * In-memory dev bus for the rotating-code playground at /code.
 *
 * Provides a single shared store for campaigns / links / sessions /
 * redemptions so the merchant publish form, creator inbox, customer
 * landing, staff terminal, and analytics dashboards all see the same
 * state across browser tabs in dev — without needing the Supabase
 * migration applied.  Cleared on dev server restart (intentional).
 *
 * Production code paths (real DB) are completely unaffected — every API
 * endpoint only routes through this bus when `devBusEnabled()` returns
 * true (dev mode + no SUPABASE_URL configured).
 */

import { randomBytes, randomUUID } from "node:crypto";
import { currentTotpWindow, generateTotp, totpMinute } from "./totp";

// ─── types ───────────────────────────────────────────────────────────────

export type BracketsPreset = "front-heavy" | "even" | "sleeper" | "custom";

export interface Bracket {
  start: number; // 1-indexed inclusive
  end: number; // inclusive
  prizes: number;
}

export interface Campaign {
  id: string;
  merchant_id: string;
  title: string;
  prize_text: string;
  prize_total: number;
  entry_total: number; // last bracket.end
  brackets: Bracket[];
  winning_positions: Set<number>;
  claim_counter: number;
  status: "active" | "ended";
  created_at: string;
}

export interface CodeLink {
  id: string;
  token: string;
  campaign_id: string;
  creator_handle: string;
  secret: Buffer; // unused now (per-session secrets), kept for parity
  disabled: boolean;
  tap_count: number; // raw POST /landing hits
  created_at: string;
}

export interface CodeSession {
  id: string;
  link_id: string;
  customer_cookie_id: string;
  secret: Buffer;
  redeemed_at: string | null;
  created_at: string;
}

export interface CodeRedemption {
  id: string;
  session_id: string;
  link_id: string;
  campaign_id: string;
  creator_handle: string;
  position_in_campaign: number;
  outcome: "won" | "lost";
  prize_text: string | null;
  created_at: string;
}

interface DevBus {
  merchant: { id: string; handle: string; name: string };
  campaigns: Map<string, Campaign>;
  links: Map<string, CodeLink>; // keyed by link.id
  linksByToken: Map<string, string>; // token -> link.id
  sessions: Map<string, CodeSession>;
  redemptions: Map<string, CodeRedemption>;
}

// ─── singleton ──────────────────────────────────────────────────────────

const g = globalThis as { __codeDevBus?: DevBus };
if (!g.__codeDevBus) {
  g.__codeDevBus = {
    merchant: {
      id: "demo-merchant",
      handle: "@canalcoffee",
      name: "Canal Street Coffee",
    },
    campaigns: new Map(),
    links: new Map(),
    linksByToken: new Map(),
    sessions: new Map(),
    redemptions: new Map(),
  };
}
const bus = g.__codeDevBus;

export function devBusEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

export function getMerchant() {
  return bus.merchant;
}

// ─── tokens / random ────────────────────────────────────────────────────

const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // base32-ish, no 0/1/i/l/o
function randomToken(len = 8): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

// ─── bracket presets ────────────────────────────────────────────────────

export function bracketsForPreset(
  preset: BracketsPreset,
  prizeTotal: number,
  entryTotal: number,
): Bracket[] {
  if (preset === "even") {
    return [{ start: 1, end: entryTotal, prizes: prizeTotal }];
  }
  if (preset === "front-heavy") {
    const earlyEnd = Math.max(1, Math.floor(entryTotal * 0.3));
    const earlyPrizes = Math.min(
      prizeTotal,
      Math.max(1, Math.floor(prizeTotal * 0.7)),
    );
    return [
      { start: 1, end: earlyEnd, prizes: earlyPrizes },
      {
        start: earlyEnd + 1,
        end: entryTotal,
        prizes: prizeTotal - earlyPrizes,
      },
    ];
  }
  if (preset === "sleeper") {
    const earlyEnd = Math.max(1, Math.floor(entryTotal * 0.3));
    const earlyPrizes = Math.max(
      1,
      Math.floor(prizeTotal * 0.2),
    );
    return [
      { start: 1, end: earlyEnd, prizes: earlyPrizes },
      {
        start: earlyEnd + 1,
        end: entryTotal,
        prizes: prizeTotal - earlyPrizes,
      },
    ];
  }
  // custom — caller passes brackets directly
  return [{ start: 1, end: entryTotal, prizes: prizeTotal }];
}

function sealWinningPositions(brackets: Bracket[]): Set<number> {
  const winners = new Set<number>();
  for (const b of brackets) {
    const range: number[] = [];
    for (let p = b.start; p <= b.end; p++) range.push(p);
    // Fisher–Yates shuffle, take first `prizes`
    for (let i = range.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [range[i], range[j]] = [range[j], range[i]];
    }
    range.slice(0, Math.min(b.prizes, range.length)).forEach((p) => winners.add(p));
  }
  return winners;
}

// ─── mutations ──────────────────────────────────────────────────────────

export function publishCampaign(input: {
  title: string;
  prize_text: string;
  prize_total: number;
  entry_total: number;
  preset: BracketsPreset;
  brackets?: Bracket[];
}): Campaign {
  const brackets =
    input.preset === "custom" && input.brackets && input.brackets.length > 0
      ? input.brackets
      : bracketsForPreset(input.preset, input.prize_total, input.entry_total);

  const id = randomUUID();
  const campaign: Campaign = {
    id,
    merchant_id: bus.merchant.id,
    title: input.title,
    prize_text: input.prize_text,
    prize_total: input.prize_total,
    entry_total: input.entry_total,
    brackets,
    winning_positions: sealWinningPositions(brackets),
    claim_counter: 0,
    status: "active",
    created_at: new Date().toISOString(),
  };
  bus.campaigns.set(id, campaign);
  return campaign;
}

export function acceptCampaign(input: {
  campaign_id: string;
  creator_handle: string;
}): CodeLink | null {
  const campaign = bus.campaigns.get(input.campaign_id);
  if (!campaign) return null;

  // If this creator has already accepted, return their existing link
  for (const link of bus.links.values()) {
    if (
      link.campaign_id === input.campaign_id &&
      link.creator_handle === input.creator_handle
    ) {
      return link;
    }
  }

  const id = randomUUID();
  let token = randomToken(8);
  while (bus.linksByToken.has(token)) token = randomToken(8);

  const link: CodeLink = {
    id,
    token,
    campaign_id: input.campaign_id,
    creator_handle: input.creator_handle,
    secret: randomBytes(32),
    disabled: false,
    tap_count: 0,
    created_at: new Date().toISOString(),
  };
  bus.links.set(id, link);
  bus.linksByToken.set(token, id);
  return link;
}

export function mintSession(input: {
  token: string;
  customer_cookie_id: string;
}): { link: CodeLink; session: CodeSession; campaign: Campaign } | null {
  const linkId = bus.linksByToken.get(input.token);
  if (!linkId) return null;
  const link = bus.links.get(linkId)!;
  const campaign = bus.campaigns.get(link.campaign_id);
  if (!campaign) return null;
  if (link.disabled || campaign.status === "ended") return null;

  // Reuse session if same cookie already has one for this link.
  // Tap counter only increments on a truly new session — repeat fetches
  // with the same cookie (page refreshes, repeated SSR hydration calls,
  // playground polling) shouldn't inflate the metric.
  for (const s of bus.sessions.values()) {
    if (
      s.link_id === link.id &&
      s.customer_cookie_id === input.customer_cookie_id
    ) {
      return { link, session: s, campaign };
    }
  }

  // New session — count this as a real tap.
  link.tap_count += 1;

  const session: CodeSession = {
    id: randomUUID(),
    link_id: link.id,
    customer_cookie_id: input.customer_cookie_id,
    secret: randomBytes(32),
    redeemed_at: null,
    created_at: new Date().toISOString(),
  };
  bus.sessions.set(session.id, session);
  return { link, session, campaign };
}

/**
 * Atomic-ish redeem.  Single-process Node so no real concurrency, but we
 * still mirror the production guard (re-check redeemed_at after lookup).
 */
export type RedeemResult =
  | {
      ok: true;
      data: {
        outcome: "won" | "lost";
        position: number;
        prize_text: string | null;
        creator_handle: string;
        campaign_title: string;
        session_id: string;
      };
    }
  | {
      ok: false;
      code:
        | "CODE_NOT_FOUND"
        | "CODE_ALREADY_USED"
        | "CAMPAIGN_FULL"
        | "CODE_AMBIGUOUS";
    };

export function redeemCode(rawCode: string): RedeemResult {
  const code = rawCode.replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, code: "CODE_NOT_FOUND" };

  // Search active sessions for ones whose current/prev minute TOTP matches.
  // Collect ALL matches — if the codespace happens to collide across two
  // simultaneously-active sessions in the same window, we refuse to guess
  // and ask staff to retry on a fresh code rather than mis-attribute.
  const matches: CodeSession[] = [];
  for (const s of bus.sessions.values()) {
    if (s.redeemed_at) continue;
    const [c1, c2] = currentTotpWindow(s.secret);
    if (c1 === code || c2 === code) {
      matches.push(s);
      if (matches.length >= 2) break;
    }
  }
  if (matches.length === 0) return { ok: false, code: "CODE_NOT_FOUND" };
  if (matches.length >= 2) return { ok: false, code: "CODE_AMBIGUOUS" };
  const matched = matches[0];

  if (matched.redeemed_at) return { ok: false, code: "CODE_ALREADY_USED" };

  const link = bus.links.get(matched.link_id)!;
  const campaign = bus.campaigns.get(link.campaign_id)!;

  campaign.claim_counter += 1;
  const position = campaign.claim_counter;
  if (position > campaign.entry_total) {
    campaign.claim_counter -= 1; // rollback
    campaign.status = "ended";
    return { ok: false, code: "CAMPAIGN_FULL" };
  }

  const won = campaign.winning_positions.has(position);
  matched.redeemed_at = new Date().toISOString();

  const redemption: CodeRedemption = {
    id: randomUUID(),
    session_id: matched.id,
    link_id: link.id,
    campaign_id: campaign.id,
    creator_handle: link.creator_handle,
    position_in_campaign: position,
    outcome: won ? "won" : "lost",
    prize_text: won ? campaign.prize_text : null,
    created_at: new Date().toISOString(),
  };
  bus.redemptions.set(redemption.id, redemption);

  return {
    ok: true,
    data: {
      outcome: redemption.outcome,
      position,
      prize_text: redemption.prize_text,
      creator_handle: link.creator_handle,
      campaign_title: campaign.title,
      session_id: matched.id,
    },
  };
}

export function reset() {
  bus.campaigns.clear();
  bus.links.clear();
  bus.linksByToken.clear();
  bus.sessions.clear();
  bus.redemptions.clear();
}

// ─── reads / aggregates ─────────────────────────────────────────────────

export function getCampaign(id: string): Campaign | undefined {
  return bus.campaigns.get(id);
}

export function getCampaigns(): Campaign[] {
  return [...bus.campaigns.values()].sort(
    (a, b) => b.created_at.localeCompare(a.created_at),
  );
}

export function getLinkByToken(token: string): CodeLink | undefined {
  const linkId = bus.linksByToken.get(token);
  return linkId ? bus.links.get(linkId) : undefined;
}

export function getSession(id: string): CodeSession | undefined {
  return bus.sessions.get(id);
}

export function currentCodeForSession(
  session: CodeSession,
): { code: string; expires_at: string } {
  const minute = totpMinute();
  const code = generateTotp(session.secret, minute);
  // expires at next minute boundary
  const expiresAt = new Date((minute + 1) * 60 * 1000).toISOString();
  return { code, expires_at: expiresAt };
}

export function getSessionRedemption(
  sessionId: string,
): CodeRedemption | undefined {
  for (const r of bus.redemptions.values()) {
    if (r.session_id === sessionId) return r;
  }
  return undefined;
}

export function getCreatorInbox(creatorHandle: string): {
  unaccepted: Campaign[];
  accepted: { campaign: Campaign; link: CodeLink }[];
} {
  const accepted: { campaign: Campaign; link: CodeLink }[] = [];
  const acceptedCampaignIds = new Set<string>();
  for (const link of bus.links.values()) {
    if (link.creator_handle === creatorHandle) {
      const c = bus.campaigns.get(link.campaign_id);
      if (c) {
        accepted.push({ campaign: c, link });
        acceptedCampaignIds.add(c.id);
      }
    }
  }
  const unaccepted = getCampaigns().filter(
    (c) => c.status === "active" && !acceptedCampaignIds.has(c.id),
  );
  return { unaccepted, accepted };
}

export function getLinkStats(linkId: string): {
  taps: number;
  sessions: number;
  visits: number;
  wins: number;
  claim_rate: number;
} {
  const link = bus.links.get(linkId);
  if (!link) return { taps: 0, sessions: 0, visits: 0, wins: 0, claim_rate: 0 };
  let sessions = 0;
  for (const s of bus.sessions.values()) {
    if (s.link_id === linkId) sessions += 1;
  }
  let visits = 0;
  let wins = 0;
  for (const r of bus.redemptions.values()) {
    if (r.link_id === linkId) {
      visits += 1;
      if (r.outcome === "won") wins += 1;
    }
  }
  const claim_rate = link.tap_count > 0 ? visits / link.tap_count : 0;
  return { taps: link.tap_count, sessions, visits, wins, claim_rate };
}

export function getCampaignStats(campaignId: string): {
  taps: number;
  visits: number;
  wins: number;
  prize_used: number;
  prize_total: number;
  claim_rate: number;
  win_rate: number;
  by_creator: {
    creator_handle: string;
    taps: number;
    visits: number;
    wins: number;
    claim_rate: number;
  }[];
} {
  const campaign = bus.campaigns.get(campaignId);
  if (!campaign) {
    return {
      taps: 0,
      visits: 0,
      wins: 0,
      prize_used: 0,
      prize_total: 0,
      claim_rate: 0,
      win_rate: 0,
      by_creator: [],
    };
  }
  let totalTaps = 0;
  let totalVisits = 0;
  let totalWins = 0;
  const perCreator = new Map<
    string,
    { taps: number; visits: number; wins: number }
  >();
  for (const link of bus.links.values()) {
    if (link.campaign_id !== campaignId) continue;
    const stat = getLinkStats(link.id);
    totalTaps += stat.taps;
    totalVisits += stat.visits;
    totalWins += stat.wins;
    const prev = perCreator.get(link.creator_handle) ?? {
      taps: 0,
      visits: 0,
      wins: 0,
    };
    perCreator.set(link.creator_handle, {
      taps: prev.taps + stat.taps,
      visits: prev.visits + stat.visits,
      wins: prev.wins + stat.wins,
    });
  }
  const by_creator = [...perCreator.entries()]
    .map(([creator_handle, s]) => ({
      creator_handle,
      ...s,
      claim_rate: s.taps > 0 ? s.visits / s.taps : 0,
    }))
    .sort((a, b) => b.visits - a.visits);
  return {
    taps: totalTaps,
    visits: totalVisits,
    wins: totalWins,
    prize_used: totalWins,
    prize_total: campaign.prize_total,
    claim_rate: totalTaps > 0 ? totalVisits / totalTaps : 0,
    win_rate: totalVisits > 0 ? totalWins / totalVisits : 0,
    by_creator,
  };
}

export function getRecentActivity(limit = 20): {
  id: string;
  ts: string;
  kind: "publish" | "accept" | "tap" | "redeem-win" | "redeem-loss";
  text: string;
}[] {
  const events: {
    id: string;
    ts: string;
    kind: "publish" | "accept" | "tap" | "redeem-win" | "redeem-loss";
    text: string;
  }[] = [];

  for (const c of bus.campaigns.values()) {
    events.push({
      id: `c-${c.id}`,
      ts: c.created_at,
      kind: "publish",
      text: `Merchant published "${c.title}" · ${c.prize_total} prizes`,
    });
  }
  for (const l of bus.links.values()) {
    const c = bus.campaigns.get(l.campaign_id);
    events.push({
      id: `l-${l.id}`,
      ts: l.created_at,
      kind: "accept",
      text: `${l.creator_handle} accepted "${c?.title ?? "?"}"`,
    });
  }
  for (const r of bus.redemptions.values()) {
    const c = bus.campaigns.get(r.campaign_id);
    events.push({
      id: `r-${r.id}`,
      ts: r.created_at,
      kind: r.outcome === "won" ? "redeem-win" : "redeem-loss",
      text:
        r.outcome === "won"
          ? `${r.creator_handle}'s customer WON · pos #${r.position_in_campaign} · "${c?.title}"`
          : `${r.creator_handle}'s customer visited (no win) · pos #${r.position_in_campaign}`,
    });
  }

  return events.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit);
}

// ─── standalone v1 page aggregates ─────────────────────────────────────

export type DevBusStatsRange = "7d" | "30d" | "90d" | "all";

export interface DevBusCreatorAnalytics {
  kpis: {
    taps: { value: number; delta: number };
    visits: { value: number; delta: number };
    claim_rate: { value: number; delta: number };
    wins: { value: number; delta: number };
  };
  sparklines: {
    taps: number[];
    visits: number[];
    claim_rate_pp: number[];
    wins: number[];
  };
  by_campaign: {
    campaign_id: string;
    campaign_title: string;
    merchant_handle: string;
    status: "active" | "ended";
    days_left: number;
    taps: number;
    visits: number;
    wins: number;
    claim_rate: number;
  }[];
  activity_feed: {
    id: string;
    ts: string;
    kind: "tap" | "visit" | "win" | "loss";
    merchant_handle: string;
    campaign_title: string;
  }[];
}

export interface DevBusMerchantOverview {
  campaign: {
    id: string;
    title: string;
    status: "active" | "ended";
    daysLeft: number;
  };
  prizes: { used: number; total: number };
  kpis: {
    taps: number;
    visits: number;
    claim_rate: number;
    win_rate: number;
    taps_series: number[];
    visits_series: number[];
    claim_rate_series: number[];
    win_rate_series: number[];
  };
  top_creators: {
    creator_id: string;
    handle: string;
    avatar_url: string | null;
    taps: number;
    visits: number;
    wins: number;
    claim_rate: number;
  }[];
  visits_by_day_stacked: {
    date: string;
    by_creator: {
      creator_id: string;
      handle?: string;
      count: number;
    }[];
    total: number;
  }[];
  activity_feed: {
    id: string;
    ts: string;
    kind: "visit" | "win" | "loss";
    creator_handle: string;
    campaign_title: string;
  }[];
}

const DAY_MS = 86_400_000;

function normalizeHandle(handle: string): string {
  const trimmed = handle.trim();
  if (!trimmed) return "@zhangcoffee";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function creatorIdForHandle(handle: string): string {
  const slug = handle.replace(/^@/, "").replace(/[^a-zA-Z0-9_-]/g, "");
  return `creator-${slug || "unknown"}`;
}

function rangeStart(range: DevBusStatsRange): number | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return Date.now() - days * DAY_MS;
}

function inRange(iso: string, start: number | null): boolean {
  return start === null || new Date(iso).getTime() >= start;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function recentDayKeys(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.now() - (count - index - 1) * DAY_MS);
    return date.toISOString().slice(0, 10);
  });
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function countByDay<T>(
  days: string[],
  rows: T[],
  getCreatedAt: (row: T) => string,
): number[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = dayKey(getCreatedAt(row));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return days.map((day) => counts.get(day) ?? 0);
}

function latestCampaign(): Campaign | null {
  return getCampaigns()[0] ?? null;
}

export function getCreatorAnalytics(
  creatorHandle: string,
  range: DevBusStatsRange,
): DevBusCreatorAnalytics {
  const handle = normalizeHandle(creatorHandle);
  const start = rangeStart(range);
  const links = [...bus.links.values()].filter(
    (link) => link.creator_handle === handle,
  );
  const linkIds = new Set(links.map((link) => link.id));
  const sessions = [...bus.sessions.values()].filter(
    (session) => linkIds.has(session.link_id) && inRange(session.created_at, start),
  );
  const redemptions = [...bus.redemptions.values()].filter(
    (redemption) =>
      linkIds.has(redemption.link_id) && inRange(redemption.created_at, start),
  );
  const wins = redemptions.filter((redemption) => redemption.outcome === "won");
  const campaignIds = [...new Set(links.map((link) => link.campaign_id))];
  const days = recentDayKeys(30);
  const tapsSeries = countByDay(days, sessions, (session) => session.created_at);
  const visitsSeries = countByDay(
    days,
    redemptions,
    (redemption) => redemption.created_at,
  );
  const winsSeries = countByDay(days, wins, (redemption) => redemption.created_at);

  return {
    kpis: {
      taps: { value: sessions.length, delta: 0 },
      visits: { value: redemptions.length, delta: 0 },
      claim_rate: { value: percent(redemptions.length, sessions.length), delta: 0 },
      wins: { value: wins.length, delta: 0 },
    },
    sparklines: {
      taps: tapsSeries,
      visits: visitsSeries,
      claim_rate_pp: days.map((_, index) =>
        percent(visitsSeries[index] ?? 0, tapsSeries[index] ?? 0),
      ),
      wins: winsSeries,
    },
    by_campaign: campaignIds
      .map((campaignId) => {
        const campaign = bus.campaigns.get(campaignId);
        const campaignLinkIds = new Set(
          links
            .filter((link) => link.campaign_id === campaignId)
            .map((link) => link.id),
        );
        const campaignSessions = sessions.filter((session) =>
          campaignLinkIds.has(session.link_id),
        );
        const campaignRedemptions = redemptions.filter((redemption) =>
          campaignLinkIds.has(redemption.link_id),
        );
        const campaignWins = campaignRedemptions.filter(
          (redemption) => redemption.outcome === "won",
        );

        return {
          campaign_id: campaignId,
          campaign_title: campaign?.title ?? "Campaign",
          merchant_handle: bus.merchant.handle,
          status: campaign?.status ?? "ended",
          days_left: 0,
          taps: campaignSessions.length,
          visits: campaignRedemptions.length,
          wins: campaignWins.length,
          claim_rate: percent(campaignRedemptions.length, campaignSessions.length),
        };
      })
      .sort((a, b) => b.visits - a.visits),
    activity_feed: [
      ...sessions.map((session) => {
        const link = bus.links.get(session.link_id);
        const campaign = link ? bus.campaigns.get(link.campaign_id) : null;
        return {
          id: `tap-${session.id}`,
          ts: session.created_at,
          kind: "tap" as const,
          merchant_handle: bus.merchant.handle,
          campaign_title: campaign?.title ?? "Campaign",
        };
      }),
      ...redemptions.map((redemption) => {
        const campaign = bus.campaigns.get(redemption.campaign_id);
        return {
          id: `redeem-${redemption.id}`,
          ts: redemption.created_at,
          kind: redemption.outcome === "won" ? "win" as const : "loss" as const,
          merchant_handle: bus.merchant.handle,
          campaign_title: campaign?.title ?? "Campaign",
        };
      }),
    ]
      .sort((a, b) => b.ts.localeCompare(a.ts))
      .slice(0, 20),
  };
}

export function getMerchantOverview(
  campaignId: string | null,
): DevBusMerchantOverview | null {
  const campaign =
    (campaignId ? bus.campaigns.get(campaignId) : undefined) ??
    latestCampaign();
  if (!campaign) return null;

  const links = [...bus.links.values()].filter(
    (link) => link.campaign_id === campaign.id,
  );
  const linkIds = new Set(links.map((link) => link.id));
  const sessions = [...bus.sessions.values()].filter((session) =>
    linkIds.has(session.link_id),
  );
  const redemptions = [...bus.redemptions.values()].filter((redemption) =>
    linkIds.has(redemption.link_id),
  );
  const wins = redemptions.filter((redemption) => redemption.outcome === "won");
  const stats = getCampaignStats(campaign.id);
  const topCreators = stats.by_creator.map((creator) => ({
    creator_id: creatorIdForHandle(creator.creator_handle),
    handle: creator.creator_handle,
    avatar_url: null,
    taps: creator.taps,
    visits: creator.visits,
    wins: creator.wins,
    claim_rate: percent(creator.visits, creator.taps),
  }));
  const days = recentDayKeys(14);
  const tapsSeries = countByDay(days, sessions, (session) => session.created_at);
  const visitsSeries = countByDay(
    days,
    redemptions,
    (redemption) => redemption.created_at,
  );
  const winsSeries = countByDay(days, wins, (redemption) => redemption.created_at);

  return {
    campaign: {
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
      daysLeft: 0,
    },
    prizes: {
      used: stats.prize_used,
      total: stats.prize_total,
    },
    kpis: {
      taps: stats.taps,
      visits: stats.visits,
      claim_rate: percent(stats.visits, stats.taps),
      win_rate: percent(stats.wins, stats.visits),
      taps_series: tapsSeries,
      visits_series: visitsSeries,
      claim_rate_series: days.map((_, index) =>
        percent(visitsSeries[index] ?? 0, tapsSeries[index] ?? 0),
      ),
      win_rate_series: days.map((_, index) =>
        percent(winsSeries[index] ?? 0, visitsSeries[index] ?? 0),
      ),
    },
    top_creators: topCreators,
    visits_by_day_stacked: days.map((date) => {
      const by_creator = topCreators.slice(0, 5).map((creator) => {
        const creatorLinkIds = new Set(
          links
            .filter((link) => link.creator_handle === creator.handle)
            .map((link) => link.id),
        );
        return {
          creator_id: creator.creator_id,
          handle: creator.handle,
          count: redemptions.filter(
            (redemption) =>
              creatorLinkIds.has(redemption.link_id) &&
              dayKey(redemption.created_at) === date,
          ).length,
        };
      });

      return {
        date,
        by_creator,
        total: by_creator.reduce((sum, item) => sum + item.count, 0),
      };
    }),
    activity_feed: [
      ...sessions.map((session) => {
        const link = bus.links.get(session.link_id);
        return {
          id: `visit-${session.id}`,
          ts: session.created_at,
          kind: "visit" as const,
          creator_handle: link?.creator_handle ?? "@creator",
          campaign_title: campaign.title,
        };
      }),
      ...redemptions.map((redemption) => ({
        id: `redeem-${redemption.id}`,
        ts: redemption.created_at,
        kind: redemption.outcome === "won" ? "win" as const : "loss" as const,
        creator_handle: redemption.creator_handle,
        campaign_title: campaign.title,
      })),
    ]
      .sort((a, b) => b.ts.localeCompare(a.ts))
      .slice(0, 25),
  };
}

// ─── full state dump (for /code page) ───────────────────────────────────

export function dumpState() {
  return {
    merchant: bus.merchant,
    campaigns: getCampaigns().map((c) => ({
      id: c.id,
      title: c.title,
      prize_text: c.prize_text,
      prize_total: c.prize_total,
      entry_total: c.entry_total,
      brackets: c.brackets,
      claim_counter: c.claim_counter,
      status: c.status,
      created_at: c.created_at,
      stats: getCampaignStats(c.id),
    })),
    links: [...bus.links.values()].map((l) => ({
      id: l.id,
      token: l.token,
      campaign_id: l.campaign_id,
      creator_handle: l.creator_handle,
      disabled: l.disabled,
      created_at: l.created_at,
      stats: getLinkStats(l.id),
    })),
    activity: getRecentActivity(30),
    counts: {
      campaigns: bus.campaigns.size,
      links: bus.links.size,
      sessions: bus.sessions.size,
      redemptions: bus.redemptions.size,
    },
  };
}
