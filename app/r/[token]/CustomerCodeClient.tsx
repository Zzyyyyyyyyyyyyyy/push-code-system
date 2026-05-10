"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CountdownRing from "@/components/code/CountdownRing";
import {
  mockGetCodeCurrent,
  mockGetCodeSessionStatus,
  type ApiSuccess,
  type CodeCurrentData,
  type CodeOutcome,
  type CodeSessionStatusData,
} from "./_mock";

export type CustomerCodeInitialData = {
  token: string;
  sessionId: string;
  campaignTitle: string;
  prizeText: string;
  merchantName: string;
  merchantHandle: string;
  merchantLocation: string;
  creatorHandle: string;
  sponsoredDisclosureText: string;
  currentCode: string;
  expiresAt: string;
};

type SessionStatus = {
  redeemed: boolean;
  outcome: CodeOutcome | null;
  prizeText?: string;
};

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload
  ) {
    return (payload as ApiSuccess<T>).data;
  }

  return payload as T;
}

function formatCode(code: string): string {
  const digits = code.replace(/\D/g, "").padStart(6, "0").slice(0, 6);
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

function secondsUntil(expiresAt: string, now: number): number {
  const remaining = Math.ceil((new Date(expiresAt).getTime() - now) / 1000);
  return Math.max(0, Math.min(60, remaining));
}

async function fetchCurrentCode(
  token: string,
  sessionId: string,
): Promise<CodeCurrentData> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "1") {
    return unwrap(await mockGetCodeCurrent({ token, sessionId }));
  }

  const response = await fetch(
    `/api/code/current?session=${encodeURIComponent(sessionId)}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Unable to refresh code");
  }

  return unwrap((await response.json()) as ApiSuccess<CodeCurrentData>);
}

async function fetchSessionStatus(
  token: string,
  sessionId: string,
): Promise<SessionStatus> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "1") {
    const status = unwrap(
      await mockGetCodeSessionStatus({ token, sessionId }),
    );
    return {
      redeemed: status.redeemed,
      outcome: status.outcome ?? null,
      prizeText: status.prize_text,
    };
  }

  const response = await fetch(
    `/api/code/session-status?session=${encodeURIComponent(sessionId)}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Unable to check session");
  }

  const status = unwrap(
    (await response.json()) as ApiSuccess<CodeSessionStatusData>,
  );

  return {
    redeemed: status.redeemed,
    outcome: status.outcome ?? null,
    prizeText: status.prize_text,
  };
}

export default function CustomerCodeClient({
  initialData,
}: {
  initialData: CustomerCodeInitialData;
}) {
  const [code, setCode] = useState(initialData.currentCode);
  const [expiresAt, setExpiresAt] = useState(initialData.expiresAt);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState<SessionStatus>({
    redeemed: false,
    outcome: null,
  });

  const secondsRemaining = secondsUntil(expiresAt, now);
  const formattedCode = useMemo(() => formatCode(code), [code]);
  const isWon = status.redeemed && status.outcome === "won";
  const isLost = status.redeemed && status.outcome === "lost";
  const revealPrize = status.prizeText ?? initialData.prizeText;

  const refreshCode = useCallback(async () => {
    if (status.redeemed) return;

    const current = await fetchCurrentCode(
      initialData.token,
      initialData.sessionId,
    );
    setCode(current.code);
    setExpiresAt(current.expires_at);
  }, [initialData.sessionId, initialData.token, status.redeemed]);

  const refreshStatus = useCallback(async () => {
    const nextStatus = await fetchSessionStatus(
      initialData.token,
      initialData.sessionId,
    );
    setStatus(nextStatus);
  }, [initialData.sessionId, initialData.token]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const poll = window.setInterval(() => {
      void refreshCode();
    }, 30_000);

    return () => window.clearInterval(poll);
  }, [refreshCode]);

  useEffect(() => {
    if (secondsRemaining !== 0 || status.redeemed) return;

    const timer = window.setTimeout(() => {
      void refreshCode();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshCode, secondsRemaining, status.redeemed]);

  useEffect(() => {
    const firstCheck = window.setTimeout(() => {
      void refreshStatus();
    }, 0);

    const poll = window.setInterval(() => {
      void refreshStatus();
    }, 5000);

    return () => {
      window.clearTimeout(firstCheck);
      window.clearInterval(poll);
    };
  }, [refreshStatus]);

  return (
    <main className="customer-code-page">
      <section className="customer-code-shell" aria-label="Rotating code">
        <p className="customer-code-eyebrow">
          (SPONSORED · {initialData.creatorHandle} ×{" "}
          {initialData.merchantHandle})
        </p>

        <div className="customer-code-ftc" role="note">
          <span>#ad</span>
          <p>{initialData.sponsoredDisclosureText}</p>
        </div>

        <article
          className={[
            "customer-code-ticket",
            isWon ? "customer-code-ticket--won" : "",
            isLost ? "customer-code-ticket--lost" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="customer-code-grommet customer-code-grommet--tl" />
          <span className="customer-code-grommet customer-code-grommet--tr" />
          <span className="customer-code-grommet customer-code-grommet--bl" />
          <span className="customer-code-grommet customer-code-grommet--br" />

          <div className="customer-code-perf customer-code-perf--top" />

          <div className="customer-code-ticket-body">
            <h1>Show this code at the counter</h1>

            <p className="customer-code-number" aria-label={`Code ${code}`}>
              {formattedCode}
            </p>

            <div className="customer-code-status" aria-live="polite">
              {status.redeemed ? (
                <div className="customer-code-reveal">
                  {isWon ? (
                    <>
                      <p className="customer-code-reveal-emoji">🎉</p>
                      <p className="customer-code-reveal-title">
                        You won! Show this to staff:
                      </p>
                      <p className="customer-code-reveal-prize">
                        {revealPrize}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="customer-code-reveal-title">
                        Thanks for visiting — better luck next time.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="customer-code-countdown">
                  <CountdownRing
                    className="customer-code-countdown-ring"
                    secondsRemaining={secondsRemaining}
                  />
                  <p>Refreshes in {secondsRemaining} s</p>
                </div>
              )}
            </div>
          </div>

          <div className="customer-code-perf customer-code-perf--bottom" />
        </article>

        <section className="customer-code-details">
          <h2>{initialData.campaignTitle}</h2>
          <p className="customer-code-prize">{initialData.prizeText}</p>
          <p className="customer-code-location">
            {initialData.merchantName} · {initialData.merchantLocation}
          </p>
          <p className="customer-code-why">
            Why this works: your visit credits the creator without collecting
            personal info.
          </p>
        </section>

        <footer className="customer-code-footer">
          This is a paid creator partnership. No personal info collected.
        </footer>
      </section>
    </main>
  );
}
