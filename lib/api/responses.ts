/**
 * Minimal port of the parent repo's lib/api/responses.ts. Just the
 * three helpers the dev-bus path uses — no SQLSTATE handling, no
 * trace_id correlation, no demo cookie short-circuit.
 */

import { NextResponse } from "next/server";

export function success<T>(
  data: T,
  extras?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({
    data,
    timestamp: new Date().toISOString(),
    ...extras,
  });
}

export function badRequest(
  message: string,
  extras?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: message, ...extras }, { status: 400 });
}

export function notFound(message = "Not found"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}
