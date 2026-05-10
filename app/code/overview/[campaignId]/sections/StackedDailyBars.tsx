"use client";

import { useMemo, useState } from "react";
import type { StackedDailyVisit } from "../_mock";

interface StackedDailyBarsProps {
  data: StackedDailyVisit[];
}

const COLORS = [
  "#c1121f",
  "#0085ff",
  "#bfa170",
  "#61605c",
  "#6a6a6a",
] as const;

const WIDTH = 328;
const HEIGHT = 224;
const TOP = 16;
const RIGHT = 8;
const BOTTOM = 32;
const LEFT = 8;
const GAP = 8;

function weekdayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
  });
}

export function StackedDailyBars({ data }: StackedDailyBarsProps) {
  const [activeIndex, setActiveIndex] = useState(data.length - 1);

  const creatorIds = useMemo(
    () =>
      Array.from(
        new Set(data.flatMap((day) => day.by_creator.map((item) => item.creator_id))),
      ).slice(0, 5),
    [data],
  );

  const creatorLabels = useMemo(() => {
    const labels = new Map<string, string>();
    data.forEach((day) => {
      day.by_creator.forEach((item) => {
        labels.set(item.creator_id, item.handle ?? item.creator_id);
      });
    });
    return labels;
  }, [data]);

  const maxTotal = Math.max(...data.map((day) => day.total), 1);
  const chartWidth = WIDTH - LEFT - RIGHT;
  const chartHeight = HEIGHT - TOP - BOTTOM;
  const barWidth = (chartWidth - GAP * (data.length - 1)) / data.length;
  const activeDay = data[activeIndex] ?? data[data.length - 1];

  return (
    <section
      className="db-major-section co-stacked"
      aria-labelledby="stacked-daily-bars-title"
    >
      <div className="db-section-head co-section-head">
        <h2 id="stacked-daily-bars-title" className="db-section-title">
          14-Day Visits
        </h2>
        <p className="co-section-kicker">Stacked by creator</p>
      </div>

      <div className="co-stacked__panel">
        <svg
          className="co-stacked__svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="14-day stacked bar chart of visits by creator"
        >
          {data.map((day, dayIndex) => {
            let usedHeight = 0;
            const x = LEFT + dayIndex * (barWidth + GAP);

            return creatorIds.map((creatorId, creatorIndex) => {
              const count =
                day.by_creator.find((item) => item.creator_id === creatorId)
                  ?.count ?? 0;
              const segmentHeight = (count / maxTotal) * chartHeight;
              const y = TOP + chartHeight - usedHeight - segmentHeight;
              usedHeight += segmentHeight;

              return (
                <rect
                  key={`${day.date}-${creatorId}`}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(segmentHeight, count > 0 ? 2 : 0)}
                  fill={COLORS[creatorIndex]}
                  rx="2"
                  role="button"
                  tabIndex={0}
                  aria-label={`${day.date}: ${creatorLabels.get(
                    creatorId,
                  )} ${count} visits`}
                  className={
                    activeIndex === dayIndex
                      ? "co-stacked__segment co-stacked__segment--active"
                      : "co-stacked__segment"
                  }
                  onClick={() => setActiveIndex(dayIndex)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActiveIndex(dayIndex);
                    }
                  }}
                />
              );
            });
          })}

          {data.map((day, index) => {
            if (index % 3 !== 0 && index !== data.length - 1) return null;
            const x = LEFT + index * (barWidth + GAP) + barWidth / 2;

            return (
              <text
                key={day.date}
                x={x}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="co-stacked__tick"
              >
                {weekdayLabel(day.date)}
              </text>
            );
          })}
        </svg>

        <div className="co-stacked__tooltip" aria-live="polite">
          <div className="co-stacked__tooltip-head">
            <span>{activeDay ? weekdayLabel(activeDay.date) : "Day"}</span>
            <strong>{activeDay?.total ?? 0} visits</strong>
          </div>
          <ul>
            {creatorIds.map((creatorId, index) => {
              const count =
                activeDay?.by_creator.find(
                  (item) => item.creator_id === creatorId,
                )?.count ?? 0;
              return (
                <li key={creatorId}>
                  <span
                    className="co-stacked__legend-dot"
                    style={{ background: COLORS[index] }}
                    aria-hidden="true"
                  />
                  <span>{creatorLabels.get(creatorId)}</span>
                  <strong>{count}</strong>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
