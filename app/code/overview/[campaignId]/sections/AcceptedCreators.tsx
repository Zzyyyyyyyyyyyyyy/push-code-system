"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface AcceptedCreatorsProps {
  campaignId: string;
}

interface DevStateLinkStats {
  taps: number;
  visits: number;
  wins: number;
  claim_rate?: number;
}

interface DevStateLink {
  id: string;
  token: string;
  campaign_id: string;
  creator_handle: string;
  avatar_url?: string | null;
  created_at: string;
  stats: DevStateLinkStats;
}

interface DevState {
  links: DevStateLink[];
}

interface ApiSuccess<T> {
  data: T;
}

function avatarLetter(handle: string): string {
  return handle.replace(/^@/, "").slice(0, 1).toUpperCase() || "?";
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatClaimRate(link: DevStateLink): string {
  const rawRate =
    typeof link.stats.claim_rate === "number"
      ? link.stats.claim_rate
      : link.stats.taps > 0
        ? link.stats.wins / link.stats.taps
        : 0;
  const percent = rawRate > 1 ? rawRate : rawRate * 100;
  return `${percent.toFixed(1)}%`;
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

export function AcceptedCreators({ campaignId }: AcceptedCreatorsProps) {
  const [links, setLinks] = useState<DevStateLink[]>([]);

  const refresh = useCallback(async () => {
    const state = await fetchDevState();
    if (!state) return;
    setLinks(
      state.links
        .filter((link) => link.campaign_id === campaignId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );
  }, [campaignId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- live dev bus polling is the source of truth for accepted links.
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => {
      window.clearInterval(interval);
    };
  }, [refresh]);

  const rows = useMemo(
    () =>
      links.map((link) => ({
        ...link,
        sharePath: `/r/${link.token}`,
      })),
    [links],
  );

  return (
    <section
      className="db-major-section co-accepted"
      aria-labelledby="accepted-creators-title"
    >
      <div className="co-section-title-block">
        <p className="co-section-eyebrow">(WHO&apos;S PROMOTING)</p>
        <h2 id="accepted-creators-title" className="co-section-title">
          Accepted creators · {links.length}
        </h2>
      </div>

      {rows.length > 0 ? (
        <div className="co-accepted__list">
          {rows.map((link) => (
            <article key={link.id} className="co-accepted-card">
              <div className="co-accepted-card__creator">
                <span className="co-accepted-card__avatar" aria-hidden="true">
                  {link.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={link.avatar_url} alt="" />
                  ) : (
                    avatarLetter(link.creator_handle)
                  )}
                </span>
                <h3>{link.creator_handle}</h3>
              </div>

              <div className="co-accepted-card__share">
                <code>{link.sharePath}</code>
                <button
                  type="button"
                  className="btn-ghost co-accepted-card__copy"
                  onClick={() => {
                    void navigator.clipboard?.writeText(link.sharePath);
                  }}
                >
                  Copy URL
                </button>
                <a
                  className="co-accepted-card__open"
                  href={link.sharePath}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in tab ↗
                </a>
              </div>

              <dl
                className="co-mini-stats"
                aria-label={`${link.creator_handle} stats`}
              >
                <div>
                  <dt>Taps</dt>
                  <dd>{formatCompact(link.stats.taps)}</dd>
                </div>
                <div>
                  <dt>Visits</dt>
                  <dd>{formatCompact(link.stats.visits)}</dd>
                </div>
                <div>
                  <dt>Wins</dt>
                  <dd>{formatCompact(link.stats.wins)}</dd>
                </div>
                <div>
                  <dt>Claim rate</dt>
                  <dd>{formatClaimRate(link)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="co-empty-state">
          No creators have accepted yet — invite via /creator/code-discover.
        </p>
      )}
    </section>
  );
}
