import { useMemo, useState } from "react";
import {
  computeLiveAlignments,
  computeZenith,
} from "../lib/gaiaSolAlignments";
import {
  ZODIAC_HUES,
  ZODIAC_RAY_NAMES,
  ZODIAC_RAY_ESSENCE,
} from "../lib/extendedChart";

type Props = {
  lat: number;
  lon: number;
  sunriseDate: Date;
  sunsetDate: Date;
  now: Date;
  rayReadings: Record<string, { title: string; core: string; gifts: string; ideal: string; affirmation: string }>;
};

/* ── Ray + zodiac data (copied from index.tsx) ─────────────────────────── */
const GAIA_RAY_WINDOWS = [
  { name: "Red", color: "#ef4444", sign: "Aries", symbol: "\u2648\uFE0E" },
  { name: "Orange", color: "#f97316", sign: "Taurus", symbol: "\u2649\uFE0E" },
  { name: "Yellow", color: "#facc15", labelColor: "#f8fafc", sign: "Gemini", symbol: "\u264A\uFE0E" },
  { name: "Green", color: "#22c55e", sign: "Cancer", symbol: "\u264B\uFE0E" },
  { name: "Turquoise", color: "#2dd4bf", sign: "Leo", symbol: "\u264C\uFE0E" },
  { name: "Blue", color: "#3b82f6", sign: "Virgo", symbol: "\u264D\uFE0E" },
  { name: "Indigo", color: "#6366f1", sign: "Libra", symbol: "\u264E\uFE0E" },
  { name: "Violet", color: "#8b5cf6", sign: "Scorpio", symbol: "\u264F\uFE0E" },
  { name: "Magenta", color: "#d946ef", sign: "Sagittarius", symbol: "\u2650\uFE0E" },
  { name: "Omni", color: "#fafafa", labelColor: "#f8fafc", sign: "Capricorn", symbol: "\u2651\uFE0E" },
  { name: "Elemental", color: "#a5f3fc", labelColor: "#f8fafc", sign: "Aquarius", symbol: "\u2652\uFE0E" },
  { name: "ALL", color: "#7dd3fc", labelColor: "#f8fafc", sign: "Pisces", symbol: "\u2653\uFE0E" },
];

const RING_OUTER_RADIUS = 62;
const RING_INNER_RADIUS = 22;
const RING_VIEWBOX_PADDING = 18;
const RING_VIEWBOX_MIN = -RING_OUTER_RADIUS - RING_VIEWBOX_PADDING;
const RING_VIEWBOX_SIZE = (RING_OUTER_RADIUS + RING_VIEWBOX_PADDING) * 2;

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function polarToCartesian(r: number, angle: number) {
  return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
}

function describeThinWedge(
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polarToCartesian(outerRadius, startAngle);
  const outerEnd = polarToCartesian(outerRadius, endAngle);
  const innerEnd = polarToCartesian(innerRadius, endAngle);
  const innerStart = polarToCartesian(innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";
  return [
    `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
    `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = parseInt(a.replace("#", ""), 16);
  const cb = parseInt(b.replace("#", ""), 16);
  const ar = (ca >> 16) & 255, ag = (ca >> 8) & 255, ab = ca & 255;
  const br = (cb >> 16) & 255, bg = (cb >> 8) & 255, bb = cb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

function colorForRayAngle(
  angle: number,
  windows: { color: string }[],
  topIndex: number
): string {
  const ordered = Array.from({ length: windows.length }, (_, i) =>
    windows[(topIndex + i) % windows.length]
  );
  const angleFromTop = (angle + Math.PI / 2) % (2 * Math.PI);
  if (angleFromTop < 0) return ordered[0].color;
  const t = (angleFromTop / (2 * Math.PI)) * windows.length;
  const idx = Math.floor(t) % windows.length;
  const nextIdx = (idx + 1) % windows.length;
  return lerpColor(ordered[idx].color, ordered[nextIdx].color, t - idx);
}

/* ── Component ─────────────────────────────────────────────────────────── */
function readingKey(rayName: string): string {
  // "Blue Ray" → "Blue", "Omni / Carbon Ray" → "Omni", "ALL Ray" → "ALL", "Elemental Ray" → "Elemental"
  return rayName.replace(" Ray", "").split(" / ")[0].trim();
}

export default function GaiaRayDial({ lat, lon, sunriseDate, sunsetDate, now, rayReadings }: Props) {
  const [orientation, setOrientation] = useState<"heartlight" | "zenith">("zenith");

  const liveChart = useMemo(() => computeLiveAlignments(lat, lon, now), [lat, lon, now]);
  const zenith = useMemo(() => computeZenith(now, lat, lon), [now, lat, lon]);
  const dawnZenith = useMemo(() => computeZenith(sunriseDate, lat, lon), [sunriseDate, lat, lon]);
  const duskZenith = useMemo(() => computeZenith(sunsetDate, lat, lon), [sunsetDate, lat, lon]);

  // Earth-facing angles
  const earthFacing = zenith;
  const dawnFacing = dawnZenith;
  const duskFacing = duskZenith;

  const gaiaRayIndex = earthFacing.signIndex;
  const gaiaRay = GAIA_RAY_WINDOWS[gaiaRayIndex];

  // Exact degree progress within the active segment (0..1)
  const rayProgress = (earthFacing.longitude % 30) / 30;

  // The Blue→Indigo cusp is north. Indigo (index 6) starts at north (-π/2).
  const GAIA_TOP_INDEX = GAIA_RAY_WINDOWS.findIndex((r) => r.name === "Indigo");
  const SEGMENT_ANGLE = (2 * Math.PI) / GAIA_RAY_WINDOWS.length;

  const dialSegments = useMemo(() => {
    return Array.from({ length: GAIA_RAY_WINDOWS.length }, (_, i) => {
      const startAngle =
        -Math.PI / 2 + ((i + GAIA_TOP_INDEX) % GAIA_RAY_WINDOWS.length) * SEGMENT_ANGLE;
      const endAngle = startAngle + SEGMENT_ANGLE;
      const midAngle = startAngle + SEGMENT_ANGLE / 2;
      const outerStart = polarToCartesian(RING_OUTER_RADIUS, startAngle);
      const outerEnd = polarToCartesian(RING_OUTER_RADIUS, endAngle);
      const innerStart = polarToCartesian(RING_INNER_RADIUS, startAngle);
      const innerEnd = polarToCartesian(RING_INNER_RADIUS, endAngle);
      const largeArcFlag = SEGMENT_ANGLE <= Math.PI ? "0" : "1";
      const path = [
        `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
        `A ${RING_OUTER_RADIUS} ${RING_OUTER_RADIUS} 0 ${largeArcFlag} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
        `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
        `A ${RING_INNER_RADIUS} ${RING_INNER_RADIUS} 0 ${largeArcFlag} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
        "Z",
      ].join(" ");
      const symbolRadius = (RING_OUTER_RADIUS + RING_INNER_RADIUS) / 2;
      const symbolPosition = polarToCartesian(symbolRadius, midAngle);
      const labelRadius = RING_OUTER_RADIUS + 8;
      const labelPosition = polarToCartesian(labelRadius, midAngle);
      return {
        index: i,
        ray: GAIA_RAY_WINDOWS[i],
        startAngle,
        endAngle,
        midAngle,
        path,
        symbolX: symbolPosition.x,
        symbolY: symbolPosition.y,
        labelX: labelPosition.x,
        labelY: labelPosition.y,
      };
    });
  }, []);

  const activeSegment = dialSegments[gaiaRayIndex];
  const pointerAngle = activeSegment
    ? activeSegment.startAngle + rayProgress * SEGMENT_ANGLE
    : Math.PI;

  const conicWedges = useMemo(() => {
    const slices = 360;
    const step = (2 * Math.PI) / slices;
    return Array.from({ length: slices }, (_, i) => {
      const startAngle = -Math.PI / 2 + i * step;
      const endAngle = startAngle + step;
      return {
        d: describeThinWedge(
          RING_OUTER_RADIUS,
          RING_INNER_RADIUS,
          startAngle,
          endAngle
        ),
        color: colorForRayAngle(startAngle + step / 2, GAIA_RAY_WINDOWS, GAIA_TOP_INDEX),
      };
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="text-xs uppercase tracking-wide text-zinc-400">
            Astro Gaia Ray Dial
          </div>
          <div className="text-lg font-semibold" style={{ color: gaiaRay.color }}>
            {gaiaRay.sign} {gaiaRay.symbol} {gaiaRay.name} Ray
          </div>
          <div className="text-[10px] text-zinc-400">
            The Ray Key faces your zenith, the constellation directly overhead.
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            setOrientation((prev) => (prev === "heartlight" ? "zenith" : "heartlight"))
          }
          className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900/60 p-2 transition hover:bg-zinc-800"
          title={
            orientation === "heartlight"
              ? "Switch to Zenith (Ray Key faces upward)"
              : "Switch to Heartlight Alignment (Intuitive compass orientation)"
          }
        >
          <img
            src="/ray-dial-compass-toggle.png"
            alt={
              orientation === "heartlight"
                ? "Heartlight mode compass"
                : "Zenith mode compass"
            }
            className={`h-8 w-8 object-contain transition-transform duration-300 ${
              orientation === "zenith" ? "rotate-0" : "rotate-45"
            }`}
          />
        </button>
      </div>

      {/* SVG Gaia dial */}
      <div className="flex justify-center mt-1">
        <div className="relative aspect-square w-full max-w-[360px]">
          <svg
            viewBox={`${RING_VIEWBOX_MIN} ${RING_VIEWBOX_MIN} ${RING_VIEWBOX_SIZE} ${RING_VIEWBOX_SIZE}`}
            className="block h-auto w-full text-zinc-100 drop-shadow-[0_10px_26px_rgba(15,23,42,0.55)]"
          >
            <defs>
              <radialGradient
                id="gaiaSpotlight"
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.28" />
                <stop offset="55%" stopColor="#f8fafc" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#f8fafc" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle
              cx="0"
              cy="0"
              r={RING_OUTER_RADIUS + 6}
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#1e293b"
              strokeWidth="0.8"
            />

            <g
              transform={
                orientation === "zenith"
                  ? `rotate(${-(pointerAngle * 180) / Math.PI - 90})`
                  : undefined
              }
            >
              <g>
                {conicWedges.map((wedge, i) => (
                  <path key={i} d={wedge.d} fill={wedge.color} stroke="none" />
                ))}
              </g>

              {/* Tick marks: cusp + mid points */}
              <g>
                {Array.from({ length: 24 }, (_, i) => {
                  const angle = -Math.PI / 2 + (i * Math.PI) / 12;
                  const isCusp = i % 2 === 0;
                  const innerR = isCusp
                    ? RING_OUTER_RADIUS + 0.5
                    : RING_OUTER_RADIUS + 0.5;
                  const outerR = isCusp
                    ? RING_OUTER_RADIUS + 6
                    : RING_OUTER_RADIUS + 4;
                  const inner = polarToCartesian(innerR, angle);
                  const outer = polarToCartesian(outerR, angle);
                  return (
                    <line
                      key={`tick-${i}`}
                      x1={inner.x.toFixed(3)}
                      y1={inner.y.toFixed(3)}
                      x2={outer.x.toFixed(3)}
                      y2={outer.y.toFixed(3)}
                      stroke={isCusp ? "#e2e8f0" : "#64748b"}
                      strokeWidth={isCusp ? "1.2" : "0.4"}
                      strokeLinecap="round"
                      opacity={isCusp ? 0.9 : 0.5}
                    />
                  );
                })}
              </g>

              {activeSegment && (
                <path
                  d={(() => {
                    const mid = activeSegment.midAngle;
                    const half = SEGMENT_ANGLE * 1.05;
                    const inner = polarToCartesian(
                      RING_INNER_RADIUS - 10,
                      mid - half
                    );
                    const outerL = polarToCartesian(
                      RING_OUTER_RADIUS + 8,
                      mid - half
                    );
                    const outerR = polarToCartesian(
                      RING_OUTER_RADIUS + 8,
                      mid + half
                    );
                    const innerR = polarToCartesian(
                      RING_INNER_RADIUS - 10,
                      mid + half
                    );
                    return [
                      "M 0 0",
                      `L ${inner.x.toFixed(3)} ${inner.y.toFixed(3)}`,
                      `L ${outerL.x.toFixed(3)} ${outerL.y.toFixed(3)}`,
                      `A ${RING_OUTER_RADIUS + 8} ${RING_OUTER_RADIUS + 8} 0 0 1 ${outerR.x.toFixed(3)} ${outerR.y.toFixed(3)}`,
                      `L ${innerR.x.toFixed(3)} ${innerR.y.toFixed(3)}`,
                      "Z",
                    ].join(" ");
                  })()}
                  fill="url(#gaiaSpotlight)"
                  stroke="none"
                />
              )}

              {/* Zodiac symbols inside ring + names outside */}
              {dialSegments.map((segment) => (
                <g key={`label-${segment.index}`}>
                  <text
                    x={segment.symbolX.toFixed(3)}
                    y={segment.symbolY.toFixed(3)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="5.2"
                    fill={segment.ray.labelColor ?? "#e2e8f0"}
                    style={{ textShadow: "0 1px 2px rgba(15,23,42,0.8)" }}
                    transform={
                      orientation === "zenith"
                        ? `rotate(${(pointerAngle * 180) / Math.PI + 90}, ${segment.symbolX.toFixed(3)}, ${segment.symbolY.toFixed(3)})`
                        : undefined
                    }
                  >
                    {segment.ray.symbol}
                  </text>
                  <text
                    x={segment.labelX.toFixed(3)}
                    y={segment.labelY.toFixed(3)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="4.0"
                    fill="#e2e8f0"
                    style={{ textShadow: "0 1px 2px rgba(15,23,42,0.8)" }}
                    transform={`rotate(${(segment.midAngle * 180) / Math.PI + 90}, ${segment.labelX.toFixed(3)}, ${segment.labelY.toFixed(3)})`}
                  >
                    {segment.ray.name}
                  </text>
                </g>
              ))}
            </g>

            {/* Fixed upright Ray Key — outside rotated group */}
            <g
              transform={
                orientation === "zenith"
                  ? "rotate(0) scale(0.035)"
                  : `rotate(${(pointerAngle * 180) / Math.PI + 90}) scale(0.035)`
              }
            >
              <image
                href="/ray-key.png"
                x="-744.7"
                y="-1766"
                width="1414"
                height="2000"
                opacity="0.92"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* ── Ray Zenith Alignment — highest priority ── */}
      <div className="rounded-xl border border-sky-500/20 bg-slate-900/50 p-4">
        <div className="text-xs uppercase tracking-wide text-sky-300/70">
          Ray Zenith Alignment ☤
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-3xl">{earthFacing.signSymbol}</span>
          <div>
            <div className="text-lg font-semibold text-sky-100">
              {earthFacing.signName} {earthFacing.degrees}°{earthFacing.minutes}' ({earthFacing.longitude.toFixed(0)}°)
            </div>
            <div
              className="text-sm font-medium"
              style={{ color: ZODIAC_HUES[earthFacing.signIndex] }}
            >
              {ZODIAC_RAY_NAMES[earthFacing.signIndex]}
            </div>
          </div>
        </div>
        <div className="mt-2 space-y-1 text-sm text-zinc-200">
          <div>
            <span className="font-semibold text-zinc-100">Core: </span>
            {rayReadings[readingKey(ZODIAC_RAY_NAMES[earthFacing.signIndex])]?.core ?? "—"}
          </div>
          <div>
            <span className="font-semibold text-zinc-100">Gifts: </span>
            {rayReadings[readingKey(ZODIAC_RAY_NAMES[earthFacing.signIndex])]?.gifts ?? "—"}
          </div>
          <div>
            <span className="font-semibold text-zinc-100">Ideal: </span>
            {rayReadings[readingKey(ZODIAC_RAY_NAMES[earthFacing.signIndex])]?.ideal ?? "—"}
          </div>
          <div>
            <span className="font-semibold text-zinc-100">Affirmation: </span>
            {rayReadings[readingKey(ZODIAC_RAY_NAMES[earthFacing.signIndex])]?.affirmation ?? "—"}
          </div>
        </div>
        <div className="mt-2 text-[0.65rem] italic text-white">
          Zenith: The constellation directly overhead. The astrological "Z" of complete present alignment.
        </div>
      </div>

      {/* ── Live Local Astro Ray Alignments ── */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-zinc-400">
          Live Local Astro Ray Alignments
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              label: "Ascendant (Rising)",
              data: liveChart.ascendant,
              meaning: "Ascendant: The zodiac sign rising on the eastern horizon right now. Your outward-facing frequency.",
            },
            {
              label: "Descendant (Setting)",
              data: liveChart.descendant,
              meaning: "Descendant: The zodiac sign setting on the western horizon right now. Your mirror frequency.",
            },
            {
              label: "Midheaven (MC)",
              data: liveChart.midheaven,
              meaning: "Midheaven: Where the ecliptic crosses your meridian, the astrological crown of your chart. Your life's crowning frequency.",
            },
            {
              label: "IC (Nadir)",
              data: liveChart.ic,
              meaning: "IC: The zodiac sign beneath your feet, lowest in the sky right now. Your root frequency.",
            },
          ].map((c) => {
            const hue = ZODIAC_HUES[c.data.signIndex] ?? "#e2e8f0";
            const isIC = c.label.startsWith("IC");
            return (
              <div
                key={c.label}
                className={`rounded-lg border p-2.5 ${
                  isIC
                    ? "border-emerald-500/30 bg-emerald-950/20"
                    : "border-sky-500/10 bg-slate-900/40"
                }`}
              >
                <div className="text-[0.65rem] uppercase tracking-wide text-white">
                  {c.label}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-lg">{c.data.signSymbol}</span>
                  <span className="text-sm font-semibold text-sky-100">
                    {c.data.signName} {c.data.degrees}°{c.data.minutes}'
                  </span>
                </div>
                <div className="mt-0.5 text-xs font-medium" style={{ color: hue }}>
                  {ZODIAC_RAY_NAMES[c.data.signIndex]}
                </div>
                <div className="mt-0.5 text-[0.65rem] leading-tight text-white">
                  {ZODIAC_RAY_ESSENCE[c.data.signIndex]}
                </div>
                <div className="mt-1 text-[0.6rem] italic text-white">
                  {c.meaning}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Dawn & Dusk Alignments ── */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-zinc-400">
          Dawn & Dusk Alignments
        </div>
        <div className="text-[10px] text-white">
          Date: {sunriseDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {/* Dawn */}
          <div className="rounded-lg border border-amber-500/20 bg-slate-900/40 p-3">
            <div className="text-[0.65rem] uppercase tracking-wide text-amber-300/70">
              Dawn Alignment
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl">{dawnFacing.signSymbol}</span>
              <div>
                <div className="text-base font-semibold text-sky-100">
                  {dawnFacing.signName} {dawnFacing.degrees}°{dawnFacing.minutes}'
                </div>
                <div
                  className="text-xs font-medium"
                  style={{ color: ZODIAC_HUES[dawnFacing.signIndex] }}
                >
                  {ZODIAC_RAY_NAMES[dawnFacing.signIndex]}
                </div>
              </div>
            </div>
            <div className="mt-1 text-[0.65rem] text-white">
              {ZODIAC_RAY_ESSENCE[dawnFacing.signIndex]}
            </div>
            <div className="mt-1 text-[0.65rem] italic text-white">
              Zenith at dawn: The constellation directly overhead as day begins.
            </div>
          </div>

          {/* Dusk */}
          <div className="rounded-lg border border-indigo-500/20 bg-slate-900/40 p-3">
            <div className="text-[0.65rem] uppercase tracking-wide text-indigo-300/70">
              Dusk Alignment
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl">{duskFacing.signSymbol}</span>
              <div>
                <div className="text-base font-semibold text-sky-100">
                  {duskFacing.signName} {duskFacing.degrees}°{duskFacing.minutes}'
                </div>
                <div
                  className="text-xs font-medium"
                  style={{ color: ZODIAC_HUES[duskFacing.signIndex] }}
                >
                  {ZODIAC_RAY_NAMES[duskFacing.signIndex]}
                </div>
              </div>
            </div>
            <div className="mt-1 text-[0.65rem] text-white">
              {ZODIAC_RAY_ESSENCE[duskFacing.signIndex]}
            </div>
            <div className="mt-1 text-[0.65rem] italic text-white">
              Zenith at dusk: The constellation directly overhead as day completes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
