import { useEffect, useRef, useMemo, useState } from "react";
import * as Astronomy from "astronomy-engine";
import { getMoonPhaseAngle, getMoonRayFrequency, getSunRayFrequency } from "../lib/lunaEvents";
import { Sun, Moon, Globe2 } from "lucide-react";

/* ───────────────────────────────────────────────────────────
   Unified Gaia/Luna/Sol Ray Dial
   Earth/Gaia at center with Moon/Luna and Sun/Sol orbiting.
   Zodiac ring with 12 Ray Frequency sectors.
   Uses actual planet images from /hsm-planets/.
   ─────────────────────────────────────────────────────────── */

const DEG2RAD = Math.PI / 180;

const ZODIAC_SIGNS = [
  { name: "Aries", symbol: "\u2648\uFE0E" },
  { name: "Taurus", symbol: "\u2649\uFE0E" },
  { name: "Gemini", symbol: "\u264A\uFE0E" },
  { name: "Cancer", symbol: "\u264B\uFE0E" },
  { name: "Leo", symbol: "\u264C\uFE0E" },
  { name: "Virgo", symbol: "\u264D\uFE0E" },
  { name: "Libra", symbol: "\u264E\uFE0E" },
  { name: "Scorpio", symbol: "\u264F\uFE0E" },
  { name: "Sagittarius", symbol: "\u2650\uFE0E" },
  { name: "Capricorn", symbol: "\u2651\uFE0E" },
  { name: "Aquarius", symbol: "\u2652\uFE0E" },
  { name: "Pisces", symbol: "\u2653\uFE0E" },
];

const ZODIAC_HUES = [
  "#ef4444", "#f97316", "#facc15", "#22c55e",
  "#2dd4bf", "#3b82f6", "#6366f1", "#8b5cf6",
  "#d946ef", "#0f0a0a", "#a5f3fc", "#7dd3fc",
];

const CAPRICORN_INDEX = 9;

function hexToRgba(hex: string, a: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(255,255,255,${a})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function getEclipticLongitude(body: Astronomy.Body, date: Date): number {
  const time = Astronomy.MakeTime(date);
  const gv = Astronomy.GeoVector(body, time, true);
  const ecl = Astronomy.Ecliptic(gv);
  return normalizeDegrees(ecl.elon);
}

/* ── Planet image loading (same pattern as AtlasCometMap) ── */
type BodyName = "Sun" | "Moon" | "Earth";

function planetIconSrc(body: BodyName): string {
  return `/hsm-planets/${body}.png`;
}

const planetImageCache = new Map<BodyName, HTMLImageElement>();

function loadPlanetImage(body: BodyName): void {
  if (planetImageCache.has(body)) return;
  const img = new Image();
  img.src = planetIconSrc(body);
  img.onload = () => { planetImageCache.set(body, img); };
  img.onerror = () => { /* silently fall back to gradient */ };
}

function getPlanetImage(body: BodyName): HTMLImageElement | undefined {
  return planetImageCache.get(body);
}

function drawPlanetImage(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  body: BodyName
): boolean {
  const img = getPlanetImage(body);
  if (!img || !img.complete || img.naturalWidth === 0) return false;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  const srcAspect = img.naturalWidth / img.naturalHeight;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (srcAspect > 1) {
    sw = img.naturalHeight;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
  return true;
}

type UnifiedDialProps = {
  lat: number;
  lon: number;
  date: Date;
};

export function UnifiedRayDial({ lat, lon, date }: UnifiedDialProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [, setImagesReady] = useState(false);

  // Load planet images on mount
  useEffect(() => {
    loadPlanetImage("Earth");
    loadPlanetImage("Moon");
    loadPlanetImage("Sun");
    // Poll until images are loaded, then force a redraw
    const checkInterval = setInterval(() => {
      if (planetImageCache.size >= 3) {
        setImagesReady(true);
        clearInterval(checkInterval);
      }
    }, 200);
    return () => clearInterval(checkInterval);
  }, []);

  // Compute astronomical positions
  const astro = useMemo(() => {
    try {
      const sunLon = getEclipticLongitude(Astronomy.Body.Sun, date);
      const moonLon = getEclipticLongitude(Astronomy.Body.Moon, date);
      const phaseAngle = getMoonPhaseAngle(date);
      const moonRay = getMoonRayFrequency(date, lat, lon);
      const sunRay = getSunRayFrequency(date, lat, lon);
      return { sunLon, moonLon, phaseAngle, moonRay, sunRay };
    } catch {
      return { sunLon: 0, moonLon: 0, phaseAngle: 0, moonRay: null, sunRay: null };
    }
  }, [date, lat, lon]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio ?? 1;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      const width = Math.round(cssWidth * dpr);
      const height = Math.round(cssHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const cx = cssWidth / 2;
      const cy = cssHeight / 2;
      const minDim = Math.min(cssWidth, cssHeight);
      const radius = minDim * 0.42;
      const zodiacRadius = radius * 1.05;
      const labelRadius = zodiacRadius * 0.94;

      // Background
      ctx.fillStyle = "#030712";
      ctx.beginPath();
      ctx.arc(cx, cy, zodiacRadius + 20, 0, Math.PI * 2);
      ctx.fill();

      // ── Draw zodiac Ray Frequency sectors ──
      for (let i = 0; i < 12; i++) {
        const startAngle = -Math.PI / 2 + i * (Math.PI * 2 / 12);
        const endAngle = startAngle + Math.PI * 2 / 12;
        const hue = ZODIAC_HUES[i];

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (let s = 0; s <= 30; s++) {
          const a = startAngle + (s / 30) * (endAngle - startAngle);
          ctx.lineTo(cx + zodiacRadius * Math.cos(a), cy + zodiacRadius * Math.sin(a));
        }
        ctx.closePath();
        ctx.fillStyle = hexToRgba(hue, i === CAPRICORN_INDEX ? 0.03 : 0.08);
        ctx.fill();

        ctx.strokeStyle = hexToRgba(hue, 0.2);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + zodiacRadius * Math.cos(startAngle), cy + zodiacRadius * Math.sin(startAngle));
        ctx.stroke();
      }

      // ── Zodiac ring ──
      ctx.strokeStyle = "rgba(56,189,248,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, zodiacRadius, 0, Math.PI * 2);
      ctx.stroke();

      // ── Zodiac symbols ──
      for (let i = 0; i < 12; i++) {
        const midAngle = -Math.PI / 2 + (i + 0.5) * (Math.PI * 2 / 12);
        const hue = ZODIAC_HUES[i];
        const lx = cx + labelRadius * Math.cos(midAngle);
        const ly = cy + labelRadius * Math.sin(midAngle);

        ctx.font = "14px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (i === CAPRICORN_INDEX) {
          ctx.fillStyle = "#f8fafc";
          ctx.shadowColor = "rgba(255,255,255,0.4)";
          ctx.shadowBlur = 3;
        } else {
          ctx.fillStyle = hexToRgba(hue, 0.85);
          ctx.shadowColor = hexToRgba(hue, 0.4);
          ctx.shadowBlur = 4;
        }
        ctx.fillText(ZODIAC_SIGNS[i].symbol, lx, ly);
        ctx.shadowBlur = 0;
      }

      // ── Earth/Gaia at center ──
      const earthRadius = radius * 0.13;
      // Earth glow
      const earthGlow = ctx.createRadialGradient(cx, cy, earthRadius * 0.5, cx, cy, earthRadius * 2);
      earthGlow.addColorStop(0, "rgba(56,189,248,0.3)");
      earthGlow.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = earthGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, earthRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Try real Earth image, fall back to gradient
      const earthDrawn = drawPlanetImage(ctx, cx, cy, earthRadius, "Earth");
      if (!earthDrawn) {
        const earthGrad = ctx.createRadialGradient(cx - earthRadius * 0.3, cy - earthRadius * 0.3, 0, cx, cy, earthRadius);
        earthGrad.addColorStop(0, "#38bdf8");
        earthGrad.addColorStop(0.5, "#0ea5e9");
        earthGrad.addColorStop(1, "#0c4a6e");
        ctx.fillStyle = earthGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, earthRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Earth label
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "rgba(226,232,240,0.8)";
      ctx.textAlign = "center";
      ctx.fillText("Gaia", cx, cy + earthRadius + 14);

      // ── Moon/Luna orbit and position ──
      const moonOrbitRadius = radius * 0.55;
      const moonAngle = -Math.PI / 2 + normalizeDegrees(astro.moonLon) * DEG2RAD;
      const moonX = cx + moonOrbitRadius * Math.cos(moonAngle);
      const moonY = cy + moonOrbitRadius * Math.sin(moonAngle);

      // Moon glow
      const moonRadius = radius * 0.06;
      const moonIllumFraction = (1 - Math.cos(astro.phaseAngle * DEG2RAD)) / 2;
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonRadius * 2.5);
      moonGlow.addColorStop(0, `rgba(248,250,252,${0.15 + moonIllumFraction * 0.2})`);
      moonGlow.addColorStop(1, "rgba(248,250,252,0)");
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonRadius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Try real Moon image, fall back to gradient
      const moonDrawn = drawPlanetImage(ctx, moonX, moonY, moonRadius, "Moon");
      if (!moonDrawn) {
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
        ctx.fill();
        if (moonIllumFraction < 0.95) {
          ctx.fillStyle = "rgba(15,23,42,0.85)";
          ctx.beginPath();
          const shadowOffset = moonRadius * Math.cos(astro.phaseAngle * DEG2RAD);
          ctx.arc(moonX + shadowOffset * 0.3, moonY, moonRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#f8fafc";
          ctx.beginPath();
          ctx.arc(moonX, moonY, moonRadius, astro.phaseAngle * DEG2RAD - Math.PI / 2, astro.phaseAngle * DEG2RAD + Math.PI / 2);
          ctx.fill();
        }
      }
      // Moon label
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "rgba(248,250,252,0.7)";
      ctx.textAlign = "center";
      ctx.fillText("Luna", moonX, moonY + moonRadius + 12);

      // ── Sun/Sol orbit and position ──
      const sunOrbitRadius = radius * 0.82;
      const sunAngle = -Math.PI / 2 + normalizeDegrees(astro.sunLon) * DEG2RAD;
      const sunX = cx + sunOrbitRadius * Math.cos(sunAngle);
      const sunY = cy + sunOrbitRadius * Math.sin(sunAngle);

      // Sun glow
      const sunRadius = radius * 0.08;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 3);
      sunGlow.addColorStop(0, "rgba(253,211,107,0.4)");
      sunGlow.addColorStop(0.5, "rgba(251,191,36,0.15)");
      sunGlow.addColorStop(1, "rgba(251,191,36,0)");
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius * 3, 0, Math.PI * 2);
      ctx.fill();

      // Try real Sun image, fall back to gradient
      const sunDrawn = drawPlanetImage(ctx, sunX, sunY, sunRadius, "Sun");
      if (!sunDrawn) {
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
        sunGrad.addColorStop(0, "#fff2cc");
        sunGrad.addColorStop(0.6, "#fde68a");
        sunGrad.addColorStop(1, "#f59e0b");
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sun label
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "rgba(253,211,107,0.8)";
      ctx.textAlign = "center";
      ctx.fillText("Sol", sunX, sunY + sunRadius + 14);

      // ── Lines from center to Moon and Sun ──
      ctx.strokeStyle = "rgba(248,250,252,0.1)";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(moonX, moonY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sunX, sunY);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Active zodiac sector highlights ──
      const sunZodiacIdx = Math.floor(normalizeDegrees(astro.sunLon) / 30) % 12;
      const moonZodiacIdx = Math.floor(normalizeDegrees(astro.moonLon) / 30) % 12;
      for (const [idx, label] of [[sunZodiacIdx, "Sol"], [moonZodiacIdx, "Luna"]] as const) {
        const sectorStart = -Math.PI / 2 + idx * (Math.PI * 2 / 12);
        const sectorEnd = sectorStart + Math.PI * 2 / 12;
        const hue = ZODIAC_HUES[idx];
        ctx.strokeStyle = hexToRgba(hue, 0.5);
        ctx.lineWidth = label === "Sol" ? 2 : 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, zodiacRadius, sectorStart, sectorEnd);
        ctx.stroke();
      }
    }

    draw();
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);

    // Redraw when images load
    const imageCheckInterval = setInterval(() => {
      if (planetImageCache.size > 0) {
        draw();
      }
    }, 500);
    const imageTimeout = setTimeout(() => clearInterval(imageCheckInterval), 5000);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(imageCheckInterval);
      clearTimeout(imageTimeout);
    };
  }, [astro]);

  return (
    <div className="space-y-4">
      {/* Canvas */}
      <div className="relative mx-auto w-full max-w-lg">
        <canvas
          ref={canvasRef}
          className="w-full aspect-square rounded-2xl"
          style={{ touchAction: "none" }}
        />
      </div>

      {/* Ray Frequency info cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Gaia */}
        <div className="rounded-xl border border-sky-500/30 bg-sky-900/15 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe2 className="h-4 w-4 text-sky-300" />
            <span className="text-sm font-semibold text-sky-200">Gaia</span>
          </div>
          <div className="text-xs text-zinc-400">Earth at center, the embodied temple where ALL frequencies meet.</div>
        </div>

        {/* Luna */}
        {astro.moonRay && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-900/15 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Moon className="h-4 w-4 text-cyan-300" />
              <span className="text-sm font-semibold" style={{ color: astro.moonRay.color }}>
                Luna · {astro.moonRay.name} Ray
              </span>
            </div>
            <div className="text-xs text-zinc-400">
              {astro.moonRay.zodiacSign} {astro.moonRay.zodiacSymbol} · {astro.moonRay.virtue}
            </div>
            <div className="text-[10px] italic text-zinc-500 mt-1">{astro.moonRay.affirmation}</div>
          </div>
        )}

        {/* Sol */}
        {astro.sunRay && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-900/15 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sun className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-semibold" style={{ color: astro.sunRay.color }}>
                Sol · {astro.sunRay.name} Ray
              </span>
            </div>
            <div className="text-xs text-zinc-400">
              {astro.sunRay.zodiacSign} {astro.sunRay.zodiacSymbol} · {astro.sunRay.virtue}
            </div>
            <div className="text-[10px] italic text-zinc-500 mt-1">{astro.sunRay.affirmation}</div>
          </div>
        )}
      </div>

      {/* Current astrological signs */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-400 mb-3">Current Astrological Signs</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-300" />
              <span className="text-sm text-zinc-200">Sol</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold" style={{ color: astro.sunRay?.color ?? "#e2e8f0" }}>
                {astro.sunRay?.zodiacSign ?? "—"} {astro.sunRay?.zodiacSymbol}
              </span>
              <div className="text-[10px] text-zinc-500">{astro.sunLon.toFixed(1)}°</div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-cyan-300" />
              <span className="text-sm text-zinc-200">Luna</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold" style={{ color: astro.moonRay?.color ?? "#e2e8f0" }}>
                {astro.moonRay?.zodiacSign ?? "—"} {astro.moonRay?.zodiacSymbol}
              </span>
              <div className="text-[10px] text-zinc-500">{astro.moonLon.toFixed(1)}°</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}