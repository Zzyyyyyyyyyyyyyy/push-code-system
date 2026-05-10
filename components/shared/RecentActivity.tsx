"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import "./recent-activity.css";

export type ActivityEventType =
  | "applicant.applied"
  | "redemption.verified"
  | "campaign.launched"
  | "dispute.opened"
  | "payment.toppedup";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** ≤80 chars. The first line in the row. */
  title: string;
  /** Optional sub-line: campaign name, amount, location, etc. */
  meta?: string;
  /** Click target. Falls back to a no-op if unset. */
  href?: string;
}

interface RecentActivityProps {
  events: ActivityEvent[];
  /** Defaults to 10. The component never shows more than 12 by spec. */
  limit?: number;
  /** Optional override for the section title eyebrow. */
  eyebrow?: string;
}

const ICON_BY_TYPE: Record<ActivityEventType, string> = {
  "applicant.applied": "person",
  "redemption.verified": "check",
  "campaign.launched": "rocket",
  "dispute.opened": "alert",
  "payment.toppedup": "card",
};

const COLOR_BY_TYPE: Record<ActivityEventType, string> = {
  "applicant.applied": "ink",
  "redemption.verified": "green",
  "campaign.launched": "blue",
  "dispute.opened": "red",
  "payment.toppedup": "champagne",
};

const LABEL_BY_TYPE: Record<ActivityEventType, string> = {
  "applicant.applied": "Applicant",
  "redemption.verified": "Verified",
  "campaign.launched": "Launched",
  "dispute.opened": "Dispute",
  "payment.toppedup": "Top-up",
};

function relativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Math.max(0, now - t);
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function ActivityIcon({ type }: { type: ActivityEventType }) {
  const kind = ICON_BY_TYPE[type];
  // Single-color stroke icons; color comes from the parent `--ra-icon-fg`.
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "person") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
      </svg>
    );
  }
  if (kind === "check") {
    return (
      <svg {...common}>
        <path d="M5 12l4 4 10-10" />
      </svg>
    );
  }
  if (kind === "rocket") {
    return (
      <svg {...common}>
        <path d="M5 19c1-3 3-5 5-5l4-4c2-2 5-3 8-3 0 3-1 6-3 8l-4 4c0 2-2 4-5 5l-2-3-3-2z" />
        <circle cx="15" cy="9" r="1.5" />
      </svg>
    );
  }
  if (kind === "alert") {
    return (
      <svg {...common}>
        <path d="M12 4l10 16H2L12 4z" />
        <path d="M12 10v4" />
        <circle cx="12" cy="17" r="0.6" fill="currentColor" />
      </svg>
    );
  }
  // card
  return (
    <svg {...common}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

export function RecentActivity({
  events,
  limit = 10,
  eyebrow = "ACTIVITY",
}: RecentActivityProps) {
  const router = useRouter();
  const now = Date.now();
  const visible = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return sorted.slice(0, Math.min(limit, 12));
  }, [events, limit]);

  function handleClick(href?: string) {
    if (!href) return;
    router.push(href);
  }

  return (
    <section className="ra-card" aria-labelledby="recent-activity-title">
      <header className="ra-card__head">
        <p className="ra-card__eyebrow">
          <span className="ra-card__eyebrow-dot" aria-hidden="true" />
          {eyebrow}
        </p>
        <h2 id="recent-activity-title" className="ra-card__title">
          Recent Activity
        </h2>
        <span className="ra-card__count">{visible.length}</span>
      </header>
      <span className="ra-card__rule" aria-hidden="true" />

      {visible.length === 0 ? (
        <p className="ra-card__empty">No activity yet — quiet day.</p>
      ) : (
        <ul className="ra-list" role="list">
          {visible.map((event) => {
            const color = COLOR_BY_TYPE[event.type];
            const label = LABEL_BY_TYPE[event.type];
            const clickable = Boolean(event.href);
            return (
              <li
                key={event.id}
                className={"ra-row" + (clickable ? " ra-row--clickable" : "")}
              >
                <button
                  type="button"
                  className="ra-row__hit"
                  onClick={() => handleClick(event.href)}
                  disabled={!clickable}
                  aria-label={`${label}: ${event.title}`}
                >
                  <span
                    className={`ra-row__icon ra-row__icon--${color}`}
                    aria-hidden="true"
                  >
                    <ActivityIcon type={event.type} />
                  </span>
                  <span className="ra-row__body">
                    <span className="ra-row__title">{event.title}</span>
                    {event.meta ? (
                      <span className="ra-row__meta">{event.meta}</span>
                    ) : null}
                  </span>
                  <span className="ra-row__time" aria-label="time">
                    {relativeTime(event.timestamp, now)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default RecentActivity;
