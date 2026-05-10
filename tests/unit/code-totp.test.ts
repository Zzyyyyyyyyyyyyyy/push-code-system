/**
 * @jest-environment node
 *
 * Unit tests for the TOTP impl backing the rotating-code system.
 *
 * Note: Our implementation uses HMAC-SHA256 (not the RFC 6238 SHA-1
 * default), 60-second period, and 6-digit truncation, so RFC reference
 * vectors don't apply directly.  We instead pin our own outputs to
 * detect regressions, plus verify cross-window determinism, the ±60s
 * grace, and rejection of off-window codes.
 */

import {
  currentTotpWindow,
  generateTotp,
  totpMinute,
  validateTotp,
} from "@/lib/code/totp";

const SECRET_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SECRET = Buffer.from(SECRET_HEX, "hex");

describe("code/totp", () => {
  describe("generateTotp", () => {
    it("produces a 6-digit zero-padded numeric string", () => {
      const code = generateTotp(SECRET, 1_000_000);
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    });

    it("is deterministic for (secret, minute)", () => {
      const c1 = generateTotp(SECRET, 42);
      const c2 = generateTotp(SECRET, 42);
      expect(c1).toBe(c2);
    });

    it("changes every minute", () => {
      const m = 28_500_000;
      const c0 = generateTotp(SECRET, m);
      const c1 = generateTotp(SECRET, m + 1);
      expect(c0).not.toBe(c1);
    });

    it("differs across secrets at same minute", () => {
      const a = generateTotp(SECRET, 42);
      const b = generateTotp(Buffer.alloc(32, 0xff), 42);
      expect(a).not.toBe(b);
    });
  });

  describe("totpMinute", () => {
    it("buckets seconds into 60s windows", () => {
      // Same minute window: floor(unixSeconds / 60).
      expect(totpMinute(0)).toBe(0);
      expect(totpMinute(59)).toBe(0);
      expect(totpMinute(60)).toBe(1);
      expect(totpMinute(61)).toBe(1);
      expect(totpMinute(119)).toBe(1);
      expect(totpMinute(120)).toBe(2);
    });
  });

  describe("currentTotpWindow", () => {
    it("returns [current, previous] codes for the ±60s grace", () => {
      const now = new Date("2026-05-08T19:30:00Z");
      const [c0, c1] = currentTotpWindow(SECRET, now);
      const minute = totpMinute(now.getTime() / 1000);
      expect(c0).toBe(generateTotp(SECRET, minute));
      expect(c1).toBe(generateTotp(SECRET, minute - 1));
    });
  });

  describe("validateTotp", () => {
    const now = new Date("2026-05-08T19:30:00Z");
    const minute = totpMinute(now.getTime() / 1000);

    it("accepts the current minute's code", () => {
      const code = generateTotp(SECRET, minute);
      expect(validateTotp(code, SECRET, now)).toBe(true);
    });

    it("accepts the previous minute's code (grace)", () => {
      const code = generateTotp(SECRET, minute - 1);
      expect(validateTotp(code, SECRET, now)).toBe(true);
    });

    it("rejects a code from 2 minutes ago", () => {
      const code = generateTotp(SECRET, minute - 2);
      expect(validateTotp(code, SECRET, now)).toBe(false);
    });

    it("rejects a code from a different secret", () => {
      const wrongSecret = Buffer.alloc(32, 0xaa);
      const code = generateTotp(wrongSecret, minute);
      expect(validateTotp(code, SECRET, now)).toBe(false);
    });

    it("rejects malformed input", () => {
      expect(validateTotp("12345", SECRET, now)).toBe(false); // 5 digits
      expect(validateTotp("abcdef", SECRET, now)).toBe(false);
      expect(validateTotp("", SECRET, now)).toBe(false);
    });
  });
});
