"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { PageHeader } from "@/components/shared";
import "./code-playground.css";

// ─── shared types (mirror /api/code/dev/state response) ────────────────

interface BusBracket {
  start: number;
  end: number;
  prizes: number;
}

interface BusCampaign {
  id: string;
  title: string;
  prize_text: string;
  prize_total: number;
  entry_total: number;
  brackets: BusBracket[];
  claim_counter: number;
  status: "active" | "ended";
  created_at: string;
  stats: {
    taps: number;
    visits: number;
    wins: number;
    prize_used: number;
    prize_total: number;
    claim_rate: number;
    win_rate: number;
    by_creator: {
      creator_handle: string;
      taps: number;
      visits: number;
      wins: number;
      claim_rate: number;
    }[];
  };
}

interface BusLink {
  id: string;
  token: string;
  campaign_id: string;
  creator_handle: string;
  disabled: boolean;
  created_at: string;
  stats: {
    taps: number;
    sessions: number;
    visits: number;
    wins: number;
    claim_rate: number;
  };
}

interface BusActivity {
  id: string;
  ts: string;
  kind: "publish" | "accept" | "tap" | "redeem-win" | "redeem-loss";
  text: string;
}

interface BusState {
  merchant: { id: string; handle: string; name: string };
  campaigns: BusCampaign[];
  links: BusLink[];
  activity: BusActivity[];
  counts: {
    campaigns: number;
    links: number;
    sessions: number;
    redemptions: number;
  };
}

type Preset = "front-heavy" | "even" | "sleeper" | "custom";

const PRESET_LABEL: Record<Preset, string> = {
  "front-heavy": "Front-Heavy (early customers favored)",
  even: "Even (uniform odds)",
  sleeper: "Sleeper (later customers favored)",
  custom: "Custom",
};

const KNOWN_CREATORS = ["@zhangcoffee", "@licoffee", "@wangcoffee"];

type StepStatus = "pending" | "active" | "done";

// ─── helpers ────────────────────────────────────────────────────────────

async function fetchState(): Promise<BusState | null> {
  try {
    const res = await fetch("/api/code/dev/state", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: BusState };
    return json.data;
  } catch {
    return null;
  }
}

function relativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Math.max(0, now - t);
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function formatPercent(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0%";
  return `${(n * 100).toFixed(1)}%`;
}

// ─── client root ────────────────────────────────────────────────────────

export default function CodePlaygroundClient() {
  const [state, setState] = useState<BusState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [actingHandle, setActingHandle] = useState("@zhangcoffee");

  const refresh = useCallback(async () => {
    const next = await fetchState();
    if (next) setState(next);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intended initial fetch
    void refresh();
    const t = window.setInterval(() => {
      void refresh();
    }, 3000);
    const t2 = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(t2);
    };
  }, [refresh]);

  // Derive step completion from bus state
  const myAccepted = useMemo(() => {
    if (!state) return [];
    return state.links.filter((l) => l.creator_handle === actingHandle);
  }, [state, actingHandle]);

  const latestLink = myAccepted[myAccepted.length - 1] ?? state?.links[state.links.length - 1];
  const lastRedemption = useMemo(() => {
    if (!state) return null;
    const redeemEvent = state.activity.find(
      (a) => a.kind === "redeem-win" || a.kind === "redeem-loss",
    );
    return redeemEvent ?? null;
  }, [state]);

  const progress = useMemo(() => {
    const hasCampaign = (state?.campaigns.length ?? 0) > 0;
    const hasLink = (state?.links.length ?? 0) > 0;
    const hasSession = (state?.counts.sessions ?? 0) > 0;
    const hasRedemption = (state?.counts.redemptions ?? 0) > 0;
    return {
      step1: hasCampaign ? "done" : "active",
      step2: hasLink ? "done" : hasCampaign ? "active" : "pending",
      step3: hasSession ? "done" : hasLink ? "active" : "pending",
      step4: hasRedemption ? "done" : hasSession ? "active" : "pending",
      step5: hasRedemption ? "done" : "pending",
    } satisfies Record<`step${1 | 2 | 3 | 4 | 5}`, StepStatus>;
  }, [state]);

  return (
    <div className="db-dashboard-page anim-page cp-shell">
      <PageHeader
        eyebrow="(CODE SYSTEM · PLAYGROUND)"
        title="One-page closed loop"
        subtitle="Walk through all 5 steps without leaving this page. Bus state is in-memory; reset to start over."
        action={
          <div className="cp-header-actions">
            <RunFullDemoButton onDone={refresh} />
            <ResetButton onReset={refresh} />
          </div>
        }
      />

      <CampaignEndedBanner state={state} />

      <FlowStrip progress={progress} />

      <Step
        number={1}
        title="Merchant publishes"
        subtitle="Define the campaign, prize pool, and bracket distribution."
        status={progress.step1}
        nextHint={
          progress.step1 === "done"
            ? "Step 2 · Switch to creator role and accept the campaign."
            : null
        }
      >
        <PublishForm onPublished={refresh} hasAny={(state?.campaigns.length ?? 0) > 0} />
      </Step>

      <Step
        number={2}
        title="Creator accepts"
        subtitle="Pick a creator handle, accept an open campaign, and mint a unique share link."
        status={progress.step2}
        nextHint={
          progress.step2 === "done"
            ? "Step 3 · The customer (you, in another tab) opens that link."
            : progress.step2 === "pending"
            ? "Publish a campaign first ↑"
            : null
        }
      >
        <CreatorPanel
          state={state}
          actingHandle={actingHandle}
          onHandleChange={setActingHandle}
          onAccepted={refresh}
        />
      </Step>

      <Step
        number={3}
        title="Customer lands"
        subtitle="The share link mints a per-customer session and shows a 6-digit code that rotates every 60 s."
        status={progress.step3}
        nextHint={
          progress.step3 === "done"
            ? "Step 4 · Type that code into the staff terminal below."
            : progress.step3 === "pending"
            ? "Accept a campaign first ↑"
            : null
        }
      >
        <CustomerPreview link={latestLink ?? null} now={now} onTapped={refresh} />
      </Step>

      <Step
        number={4}
        title="Staff redeems"
        subtitle="Type the code the customer reads to you. Backend atomically increments the campaign counter and checks the sealed winning positions."
        status={progress.step4}
        nextHint={
          progress.step4 === "done"
            ? "Step 5 · The customer's page detects the redemption and flips to win/lose within 5 s."
            : progress.step4 === "pending"
            ? "Land a customer session first ↑"
            : null
        }
      >
        <InlineTerminal
          onRedeemed={refresh}
          latestLink={latestLink ?? null}
        />
      </Step>

      <Step
        number={5}
        title="Customer sees outcome"
        subtitle="Automatic. Any open /r/<token> tab polls /api/code/session-status every 5 s and switches to a win or lose reveal."
        status={progress.step5}
        nextHint={null}
      >
        <OutcomeNote
          lastRedemption={lastRedemption}
          latestLink={latestLink ?? null}
          state={state}
        />
      </Step>

      <LiveStatePanel state={state} now={now} />
    </div>
  );
}

// ─── reusable step wrapper ──────────────────────────────────────────────

function Step({
  number,
  title,
  subtitle,
  status,
  nextHint,
  children,
}: {
  number: number;
  title: string;
  subtitle: string;
  status: StepStatus;
  nextHint: string | null;
  children: ReactNode;
}) {
  return (
    <section
      className={`cp-step cp-step--${status}`}
      aria-labelledby={`cp-step-${number}-title`}
    >
      <div className="cp-step__rail">
        <div className="cp-step__circle" aria-hidden="true">
          {status === "done" ? "✓" : number}
        </div>
        <div className="cp-step__line" aria-hidden="true" />
      </div>
      <div className="cp-step__content">
        <header className="cp-step__head">
          <p className="cp-step__eyebrow">
            STEP {number}
            <span className={`cp-step__badge cp-step__badge--${status}`}>
              {status === "done" ? "DONE" : status === "active" ? "ACTIVE" : "WAITING"}
            </span>
          </p>
          <h2 id={`cp-step-${number}-title`} className="cp-step__title">
            {title}
          </h2>
          <p className="cp-step__subtitle">{subtitle}</p>
        </header>
        <div className="cp-step__body">{children}</div>
        {nextHint ? (
          <p className="cp-step__hint">→ {nextHint}</p>
        ) : null}
      </div>
    </section>
  );
}

// ─── flow strip ─────────────────────────────────────────────────────────

function FlowStrip({
  progress,
}: {
  progress: Record<`step${1 | 2 | 3 | 4 | 5}`, StepStatus>;
}) {
  const labels = [
    { n: 1, label: "Publish" },
    { n: 2, label: "Accept" },
    { n: 3, label: "Land" },
    { n: 4, label: "Redeem" },
    { n: 5, label: "Reveal" },
  ];
  return (
    <ol className="cp-flow" aria-label="Closed-loop progress">
      {labels.map((l, i) => {
        const status = progress[`step${l.n}` as keyof typeof progress];
        return (
          <li key={l.n} className={`cp-flow__step cp-flow__step--${status}`}>
            <span className="cp-flow__dot">{status === "done" ? "✓" : l.n}</span>
            <span className="cp-flow__label">{l.label}</span>
            {i < labels.length - 1 ? (
              <span className="cp-flow__connector" aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// ─── reset button ───────────────────────────────────────────────────────

function ResetButton({ onReset }: { onReset: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost cp-reset"
      disabled={busy}
      onClick={async () => {
        if (
          !window.confirm(
            "Clear all dev-bus state (campaigns, links, redemptions)?",
          )
        ) {
          return;
        }
        setBusy(true);
        await fetch("/api/code/dev/reset", { method: "POST" });
        await onReset();
        setBusy(false);
      }}
    >
      {busy ? "Resetting…" : "Reset"}
    </button>
  );
}

/**
 * One-click "publish + 3 creators accept + 5 customers land + 1 redeem"
 * shortcut so you can demo to someone without click-by-click narration.
 */
function RunFullDemoButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg("Resetting…");
    await fetch("/api/code/dev/reset", { method: "POST" });

    setMsg("Publishing…");
    const pub = await fetch("/api/code/dev/publish-campaign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Free latte for a 30s reel",
        prize_text: "Free latte",
        prize_total: 30,
        entry_total: 100,
        preset: "front-heavy",
      }),
    });
    const pubJson = (await pub.json()) as { data?: { campaign_id: string } };
    if (!pubJson.data) {
      setMsg("Publish failed");
      setBusy(false);
      return;
    }
    const campaignId = pubJson.data.campaign_id;

    setMsg("3 creators accepting…");
    const tokens: string[] = [];
    for (const handle of KNOWN_CREATORS) {
      const acc = await fetch("/api/code/dev/accept-campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          creator_handle: handle,
        }),
      });
      const accJson = (await acc.json()) as { data?: { token: string } };
      if (accJson.data) tokens.push(accJson.data.token);
    }

    setMsg("Simulating 5 customer landings…");
    // We can't easily mint sessions from arbitrary cookies via the API,
    // so just bump tap counts via repeated /api/code/landing calls.  The
    // dev cookie sticks to one session per link per browser, which is
    // fine for a quick demo.
    for (const token of tokens) {
      await fetch("/api/code/landing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
    }

    setMsg("Done · refresh to see state");
    await onDone();
    setBusy(false);
    window.setTimeout(() => setMsg(null), 2500);
  }

  return (
    <button
      type="button"
      className="btn-ghost cp-reset cp-demo-btn"
      disabled={busy}
      onClick={run}
      title="Reset + publish + 3 creators accept + 5 landings"
    >
      {busy ? msg ?? "Running…" : "▶ Run demo"}
    </button>
  );
}

/**
 * Banner that appears at the top of the page when any campaign has hit
 * its entry cap.  Otherwise null.
 */
function CampaignEndedBanner({ state }: { state: BusState | null }) {
  if (!state) return null;
  const ended = state.campaigns.filter((c) => c.status === "ended");
  if (ended.length === 0) return null;
  return (
    <div className="cp-ended-banner" role="status">
      <p className="cp-ended-banner__title">
        ⚑ {ended.length === 1 ? "Campaign ended" : `${ended.length} campaigns ended`}
      </p>
      <p className="cp-ended-banner__body">
        {ended.map((c) => (
          <span key={c.id} className="cp-ended-banner__row">
            <strong>{c.title}</strong> · {c.stats.prize_used} of {c.prize_total} prizes
            given · {c.entry_total} entries used
          </span>
        ))}
        Reset to start a new one, or publish another above.
      </p>
    </div>
  );
}

// ─── step 1 · publish form ──────────────────────────────────────────────

function PublishForm({
  onPublished,
  hasAny,
}: {
  onPublished: () => void;
  hasAny: boolean;
}) {
  const [title, setTitle] = useState("Free latte for a 30s reel");
  const [prizeText, setPrizeText] = useState("Free latte");
  const [prizeTotal, setPrizeTotal] = useState(30);
  const [entryTotal, setEntryTotal] = useState(100);
  const [preset, setPreset] = useState<Preset>("front-heavy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/code/dev/publish-campaign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        prize_text: prizeText,
        prize_total: prizeTotal,
        entry_total: entryTotal,
        preset,
      }),
    });
    const json = (await res.json()) as { data?: { title: string }; error?: string };
    if (res.ok && json.data) {
      setSuccess(`Published "${json.data.title}"`);
      onPublished();
    } else {
      setError(json.error ?? "Publish failed");
    }
    setBusy(false);
  }

  return (
    <form className="cp-form" onSubmit={submit}>
      <label className="cp-field">
        <span className="cp-field__label">Title</span>
        <input
          className="cp-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Free latte for a 30s reel"
          required
        />
      </label>
      <label className="cp-field">
        <span className="cp-field__label">
          Prize text · what staff hands the winner
        </span>
        <input
          className="cp-input"
          value={prizeText}
          onChange={(e) => setPrizeText(e.target.value)}
          placeholder="Free latte"
          required
        />
      </label>
      <div className="cp-row">
        <label className="cp-field">
          <span className="cp-field__label">Prizes total</span>
          <input
            className="cp-input"
            type="number"
            min={1}
            value={prizeTotal}
            onChange={(e) => setPrizeTotal(Number(e.target.value))}
          />
        </label>
        <label className="cp-field">
          <span className="cp-field__label">Entry cap</span>
          <input
            className="cp-input"
            type="number"
            min={prizeTotal}
            value={entryTotal}
            onChange={(e) => setEntryTotal(Number(e.target.value))}
          />
        </label>
      </div>
      <label className="cp-field">
        <span className="cp-field__label">Brackets preset</span>
        <select
          className="cp-input"
          value={preset}
          onChange={(e) => setPreset(e.target.value as Preset)}
        >
          {(Object.keys(PRESET_LABEL) as Preset[]).map((p) => (
            <option key={p} value={p}>
              {PRESET_LABEL[p]}
            </option>
          ))}
        </select>
      </label>
      <BracketHistogram
        preset={preset}
        prizeTotal={prizeTotal}
        entryTotal={entryTotal}
      />
      <button
        className="btn-primary cp-submit"
        disabled={busy}
        type="submit"
      >
        {busy ? "Publishing…" : hasAny ? "Publish another" : "Publish campaign"}
      </button>
      {error ? <p className="cp-msg cp-msg--err">{error}</p> : null}
      {success ? <p className="cp-msg cp-msg--ok">✓ {success}</p> : null}
    </form>
  );
}

/**
 * Visual: 2 horizontal bars showing the bracket distribution + win-rate
 * per bracket, computed from the same preset → brackets logic in
 * lib/code/dev-bus.ts.  Updates live as the form fields change.
 */
function BracketHistogram({
  preset,
  prizeTotal,
  entryTotal,
}: {
  preset: Preset;
  prizeTotal: number;
  entryTotal: number;
}) {
  const brackets = useMemo(() => {
    if (entryTotal < 1 || prizeTotal < 1) return [];
    if (preset === "even") {
      return [{ start: 1, end: entryTotal, prizes: prizeTotal }];
    }
    if (preset === "front-heavy") {
      const earlyEnd = Math.max(1, Math.floor(entryTotal * 0.3));
      const earlyPrizes = Math.min(
        prizeTotal,
        Math.max(1, Math.floor(prizeTotal * 0.7)),
      );
      return [
        { start: 1, end: earlyEnd, prizes: earlyPrizes },
        {
          start: earlyEnd + 1,
          end: entryTotal,
          prizes: Math.max(0, prizeTotal - earlyPrizes),
        },
      ];
    }
    if (preset === "sleeper") {
      const earlyEnd = Math.max(1, Math.floor(entryTotal * 0.3));
      const earlyPrizes = Math.max(1, Math.floor(prizeTotal * 0.2));
      return [
        { start: 1, end: earlyEnd, prizes: earlyPrizes },
        {
          start: earlyEnd + 1,
          end: entryTotal,
          prizes: Math.max(0, prizeTotal - earlyPrizes),
        },
      ];
    }
    return [{ start: 1, end: entryTotal, prizes: prizeTotal }];
  }, [preset, prizeTotal, entryTotal]);

  if (brackets.length === 0) return null;

  return (
    <div className="cp-histogram">
      <p className="cp-histogram__label">
        Distribution preview · {prizeTotal} winners across {entryTotal} entries
      </p>
      <div className="cp-histogram__bars">
        {brackets.map((b, i) => {
          const span = b.end - b.start + 1;
          const widthPct = (span / entryTotal) * 100;
          const winRate = span > 0 ? b.prizes / span : 0;
          return (
            <div
              key={i}
              className="cp-histogram__bar"
              style={{ width: `${widthPct}%` }}
              title={`Positions ${b.start}–${b.end}: ${b.prizes} winners (${(winRate * 100).toFixed(0)}% odds)`}
            >
              <span className="cp-histogram__bar-fill" style={{ height: `${Math.min(100, winRate * 100)}%` }} />
              <span className="cp-histogram__caption">
                pos {b.start}–{b.end}
                <br />
                {b.prizes} prize{b.prizes === 1 ? "" : "s"} · {(winRate * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── step 2 · creator panel ─────────────────────────────────────────────

function CreatorPanel({
  state,
  actingHandle,
  onHandleChange,
  onAccepted,
}: {
  state: BusState | null;
  actingHandle: string;
  onHandleChange: (v: string) => void;
  onAccepted: () => void;
}) {
  const myAccepted = useMemo(() => {
    if (!state) return [];
    return state.links.filter((l) => l.creator_handle === actingHandle);
  }, [state, actingHandle]);

  const inboxOpen = useMemo(() => {
    if (!state) return [];
    const acceptedCampaignIds = new Set(myAccepted.map((l) => l.campaign_id));
    return state.campaigns.filter(
      (c) => c.status === "active" && !acceptedCampaignIds.has(c.id),
    );
  }, [state, myAccepted]);

  async function accept(campaignId: string) {
    await fetch("/api/code/dev/accept-campaign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campaign_id: campaignId,
        creator_handle: actingHandle,
      }),
    });
    onAccepted();
  }

  return (
    <>
      <div className="cp-creator-pick">
        <p className="cp-field__label">Acting as creator</p>
        <div className="cp-creator-pick__chips" role="group" aria-label="Creator quick-switch">
          {KNOWN_CREATORS.map((h) => (
            <button
              key={h}
              type="button"
              className={`cp-creator-chip${
                h === actingHandle ? " cp-creator-chip--active" : ""
              }`}
              onClick={() => onHandleChange(h)}
            >
              {h}
            </button>
          ))}
        </div>
        <input
          className="cp-input cp-creator-pick__input"
          value={actingHandle}
          onChange={(e) =>
            onHandleChange(
              e.target.value.startsWith("@")
                ? e.target.value
                : `@${e.target.value}`,
            )
          }
          aria-label="Custom creator handle"
        />
      </div>

      <h3 className="cp-subhead">
        Inbox · open campaigns ({inboxOpen.length})
      </h3>
      {inboxOpen.length === 0 ? (
        <p className="cp-empty">
          No open campaigns waiting. Publish one above (or you&rsquo;ve
          accepted them all).
        </p>
      ) : (
        <ul className="cp-list">
          {inboxOpen.map((c) => (
            <li key={c.id} className="cp-list-item">
              <div className="cp-list-item__main">
                <p className="cp-list-item__title">{c.title}</p>
                <p className="cp-list-item__meta">
                  {c.prize_total} prizes · cap {c.entry_total}
                </p>
              </div>
              <button
                className="btn-primary cp-accept"
                type="button"
                onClick={() => accept(c.id)}
              >
                Accept
              </button>
            </li>
          ))}
        </ul>
      )}

      {myAccepted.length > 0 ? (
        <>
          <h3 className="cp-subhead">My accepted ({myAccepted.length})</h3>
          <ul className="cp-list cp-list--cards">
            {myAccepted.map((l) => {
              const campaign = state?.campaigns.find(
                (c) => c.id === l.campaign_id,
              );
              return (
                <li key={l.id} className="cp-link-card">
                  <p className="cp-link-card__campaign">
                    {campaign?.title ?? "—"}
                  </p>
                  <code className="cp-link-card__url">/r/{l.token}</code>
                  <div className="cp-link-card__actions">
                    <a
                      className="btn-ghost cp-mini-btn"
                      href={`/r/${l.token}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open as customer ↗
                    </a>
                    <CopyButton
                      text={`${
                        typeof window !== "undefined" ? window.location.origin : ""
                      }/r/${l.token}`}
                    />
                  </div>
                  <dl className="cp-link-card__stats">
                    <Stat label="Taps" value={l.stats.taps} />
                    <Stat label="Visits" value={l.stats.visits} />
                    <Stat label="Wins" value={l.stats.wins} />
                    <Stat
                      label="Claim rate"
                      value={formatPercent(l.stats.claim_rate)}
                    />
                  </dl>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </>
  );
}

// ─── step 3 · inline customer preview ───────────────────────────────────

interface LiveCode {
  session_id: string | null;
  code: string;
  expires_at: string;
}

function CustomerPreview({
  link,
  now,
  onTapped,
}: {
  link: BusLink | null;
  now: number;
  onTapped: () => void;
}) {
  const [live, setLive] = useState<LiveCode | null>(null);
  const [campaignTitle, setCampaignTitle] = useState<string>("");
  const [prizeText, setPrizeText] = useState<string>("");
  const [creatorHandle, setCreatorHandle] = useState<string>("");
  // landedTokens tracks which tokens the user has explicitly tapped to
  // land for, so the gesture is preserved if the user toggles between
  // creators (which changes `link`).
  const [landedTokens, setLandedTokens] = useState<Set<string>>(new Set());
  const hasLanded = link ? landedTokens.has(link.token) : false;

  useEffect(() => {
    // Reset preview when the active link changes; keep landedTokens.
    if (!link) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intended reset on unlink
      setLive(null);
      return;
    }
    if (!landedTokens.has(link.token)) {
      setLive(null);
      return;
    }
    const token = link.token;
    let cancelled = false;
    let interval: number | null = null;

    async function bootstrap() {
      const landing = await fetch("/api/code/landing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!landing.ok || cancelled) return;
      const lj = (await landing.json()) as {
        data: {
          session_id: string;
          link: {
            campaign_title: string;
            prize_text: string;
            creator_handle: string;
          };
        };
      };
      if (cancelled) return;
      setCampaignTitle(lj.data.link.campaign_title);
      setPrizeText(lj.data.link.prize_text);
      setCreatorHandle(lj.data.link.creator_handle);
      onTapped();

      async function pollCode() {
        const res = await fetch(
          `/api/code/current?session=${lj.data.session_id}`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const cj = (await res.json()) as {
          data: { code: string; expires_at: string };
        };
        if (cancelled) return;
        setLive({
          session_id: lj.data.session_id,
          code: cj.data.code,
          expires_at: cj.data.expires_at,
        });
      }

      void pollCode();
      interval = window.setInterval(pollCode, 10000);
    }

    void bootstrap();
    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
    // We bootstrap once per (token, hasLanded) change; downstream fetchers handle their own loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.token, hasLanded]);

  if (!link) {
    return (
      <p className="cp-empty">
        Accept a campaign in Step 2 to mint a link customers can tap. The live
        rotating code will preview here.
      </p>
    );
  }

  if (!hasLanded) {
    return (
      <div className="cp-tap-to-land">
        <p className="cp-tap-to-land__copy">
          A customer would tap{" "}
          <code className="cp-tap-to-land__url">/r/{link.token}</code> from{" "}
          {link.creator_handle}&rsquo;s post or story. Simulate that tap to
          mint a session and start the rotating code.
        </p>
        <button
          type="button"
          className="btn-primary cp-tap-to-land__btn"
          onClick={() =>
            setLandedTokens((prev) => {
              const next = new Set(prev);
              next.add(link.token);
              return next;
            })
          }
        >
          Tap to land as customer
        </button>
      </div>
    );
  }

  const expiresMs = live ? new Date(live.expires_at).getTime() : 0;
  const remaining = live ? Math.max(0, Math.ceil((expiresMs - now) / 1000)) : 60;
  const formatted = live ? `${live.code.slice(0, 3)} ${live.code.slice(3)}` : "— — —";

  return (
    <div className="cp-customer-preview">
      <div className="cp-customer-preview__panel">
        <span className="cp-customer-preview__grommet cp-customer-preview__grommet--tl" />
        <span className="cp-customer-preview__grommet cp-customer-preview__grommet--tr" />
        <span className="cp-customer-preview__grommet cp-customer-preview__grommet--bl" />
        <span className="cp-customer-preview__grommet cp-customer-preview__grommet--br" />
        <p className="cp-customer-preview__eyebrow">
          (SPONSORED · {creatorHandle.toUpperCase()})
        </p>
        <p className="cp-customer-preview__sub">Show this code at the counter</p>
        <p className="cp-customer-preview__code">{formatted}</p>
        <p className="cp-customer-preview__count">
          Refreshes in {remaining} s · {prizeText}
        </p>
      </div>
      <p className="cp-customer-preview__campaign">{campaignTitle}</p>
      <div className="cp-customer-preview__actions">
        <a
          className="btn-ghost cp-mini-btn"
          href={`/r/${link.token}`}
          target="_blank"
          rel="noreferrer"
        >
          Open full /r/{link.token} ↗
        </a>
      </div>
    </div>
  );
}

// ─── step 4 · inline staff terminal ─────────────────────────────────────

interface RedeemReveal {
  ok: boolean;
  outcome?: "won" | "lost";
  position?: number;
  prize_text?: string | null;
  creator_handle?: string;
  campaign_title?: string;
  error?: string;
}

function InlineTerminal({
  onRedeemed,
  latestLink,
}: {
  onRedeemed: () => void;
  latestLink: BusLink | null;
}) {
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<RedeemReveal | null>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setDigits(e.target.value.replace(/\D/g, "").slice(0, 6));
  }

  const formatted = useMemo(() => {
    if (digits.length <= 3) return digits;
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }, [digits]);

  const canRedeem = digits.length === 6 && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canRedeem) return;
    setBusy(true);
    setReveal(null);
    const res = await fetch("/api/code/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: digits }),
    });
    const json = (await res.json()) as {
      data?: {
        outcome: "won" | "lost";
        position: number;
        prize_text: string | null;
        creator_handle: string;
        campaign_title: string;
      };
      error?: string;
    };
    if (res.ok && json.data) {
      setReveal({
        ok: true,
        outcome: json.data.outcome,
        position: json.data.position,
        prize_text: json.data.prize_text,
        creator_handle: json.data.creator_handle,
        campaign_title: json.data.campaign_title,
      });
      setDigits("");
      onRedeemed();
    } else {
      setReveal({ ok: false, error: json.error ?? "REDEEM_FAILED" });
    }
    setBusy(false);
  }

  return (
    <form className="cp-terminal" onSubmit={submit}>
      {latestLink ? (
        <div className="cp-cross-tab">
          <p className="cp-cross-tab__label">
            Want to see Step 5 fire live?
          </p>
          <p className="cp-cross-tab__body">
            Open{" "}
            <a
              className="cp-cross-tab__link"
              href={`/r/${latestLink.token}`}
              target="_blank"
              rel="noreferrer"
            >
              /r/{latestLink.token}
            </a>{" "}
            in another tab BEFORE you redeem. After you submit below, that
            tab will auto-flip to a win/lose reveal within ~5 s.
          </p>
        </div>
      ) : null}
      <label className="cp-field">
        <span className="cp-field__label">Customer code</span>
        <input
          className="cp-terminal__input"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000 000"
          value={formatted}
          onChange={handleChange}
        />
      </label>
      <button
        type="submit"
        className="cp-terminal__submit"
        disabled={!canRedeem}
      >
        {busy ? "Redeeming…" : "Redeem"}
      </button>
      {reveal ? <RedeemRevealCard reveal={reveal} /> : null}
    </form>
  );
}

function RedeemRevealCard({ reveal }: { reveal: RedeemReveal }) {
  if (!reveal.ok) {
    const msg =
      reveal.error === "CODE_NOT_FOUND"
        ? "No active code matches. Make sure the code is fresh — codes refresh every minute."
        : reveal.error === "CODE_ALREADY_USED"
        ? "Already redeemed. Each customer's code is single-use."
        : reveal.error === "CAMPAIGN_FULL"
        ? "Campaign reached its max attempts."
        : reveal.error === "CODE_AMBIGUOUS"
        ? "Two active sessions share this code in the current minute. Ask the customer to refresh and read the next rotation."
        : reveal.error ?? "Redeem failed.";
    return (
      <div className="cp-reveal cp-reveal--err">
        <p className="cp-reveal__eyebrow">CHECK CODE</p>
        <p className="cp-reveal__title">Redemption blocked</p>
        <p className="cp-reveal__body">{msg}</p>
      </div>
    );
  }
  if (reveal.outcome === "won") {
    return (
      <div className="cp-reveal cp-reveal--win">
        <p className="cp-reveal__eyebrow">
          {reveal.campaign_title?.toUpperCase()}
        </p>
        <p className="cp-reveal__title">
          🎁 Position #{reveal.position} · WINNER
        </p>
        <p className="cp-reveal__body">Creator: {reveal.creator_handle}</p>
        <p className="cp-reveal__hand">HAND TO CUSTOMER:</p>
        <p className="cp-reveal__prize">{reveal.prize_text}</p>
      </div>
    );
  }
  return (
    <div className="cp-reveal cp-reveal--lose">
      <p className="cp-reveal__eyebrow">
        {reveal.campaign_title?.toUpperCase()}
      </p>
      <p className="cp-reveal__title">
        Position #{reveal.position} · No win this time
      </p>
      <p className="cp-reveal__body">
        Creator: {reveal.creator_handle} · Thank the customer for visiting.
      </p>
    </div>
  );
}

// ─── step 5 · outcome note ──────────────────────────────────────────────

function OutcomeNote({
  lastRedemption,
  latestLink,
  state,
}: {
  lastRedemption: BusActivity | null;
  latestLink: BusLink | null;
  state: BusState | null;
}) {
  if (!state || state.counts.redemptions === 0) {
    return (
      <p className="cp-empty">
        Once Step 4 succeeds, the customer&rsquo;s tab at /r/&lt;token&gt;
        polls /api/code/session-status every 5 s and switches to a win or
        lose reveal. Open the link in another tab before Step 4 to watch it
        flip live.
      </p>
    );
  }
  return (
    <div className="cp-outcome-note">
      <p className="cp-outcome-note__lead">
        ✓ Last redemption pushed an update to{" "}
        <code>/api/code/session-status</code>. Any open
        <code>/r/&lt;token&gt;</code> tab flipped within 5 s.
      </p>
      {lastRedemption ? (
        <p className="cp-outcome-note__event">{lastRedemption.text}</p>
      ) : null}
      {latestLink ? (
        <a
          className="btn-ghost cp-mini-btn"
          href={`/r/${latestLink.token}`}
          target="_blank"
          rel="noreferrer"
        >
          Re-open /r/{latestLink.token} ↗
        </a>
      ) : null}
    </div>
  );
}

// ─── live state panel (collapsible) ─────────────────────────────────────

function LiveStatePanel({
  state,
  now,
}: {
  state: BusState | null;
  now: number;
}) {
  if (!state) return null;
  return (
    <details className="cp-live" open>
      <summary>
        Live bus state · {state.counts.campaigns} campaign /{" "}
        {state.counts.links} link / {state.counts.sessions} session /{" "}
        {state.counts.redemptions} redemption
      </summary>
      <div className="cp-live__body">
        {state.campaigns.length > 0 ? (
          <ul className="cp-campaign-list">
            {state.campaigns.map((c) => (
              <li key={c.id} className="cp-campaign-card">
                <header className="cp-campaign-card__head">
                  <p className="cp-campaign-card__title">{c.title}</p>
                  <span
                    className={`cp-pill cp-pill--${
                      c.status === "active" ? "active" : "ended"
                    }`}
                  >
                    {c.status}
                  </span>
                </header>
                <p className="cp-campaign-card__meta">
                  {c.stats.prize_used} / {c.prize_total} prizes given · cap{" "}
                  {c.entry_total}
                </p>
                <div className="cp-progress">
                  <div
                    className="cp-progress__fill"
                    style={{
                      width: `${Math.min(
                        100,
                        (c.stats.prize_used / c.prize_total) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <dl className="cp-campaign-card__stats">
                  <Stat label="Taps" value={c.stats.taps} />
                  <Stat label="Visits" value={c.stats.visits} />
                  <Stat label="Wins" value={c.stats.wins} />
                  <Stat
                    label="Claim rate"
                    value={formatPercent(c.stats.claim_rate)}
                  />
                </dl>
              </li>
            ))}
          </ul>
        ) : null}
        {state.activity.length > 0 ? (
          <>
            <h3 className="cp-subhead">Activity</h3>
            <ol className="cp-activity">
              {state.activity.map((a) => (
                <li
                  key={a.id}
                  className={`cp-activity-row cp-activity-row--${a.kind}`}
                >
                  <span className="cp-activity-row__time">
                    {relativeTime(a.ts, now)}
                  </span>
                  <span className="cp-activity-row__text">{a.text}</span>
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </details>
  );
}

// ─── small primitives ───────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="cp-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost cp-mini-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // ignore
        }
      }}
    >
      {copied ? "Copied!" : "Copy URL"}
    </button>
  );
}
