import Link from "next/link";
import type { CodeCampaignStat } from "../_mock";

interface CodeCampaignListProps {
  campaigns: CodeCampaignStat[];
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function formatRate(value: number): string {
  return `${value.toFixed(1)}%`;
}

function daysLabel(campaign: CodeCampaignStat): string {
  if (campaign.status === "ended") return "Ended";
  if (campaign.days_left === 1) return "1 day left";
  return `${campaign.days_left} days left`;
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="cs-campaign-chevron"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function CodeCampaignList({ campaigns }: CodeCampaignListProps) {
  return (
    <section className="db-major-section" aria-labelledby="campaign-list-title">
      <div className="db-section-head">
        <h2 id="campaign-list-title" className="db-section-title">
          By Campaign
        </h2>
        <p className="cs-section-meta">{campaigns.length} campaigns</p>
      </div>

      <div className="cs-campaign-list">
        {campaigns.map((campaign) => (
          <Link
            key={campaign.campaign_id}
            href={`/code/stats/${campaign.campaign_id}`}
            className="cs-campaign-card"
            aria-label={`Open ${campaign.campaign_title} code stats`}
          >
            <div className="cs-campaign-card__main">
              <div className="cs-campaign-card__top">
                <div className="cs-campaign-card__identity">
                  <h3 className="cs-campaign-card__title">
                    {campaign.campaign_title}
                  </h3>
                  <p className="cs-campaign-card__merchant">
                    {campaign.merchant_handle}
                  </p>
                </div>
                <span
                  className={`cs-status-pill cs-status-pill--${campaign.status}`}
                >
                  {campaign.status}
                </span>
              </div>

              <div className="cs-campaign-card__meta">
                <span>{daysLabel(campaign)}</span>
              </div>

              <dl className="cs-campaign-stats" aria-label="Campaign stats">
                <div>
                  <dt>Taps</dt>
                  <dd>{formatNumber(campaign.taps)}</dd>
                </div>
                <div>
                  <dt>Visits</dt>
                  <dd>{formatNumber(campaign.visits)}</dd>
                </div>
                <div>
                  <dt>Wins</dt>
                  <dd>{formatNumber(campaign.wins)}</dd>
                </div>
                <div>
                  <dt>Claim</dt>
                  <dd>{formatRate(campaign.claim_rate)}</dd>
                </div>
              </dl>
            </div>
            <ChevronIcon />
          </Link>
        ))}
      </div>
    </section>
  );
}
