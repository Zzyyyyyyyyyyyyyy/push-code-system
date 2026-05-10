import { KPICard } from "@/components/shared";
import type { ComponentType } from "react";
import type {
  CodeStatsKPIs,
  CodeStatsRange,
  CodeStatsSparklines,
} from "../_mock";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  trend?: "up" | "down" | "flat" | "auto";
  variant?: "primary" | "subtle" | "warning";
  showArea?: boolean;
  showLastDot?: boolean;
  ariaLabel?: string;
  className?: string;
}

const Sparkline = (
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- This isolated worktree is missing the shared component file, but the merged tree provides it at this alias.
  require("@/components/shared/Sparkline") as {
    Sparkline: ComponentType<SparklineProps>;
  }
).Sparkline;

interface CodeKPIGridProps {
  range: CodeStatsRange;
  data: CodeStatsKPIs;
  sparklines: CodeStatsSparklines;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDelta(value: number, suffix = "%"): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${suffix} vs prior`;
}

function trendFor(delta: number): SparklineProps["trend"] {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

export function CodeKPIGrid({ range, data, sparklines }: CodeKPIGridProps) {
  const cards = [
    {
      label: "TAPS",
      value: formatNumber(data.taps.value),
      delta: formatDelta(data.taps.delta),
      deltaPositive: data.taps.delta >= 0,
      sparkline: sparklines.taps,
      trend: trendFor(data.taps.delta),
    },
    {
      label: "VISITS",
      value: formatNumber(data.visits.value),
      delta: formatDelta(data.visits.delta),
      deltaPositive: data.visits.delta >= 0,
      sparkline: sparklines.visits,
      trend: trendFor(data.visits.delta),
      variant: "accent" as const,
    },
    {
      label: "CLAIM RATE",
      value: formatPercent(data.claim_rate.value),
      delta: formatDelta(data.claim_rate.delta, " pp"),
      deltaPositive: data.claim_rate.delta >= 0,
      sparkline: sparklines.claim_rate_pp,
      trend: trendFor(data.claim_rate.delta),
    },
    {
      label: "WINS",
      value: formatNumber(data.wins.value),
      delta: formatDelta(data.wins.delta),
      deltaPositive: data.wins.delta >= 0,
      sparkline: sparklines.wins,
      trend: trendFor(data.wins.delta),
      numeralColor: "champagne" as const,
    },
  ];

  return (
    <section className="db-major-section" aria-labelledby="code-kpis-title">
      <div className="db-section-head">
        <h2 id="code-kpis-title" className="db-section-title">
          Performance Snapshot
        </h2>
        <p className="cs-section-meta">{range.toUpperCase()} window</p>
      </div>
      <div className="db-kpi-grid cs-kpi-grid anim-stagger">
        {cards.map((card, index) => (
          <div className="cs-kpi-tile" key={card.label}>
            <KPICard
              label={card.label}
              value={card.value}
              delta={card.delta}
              deltaPositive={card.deltaPositive}
              variant={card.variant}
              numeralColor={card.numeralColor}
              delay={40 + index * 60}
            />
            <div className="cs-kpi-spark" aria-hidden="true">
              <Sparkline
                data={card.sparkline}
                width={88}
                height={28}
                trend={card.trend}
                showArea
                showLastDot
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
