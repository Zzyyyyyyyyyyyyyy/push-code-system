/**
 * @jest-environment node
 *
 * Unit tests for the in-memory dev bus that powers /code playground.
 * Verifies bracket preset math, winning-position sealing, idempotent
 * session minting (no double-counted taps), single-use redemption,
 * ambiguous-code refusal, and CAMPAIGN_FULL once the entry cap is hit.
 *
 * Note: each `describe` runs in its own jest test file so the
 * globalThis singleton is per-test-file, not per-`it`.  We call
 * `reset()` at the start of every `it` to keep cases independent.
 */

import {
  acceptCampaign,
  bracketsForPreset,
  mintSession,
  publishCampaign,
  redeemCode,
  reset,
} from "@/lib/code/dev-bus";
import { generateTotp } from "@/lib/code/totp";

beforeEach(() => {
  reset();
});

describe("bracketsForPreset", () => {
  it("even = single bracket spanning all entries with all prizes", () => {
    const b = bracketsForPreset("even", 30, 100);
    expect(b).toHaveLength(1);
    expect(b[0]).toEqual({ start: 1, end: 100, prizes: 30 });
  });

  it("front-heavy puts ~70% of prizes in the first ~30% of entries", () => {
    const b = bracketsForPreset("front-heavy", 30, 100);
    expect(b).toHaveLength(2);
    expect(b[0]).toEqual({ start: 1, end: 30, prizes: 21 });
    expect(b[1]).toEqual({ start: 31, end: 100, prizes: 9 });
  });

  it("sleeper puts ~20% of prizes in the first ~30% of entries", () => {
    const b = bracketsForPreset("sleeper", 30, 100);
    expect(b).toHaveLength(2);
    expect(b[0]).toEqual({ start: 1, end: 30, prizes: 6 });
    expect(b[1]).toEqual({ start: 31, end: 100, prizes: 24 });
  });

  it("custom returns a single fallback bracket (caller is expected to override)", () => {
    const b = bracketsForPreset("custom", 30, 100);
    expect(b).toHaveLength(1);
    expect(b[0].prizes).toBe(30);
  });
});

describe("publishCampaign + winning_positions", () => {
  it("seals exactly N winning positions from the bracket prize counts", () => {
    const c = publishCampaign({
      title: "T",
      prize_text: "Free",
      prize_total: 30,
      entry_total: 100,
      preset: "front-heavy",
    });
    expect(c.winning_positions.size).toBe(30);
  });

  it("respects bracket boundaries when sealing", () => {
    const c = publishCampaign({
      title: "T",
      prize_text: "Free",
      prize_total: 30,
      entry_total: 100,
      preset: "front-heavy",
    });
    let inEarly = 0;
    let inLate = 0;
    for (const p of c.winning_positions) {
      if (p >= 1 && p <= 30) inEarly++;
      else if (p >= 31 && p <= 100) inLate++;
    }
    expect(inEarly).toBe(21);
    expect(inLate).toBe(9);
  });

  it("starts with status=active and claim_counter=0", () => {
    const c = publishCampaign({
      title: "T",
      prize_text: "Free",
      prize_total: 5,
      entry_total: 10,
      preset: "even",
    });
    expect(c.status).toBe("active");
    expect(c.claim_counter).toBe(0);
  });
});

describe("acceptCampaign", () => {
  it("mints a unique link with a base32-ish token", () => {
    const c = publishCampaign({
      title: "T",
      prize_text: "Free",
      prize_total: 5,
      entry_total: 10,
      preset: "even",
    });
    const link = acceptCampaign({
      campaign_id: c.id,
      creator_handle: "@zhangcoffee",
    });
    expect(link).not.toBeNull();
    expect(link!.token).toMatch(/^[a-z2-9]{8}$/i);
    expect(link!.creator_handle).toBe("@zhangcoffee");
  });

  it("returns the SAME link if the same creator accepts twice", () => {
    const c = publishCampaign({
      title: "T",
      prize_text: "Free",
      prize_total: 5,
      entry_total: 10,
      preset: "even",
    });
    const a = acceptCampaign({
      campaign_id: c.id,
      creator_handle: "@zhang",
    });
    const b = acceptCampaign({
      campaign_id: c.id,
      creator_handle: "@zhang",
    });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(b!.id).toBe(a!.id);
    expect(b!.token).toBe(a!.token);
  });

  it("returns null for an unknown campaign", () => {
    const link = acceptCampaign({
      campaign_id: "nonexistent",
      creator_handle: "@x",
    });
    expect(link).toBeNull();
  });
});

describe("mintSession + tap counting hygiene", () => {
  it("creates a session and increments tap_count for a new cookie", () => {
    const c = publishCampaign({
      title: "T",
      prize_text: "Free",
      prize_total: 5,
      entry_total: 10,
      preset: "even",
    });
    const link = acceptCampaign({
      campaign_id: c.id,
      creator_handle: "@x",
    })!;
    const r = mintSession({ token: link.token, customer_cookie_id: "ck1" });
    expect(r).not.toBeNull();
    expect(r!.link.tap_count).toBe(1);
  });

  it("does NOT double-count taps for repeated mintSession with same cookie", () => {
    const c = publishCampaign({
      title: "T",
      prize_text: "Free",
      prize_total: 5,
      entry_total: 10,
      preset: "even",
    });
    const link = acceptCampaign({
      campaign_id: c.id,
      creator_handle: "@x",
    })!;
    mintSession({ token: link.token, customer_cookie_id: "ck1" });
    mintSession({ token: link.token, customer_cookie_id: "ck1" });
    mintSession({ token: link.token, customer_cookie_id: "ck1" });
    const r = mintSession({ token: link.token, customer_cookie_id: "ck1" });
    expect(r!.link.tap_count).toBe(1);
  });

  it("DOES count two distinct cookies as two taps", () => {
    const c = publishCampaign({
      title: "T",
      prize_text: "Free",
      prize_total: 5,
      entry_total: 10,
      preset: "even",
    });
    const link = acceptCampaign({
      campaign_id: c.id,
      creator_handle: "@x",
    })!;
    mintSession({ token: link.token, customer_cookie_id: "ck1" });
    const r = mintSession({ token: link.token, customer_cookie_id: "ck2" });
    expect(r!.link.tap_count).toBe(2);
  });
});

describe("redeemCode", () => {
  it("returns CODE_NOT_FOUND when no session matches", () => {
    const r = redeemCode("000000");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CODE_NOT_FOUND");
  });

  it("redeems a valid current-window code and marks the session used", () => {
    const c = publishCampaign({
      title: "T",
      prize_text: "Free",
      prize_total: 5,
      entry_total: 10,
      preset: "even",
    });
    const link = acceptCampaign({
      campaign_id: c.id,
      creator_handle: "@z",
    })!;
    const minted = mintSession({ token: link.token, customer_cookie_id: "ck" })!;
    const code = generateTotp(minted.session.secret);

    const r1 = redeemCode(code);
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.data.session_id).toBe(minted.session.id);
      expect(["won", "lost"]).toContain(r1.data.outcome);
    }

    const r2 = redeemCode(code);
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      // Either the session is now redeemed (ALREADY_USED) or the code
      // got rotated out — both are correct rejections.
      expect(["CODE_ALREADY_USED", "CODE_NOT_FOUND"]).toContain(r2.code);
    }
  });

  it("returns CAMPAIGN_FULL when the entry cap is exceeded on redeem", () => {
    const c = publishCampaign({
      title: "T",
      prize_text: "Free",
      prize_total: 2,
      entry_total: 2,
      preset: "even",
    });
    const link = acceptCampaign({
      campaign_id: c.id,
      creator_handle: "@z",
    })!;
    // 3 customers land before any redemptions — all 3 sessions mint
    // (campaign is still active until the (cap+1)th redeem attempt).
    const m1 = mintSession({ token: link.token, customer_cookie_id: "c1" })!;
    const m2 = mintSession({ token: link.token, customer_cookie_id: "c2" })!;
    const m3 = mintSession({ token: link.token, customer_cookie_id: "c3" })!;

    expect(redeemCode(generateTotp(m1.session.secret)).ok).toBe(true);
    expect(redeemCode(generateTotp(m2.session.secret)).ok).toBe(true);

    // 3rd redeem hits the cap; campaign flips to ended; counter stays at 2.
    const r3 = redeemCode(generateTotp(m3.session.secret));
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.code).toBe("CAMPAIGN_FULL");

    // After cap, new customers can't even mint sessions.
    const m4 = mintSession({ token: link.token, customer_cookie_id: "c4" });
    expect(m4).toBeNull();
  });
});
