"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface RecentRedemptionsProps {
  campaignId: string;
}

interface DevStateActivity {
  id: string;
  ts: string;
  kind: "publish" | "accept" | "tap" | "redeem-win" | "redeem-loss";
  text: string;
  campaign_id?: string;
  creator_handle?: string;
  outcome?: "won" | "lost";
  position_in_campaign?: number;
  session_id?: string;
}

interface DevState {
  activity: DevStateActivity[];
}

interface ApiSuccess<T> {
  data: T;
}

function relativeTime(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "just now";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

async function fetchDevState(): Promise<DevState | null> {
  try {
    const response = await fetch("/api/code/dev/state", { cache: "no-store" });
    if (!response.ok) return null;
    const payload = (await response.json()) as ApiSuccess<DevState>;
    return payload.data;
  } catch {
    return null;
  }
}

export function RecentRedemptions({ campaignId }: RecentRedemptionsProps) {
  const [activity, setActivity] = useState<DevStateActivity[]>([]);

  const refresh = useCallback(async () => {
    const state = await fetchDevState();
    if (!state) return;
    setActivity(state.activity);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- live dev bus polling is the source of truth for redemption events.
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => {
      window.clearInterval(interval);
    };
  }, [refresh]);

  const redemptions = useMemo(
    () =>
      activity
        .filter(
          (event) =>
            event.campaign_id === campaignId &&
            (event.kind === "redeem-win" || event.kind === "redeem-loss"),
        )
        .sort((a, b) => b.ts.localeCompare(a.ts))
        .slice(0, 20),
    [activity, campaignId],
  );

  return (
    <section
      className="db-major-section co-redemptions"
      aria-labelledby="recent-redemptions-title"
    >
      <div className="co-section-title-block">
        <p className="co-section-eyebrow">(LIVE LOG)</p>
        <h2 id="recent-redemptions-title" className="co-section-title">
          Recent redemptions
        </h2>
      </div>

      {redemptions.length > 0 ? (
        <ol className="co-redemptions__list">
          {redemptions.map((event) => {
            const won = event.outcome === "won" || event.kind === "redeem-win";
            const outcomeLabel = won ? "WIN" : "LOSE";
            return (
              <li key={event.id} className="co-redemption-row">
                <time dateTime={event.ts}>{relativeTime(event.ts)}</time>
                <span className="co-redemption-row__creator">
                  {event.creator_handle ?? "@creator"}
                </span>
                <span
                  className={
                    won
                      ? "co-outcome-pill co-outcome-pill--win"
                      : "co-outcome-pill co-outcome-pill--lose"
                  }
                >
                  {outcomeLabel}
                </span>
                <span className="co-redemption-row__position">
                  #{event.position_in_campaign ?? "—"}
                </span>
                <span className="co-redemption-row__session">
                  {(event.session_id ?? "------").slice(0, 6)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="co-empty-state">
          No redemptions yet — once staff types a customer&apos;s code,
          it&apos;ll show here.
        </p>
      )}
    </section>
  );
}
