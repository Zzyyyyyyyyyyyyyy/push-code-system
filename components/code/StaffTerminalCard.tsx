"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import "./staff-terminal-card.css";

interface StaffTerminalCardProps {
  compact?: boolean;
}

export default function StaffTerminalCard({
  compact = false,
}: StaffTerminalCardProps) {
  const [terminalUrl, setTerminalUrl] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderQrCode() {
      const url = `${window.location.origin}/code/terminal`;
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
        color: {
          dark: "#0a0a0a",
          light: "#ffffff",
        },
      });

      if (!cancelled) {
        setTerminalUrl(url);
        setQrSvg(svg);
      }
    }

    void renderQrCode();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    if (!terminalUrl) return;

    await navigator.clipboard.writeText(terminalUrl);
    setCopied(true);

    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current);
    }

    copiedTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copiedTimerRef.current = null;
    }, 2000);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <article
      className={`staff-terminal-card${compact ? " staff-terminal-card--compact" : ""}`}
      aria-labelledby="staff-terminal-card-title"
    >
      <div className="staff-terminal-card__qr-panel">
        <div
          className="staff-terminal-card__qr"
          aria-label="QR code for staff redemption terminal"
          dangerouslySetInnerHTML={qrSvg ? { __html: qrSvg } : undefined}
        />
      </div>

      <div className="staff-terminal-card__content">
        <p className="staff-terminal-card__eyebrow">(STAFF TERMINAL)</p>
        <h3 id="staff-terminal-card-title" className="staff-terminal-card__title">
          Staff redemption terminal
        </h3>
        <p className="staff-terminal-card__description">
          Print this and tape it next to the register. Staff opens the URL on
          their phone, types the customer&apos;s 6-digit code, hits Redeem.
        </p>

        <div className="staff-terminal-card__url-row">
          <p className="staff-terminal-card__url">{terminalUrl}</p>
          <button
            className="staff-terminal-card__button staff-terminal-card__button--primary"
            type="button"
            onClick={handleCopy}
            disabled={!terminalUrl}
          >
            Copy URL
          </button>
        </div>

        <div className="staff-terminal-card__actions">
          <button
            className="staff-terminal-card__button staff-terminal-card__button--ghost"
            type="button"
            onClick={handlePrint}
          >
            Print this card
          </button>
          <span className="staff-terminal-card__copied" aria-live="polite">
            {copied ? "Copied!" : ""}
          </span>
        </div>
      </div>
    </article>
  );
}
