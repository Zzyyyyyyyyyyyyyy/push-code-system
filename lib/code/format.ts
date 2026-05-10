export function padCode(value: number | string): string {
  const digits =
    typeof value === "number"
      ? Math.trunc(value).toString()
      : value.replace(/\D/g, "");
  return digits.slice(-6).padStart(6, "0");
}

export function formatCodeForDisplay(code: string): string {
  const padded = padCode(code);
  return `${padded.slice(0, 3)} ${padded.slice(3)}`;
}

export function normalizeCodeInput(input: unknown): string | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const digits = String(input).replace(/\D/g, "");
  if (digits.length !== 6) return null;
  return digits;
}
