import { createHmac, timingSafeEqual } from "node:crypto";
import { padCode } from "./format";

const STEP_SECONDS = 60;
const DIGITS_MOD = 1_000_000;

export type SecretInput = Buffer | Uint8Array | string | number[];

export function secretToBuffer(secret: SecretInput): Buffer {
  if (Buffer.isBuffer(secret)) return secret;
  if (secret instanceof Uint8Array) return Buffer.from(secret);
  if (Array.isArray(secret)) return Buffer.from(secret);
  if (secret.startsWith("\\x")) return Buffer.from(secret.slice(2), "hex");
  if (/^[0-9a-f]+$/i.test(secret) && secret.length % 2 === 0) {
    return Buffer.from(secret, "hex");
  }
  try {
    return Buffer.from(secret, "base64");
  } catch {
    return Buffer.from(secret, "utf8");
  }
}

export function totpMinute(unixSeconds = Date.now() / 1000): number {
  return Math.floor(unixSeconds / STEP_SECONDS);
}

export function generateTotp(secret: SecretInput, minute = totpMinute()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(minute));

  const digest = createHmac("sha256", secretToBuffer(secret))
    .update(counter)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const truncated = digest.readUInt32BE(offset) & 0x7fffffff;

  return padCode(truncated % DIGITS_MOD);
}

export function currentTotpWindow(secret: SecretInput, now = new Date()) {
  const current = totpMinute(now.getTime() / 1000);
  return [generateTotp(secret, current), generateTotp(secret, current - 1)];
}

export function validateTotp(
  code: string,
  secret: SecretInput,
  now = new Date(),
): boolean {
  const normalized = padCode(code);
  const expected = currentTotpWindow(secret, now);
  const actual = Buffer.from(normalized);

  return expected.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate);
    return (
      actual.length === candidateBuffer.length &&
      timingSafeEqual(actual, candidateBuffer)
    );
  });
}

export function nextTotpExpiry(now = new Date()): string {
  const nextBoundary =
    Math.floor(now.getTime() / (STEP_SECONDS * 1000)) * STEP_SECONDS * 1000 +
    STEP_SECONDS * 1000;
  return new Date(nextBoundary).toISOString();
}
