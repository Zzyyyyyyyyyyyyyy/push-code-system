import type { RedeemErrorCode, RedeemOutcome } from "@/app/code/terminal/_mock";

export type CodeOutcomeRevealProps = {
  outcome: RedeemOutcome | null;
  position?: number;
  prize?: string;
  creatorName?: string;
  campaignName?: string;
  errorCode?: string;
  isLoading?: boolean;
};

const ERROR_COPY: Record<RedeemErrorCode, string> = {
  CODE_NOT_FOUND:
    "No active code matches. Make sure the code is fresh - codes refresh every minute.",
  CODE_ALREADY_USED: "Already redeemed. Each customer's code is single-use.",
  CAMPAIGN_FULL:
    "Campaign reached its max attempts. Tell the customer this campaign just ended.",
};

function isKnownErrorCode(value: string | undefined): value is RedeemErrorCode {
  return (
    value === "CODE_NOT_FOUND" ||
    value === "CODE_ALREADY_USED" ||
    value === "CAMPAIGN_FULL"
  );
}

function GiftIcon() {
  return (
    <svg
      aria-hidden="true"
      className="cor-icon-svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4.5 10h15v9.5h-15V10Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M3.5 6.5h17V10h-17V6.5ZM12 6.5v13M7.5 6.5c-1.2-.7-1.7-1.8-1.2-2.7.5-.8 1.8-.8 2.8.1L12 6.5M16.5 6.5c1.2-.7 1.7-1.8 1.2-2.7-.5-.8-1.8-.8-2.8.1L12 6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function CodeOutcomeReveal({
  outcome,
  position,
  prize,
  creatorName,
  campaignName,
  errorCode,
  isLoading = false,
}: CodeOutcomeRevealProps) {
  if (isLoading) {
    return (
      <section
        aria-busy="true"
        aria-label="Checking code"
        className="cor-card cor-card--loading"
      >
        <span className="cor-skeleton cor-skeleton--title" />
        <span className="cor-skeleton cor-skeleton--body" />
        <span className="cor-skeleton cor-skeleton--short" />
      </section>
    );
  }

  if (isKnownErrorCode(errorCode)) {
    return (
      <section className="cor-card cor-card--error" role="status">
        <p className="cor-kicker">CHECK CODE</p>
        <h2 className="cor-heading">Redemption blocked</h2>
        <p className="cor-copy">{ERROR_COPY[errorCode]}</p>
      </section>
    );
  }

  if (outcome === "WIN") {
    return (
      <section className="cor-card cor-card--win" role="status">
        <div className="cor-title-row">
          <span className="cor-icon-tile">
            <GiftIcon />
          </span>
          <div>
            <p className="cor-kicker">{campaignName ?? "ACTIVE CAMPAIGN"}</p>
            <h2 className="cor-heading">
              Position #{position ?? "-"} · WINNER
            </h2>
          </div>
        </div>
        {creatorName ? <p className="cor-meta">Creator: {creatorName}</p> : null}
        <div className="cor-prize-block">
          <p className="cor-label">Hand to customer:</p>
          <p className="cor-prize">{prize ?? "Prize unlocked"}</p>
        </div>
      </section>
    );
  }

  if (outcome === "LOSE") {
    return (
      <section className="cor-card cor-card--lose" role="status">
        <p className="cor-kicker">{campaignName ?? "ACTIVE CAMPAIGN"}</p>
        <h2 className="cor-heading">
          Position #{position ?? "-"} · No win this time
        </h2>
        {creatorName ? <p className="cor-meta">Creator: {creatorName}</p> : null}
        <p className="cor-copy">Thank the customer for visiting.</p>
      </section>
    );
  }

  return (
    <section className="cor-card cor-card--idle" role="status">
      <p className="cor-kicker">READY</p>
      <p className="cor-copy">Submit a code to see the result here.</p>
    </section>
  );
}
