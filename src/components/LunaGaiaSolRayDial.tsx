import { useMemo, useState } from "react";
import * as Astronomy from "astronomy-engine";
import { COLIGNY_MONTHS, type ColignyMonth } from "../lib/lunaSolSeason";
import { computeZenith } from "../lib/gaiaSolAlignments";

/* ───────────────────────────────────────────────────────────
   Luna Gaia Sol (LGS) Ray Dial
   Conic-gradient ring, Coligny months, Celtic gate ring.
   Center: fixed upright Ray Key (outside rotated group).
   Luna + Sol: small colored dots on orbits (inside rotated group).
   Zenith mode: entire zodiac rotates so overhead sign faces up.
   Heartlight: Blue/Indigo cusp fixed at top.
   ─────────────────────────────────────────────────────────── */

const DEG2RAD = Math.PI / 180;
const MABON_ECLIPTIC = 180; // Ecliptic longitude placed at top (North) in Heartlight mode


function normalizeLon(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function getEclipticLongitude(body: Astronomy.Body, date: Date): number {
  const time = Astronomy.MakeTime(date);
  const gv = Astronomy.GeoVector(body, time, true);
  const ecl = Astronomy.Ecliptic(gv);
  return normalizeLon(ecl.elon);
}

function polarToCartesian(r: number, angle: number) {
  return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
}

type LGSRayDialProps = {
  lat: number;
  lon: number;
  date: Date;
  currentMonth: ColignyMonth;
  currentMonthProgress?: number;
  ciallosActive: boolean;
};

const RING_OUTER = 62;
const RING_INNER = 22;
const VB_MIN = -80;
const VB_SIZE = 160;
const BASE_OFFSET = -(MABON_ECLIPTIC * DEG2RAD); // Rotates ecliptic 180° (Mabon) to screen top

/* ── Ecliptic → screen angle mapping ──
   planetAngle maps an ecliptic longitude to a screen angle.
   With BASE_OFFSET = -180°, ecliptic 180° (Mabon) → screen -PI/2 (top).
   Ascending ecliptic = clockwise on screen, matching the gate ring. */
function planetAngle(eclipticDeg: number): number {
  return -Math.PI / 2 + eclipticDeg * DEG2RAD + BASE_OFFSET;
}

function screenToEcliptic(screenAngle: number): number {
  return (((screenAngle + Math.PI / 2) / DEG2RAD + MABON_ECLIPTIC) % 360 + 360) % 360;
}

/* ── Color helpers ─────────────────────────────────────────────────── */

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

function colorForMonthAngle(angle: number): string {
  const ecl = screenToEcliptic(angle);
  // Find the month whose [threshold-30, threshold) ecliptic range contains this point
  for (const m of COLIGNY_MONTHS) {
    const t = m.thresholdEclipticDeg;
    const start = ((t - 30) % 360 + 360) % 360;
    let inSpan = false;
    let localProgress = 0;
    if (start < t) {
      if (ecl >= start && ecl < t) {
        inSpan = true;
        localProgress = (ecl - start) / 30;
      }
    } else {
      // Wraps around 0° (Cantlos: 330° → 0°)
      if (ecl >= start || ecl < t) {
        localProgress = ecl >= start ? (ecl - start) / 30 : (ecl + 360 - start) / 30;
        inSpan = true;
      }
    }
    if (inSpan) {
      return lerpColor(
        m.thresholdRays.fromColor,
        m.thresholdRays.toColor,
        localProgress
      );
    }
  }
  return COLIGNY_MONTHS[0].thresholdRays.fromColor;
}

/* ── Gate data (ecliptic longitude in degrees) ─────────────────────── */

const GATE_DATA = [
  { name: "Ostara", eclipticDeg: 0, color: "#ef4444" },
  { name: "Beltane", eclipticDeg: 45, color: "#f97316" },
  { name: "Litha", eclipticDeg: 90, color: "#facc15" },
  { name: "Lughnasadh", eclipticDeg: 135, color: "#2dd4bf" },
  { name: "Mabon", eclipticDeg: 180, color: "#6366f1" },
  { name: "Samhain", eclipticDeg: 225, color: "#8b5cf6" },
  { name: "Yule", eclipticDeg: 270, color: "#d946ef" },
  { name: "Imbolc", eclipticDeg: 315, color: "#a5f3fc" },
];

/* ── Component ─────────────────────────────────────────────────────── */

export function LunaGaiaSolRayDial({
  lat,
  lon,
  date,
  currentMonth,
  currentMonthProgress,
  ciallosActive,
}: LGSRayDialProps) {
  const [orientation, setOrientation] = useState<"zenith" | "heartlight">("zenith");

  const astro = useMemo(() => {
    try {
      const sunLon = getEclipticLongitude(Astronomy.Body.Sun, date);
      const moonLon = getEclipticLongitude(Astronomy.Body.Moon, date);
      return { sunLon, moonLon };
    } catch {
      return { sunLon: 0, moonLon: 0 };
    }
  }, [date]);

  const zenith = useMemo(() => {
    try {
      return computeZenith(date, lat, lon);
    } catch {
      return { signIndex: 0, signName: "Aries", longitude: 0, degrees: 0, minutes: 0, signSymbol: "♈" };
    }
  }, [date, lat, lon]);

  /* Rotation anchored on current month's ecliptic threshold + lunation progress.
     This tracks where we ARE in the LUNAR month on the ecliptic wheel.
     In Zenith mode, this brings the current lunation position to the top.
     In Heartlight mode, the Key rotates by -rotationDeg to point at the
     current lunation position within the fixed ring (Mabon at top).
     The lunation position may differ from the Sun's ecliptic position
     because lunar months and solar gates drift ~10.89 days/year. */
  const rotationDeg = useMemo(() => {
    const monthEcliptic = currentMonth.thresholdEclipticDeg;
    const sectorStartEcl = monthEcliptic - 30;
    const progress = currentMonthProgress ?? 0.5;
    const targetEcl = sectorStartEcl + progress * 30;
    const targetScreenAngle = planetAngle(targetEcl);
    // Bring targetScreenAngle to -PI/2 (top)
    const rotationRad = -Math.PI / 2 - targetScreenAngle;
    return (rotationRad * 180) / Math.PI;
  }, [currentMonth.thresholdEclipticDeg, currentMonthProgress]);

  /* Build sectors positioned by ecliptic longitude (ascending, matching gates) */
  const sectors = useMemo(() => {
    return COLIGNY_MONTHS.map((month) => {
      const monthEcliptic = month.thresholdEclipticDeg;
      const startEcl = monthEcliptic - 30;
      const endEcl = monthEcliptic;
      const startAngle = planetAngle(startEcl);
      const endAngle = planetAngle(endEcl);
      const midAngle = (startAngle + endAngle) / 2;

      const innerStart = polarToCartesian(RING_INNER, startAngle);
      const outerStart = polarToCartesian(RING_OUTER, startAngle);
      const innerEnd = polarToCartesian(RING_INNER, endAngle);
      const outerEnd = polarToCartesian(RING_OUTER, endAngle);

      const path = [
        `M ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
        `L ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
        `A ${RING_OUTER} ${RING_OUTER} 0 0 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
        `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
        `A ${RING_INNER} ${RING_INNER} 0 0 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
        "Z",
      ].join(" ");

      return {
        month,
        startAngle,
        endAngle,
        midAngle,
        path,
        isCurrent: month.name === currentMonth.name,
      };
    });
  }, [currentMonth.name]);

  /* 360 thin wedges for smooth conic gradient */
  const conicWedges = useMemo(() => {
    const slices = 360;
    const step = (2 * Math.PI) / slices;
    return Array.from({ length: slices }, (_, i) => {
      const startAngle = -Math.PI / 2 + i * step - step / 2;
      const endAngle = startAngle + step;
      return {
        d: describeThinWedge(RING_OUTER, RING_INNER, startAngle, endAngle),
        color: colorForMonthAngle(startAngle + step / 2),
      };
    });
  }, []);

  /* Sun sector highlight — ecliptic-based, aligned with month sectors */
  const sunZodiacIdx = Math.floor(normalizeLon(astro.sunLon) / 30) % 12;
  const sunSectorStartEcl = sunZodiacIdx * 30;
  const sunSectorEndEcl = (sunZodiacIdx + 1) * 30;
  const sunSectorStart = planetAngle(sunSectorStartEcl);
  const sunSectorEnd = planetAngle(sunSectorEndEcl);

  /* Label radii */
  const monthLabelRadius = RING_OUTER + 7;
  const gateTickInner = RING_OUTER + 0.5;
  const gateTickOuter = RING_OUTER + 5;
  const gateLabelRadius = RING_OUTER + 13;

  return (
    <div className="relative mx-auto w-full max-w-lg space-y-4">
      {/* Header + compass toggle */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div />
        <div className="text-center space-y-1 min-w-0">
          <div className="text-xs uppercase tracking-wide text-zinc-400">
            Luna Gaia Sol Ray Dial
          </div>
          <div
            className="text-lg font-semibold"
            style={{ color: currentMonth.thresholdRays.fromColor }}
          >
            {currentMonth.name}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() =>
              setOrientation((prev) =>
                prev === "zenith" ? "heartlight" : "zenith"
              )
            }
            className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900/60 p-2 transition hover:bg-zinc-800"
            title={
              orientation === "zenith"
                ? "Switch to Heartlight Alignment (Blue/Indigo cusp fixed at North)"
                : "Switch to Zenith Mode (overhead sign rises to top)"
            }
          >
            <img
              src="/ray-dial-compass-toggle.png"
              alt={
                orientation === "zenith"
                  ? "Zenith mode compass"
                  : "Heartlight mode compass"
              }
              className={`h-8 w-8 object-contain transition-transform duration-300 ${
                orientation === "zenith" ? "rotate-0" : "rotate-45"
              }`}
            />
          </button>
        </div>
      </div>

      <svg
        viewBox={`${VB_MIN} ${VB_MIN} ${VB_SIZE} ${VB_SIZE}`}
        className="block h-auto w-full text-zinc-100 drop-shadow-[0_10px_26px_rgba(15,23,42,0.55)]"
      >
        <defs>
          <filter id="gateGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background disc */}
        <circle
          r={RING_OUTER + 6}
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#1e293b"
          strokeWidth="0.8"
        />

        {/* ── Rotating zodiac group ── */}
        <g
          transform={
            orientation === "zenith" ? `rotate(${rotationDeg.toFixed(2)})` : undefined
          }
        >
          {/* Conic gradient ring */}
          <g>
            {conicWedges.map((wedge, i) => (
              <path key={`w-${i}`} d={wedge.d} fill={wedge.color} stroke="none" />
            ))}
          </g>

          {/* Current month highlight */}
          {sectors
            .filter((s) => s.isCurrent)
            .map((s) => (
              <g key="cur">
                <path
                  d={(() => {
                    const outerStart = polarToCartesian(RING_OUTER + 2, s.startAngle);
                    const outerEnd = polarToCartesian(RING_OUTER + 2, s.endAngle);
                    const largeArc = s.endAngle - s.startAngle > Math.PI ? 1 : 0;
                    return [
                      `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
                      `A ${RING_OUTER + 2} ${RING_OUTER + 2} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
                    ].join(" ");
                  })()}
                  fill="none"
                  stroke={s.month.thresholdRays.fromColor}
                  strokeWidth="2.5"
                  opacity="0.8"
                />
                <path
                  d={(() => {
                    const innerStart = polarToCartesian(RING_INNER - 2, s.startAngle);
                    const innerEnd = polarToCartesian(RING_INNER - 2, s.endAngle);
                    const largeArc = s.endAngle - s.startAngle > Math.PI ? 1 : 0;
                    return [
                      `M ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
                      `A ${RING_INNER - 2} ${RING_INNER - 2} 0 ${largeArc} 1 ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
                    ].join(" ");
                  })()}
                  fill="none"
                  stroke={s.month.thresholdRays.toColor}
                  strokeWidth="1.2"
                  opacity="0.5"
                />
              </g>
            ))}

          {/* 12/0 Gate glow (Cantlos boundary) */}
          {(() => {
            const s = sectors[0];
            const outerStart = polarToCartesian(RING_OUTER + 4, s.startAngle);
            const outerEnd = polarToCartesian(RING_OUTER + 4, s.endAngle);
            const largeArc = s.endAngle - s.startAngle > Math.PI ? 1 : 0;
            return (
              <path
                d={[
                  `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
                  `A ${RING_OUTER + 4} ${RING_OUTER + 4} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
                ].join(" ")}
                fill="none"
                stroke="rgba(125,211,252,0.4)"
                strokeWidth="3"
                filter="url(#gateGlow)"
              />
            );
          })()}

          {/* Month labels */}
          {sectors.map((s) => {
            const pos = polarToCartesian(monthLabelRadius, s.midAngle);
            const deg = (s.midAngle * 180) / Math.PI + 90;
            return (
              <text
                key={`m-${s.month.name}`}
                x={pos.x.toFixed(3)}
                y={pos.y.toFixed(3)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={s.isCurrent ? "5.0" : "4.2"}
                fontWeight={s.isCurrent ? "bold" : "normal"}
                fill={s.isCurrent ? "#f8fafc" : "rgba(226,232,240,0.60)"}
                style={{ textShadow: "0 1px 2px rgba(15,23,42,0.8)" }}
                transform={`rotate(${deg.toFixed(1)}, ${pos.x.toFixed(3)}, ${pos.y.toFixed(3)})`}
              >
                {s.month.name}
              </text>
            );
          })}

          {/* Sun sector highlight */}
          {(() => {
            const start = polarToCartesian(RING_OUTER, sunSectorStart);
            const end = polarToCartesian(RING_OUTER, sunSectorEnd);
            const largeArc = sunSectorEnd - sunSectorStart > Math.PI ? 1 : 0;
            return (
              <path
                d={[
                  `M ${start.x.toFixed(3)} ${start.y.toFixed(3)}`,
                  `A ${RING_OUTER} ${RING_OUTER} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`,
                ].join(" ")}
                fill="none"
                stroke={COLIGNY_MONTHS.find((m) => {
                  const s = ((m.thresholdEclipticDeg - 30) % 360 + 360) % 360;
                  const e = m.thresholdEclipticDeg;
                  const sunEcl = normalizeLon(astro.sunLon);
                  return s < e ? (sunEcl >= s && sunEcl < e) : (sunEcl >= s || sunEcl < e);
                })?.thresholdRays.fromColor ?? "#facc15"}
                strokeWidth="1.8"
                opacity="0.5"
              />
            );
          })()}

          {/* ── Sol position marker ──
              Shows the Sun's ACTUAL ecliptic position on the ring.
              This reveals which Celtic gates have been crossed, independent
              of the lunation progress. When the Sol dot is past a gate,
              that threshold has been crossed — even if the Ray Key (lunation
              position) hasn't reached it yet. This is the lunar-solar drift
              made visible. */}
          {(() => {
            const solAngle = planetAngle(normalizeLon(astro.sunLon));
            const solOrbitR = 52;
            const solX = solOrbitR * Math.cos(solAngle);
            const solY = solOrbitR * Math.sin(solAngle);
            return (
              <g>
                {/* Orbit ring */}
                <circle r={solOrbitR} fill="none" stroke="rgba(245,158,11,0.12)" strokeWidth="0.4" />
                {/* Sol dot */}
                <circle cx={solX.toFixed(3)} cy={solY.toFixed(3)} r="2.8" fill="#f59e0b" opacity="0.95" />
                <circle cx={solX.toFixed(3)} cy={solY.toFixed(3)} r="4.5" fill="none" stroke="#f59e0b" strokeWidth="0.5" opacity="0.3" />
                <text
                  x={solX.toFixed(3)}
                  y={(solY - 4).toFixed(3)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="2.8"
                  fill="#f59e0b"
                  opacity="0.8"
                >
                  ☉
                </text>
              </g>
            );
          })()}

          {/* ── Luna position marker ──
              Shows the Moon's ACTUAL ecliptic position on the ring. */}
          {(() => {
            const lunaAngle = planetAngle(normalizeLon(astro.moonLon));
            const lunaOrbitR = 38;
            const lunaX = lunaOrbitR * Math.cos(lunaAngle);
            const lunaY = lunaOrbitR * Math.sin(lunaAngle);
            return (
              <g>
                {/* Orbit ring */}
                <circle r={lunaOrbitR} fill="none" stroke="rgba(212,212,216,0.10)" strokeWidth="0.4" />
                {/* Luna dot */}
                <circle cx={lunaX.toFixed(3)} cy={lunaY.toFixed(3)} r="2.2" fill="#d4d4d8" opacity="0.9" />
                <text
                  x={lunaX.toFixed(3)}
                  y={(lunaY - 3.5).toFixed(3)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="2.4"
                  fill="#d4d4d8"
                  opacity="0.7"
                >
                  ☾
                </text>
              </g>
            );
          })()}

          {/* Ciallos subtle ring */}
          {ciallosActive && (
            <circle
              r={RING_OUTER + 10}
              fill="none"
              stroke="rgba(34,211,238,0.15)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* ── Celtic gate ring — inside rotating group ──
              Gates rotate WITH the zodiac ring. In Zenith mode, they move
              to their correct ecliptic positions relative to the current
              month at top. In Heartlight mode, the group transform is
              undefined (no rotation), so gates stay fixed at their ecliptic
              positions with Mabon at top. */}
          {GATE_DATA.map((gate) => {
            const angle = planetAngle(gate.eclipticDeg);
            const t1 = polarToCartesian(gateTickInner, angle);
            const t2 = polarToCartesian(gateTickOuter, angle);
            const lp = polarToCartesian(gateLabelRadius, angle);
            const deg = (angle * 180) / Math.PI + 90;
            return (
              <g key={gate.name}>
                <line
                  x1={t1.x.toFixed(3)}
                  y1={t1.y.toFixed(3)}
                  x2={t2.x.toFixed(3)}
                  y2={t2.y.toFixed(3)}
                  stroke={gate.color}
                  strokeWidth="0.9"
                  opacity="0.65"
                />
                <text
                  x={lp.x.toFixed(3)}
                  y={lp.y.toFixed(3)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="3.4"
                  fill={gate.color}
                  opacity="0.7"
                  style={{ textShadow: "0 1px 2px rgba(15,23,42,0.8)" }}
                  transform={`rotate(${deg.toFixed(1)}, ${lp.x.toFixed(3)}, ${lp.y.toFixed(3)})`}
                >
                  {gate.name}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Fixed upright Ray Key at center ── */}
        <g
          transform={
            orientation === "zenith"
              ? "rotate(0) scale(0.035)"
              : `rotate(${-rotationDeg.toFixed(2)}) scale(0.035)`
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
  );
}
