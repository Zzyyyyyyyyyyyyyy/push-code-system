"use client";

import { useMemo, useState } from "react";
import type { CodeCreatorRow } from "../_mock";

type LeaderboardSort = "visits" | "taps" | "claim_rate" | "wins";

interface CreatorLeaderboardProps {
  rows: CodeCreatorRow[];
  sort?: LeaderboardSort;
}

const SORT_OPTIONS: Array<{ key: LeaderboardSort; label: string }> = [
  { key: "visits", label: "Visits" },
  { key: "taps", label: "Taps" },
  { key: "claim_rate", label: "Claim Rate" },
  { key: "wins", label: "Wins" },
];

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function avatarLetter(handle: string): string {
  return handle.replace(/^@/, "").slice(0, 1).toUpperCase();
}

export function CreatorLeaderboard({
  rows,
  sort = "visits",
}: CreatorLeaderboardProps) {
  const [activeSort, setActiveSort] = useState<LeaderboardSort>(sort);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const diff = b[activeSort] - a[activeSort];
        return diff === 0 ? b.visits - a.visits : diff;
      }),
    [activeSort, rows],
  );

  const visibleRows = sortedRows.slice(0, 5);

  return (
    <section
      className="db-major-section co-leaderboard"
      aria-labelledby="creator-leaderboard-title"
    >
      <div className="db-section-head co-section-head">
        <h2 id="creator-leaderboard-title" className="db-section-title">
          Creator Leaderboard
        </h2>
        <div className="co-sort-tabs" aria-label="Sort creators">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className="btn-pill co-sort-tabs__button"
              aria-pressed={activeSort === option.key}
              onClick={() => setActiveSort(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="co-leaderboard__list anim-stagger">
        {visibleRows.map((row, index) => (
          <article key={row.creator_id} className="co-creator-row">
            <div className="co-creator-row__identity">
              <span className="co-creator-row__rank">{index + 1}</span>
              <span className="co-creator-row__avatar" aria-hidden="true">
                {row.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.avatar_url} alt="" />
                ) : (
                  avatarLetter(row.handle)
                )}
              </span>
              <h3>{row.handle}</h3>
            </div>

            <dl className="co-creator-row__stats">
              <div>
                <dt>Visits</dt>
                <dd>{formatCompact(row.visits)}</dd>
              </div>
              <div>
                <dt>Taps</dt>
                <dd>{formatCompact(row.taps)}</dd>
              </div>
              <div>
                <dt>Claim</dt>
                <dd>{row.claim_rate.toFixed(1)}%</dd>
              </div>
              <div>
                <dt>Wins</dt>
                <dd>{row.wins}</dd>
              </div>
            </dl>

            <span className="co-creator-row__arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M8 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </article>
        ))}
      </div>

      {rows.length > 5 ? (
        <div className="co-leaderboard__footer">
          <span className="co-leaderboard__footer-pill">
            View all {rows.length} creators
          </span>
        </div>
      ) : null}
    </section>
  );
}
