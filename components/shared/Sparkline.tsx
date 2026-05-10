"use client";

import { useId, useMemo } from "react";
import "./sparkline.css";

export interface SparklineProps {
  /** 7-day or 30-day series (any length >= 2). Values get min/max-normalized. */
  data: number[];
  /** SVG width in px. Default 80. */
  width?: number;
  /** SVG height in px. Default 24. */
  height?: number;
  /**
   * Trend coloring. `auto` computes from the data: last vs first, > 5% delta
   * is up/down, otherwise flat.
   */
  trend?: "up" | "down" | "flat" | "auto";
  /** Reserved variant slot for future palettes. */
  variant?: "primary" | "subtle" | "warning";
  /** Adds a soft gradient fill from the line down to the baseline. */
  showArea?: boolean;
  /** Emphasizes the latest data point with a 3px filled circle. */
  showLastDot?: boolean;
  /** Override aria-label. Default is computed from trend + delta. */
  ariaLabel?: string;
  /** Class hook for callers that need extra spacing. */
  className?: string;
}

type ResolvedTrend = "up" | "down" | "flat";

const STROKE_PADDING = 2; // keep stroke + dot inside the viewBox

function resolveTrend(
  data: number[],
  hint: SparklineProps["trend"],
): ResolvedTrend {
  if (hint && hint !== "auto") return hint;
  if (data.length < 2) return "flat";
  const first = data[0];
  const last = data[data.length - 1];
  if (first === 0) return last > 0 ? "up" : last < 0 ? "down" : "flat";
  const delta = (last - first) / Math.abs(first);
  if (delta > 0.05) return "up";
  if (delta < -0.05) return "down";
  return "flat";
}

function pctChange(data: number[]): number {
  if (data.length < 2) return 0;
  const first = data[0];
  const last = data[data.length - 1];
  if (first === 0) return last === 0 ? 0 : 100;
  return Math.round(((last - first) / Math.abs(first)) * 100);
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  trend = "auto",
  variant = "primary",
  showArea = false,
  showLastDot = false,
  ariaLabel,
  className,
}: SparklineProps) {
  const reactId = useId();
  const gradientId = `spk-grad-${reactId.replace(/:/g, "")}`;

  const safeData = useMemo(() => {
    if (!data || data.length === 0) return [0, 0];
    if (data.length === 1) return [data[0], data[0]];
    return data;
  }, [data]);

  const resolvedTrend = useMemo(
    () => resolveTrend(safeData, trend),
    [safeData, trend],
  );

  const { points, areaPoints, lastPoint, pathLength } = useMemo(() => {
    const min = Math.min(...safeData);
    const max = Math.max(...safeData);
    const range = max - min || 1;
    const innerW = width - STROKE_PADDING * 2;
    const innerH = height - STROKE_PADDING * 2;
    const stepX = safeData.length > 1 ? innerW / (safeData.length - 1) : 0;

    const coords = safeData.map((value, i) => {
      const x = STROKE_PADDING + stepX * i;
      // Invert Y so high values render up.
      const norm = (value - min) / range;
      const y = STROKE_PADDING + (1 - norm) * innerH;
      return [x, y] as const;
    });

    const polyline = coords.map(([x, y]) => `${x},${y}`).join(" ");
    const baseline = height - STROKE_PADDING;
    const firstX = coords[0][0];
    const lastX = coords[coords.length - 1][0];
    const area = `${firstX},${baseline} ${polyline} ${lastX},${baseline}`;

    // Approximate path length for the draw-on animation.
    let length = 0;
    for (let i = 1; i < coords.length; i++) {
      const [x1, y1] = coords[i - 1];
      const [x2, y2] = coords[i];
      length += Math.hypot(x2 - x1, y2 - y1);
    }

    return {
      points: polyline,
      areaPoints: area,
      lastPoint: coords[coords.length - 1],
      pathLength: Math.max(length, 1),
    };
  }, [safeData, width, height]);

  const delta = pctChange(safeData);
  const computedAria =
    ariaLabel ??
    (resolvedTrend === "flat"
      ? "Trend: flat"
      : `Trend: ${resolvedTrend} ${Math.abs(delta)}%`);

  const className_ = [
    "spk",
    `spk--${resolvedTrend}`,
    `spk--${variant}`,
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      className={className_}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={computedAria}
      // Inline custom prop fuels the keyframe; calc handles dasharray/offset.
      style={
        {
          ["--spk-len" as string]: `${pathLength.toFixed(2)}`,
        } as React.CSSProperties
      }
    >
      {showArea ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            className="spk__area"
            points={areaPoints}
            fill={`url(#${gradientId})`}
          />
        </>
      ) : null}
      <polyline
        className="spk__line"
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {showLastDot ? (
        <circle
          className="spk__dot"
          cx={lastPoint[0]}
          cy={lastPoint[1]}
          r="2.5"
          fill="currentColor"
        />
      ) : null}
    </svg>
  );
}

export default Sparkline;
