import type { CodeCampaignStatus } from "../_mock";

interface CampaignHeroStripProps {
  status: CodeCampaignStatus;
  daysLeft: number;
  prizesUsed: number;
  prizesTotal: number;
}

function formatStatus(status: CodeCampaignStatus): string {
  return status === "active" ? "Active" : "Ended";
}

export function CampaignHeroStrip({
  status,
  daysLeft,
  prizesUsed,
  prizesTotal,
}: CampaignHeroStripProps) {
  const progress =
    prizesTotal > 0 ? Math.min((prizesUsed / prizesTotal) * 100, 100) : 0;

  return (
    <section className="co-hero-strip anim-hero" aria-label="Campaign status">
      <div className="co-hero-strip__status">
        <span className={`co-status-pill co-status-pill--${status}`}>
          {formatStatus(status)}
        </span>
        <span className="co-days-badge">{daysLeft} days left</span>
      </div>

      <div className="co-prize-meter" aria-label="Prize budget">
        <div className="co-prize-meter__head">
          <span>Prize budget</span>
          <strong>
            {prizesUsed} / {prizesTotal}
          </strong>
        </div>
        <div
          className="co-prize-meter__track"
          role="progressbar"
          aria-valuenow={prizesUsed}
          aria-valuemin={0}
          aria-valuemax={prizesTotal}
          aria-label={`${prizesUsed} of ${prizesTotal} prizes given`}
        >
          <span
            className="co-prize-meter__fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </section>
  );
}
