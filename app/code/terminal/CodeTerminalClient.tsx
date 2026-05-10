"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { CodeOutcomeReveal } from "@/components/code/CodeOutcomeReveal";
import {
  redeemCodeViaApi,
  type RedeemErrorCode,
  type RedeemOutcome,
} from "./_mock";
import "./code-terminal.css";

type RevealState = {
  outcome: RedeemOutcome | null;
  position?: number;
  prize?: string;
  creatorName?: string;
  campaignName?: string;
  errorCode?: RedeemErrorCode;
};

const EMPTY_REVEAL: RevealState = {
  outcome: null,
};

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function formatCode(value: string) {
  const digits = normalizeDigits(value);
  if (digits.length <= 3) {
    return digits;
  }

  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

export function CodeTerminalClient() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [digits, setDigits] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reveal, setReveal] = useState<RevealState>(EMPTY_REVEAL);

  const formattedCode = formatCode(digits);
  const canRedeem = digits.length === 6 && !isLoading;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleCodeChange(event: ChangeEvent<HTMLInputElement>) {
    setDigits(normalizeDigits(event.target.value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canRedeem) {
      inputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setReveal(EMPTY_REVEAL);

    const result = await redeemCodeViaApi(digits);

    if ("errorCode" in result) {
      setReveal({
        outcome: null,
        errorCode: result.errorCode,
      });
      setIsLoading(false);
      inputRef.current?.focus();
      return;
    }

    setReveal({
      outcome: result.outcome,
      position: result.position,
      prize: result.prize,
      creatorName: result.creatorName,
      campaignName: result.campaignName,
    });
    setDigits("");
    setIsLoading(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="ct-page">
      <form className="ct-terminal" onSubmit={handleSubmit}>
        <label className="ct-input-label" htmlFor="customer-code">
          Customer code
        </label>
        <input
          ref={inputRef}
          aria-label="Customer 6-digit code"
          autoComplete="off"
          className="ct-code-input"
          id="customer-code"
          inputMode="numeric"
          maxLength={7}
          pattern="[0-9 ]*"
          placeholder="000 000"
          type="text"
          value={formattedCode}
          onChange={handleCodeChange}
        />
        <button className="btn-ink ct-submit" disabled={!canRedeem} type="submit">
          Redeem
        </button>
      </form>

      <CodeOutcomeReveal
        campaignName={reveal.campaignName}
        creatorName={reveal.creatorName}
        errorCode={reveal.errorCode}
        isLoading={isLoading}
        outcome={reveal.outcome}
        position={reveal.position}
        prize={reveal.prize}
      />
    </div>
  );
}
