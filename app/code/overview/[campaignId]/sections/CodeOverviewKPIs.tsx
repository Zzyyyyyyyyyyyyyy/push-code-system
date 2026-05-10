import { KPICard } from "@/components/shared";
import type { CodeOverviewKpis } from "../_mock";

interface CodeOverviewKPIsProps {
  kpis: CodeOverviewKpis;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function CodeOverviewKPIs({ kpis }: CodeOverviewKPIsProps) {
  return (
    <section
      className="db-major-section"
      aria-labelledby="code-overview-kpis-title"
    >
      <h2 id="code-overview-kpis-title" className="db-section-title">
        Performance Snapshot
      </h2>
      <div className="db-kpi-grid anim-stagger">
        <KPICard
          label="Taps"
          value={formatCompact(kpis.taps)}
          delta="Across creators"
          deltaPositive={false}
          delay={40}
          sparkline={kpis.taps_series}
        />
        <KPICard
          label="Visits"
          value={formatCompact(kpis.visits)}
          delta="Primary signal"
          variant="accent"
          delay={100}
          sparkline={kpis.visits_series}
        />
        <KPICard
          label="Claim Rate"
          value={formatPercent(kpis.claim_rate)}
          delta="Visit / tap"
          delay={160}
          sparkline={kpis.claim_rate_series}
        />
        <KPICard
          label="Win Rate"
          value={formatPercent(kpis.win_rate)}
          delta="Prize wins"
          numeralColor="champagne"
          delay={220}
          sparkline={kpis.win_rate_series}
        />
      </div>
    </section>
  );
}
