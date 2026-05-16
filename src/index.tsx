import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { PRESENT_ONLY } from "./config/rays";
import { ZIP_LOOKUP_ENDPOINT, ZIP_LOOKUP_USER_AGENT } from "./config/geocode";
import { LunaRuntime } from "./lib/lunaRuntime";
import { SolRuntime } from "./lib/solRuntime";
import { AtlasCometMap } from "./comet/AtlasCometMap";
import { THEME_PRESETS, type UITheme } from "./config/themePresets";
import { DAYS_PER_YEAR_APPROX, MOON_FORMATION_YEARS_AGO, SYNODIC_MONTH_DAYS, EARTH_FORMATION_YEARS_AGO } from "./config/autDate";
import { CosmicCalendarPanel } from "./components/CosmicCalendarPanel";

/**
 * Alastizen Universal Time (AUT) — Live Clock ✨
 * Sunrise→Sunset maps to 00:00→12:00 AUT; Sunset→Next Sunrise maps to 12:00→24:00 AUT.
 * Includes:
 *  • Polar/Solstice continuity via Equilux fallback using Apparent Solar Time (AST)
 *  • Higher-accuracy NOAA-style ephemeris (declination & equation of time)
 *  • Ray Windows band + cursor with within-window progress
 *  • Alice font loader
 *  • In‑app PWA registration (service worker + manifest via Blob)
 */

type Coordinates = { lat: number; lon: number };
type GeolocationStatus = "pending" | "granted" | "denied" | "unavailable";

type PolarMode = {
  mode: "polar_night" | "polar_day";
  noonUTC: number;
  EoT: number;
  declDeg: number;
};

type NormalSunWindow = {
  mode: "normal";
  sunriseUTC: number;
  sunsetUTC: number;
  noonUTC: number;
  EoT: number;
  declDeg: number;
};

type SunWindow = PolarMode | NormalSunWindow;

type AUTBase = {
  autHours: number;
  autClock: string;
  sunriseLocal: Date;
  sunsetLocal: Date;
  solarNoonLocal: Date;
  nextSunriseLocal: Date;
  segmentLabel: string;
  progress: number;
  segLenMin: number;
  dayLenMin: number;
  nightLenMin: number;
};

type NormalAUT = AUTBase & {
  mode: "normal";
  noonUTC: number;
};

type EquiluxAUT = AUTBase & {
  mode: "equilux";
};

type AUTResult = NormalAUT | EquiluxAUT;

type PlaceStatus = "idle" | "loading" | "ready" | "error";
type ZipStatus = "idle" | "loading" | "success" | "error";
type TimeZoneStatus = "idle" | "loading" | "success" | "error";

type TimeZoneInfo = {
  timeZone: string;
  abbreviation?: string;
  offsetMinutes?: number;
};

type AtmosphereSample = {
  temperatureC?: number;
  temperatureF?: number;
  seaLevelPressure?: number;
  ozone?: number;
  ozoneUnits?: string;
  updated?: Date;
  stationId?: string;
  stationName?: string;
};

type AtmosphereStatus = "idle" | "loading" | "ready" | "error";

type HistoricalTempSample = {
  avgC?: number;
  avgF?: number;
  status: "idle" | "loading" | "ready" | "error";
  error?: string | null;
  source?: string;
};

type CompassStatus = "idle" | "active" | "denied" | "unsupported";
type PanelId =
  | "clock"
  | "cosmic"
  | "sol"
  | "luna"
  | "compass"
  | "heartlight"
  | "coreSignature"
  | "community"
  | "ray"
  | "weekrays"
  | "rayreading"
  | "atmosphere"
  | "postal"
  | "settings";
type RayWindow = { name: string; start: number; end: number; color: string; labelColor?: string };
type RayWindowTimes = {
  start: { aut: string; local: string };
  end: { aut: string; local: string };
};
type WeeklyRayCycle = {
  id: string;
  dayIndex: number; // JS day: 0 = Sunday, ... 6 = Saturday
  dayLabel: string;
  dayAbbrev: string;
  cycle: 1 | 2;
  name: string;
  code: string;
  description: string;
  color: string;
  labelColor?: string;
};
type WeekRayWindowTimes = { start: string; end: string };
type RayReading = { title: string; core: string; gifts: string; ideal: string; affirmation: string };
type WeekRayReading = { title: string; body: string };
type CoreSignatureProfile = {
  name: string;
  code: string;
  photoData?: string;
  photoName?: string;
  adminCes?: string;
  updatedAt?: number;
  uiTheme?: UITheme;
  theme?: UITheme;
};
type CommunityPost = {
  id: string;
  name: string;
  code: string;
  message: string;
  createdAt: number;
  photoData?: string;
  photoName?: string;
  imageData?: string;
  imageName?: string;
};

const MAX_POST_IMAGE_BYTES = 2_000_000; // ≈2 MB guardrail for attached images

const FALLBACK_PLACE_LABEL = "Charlotte, NC";
const PLACE_CACHE_PREFIX = "aut-place:";
const COORD_PRECISION = 3;
const RING_OUTER_RADIUS = 62;
const RING_INNER_RADIUS = 22;
const POINTER_RADIUS = 58;
const LABEL_RADIUS = (RING_OUTER_RADIUS + RING_INNER_RADIUS) / 2;
const RAY_LABEL_RADIUS = LABEL_RADIUS - 4;
const WEEK_LABEL_RADIUS = LABEL_RADIUS - 2;
const RING_VIEWBOX_PADDING = 10;
const RING_VIEWBOX_MIN = -RING_OUTER_RADIUS - RING_VIEWBOX_PADDING;
const RING_VIEWBOX_SIZE = (RING_OUTER_RADIUS + RING_VIEWBOX_PADDING) * 2;
const COMPASS_CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const UI_THEME_STORAGE_KEY = "aut-ui-theme";
const PANEL_OPTIONS: Array<{ id: PanelId; label: string }> = [
  { id: "clock", label: "AUT Clock" },
  { id: "cosmic", label: "Cosmic Calendar" },
  { id: "sol", label: "Sol Panel" },
  { id: "luna", label: "Luna Panel" },
  { id: "compass", label: "Gyro Compass" },
  { id: "heartlight", label: "Ray Astrology" },
  { id: "community", label: "Community" },
  { id: "ray", label: "Ray Dial" },
  { id: "weekrays", label: "Rays of the Week" },
  { id: "rayreading", label: "Ray Reading" },
  { id: "atmosphere", label: "Atmosphere Panel" },
  { id: "postal", label: "Postal Lookup" },
  { id: "coreSignature", label: "CES Profile" },
  { id: "settings", label: "Settings" },
];
const CORE_DIGIT_COLORS: Record<string, string> = {
  "0": "#0b0b0f",
  "1": "#ef4444",
  "2": "#fb923c",
  "3": "#facc15",
  "4": "#22c55e",
  "5": "#14b8a6",
  "6": "#3b82f6",
  "7": "#4338ca",
  "8": "#8b5cf6",
  "9": "#d946ef",
};
const CORE_SPECIAL_GRADIENT = "conic-gradient(#ff0000, #ff7f00, #ffee00, #22c55e, #14b8a6, #3b82f6, #4338ca, #8b5cf6, #d946ef, #ff0000)";
const CORS_PROXY = "https://cors.isomorphic-git.org/";
const TEMIS_ENDPOINT = "https://services.temis.nl/api/tco3/";
const HISTORICAL_START_YEAR = 1993;
const DEVICE_ID_STORAGE_KEY = "aut-device-id";
const CES_PROFILE_STORAGE_KEY = "aut-ces-profile";

function generateDeviceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dev-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

const LARB_RAYS = [
  {
    id: "red",
    name: "Red Ray",
    virtue: "Presence",
    color: "#ef4444",
    mantra:
      "The pulse of embodied life. Rooted vitality, courage, and the will to be. The grounding of soul into matter where every heartbeat affirms “I am.”",
  },
  {
    id: "orange",
    name: "Orange Ray",
    virtue: "Essence",
    color: "#fb923c",
    mantra:
      "Creative river of feeling and flow. The dance of emotion, artistry, and sacred sensuality that bridges survival into joyful expression.",
  },
  {
    id: "yellow",
    name: "Yellow Ray",
    virtue: "Sovereignty",
    color: "#facc15",
    mantra:
      "Solar clarity and self-leadership. Confidence, discernment, and luminous will harmonizing into empowered radiance.",
  },
  {
    id: "green",
    name: "Green Ray",
    virtue: "Union",
    color: "#22c55e",
    mantra:
      "Heartlight coherence and manifestation. Compassionate connection with Earth and ALL; harmony that flourishes through love.",
  },
  {
    id: "turquoise",
    name: "Turquoise Ray",
    virtue: "Harmony",
    color: "#2dd4bf",
    mantra:
      "Bridge of empathy and higher communication. The current where emotional intelligence meets intuitive knowing, allowing peace to ripple through connection and creation.",
  },
  {
    id: "blue",
    name: "Blue Ray",
    virtue: "Expression",
    color: "#3b82f6",
    mantra:
      "Crystalline voice of truth. The current of communication, resonance, and boundary grace through which being speaks itself.",
  },
  {
    id: "indigo",
    name: "Indigo Ray",
    virtue: "Perception",
    color: "#6366f1",
    mantra:
      "Inner vision and intuitive wisdom. The dream-seer’s frequency that unveils mysteries and weaves imagination into revelation.",
  },
  {
    id: "violet",
    name: "Violet Ray",
    virtue: "Integration",
    color: "#8b5cf6",
    mantra:
      "Bridge of spirit and form. The transmutational current of transformation, death-rebirth, and sacred wholeness.",
  },
  {
    id: "magenta",
    name: "Magenta Ray",
    virtue: "Reunion",
    color: "#d946ef",
    mantra:
      "The infinite spiral of ALL. Union of Red and Violet, dissolving duality into remembrance, unconditional love, and cosmic return.",
  },
] as const;

type LarbRayDefinition = (typeof LARB_RAYS)[number];
type LarbRayId = LarbRayDefinition["id"];

const LARB_RAY_LOOKUP = Object.fromEntries(LARB_RAYS.map((ray) => [ray.id, ray])) as Record<
  LarbRayId,
  LarbRayDefinition
>;

const RAY_NAME_TO_LARB_ID: Record<string, LarbRayId | undefined> = {
  Red: "red",
  Orange: "orange",
  Yellow: "yellow",
  Green: "green",
  Turquoise: "turquoise",
  Blue: "blue",
  Indigo: "indigo",
  Violet: "violet",
  Magenta: "magenta",
};

const LARB_STORAGE_KEY = "aut-larb-archives";
const LARB_MAX_RAY_SLOTS = 9;
const LARB_TOTAL_ORBS = 12; // 1 head + 2 eyes + 9 aura orbs
const LARB_HEAD_INDEX = 0;
const LARB_EYE_INDICES: [number, number] = [1, 2];
const LARB_AURA_COUNT = 9;
const LARB_DEFAULT_CHORD: LarbRayId[] = ["red", "turquoise", "violet"];
const LARB_ARCHIVE_LIMIT = 12;
const LARB_CLUSTER_BASE = { x: 50, y: 40 };
const LARB_CLUSTER_LIMIT = { x: 16, y: 12 };
const LARB_CLUSTER_Y_SCALE = 0.7;

const LARB_EYE_MODES = [
  { id: "round", label: "Pulse", detail: "Open, gentle gaze that mirrors presence." },
  { id: "nova", label: "Nova", detail: "Faceted iris that sparks when harmonized." },
  { id: "crescent", label: "Crescent", detail: "Dreaming eyelids that catch moonlight." },
] as const;

type LarbEyeShape = (typeof LARB_EYE_MODES)[number]["id"];

type LarbEyeSettings = {
  shape: LarbEyeShape;
  glow: number; // 0–100
  shimmer: number; // 0–100
  staticCharge: number; // 0–100
};

type LarbArchetype = {
  id: string;
  name: string;
  rayChord: LarbRayId[];
  eye: LarbEyeSettings;
  savedAt: number;
};

type SecretLarbSanctumProps = {
  onClose: () => void;
  activeRayWindow: RayWindow | null;
  activeLarbRayId: LarbRayId | null;
  rayProgressPct: number;
  rayWindowTimes: RayWindowTimes | null;
  autClock: string;
  remainingMinutes: number;
};

type PlasmaEyeCanvasProps = {
  id: string;
  diameter: number;
  charge: number;
  primaryColor: string;
  secondaryColor: string;
  offsetX: number;
  offsetY: number;
};

type PlasmaArc = {
  baseAngle: number;
  spread: number;
  seed: number;
  bend: number;
  driftSpeed: number;
  life: number;
  maxLife: number;
};

function roundedCoord(value: number, precision = COORD_PRECISION): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function coordsCacheKey(coords: Coordinates): string {
  const lat = roundedCoord(coords.lat);
  const lon = roundedCoord(coords.lon);
  return `${lat.toFixed(COORD_PRECISION)},${lon.toFixed(COORD_PRECISION)}`;
}

function readSession(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeSession(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function readStoredTheme(): UITheme {
  if (typeof window === "undefined") return "normal";
  try {
    const stored = window.localStorage.getItem(UI_THEME_STORAGE_KEY);
    return stored === "retro" || stored === "normal" || stored === "atlas" ? stored : "normal";
  } catch {
    return "normal";
  }
}

function persistTheme(theme: UITheme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

function extractPlaceName(response: any): string | undefined {
  const sanitize = (label?: string) =>
    typeof label === "string" ? label.replace(/\s*\(the\)/gi, "").trim() : label;
  if (!response || typeof response !== "object") return undefined;
  const locality = typeof response.city === "string" && response.city.trim().length > 0
    ? response.city.trim()
    : typeof response.locality === "string" && response.locality.trim().length > 0
    ? response.locality.trim()
    : undefined;
  const region =
    typeof response.principalSubdivision === "string" && response.principalSubdivision.trim().length > 0
      ? response.principalSubdivision.trim()
      : undefined;
  const country =
    typeof response.countryName === "string" && response.countryName.trim().length > 0
      ? response.countryName.trim()
      : undefined;
  const cleanCountry =
    country && /\(the\)$/i.test(country) ? country.replace(/\s*\(the\)$/i, "") : country;

  const parts: string[] = [];
  if (locality) parts.push(locality);
  if (region && !parts.includes(region)) parts.push(region);
  if (cleanCountry && !parts.includes(cleanCountry)) parts.push(cleanCountry);
  return sanitize(parts.length > 0 ? parts.join(", ") : undefined);
}

function polarToCartesian(radius: number, angle: number): { x: number; y: number } {
  return {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
  };
}

function describeWedge(
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

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function headingToLabel(degrees: number): string {
  const normalized = normalizeDegrees(degrees);
  const index = Math.round(normalized / 45) % COMPASS_CARDINALS.length;
  return COMPASS_CARDINALS[index];
}

type HorizonTrackPoint = { ts: Date; alt: number; az: number };
type HorizonArcPoint = HorizonTrackPoint & { x: number; y: number; cappedAlt: number };
type HorizonArc = {
  width: number;
  height: number;
  leftPadding: number;
  rightPadding: number;
  topPadding: number;
  bottomPadding: number;
  chartWidth: number;
  chartHeight: number;
  path: string;
  areaPath: string | null;
  horizonY: number;
  bands: Array<{ label: string; y: number }>;
  points: HorizonArcPoint[];
  current: HorizonArcPoint | null;
};

function buildHorizonArc(
  track: HorizonTrackPoint[],
  now: Date,
  options?: { minAltitude?: number; maxAltitude?: number }
): HorizonArc | null {
  if (!track || track.length < 2) return null;

  const width = 360;
  const height = 200;
  const leftPadding = 28;
  const rightPadding = 28;
  const topPadding = 18;
  const bottomPadding = 28;
  const chartWidth = width - leftPadding - rightPadding;
  const chartHeight = height - topPadding - bottomPadding;
  const minAlt = options?.minAltitude ?? -10;
  const maxAlt = options?.maxAltitude ?? 90;
  const clampAltitude = (alt: number) => Math.max(minAlt, Math.min(maxAlt, alt));

  const points: HorizonArcPoint[] = track.map((entry) => {
    const azRad = (entry.az * Math.PI) / 180;
    const xNorm = (1 - Math.sin(azRad)) / 2; // East left, West right
    const cappedAlt = clampAltitude(entry.alt);
    const altNorm = (cappedAlt - minAlt) / (maxAlt - minAlt);
    const x = leftPadding + xNorm * chartWidth;
    const y = topPadding + (1 - altNorm) * chartHeight;
    return { ...entry, x, y, cappedAlt };
  });

  const horizonAltNorm = (0 - minAlt) / (maxAlt - minAlt);
  const horizonY = topPadding + (1 - horizonAltNorm) * chartHeight;

  const path = points
    .map((point, idx) => `${idx === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  const areaPoints = points.map((point) => ({
    x: point.x,
    y: Math.min(point.y, horizonY),
  }));

  const areaPath =
    areaPoints.length >= 2
      ? [
          `M${areaPoints[0].x.toFixed(1)},${horizonY.toFixed(1)}`,
          ...areaPoints.map((point) => `L${point.x.toFixed(1)},${point.y.toFixed(1)}`),
          `L${areaPoints[areaPoints.length - 1].x.toFixed(1)},${horizonY.toFixed(1)}`,
          "Z",
        ].join(" ")
      : null;

  const sixtyAltNorm = (60 - minAlt) / (maxAlt - minAlt);
  const thirtyAltNorm = (30 - minAlt) / (maxAlt - minAlt);
  const bands = [
    { label: "60°", y: topPadding + (1 - sixtyAltNorm) * chartHeight },
    { label: "30°", y: topPadding + (1 - thirtyAltNorm) * chartHeight },
  ];

  const nowMs = now.getTime();
  const current = points.reduce<{ diff: number; point: HorizonArcPoint | null }>(
    (best, point) => {
      const diff = Math.abs(point.ts.getTime() - nowMs);
      return diff < best.diff ? { diff, point } : best;
    },
    { diff: Number.POSITIVE_INFINITY, point: null }
  ).point;

  return {
    width,
    height,
    leftPadding,
    rightPadding,
    topPadding,
    bottomPadding,
    chartWidth,
    chartHeight,
    path,
    areaPath,
    horizonY,
    bands,
    points,
    current,
  };
}

type MoonPhaseKey =
  | "new"
  | "waxing-crescent"
  | "first-quarter"
  | "waxing-gibbous"
  | "full"
  | "waning-gibbous"
  | "last-quarter"
  | "waning-crescent";

const MOON_PHASE_GRADIENTS: Record<
  MoonPhaseKey,
  { stops: Array<{ offset: number; color: string }>; reverse?: boolean } | null
> = {
  new: null,
  full: null,
  "waxing-crescent": {
    stops: [
      { offset: 0.0, color: "#0f172a" },
      { offset: 0.45, color: "#0f172a" },
      { offset: 0.52, color: "#f8fafc" },
      { offset: 1.0, color: "#f8fafc" },
    ],
  },
  "waning-crescent": {
    stops: [
      { offset: 0.0, color: "#0f172a" },
      { offset: 0.45, color: "#0f172a" },
      { offset: 0.52, color: "#f8fafc" },
      { offset: 1.0, color: "#f8fafc" },
    ],
    reverse: true,
  },
  "first-quarter": {
    stops: [
      { offset: 0.0, color: "#0f172a" },
      { offset: 0.5, color: "#0f172a" },
      { offset: 0.5, color: "#f8fafc" },
      { offset: 1.0, color: "#f8fafc" },
    ],
  },
  "last-quarter": {
    stops: [
      { offset: 0.0, color: "#0f172a" },
      { offset: 0.5, color: "#0f172a" },
      { offset: 0.5, color: "#f8fafc" },
      { offset: 1.0, color: "#f8fafc" },
    ],
    reverse: true,
  },
  "waxing-gibbous": {
    stops: [
      { offset: 0.0, color: "#0f172a" },
      { offset: 0.2, color: "#0f172a" },
      { offset: 0.45, color: "#f8fafc" },
      { offset: 1.0, color: "#f8fafc" },
    ],
  },
  "waning-gibbous": {
    stops: [
      { offset: 0.0, color: "#0f172a" },
      { offset: 0.2, color: "#0f172a" },
      { offset: 0.45, color: "#f8fafc" },
      { offset: 1.0, color: "#f8fafc" },
    ],
    reverse: true,
  },
};

function getMoonPhaseKey(phaseName: string): MoonPhaseKey {
  const normalized = phaseName.toLowerCase();
  if (normalized.includes("new")) return "new";
  if (normalized.includes("waxing crescent")) return "waxing-crescent";
  if (normalized.includes("first quarter")) return "first-quarter";
  if (normalized.includes("waxing gibbous")) return "waxing-gibbous";
  if (normalized.includes("full")) return "full";
  if (normalized.includes("waning gibbous")) return "waning-gibbous";
  if (normalized.includes("last quarter") || normalized.includes("third quarter")) return "last-quarter";
  if (normalized.includes("waning crescent")) return "waning-crescent";
  return "full";
}

function MoonPhaseIcon({ phaseName }: { phaseName: string }) {
  const id = useId();
  const key = getMoonPhaseKey(phaseName);
  const gradientConfig = MOON_PHASE_GRADIENTS[key];
  const gradientId = `${id}-moon-phase`;

  return (
    <svg width="52" height="52" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <circle cx="24" cy="24" r="22" fill="#0f172a" stroke="#f8fafc" strokeWidth="1.5" />
      {key === "full" ? (
        <circle cx="24" cy="24" r="20" fill="#f8fafc" />
      ) : key === "new" ? (
        <circle cx="24" cy="24" r="20" fill="rgba(148,163,184,0.12)" />
      ) : (
        <>
          <defs>
            <linearGradient
              id={gradientId}
              x1={gradientConfig?.reverse ? "100%" : "0%"}
              y1="0%"
              x2={gradientConfig?.reverse ? "0%" : "100%"}
              y2="0%"
            >
              {gradientConfig?.stops.map((stop, idx) => (
                <stop key={idx} offset={`${stop.offset * 100}%`} stopColor={stop.color} />
              ))}
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="20" fill={`url(#${gradientId})`} />
        </>
      )}
    </svg>
  );
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(Math.round(minutes));
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function splitRayLabel(name: string): string[] {
  if (name.includes("-")) {
    const parts = name.split("-");
    return parts.map((part, idx) =>
      idx < parts.length - 1 ? `${part.trim()}-` : part.trim()
    );
  }
  const tokens = name.split(" ");
  const lines: string[] = [];
  let current = "";
  const maxLen = 10;
  for (const token of tokens) {
    const candidate = current ? `${current} ${token}` : token;
    if (candidate.length > maxLen && current) {
      lines.push(current);
      current = token;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

type LarbOrbKind = "head" | "eye" | "aura";

type LarbOrbState = {
  id: string;
  kind: LarbOrbKind;
  band: number;
  angle: number;
  radius: number;
  size: number;
  blur: number;
  speed: number;
  wobble: number;
};

type LarbClusterOffset = {
  x: number;
  y: number;
};

function isLarbRayId(value: unknown): value is LarbRayId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LARB_RAY_LOOKUP, value);
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHexColor(hex: string): string | null {
  const stripped = hex.replace("#", "").trim();
  if (stripped.length === 6) return stripped.toLowerCase();
  if (stripped.length === 3) {
    return stripped
      .split("")
      .map((ch) => ch + ch)
      .join("")
      .toLowerCase();
  }
  return null;
}

function averageHexColor(colors: string[], fallback: string): string {
  const palette = colors.length > 0 ? colors : [fallback];
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (const hex of palette) {
    const normalized = normalizeHexColor(hex);
    if (!normalized) continue;
    r += parseInt(normalized.slice(0, 2), 16);
    g += parseInt(normalized.slice(2, 4), 16);
    b += parseInt(normalized.slice(4, 6), 16);
    count += 1;
  }
  if (count === 0) return fallback;
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(Math.round(r / count))}${toHex(Math.round(g / count))}${toHex(Math.round(b / count))}`;
}

function normalizeSignatureCode(raw: string): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, 9);
}

function deriveSignatureSegments(code: string): {
  sanitized: string;
  colors: string[];
  special: "white" | "diamond" | "rainbow" | null;
  lastTwo: number | null;
} {
  const sanitized = normalizeSignatureCode(code);
  const padded = sanitized.padEnd(9, "0").slice(0, 9);
  const colors = padded.split("").map((digit) => CORE_DIGIT_COLORS[digit] ?? CORE_DIGIT_COLORS["0"]);
  const lastTwoStr = padded.slice(-2);
  const lastTwo = lastTwoStr ? Number.parseInt(lastTwoStr, 10) : null;
  let special: "white" | "diamond" | "rainbow" | null = null;
  if (lastTwo === 10) special = "white";
  if (lastTwo === 11) special = "diamond";
  if (lastTwo === 12) special = "rainbow";
  if (special) {
    colors[colors.length - 1] =
      special === "white" ? "#ffffff" : special === "diamond" ? "#e5e7eb" : "#f472b6";
  }
  return { sanitized: padded, colors, special, lastTwo };
}

function buildSignatureGradient(colors: string[], special: "white" | "diamond" | "rainbow" | null): string {
  const stops = colors
    .map((color, index) => {
      const start = (index / colors.length) * 100;
      const end = ((index + 1) / colors.length) * 100;
      return `${color} ${start}% ${end}%`;
    })
    .join(", ");
  const base = `conic-gradient(${stops})`;
  if (special === "diamond") {
    return `${base}, repeating-conic-gradient(from 45deg, rgba(255,255,255,0.5) 0deg 8deg, rgba(255,255,255,0.08) 8deg 16deg)`;
  }
  if (special === "rainbow") {
    return `${base}, ${CORE_SPECIAL_GRADIENT}`;
  }
  if (special === "white") {
    return `${base}, radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 65%)`;
  }
  return base;
}

function formatSignatureDisplay(code: string): string {
  const digits = normalizeSignatureCode(code);
  if (digits.length === 0) return "—";
  return digits.padEnd(9, "•").replace(/(.{3})/g, "$1 ").trim();
}

function clampClusterOffset(offset: LarbClusterOffset): LarbClusterOffset {
  return {
    x: clamp(offset.x, -LARB_CLUSTER_LIMIT.x, LARB_CLUSTER_LIMIT.x),
    y: clamp(offset.y, -LARB_CLUSTER_LIMIT.y, LARB_CLUSTER_LIMIT.y),
  };
}

function createPlasmaArcs(count: number): PlasmaArc[] {
  return Array.from({ length: count }, () => ({
    baseAngle: Math.random() * Math.PI * 2,
    spread: 0.2 + Math.random() * 0.4,
    seed: Math.random() * 1000,
    bend: 0.15 + Math.random() * 0.2,
    driftSpeed: 0.4 + Math.random() * 0.4,
    life: 1800 + Math.random() * 1800,
    maxLife: 1800 + Math.random() * 2200,
  }));
}

function PlasmaEyeCanvas({
  id,
  diameter,
  charge,
  primaryColor,
  secondaryColor,
  offsetX,
  offsetY,
}: PlasmaEyeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const arcsRef = useRef<PlasmaArc[]>([]);
  const animationRef = useRef<number | null>(null);
  const centerSeedRef = useRef(Math.random() * 1000);
  const lastTimeRef = useRef(0);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const renderSize = Math.max(diameter, 24);
  const arcCount = Math.max(3, Math.round(4 + (charge / 100) * 8));

  useEffect(() => {
    arcsRef.current = createPlasmaArcs(arcCount);
  }, [arcCount, diameter, charge, primaryColor, secondaryColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    const scaledSize = renderSize * dpr;
    canvas.width = scaledSize;
    canvas.height = scaledSize;
    canvas.style.width = `${renderSize}px`;
    canvas.style.height = `${renderSize}px`;
    const center = scaledSize / 2;
    const maxRadius = Math.max(2, (diameter / 2 - 2) * dpr);

    const drawFrame = (time: number) => {
      if (!ctx) return;
      const delta = lastTimeRef.current ? time - lastTimeRef.current : 16;
      lastTimeRef.current = time;
      ctx.clearRect(0, 0, scaledSize, scaledSize);
      ctx.globalCompositeOperation = "source-over";
      const chargeIntensity = Math.max(0.2, charge / 100);
      const driftRadius = (1 + chargeIntensity * 1.6) * dpr;
      const coreOffsetX =
        Math.sin(time * 0.0023 + centerSeedRef.current) * driftRadius;
      const coreOffsetY =
        Math.cos(time * 0.0029 + centerSeedRef.current * 1.3) * driftRadius * 0.9;
      const coreX = center + coreOffsetX;
      const coreY = center + coreOffsetY;
      ctx.lineWidth = (1 + chargeIntensity * 1.4) * dpr;
      ctx.shadowBlur = 8 * chargeIntensity * dpr;
      ctx.shadowColor = hexToRgba(secondaryColor, 0.55);

      // Center pupil glow
      const pupilRadius = diameter * (0.18 + chargeIntensity * 0.18) * dpr;
      const innerGradient = ctx.createRadialGradient(
        coreX,
        coreY,
        pupilRadius * 0.15,
        coreX,
        coreY,
        pupilRadius
      );
      innerGradient.addColorStop(0, "rgba(255,255,255,0.98)");
      innerGradient.addColorStop(0.45, hexToRgba(primaryColor, 0.92));
      innerGradient.addColorStop(1, hexToRgba(secondaryColor, 0.55));
      ctx.fillStyle = innerGradient;
      ctx.beginPath();
      ctx.arc(coreX, coreY, pupilRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(coreX, coreY, pupilRadius * 0.38, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      arcsRef.current.forEach((arc, idx) => {
        const normalizedDelta = delta / 16.6;
        arc.life -= delta;
        if (arc.life <= 0 || Math.random() < 0.01 + chargeIntensity * 0.02) {
          arcsRef.current[idx] = {
            baseAngle: Math.random() * Math.PI * 2,
            spread: 0.2 + Math.random() * 0.4,
            seed: Math.random() * 1000,
            bend: 0.18 + Math.random() * 0.25,
            driftSpeed: 0.6 + Math.random() * 0.5,
            life: 1400 + Math.random() * 1600,
            maxLife: 1600 + Math.random() * 2200,
          };
          return;
        }
        const jitter =
          Math.sin(time * 0.0012 * arc.driftSpeed + arc.seed) * arc.spread;
        arc.baseAngle += 0.0008 * arc.driftSpeed * normalizedDelta;
        const targetAngle = arc.baseAngle + jitter;
        const segments = 20;
        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const ease = Math.pow(t, 0.9);
          const radial = maxRadius * ease;
          const bend =
            Math.sin(time * 0.003 + arc.seed + t * 6) * arc.bend * (1 - ease);
          const theta = targetAngle + bend;
          const x = coreX + radial * Math.cos(theta);
          const y = coreY + radial * Math.sin(theta);
          if (i === 0) {
            ctx.moveTo(coreX, coreY);
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        const gradient = ctx.createLinearGradient(
          coreX,
          coreY,
          coreX + Math.cos(targetAngle) * maxRadius,
          coreY + Math.sin(targetAngle) * maxRadius
        );
        gradient.addColorStop(0, "rgba(255,255,255,0.9)");
        gradient.addColorStop(0.35, hexToRgba(primaryColor, 0.8));
        gradient.addColorStop(1, hexToRgba(secondaryColor, 0.3));
        ctx.strokeStyle = gradient;
        ctx.globalAlpha =
          0.6 + (chargeIntensity * 0.35 + (arc.life / arc.maxLife) * 0.2);
        ctx.stroke();
      });
      ctx.restore();

      animationRef.current = window.requestAnimationFrame(drawFrame);
    };

    animationRef.current = window.requestAnimationFrame(drawFrame);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [arcCount, charge, dpr, primaryColor, renderSize, secondaryColor]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-eye-id={id}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`,
        pointerEvents: "none",
        mixBlendMode: "screen",
        zIndex: 60,
      }}
    />
  );
}

function resolveLarbIdFromRayName(name?: string | null): LarbRayId | null {
  if (!name) return null;
  const trimmed = name.trim();
  return RAY_NAME_TO_LARB_ID[trimmed] ?? null;
}

function buildInitialLarbChord(activeRayId: LarbRayId | null): LarbRayId[] {
  if (!activeRayId) return [...LARB_DEFAULT_CHORD];
  const existing = LARB_DEFAULT_CHORD.includes(activeRayId)
    ? [...LARB_DEFAULT_CHORD]
    : [activeRayId, ...LARB_DEFAULT_CHORD];
  return existing.slice(0, LARB_MAX_RAY_SLOTS);
}

function readSavedLarbArchetypes(): LarbArchetype[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LARB_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (
          !item ||
          typeof item !== "object" ||
          typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          !Array.isArray(item.rayChord) ||
          typeof item.eye !== "object"
        ) {
          return null;
        }
        const rayChord = item.rayChord.filter((ray: unknown): ray is LarbRayId => isLarbRayId(ray));
        if (rayChord.length === 0) return null;
        const eye: LarbEyeSettings = {
          shape: LARB_EYE_MODES.some((mode) => mode.id === item.eye?.shape)
            ? item.eye.shape
            : "round",
          glow: Math.max(0, Math.min(100, Number(item.eye?.glow) || 60)),
          shimmer: Math.max(0, Math.min(100, Number(item.eye?.shimmer) || 50)),
          staticCharge: Math.max(0, Math.min(100, Number(item.eye?.staticCharge) ?? 35)),
        };
        return {
          id: item.id,
          name: item.name,
          rayChord: rayChord.slice(0, LARB_MAX_RAY_SLOTS),
          eye,
          savedAt: typeof item.savedAt === "number" ? item.savedAt : Date.now(),
        } as LarbArchetype;
      })
      .filter(Boolean) as LarbArchetype[];
  } catch {
    return [];
  }
}

function persistLarbArchetypes(list: LarbArchetype[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LARB_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore write failures
  }
}

function createOrbState(index: number): LarbOrbState {
  const kind: LarbOrbKind =
    index === LARB_HEAD_INDEX ? "head" : LARB_EYE_INDICES.includes(index) ? "eye" : "aura";
  const auraIndex = index - (LARB_HEAD_INDEX + LARB_EYE_INDICES.length);
  const auraFraction = auraIndex >= 0 ? auraIndex / Math.max(1, LARB_AURA_COUNT) : 0;
  const baseAngle =
    kind === "head"
      ? -Math.PI / 2 + (Math.random() - 0.5) * 0.15
      : kind === "eye"
      ? (index === LARB_EYE_INDICES[0] ? -0.32 : 0.32) - Math.PI / 2
      : auraFraction * 2 * Math.PI - Math.PI / 2 + (Math.random() - 0.5) * 0.25;
  const radius =
    kind === "head"
      ? 6 + Math.random() * 2
      : kind === "eye"
      ? 16 + Math.random() * 4
      : 26 + Math.random() * 18;
  const size =
    kind === "head"
      ? 110 + Math.random() * 10
      : kind === "eye"
      ? 58 + Math.random() * 6
      : 32 + Math.random() * 26;
  const blur =
    kind === "head"
      ? 1.5 + Math.random() * 1.5
      : kind === "eye"
      ? 2 + Math.random() * 2
      : 4 + Math.random() * 9;
  const wobble = (Math.random() - 0.5) * (kind === "aura" ? 14 : 6);
  const speed =
    kind === "aura" ? 4 + Math.random() * 4 : kind === "eye" ? 6 + Math.random() * 3 : 10 + Math.random() * 4;
  return {
    id: `larb-orb-${index}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    band: index,
    angle: baseAngle,
    radius,
    size,
    blur,
    speed,
    wobble,
  };
}

function randomizeOrbPosition(prev: LarbOrbState): LarbOrbState {
  if (prev.kind === "head") {
    return {
      ...prev,
      angle: -Math.PI / 2 + (Math.random() - 0.5) * 0.12,
      radius: clamp(prev.radius + (Math.random() - 0.5) * 2, 4, 10),
      wobble: (Math.random() - 0.5) * 4,
    };
  }
  if (prev.kind === "eye") {
    return {
      ...prev,
      angle: prev.angle + (Math.random() - 0.5) * 0.25,
      radius: clamp(prev.radius + (Math.random() - 0.5) * 3, 12, 24),
      wobble: (Math.random() - 0.5) * 6,
      speed: 5 + Math.random() * 4,
    };
  }
  return {
    ...prev,
    angle: prev.angle + (Math.random() - 0.5) * 0.5,
    radius: clamp(prev.radius + (Math.random() - 0.5) * 8, 18, 44),
    wobble: (Math.random() - 0.5) * 14,
    speed: 4 + Math.random() * 4,
    size: clamp(prev.size + (Math.random() - 0.5) * 10, 28, 60),
    blur: clamp(prev.blur + (Math.random() - 0.5) * 4, 2, 14),
  };
}

function computeResonanceScore(
  chord: LarbRayId[],
  activeRayId: LarbRayId | null,
  eye: LarbEyeSettings
): number {
  let score = chord.length * 18;
  if (activeRayId && chord.includes(activeRayId)) {
    score += 28;
  }
  score += eye.glow * 0.25;
  score += eye.shimmer * 0.2;
  score += eye.staticCharge * 0.15;
  return Math.max(5, Math.min(100, Math.round(score)));
}

function describeChord(chord: LarbRayId[]): string {
  if (chord.length === 0) return "Awaiting song";
  return chord
    .map((id) => LARB_RAY_LOOKUP[id]?.virtue ?? id)
    .join(" • ");
}

// --- Math helpers ---
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function dayOfYear(d: Date): number {
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const diff = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start.getTime()) / 86400000;
  return diff + 1; // Jan 1 → 1
}

// NOAA-style fractional year gamma and derived EoT & declination (highly precise for our purpose)
function solarParamsNOAA(n: number /* day of year */): { declDeg: number; EoT: number } {
  const gamma = (2 * Math.PI * (n - 1)) / 365.0; // fractional year at local-noon baseline
  const declRad = Math.asin(
    0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma)
  );
  const EoT =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma)); // minutes
  return { declDeg: declRad * RAD, EoT };
}

function solarNoonUTCMinutes(longitudeDeg: number, EoT: number): number {
  return 720 - 4 * longitudeDeg - EoT; // minutes from 00:00 UTC
}

// Returns sunrise/sunset/noon plus a mode flag for polar conditions
function sunriseSunsetUTCMinutes(dateUTC: Date, latDeg: number, lonDeg: number): SunWindow {
  const n = dayOfYear(dateUTC);
  const { EoT, declDeg } = solarParamsNOAA(n);
  const noonUTC = solarNoonUTCMinutes(lonDeg, EoT);

  // Hour angle for standard upper-limb with refraction (alpha = 0.833°)
  const alpha = 0.833;
  const phi = latDeg * DEG;
  const decl = declDeg * DEG;
  const x =
    (Math.sin(-alpha * DEG) - Math.sin(phi) * Math.sin(decl)) /
    (Math.cos(phi) * Math.cos(decl));

  if (x > 1) {
    // Sun stays below horizon (polar night)
    return { mode: "polar_night", noonUTC, EoT, declDeg };
  }
  if (x < -1) {
    // Sun stays above horizon (polar day)
    return { mode: "polar_day", noonUTC, EoT, declDeg };
  }

  const h0 = Math.acos(Math.min(1, Math.max(-1, x))) * RAD; // degrees
  const sunriseUTC = noonUTC - 4 * h0;
  const sunsetUTC = noonUTC + 4 * h0;
  return { mode: "normal", sunriseUTC, sunsetUTC, noonUTC, EoT, declDeg };
}

function minutesLocalToUTCMinutes(d: Date): number {
  const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return (d.getTime() - utcMidnight) / 60000; // minutes since today's UTC 00:00
}

function minutesToHHMMSS(mins: number): string {
  const total = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = Math.floor(total % 60);
  const s = Math.floor((total * 60) % 60);
  const pad = (x: number) => x.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatClock(hhFloat: number): string {
  const totalMin = (((hhFloat % 24) + 24) % 24) * 60;
  return minutesToHHMMSS(totalMin);
}

function formatMonthDayLong(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

function utcMinutesToLocalDate(utcMinutes: number, baseDateUTC: Date): Date {
  const baseUTC = Date.UTC(
    baseDateUTC.getUTCFullYear(),
    baseDateUTC.getUTCMonth(),
    baseDateUTC.getUTCDate()
  );
  return new Date(baseUTC + utcMinutes * 60000);
}

// Apparent Solar Time (AST) minutes from midnight, normalized 0..1440
function apparentSolarMinutesUTC(tUTCmin: number, lonDeg: number, EoT: number): number {
  const ast = tUTCmin + 4 * lonDeg + EoT; // minutes
  return ((ast % 1440) + 1440) % 1440;
}

// Equilux fallback: split the day into two equal halves around solar noon using AST
function computeAUTEquilux(nowLocal: Date, lonDeg: number, EoT: number, noonUTC: number): EquiluxAUT {
  const tUTC = minutesLocalToUTCMinutes(nowLocal);
  const astMin = apparentSolarMinutesUTC(tUTC, lonDeg, EoT); // 0..1440
  // Day half centered on AST noon: 06:00..18:00; Night half: 18:00..30:00→wrap
  const dayStart = 360; // 06:00 AST
  const dayEnd = 1080; // 18:00 AST
  let autHours = 0;
  let segmentLabel = "";
  let progress = 0;
  let segLenMin = 0;

  if (astMin >= dayStart && astMin < dayEnd) {
    const ratio = (astMin - dayStart) / 720; // 12h day
    autHours = 12 * ratio; // 0..12
    segmentLabel = "Daylight // Lux";
    progress = ratio;
    segLenMin = 720;
  } else {
    // Night half: from 18:00→06:00 AST
    // Normalize via wrap
    const delta = astMin >= dayEnd ? astMin - dayEnd : astMin + (1440 - dayEnd);
    const ratio = delta / 720;
    autHours = 12 + 12 * ratio; // 12..24
    segmentLabel = "Nighttime // Umbra";
    progress = ratio;
    segLenMin = 720;
  }

  // For cards: virtual sunrise/sunset based on AST half splits
  const todayUTC = new Date(
    Date.UTC(
      nowLocal.getUTCFullYear(),
      nowLocal.getUTCMonth(),
      nowLocal.getUTCDate()
    )
  );
  const sunriseVirtualUTC = noonUTC - 360; // 06:00 before noon
  const sunsetVirtualUTC = noonUTC + 360; // 18:00 after noon
  const tomorrowUTC = new Date(
    Date.UTC(
      nowLocal.getUTCFullYear(),
      nowLocal.getUTCMonth(),
      nowLocal.getUTCDate() + 1
    )
  );

  return {
    autHours,
    autClock: formatClock(autHours),
    sunriseLocal: utcMinutesToLocalDate(sunriseVirtualUTC, todayUTC),
    sunsetLocal: utcMinutesToLocalDate(sunsetVirtualUTC, todayUTC),
    solarNoonLocal: utcMinutesToLocalDate(noonUTC, todayUTC),
    nextSunriseLocal: utcMinutesToLocalDate(sunriseVirtualUTC, tomorrowUTC),
    segmentLabel,
    progress,
    segLenMin,
    dayLenMin: 720,
    nightLenMin: 720,
    mode: "equilux",
  };
}

function computeAUT(nowLocal: Date, latDeg: number, lonDeg: number): AUTResult {
  // Build UTC anchors
  const todayUTC = new Date(
    Date.UTC(
      nowLocal.getUTCFullYear(),
      nowLocal.getUTCMonth(),
      nowLocal.getUTCDate()
    )
  );
  const yesterdayUTC = new Date(
    Date.UTC(
      nowLocal.getUTCFullYear(),
      nowLocal.getUTCMonth(),
      nowLocal.getUTCDate() - 1
    )
  );
  const tomorrowUTC = new Date(
    Date.UTC(
      nowLocal.getUTCFullYear(),
      nowLocal.getUTCMonth(),
      nowLocal.getUTCDate() + 1
    )
  );

  const today = sunriseSunsetUTCMinutes(todayUTC, latDeg, lonDeg);
  const tUTC = minutesLocalToUTCMinutes(nowLocal); // 0..1440

  // Polar continuity using Equilux AST split
  if (today.mode === "polar_day" || today.mode === "polar_night") {
    return computeAUTEquilux(nowLocal, lonDeg, today.EoT, today.noonUTC);
  }

  if (today.mode !== "normal") {
    return computeAUTEquilux(nowLocal, lonDeg, today.EoT, today.noonUTC);
  }

  // Normal sunrise/sunset flow
  const { sunriseUTC: sunriseToday, sunsetUTC: sunsetToday, noonUTC } = today;
  const yesterday = sunriseSunsetUTCMinutes(yesterdayUTC, latDeg, lonDeg);
  const tomorrow = sunriseSunsetUTCMinutes(tomorrowUTC, latDeg, lonDeg);

  if (yesterday.mode !== "normal" || tomorrow.mode !== "normal") {
    return computeAUTEquilux(nowLocal, lonDeg, today.EoT, today.noonUTC);
  }

  const { sunsetUTC: sunsetYest } = yesterday;
  const { sunriseUTC: sunriseTom } = tomorrow;

  let sunriseLocal = utcMinutesToLocalDate(sunriseToday, todayUTC);
  let sunsetLocal = utcMinutesToLocalDate(sunsetToday, todayUTC);
  let nextSunriseLocal = utcMinutesToLocalDate(sunriseTom, tomorrowUTC);

  const spanAfter = (endMin: number, startMin: number): number => endMin + 1440 - startMin; // next-day minus today
  const spanBefore = (endMin: number, startMin: number): number => endMin - startMin + 1440; // today minus yesterday

  let autHours = 0;
  let segmentLabel = "";
  let progress = 0;
  let segLenMin = 0;

  if (tUTC >= sunriseToday && tUTC < sunsetToday) {
    const dayLen = sunsetToday - sunriseToday;
    const ratio = (tUTC - sunriseToday) / dayLen;
    autHours = 12 * ratio;
    segmentLabel = "Daylight // Lux";
    segLenMin = dayLen;
    progress = ratio;
  } else if (tUTC >= sunsetToday) {
    const nightLen = spanAfter(sunriseTom, sunsetToday);
    const ratio = (tUTC - sunsetToday) / nightLen;
    autHours = 12 + 12 * ratio;
    segmentLabel = "Nighttime // Umbra";
    segLenMin = nightLen;
    progress = ratio;
  } else {
    // pre-sunrise: yesterday's sunset → today's sunrise (lift tUTC by +1440)
    const tCont = tUTC + 1440;
    const nightLen = spanBefore(sunriseToday, sunsetYest);
    const ratio = (tCont - sunsetYest) / nightLen;
    autHours = 12 + 12 * ratio;
    segmentLabel = "Nighttime // Umbra";
    segLenMin = nightLen;
    progress = ratio;
    sunsetLocal = utcMinutesToLocalDate(sunsetYest, yesterdayUTC);
    nextSunriseLocal = utcMinutesToLocalDate(sunriseToday, todayUTC);
  }

  const dayLenMin = Math.max(0, sunsetToday - sunriseToday);
  const nightLenMin = Math.max(0, spanAfter(sunriseTom, sunsetToday));

  return {
    autHours,
    autClock: formatClock(autHours),
    sunriseLocal,
    sunsetLocal,
    solarNoonLocal: utcMinutesToLocalDate(noonUTC, todayUTC),
    nextSunriseLocal,
    segmentLabel,
    progress,
    segLenMin,
    dayLenMin,
    nightLenMin,
    mode: "normal",
    noonUTC,
  };
}

function useGeolocation(defaultCoords: Coordinates) {
  const [coords, setCoords] = useState<Coordinates>(defaultCoords);
  const [status, setStatus] = useState<GeolocationStatus>("pending");

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos: GeolocationPosition) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStatus("granted");
      },
      () => {
        setStatus("denied");
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 }
    );
  }, []);

  return { coords, status, setCoords };
}

function useReverseGeocode(
  coords: Coordinates,
  geoStatus: GeolocationStatus,
  fallbackLabel: string
) {
  const cacheRef = useRef<Map<string, string>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string>(fallbackLabel);
  const [placeStatus, setPlaceStatus] = useState<PlaceStatus>("idle");
  const sanitize = useCallback(
    (label?: string) =>
      typeof label === "string" ? label.replace(/\s*\(the\)/gi, "").trim() : label,
    []
  );

  const lookup = useCallback(
    (force = false) => {
      if (geoStatus !== "granted") {
        abortRef.current?.abort();
        const label = geoStatus === "pending" ? fallbackLabel : `${fallbackLabel}`;
        setPlaceLabel(label);
        setPlaceStatus(geoStatus === "pending" ? "idle" : "ready");
        return;
      }

      if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) {
        setPlaceLabel("Current location");
        setPlaceStatus("error");
        return;
      }

      const key = coordsCacheKey(coords);
      if (!force) {
        const cached =
          cacheRef.current.get(key) ??
          readSession(PLACE_CACHE_PREFIX + key);
        if (cached) {
          const cleaned = sanitize(cached) ?? "Current location";
          cacheRef.current.set(key, cleaned);
          setPlaceLabel(cleaned);
          setPlaceStatus("ready");
          return;
        }
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setPlaceStatus("loading");

      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lon}&localityLanguage=en`;
      fetch(url, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) {
            throw new Error("reverse geocode failed");
          }
          return res.json();
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          const resolved = extractPlaceName(data) ?? "Current location";
          const cleaned = sanitize(resolved) ?? "Current location";
          cacheRef.current.set(key, cleaned);
          writeSession(PLACE_CACHE_PREFIX + key, cleaned);
          setPlaceLabel(cleaned);
          setPlaceStatus("ready");
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setPlaceLabel("Current location");
          setPlaceStatus("error");
        });
    },
    [coords, geoStatus, fallbackLabel]
  );

  useEffect(() => {
    lookup();
    return () => {
      abortRef.current?.abort();
    };
  }, [lookup]);

  const retry = useCallback(() => lookup(true), [lookup]);

  return { placeLabel, placeStatus, retry };
}

function useAtmosphereSnapshot(coords: Coordinates) {
  const [status, setStatus] = useState<AtmosphereStatus>("idle");
  const [sample, setSample] = useState<AtmosphereSample | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [nonce, setNonce] = useState(0);

  const fetchJsonWithProxy = async (
    url: string,
    controller: AbortController,
    headers: Record<string, string> = {},
    base?: string
  ) => {
    const absolute =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : base
        ? new URL(url, base).toString()
        : url;
    const attempt = async (target: string) => {
      const resp = await fetch(target, {
        signal: controller.signal,
        headers,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    };
    try {
      return await attempt(absolute);
    } catch (err) {
      if (controller.signal.aborted) throw err;
      return await attempt(`${CORS_PROXY}${absolute}`);
    }
  };

  const extractTemisOzone = (payload: any): number | undefined => {
    if (!payload) return undefined;
    const candidates = [
      payload.total_ozone,
      payload.total_ozone_du,
      payload.tco3,
      payload.ozone,
      payload.value,
      payload?.data?.value,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return candidate;
      }
    }
    if (Array.isArray(payload?.data)) {
      for (const item of payload.data) {
        if (typeof item?.value === "number" && Number.isFinite(item.value)) {
          return item.value;
        }
      }
    }
    return undefined;
  };

const fetchTemisOzone = async (controller: AbortController) => {
  try {
    const temis = await fetchJsonWithProxy(
      `${TEMIS_ENDPOINT}?lat=${coords.lat.toFixed(2)}&lon=${coords.lon.toFixed(
        2
      )}&format=json`,
      controller
    );
      return extractTemisOzone(temis);
    } catch (err) {
      if (controller.signal.aborted) throw err;
      console.warn("TEMIS fetch failed", err);
      return undefined;
    }
  };

  const fetchNoaaObservation = async (controller: AbortController) => {
    const headers = {
      Accept: "application/geo+json, application/json",
      "User-Agent": "AUTClock/1.0 (atlasisland.co)",
    };
    const point = await fetchJsonWithProxy(
      `/points/${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`,
      controller,
      headers,
      "https://api.weather.gov"
    );
    const stationsUrl: string | undefined = point?.properties?.observationStations;
    if (!stationsUrl) throw new Error("No observation stations available.");
    const stations = await fetchJsonWithProxy(stationsUrl, controller, headers);
    const stationFeature = stations?.features?.[0];
    const stationId: string | undefined = stationFeature?.properties?.stationIdentifier;
    if (!stationId) throw new Error("No nearby station found.");
    const stationName: string | undefined = stationFeature?.properties?.name;
    const observation = await fetchJsonWithProxy(
      `/stations/${stationId}/observations/latest`,
      controller,
      headers,
      "https://api.weather.gov"
    );
    const props = observation?.properties;
    if (!props) throw new Error("No observation data.");
    const tempC =
      typeof props.temperature?.value === "number" ? props.temperature.value : undefined;
    const pressurePa =
      typeof props.seaLevelPressure?.value === "number"
        ? props.seaLevelPressure.value
        : typeof props.barometricPressure?.value === "number"
        ? props.barometricPressure.value
        : undefined;
    return {
      temperatureC: tempC,
      seaLevelPressure: typeof pressurePa === "number" ? pressurePa / 100 : undefined,
      updated: props.timestamp ? new Date(props.timestamp) : new Date(),
      stationId,
      stationName,
    };
  };

  const fetchOpenMeteo = async (controller: AbortController) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat.toFixed(
      4
    )}&longitude=${coords.lon.toFixed(
      4
    )}&current=temperature_2m,pressure_msl,ozone&timezone=auto`;
    const json = await fetchJsonWithProxy(url, controller);
    const current = json?.current;
    if (!current) throw new Error("No fallback weather data.");
    const tempC =
      typeof current.temperature_2m === "number" ? current.temperature_2m : undefined;
    const pressure =
      typeof current.pressure_msl === "number" ? current.pressure_msl : undefined;
    const ozone =
      typeof current.ozone === "number" && Number.isFinite(current.ozone)
        ? current.ozone
        : undefined;
    return {
      temperatureC: tempC,
      seaLevelPressure: pressure,
      ozone,
      ozoneUnits: typeof ozone === "number" ? "DU" : undefined,
      updated: current.time ? new Date(current.time) : new Date(),
    };
  };

  const fetchOpenMeteoAirQuality = async (controller: AbortController) => {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.lat.toFixed(
      4
    )}&longitude=${coords.lon.toFixed(4)}&current=ozone`;
    const json = await fetchJsonWithProxy(url, controller);
    const ozone =
      typeof json?.current?.ozone === "number" && Number.isFinite(json.current.ozone)
        ? json.current.ozone
        : undefined;
    return {
      ozone,
      ozoneUnits: typeof ozone === "number" ? "µg/m³" : undefined,
      updated: json?.current?.time ? new Date(json.current.time) : undefined,
    };
  };

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setStatus("loading");
    setError(null);
    (async () => {
      try {
        let reading: AtmosphereSample = {};
        let gotPrimary = false;
        let fallbackMet: AtmosphereSample | null = null;
        const ensureFallback = async () => {
          if (fallbackMet) return fallbackMet;
          try {
            fallbackMet = await fetchOpenMeteo(controller);
          } catch (fallbackErr) {
            if (controller.signal.aborted) throw fallbackErr;
            console.warn("Open-Meteo fallback failed", fallbackErr);
          }
          return fallbackMet;
        };
        try {
          reading = await fetchNoaaObservation(controller);
          gotPrimary = true;
        } catch (noaaErr) {
          if (controller.signal.aborted) throw noaaErr;
          console.warn("NOAA observation failed; attempting fallback", noaaErr);
          const fallback = await ensureFallback();
          if (!fallback) throw noaaErr;
          reading = { ...reading, ...fallback };
          gotPrimary = true;
        }
        if (!gotPrimary) throw new Error("No temperature/pressure data available.");
        if (
          typeof reading.temperatureC !== "number" ||
          typeof reading.seaLevelPressure !== "number"
        ) {
          const fallback = await ensureFallback();
          if (fallback) {
            if (typeof reading.temperatureC !== "number" && typeof fallback.temperatureC === "number") {
              reading.temperatureC = fallback.temperatureC;
            }
            if (
              typeof reading.seaLevelPressure !== "number" &&
              typeof fallback.seaLevelPressure === "number"
            ) {
              reading.seaLevelPressure = fallback.seaLevelPressure;
            }
          }
        }
        if (typeof reading.temperatureC === "number") {
          reading.temperatureF = reading.temperatureC * (9 / 5) + 32;
        }
        let ozoneApplied = false;
        const temisOzone = await fetchTemisOzone(controller);
        if (typeof temisOzone === "number") {
          reading.ozone = temisOzone;
          reading.ozoneUnits = "DU";
          ozoneApplied = true;
        }
        if (!ozoneApplied) {
          const temisFallback = await fetchOpenMeteoAirQuality(controller);
          if (typeof temisFallback?.ozone === "number") {
            reading.ozone = temisFallback.ozone;
            reading.ozoneUnits = temisFallback.ozoneUnits ?? "µg/m³";
            if (!reading.updated && temisFallback.updated) {
              reading.updated = temisFallback.updated;
            }
            ozoneApplied = true;
          }
        }
        if (!ozoneApplied) {
          const fallback = await ensureFallback();
          if (typeof fallback?.ozone === "number") {
            reading.ozone = fallback.ozone;
            reading.ozoneUnits = fallback.ozoneUnits ?? "DU";
          }
        }
        reading.updated ??= new Date();
        setSample(reading);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [coords.lat, coords.lon, nonce]);

  return { status, sample, error, refetch: () => setNonce((n) => n + 1) };
}

function useHistoricalTemperatureNormal(
  coords: Coordinates,
  dayKey: string,
  nonce: number
): HistoricalTempSample {
  const [state, setState] = useState<HistoricalTempSample>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const monthIndex = parseInt(dayKey.slice(5, 7), 10) - 1;
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  useEffect(() => {
    if (!dayKey || Number.isNaN(monthIndex)) return;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setState({ status: "loading" });

    const fetchWithProxy = async (url: string) => {
      const attempt = async (target: string) => {
        const resp = await fetch(target, { signal: controller.signal, headers: { Accept: "application/json" } });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      };
      try {
        return await attempt(url);
      } catch (err) {
        if (controller.signal.aborted) throw err;
        return attempt(`${CORS_PROXY}${url}`);
      }
    };

    const fetchOpenMeteoDaily = async () => {
      const start = new Date(Date.UTC(HISTORICAL_START_YEAR, 0, 1));
      const end = new Date(`${dayKey}T00:00:00Z`);
      const monthDay = dayKey.slice(5, 10);
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${coords.lat.toFixed(
        4
      )}&longitude=${coords.lon.toFixed(
        4
      )}&start_date=${start.toISOString().slice(0, 10)}&end_date=${end
        .toISOString()
        .slice(0, 10)}&daily=temperature_2m_mean&timezone=UTC`;
      const json = await fetchWithProxy(url);
      const times: string[] = json?.daily?.time ?? [];
      const temps: Array<number | null> = json?.daily?.temperature_2m_mean ?? [];
      let sum = 0;
      let count = 0;
      for (let i = 0; i < times.length; i++) {
        if (times[i]?.slice(5, 10) === monthDay) {
          const val = temps[i];
          if (typeof val === "number" && Number.isFinite(val)) {
            sum += val;
            count += 1;
          }
        }
      }
      if (count === 0) throw new Error("No historical data");
      const avgC = sum / count;
      return { avgC, source: "Open-Meteo Climatology" };
    };

    (async () => {
      try {
        const monthKey = monthNames[Math.max(0, Math.min(monthNames.length - 1, monthIndex))];
        const nasaUrl = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M&community=RE&longitude=${coords.lon.toFixed(
          2
        )}&latitude=${coords.lat.toFixed(2)}&start=19810101&end=20101231&format=JSON`;
        let avgC: number | undefined;
        try {
          const nasaJson = await fetchWithProxy(nasaUrl);
          avgC = nasaJson?.properties?.parameter?.T2M?.[monthKey];
        } catch (nasaErr) {
          if (controller.signal.aborted) return;
          console.warn("NASA POWER climatology fetch failed", nasaErr);
        }

        let source = "NASA POWER (1981–2010 monthly mean)";
        if (typeof avgC !== "number" || !Number.isFinite(avgC)) {
          const fallback = await fetchOpenMeteoDaily();
          avgC = fallback.avgC;
          source = fallback.source;
        }

        if (typeof avgC !== "number" || !Number.isFinite(avgC)) throw new Error("No climatology data");

        setState({
          status: "ready",
          avgC,
          avgF: avgC * (9 / 5) + 32,
          source,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return () => controller.abort();
  }, [coords.lat, coords.lon, dayKey, nonce, monthIndex]);

  return state;
}

// Alice font loader + PWA (manifest + SW) registration
function useAliceAndPWA() {
  useEffect(() => {
    // Alice font
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Alice&display=swap";
    document.head.appendChild(link);

    // Manifest via Blob
    const manifest = {
      name: "AUT — Alastizen Universal Time",
      short_name: "AUT",
      start_url: ".",
      display: "standalone",
      background_color: "#0a0a0a",
      theme_color: "#16a34a",
      icons: [
        {
          src: "/icons/aut-icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/aut-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/aut-icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    };
    const manifestBlob = new Blob([JSON.stringify(manifest)], {
      type: "application/json",
    });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    const mlink = document.createElement("link");
    mlink.rel = "manifest";
    mlink.href = manifestUrl;
    document.head.appendChild(mlink);

    // Minimal service worker via Blob (pass-through + immediate claim)
    if ("serviceWorker" in navigator) {
      const swCode =
        "self.addEventListener('install', e => { self.skipWaiting(); });\n" +
        "self.addEventListener('activate', e => { self.clients.claim(); });\n" +
        "self.addEventListener('fetch', e => { /* passthrough */ });";
      const swBlob = new Blob([swCode], { type: "text/javascript" });
      const swUrl = URL.createObjectURL(swBlob);
      navigator.serviceWorker.register(swUrl).catch(() => {});
    }
  }, []);
}

// Ray windows: 12 windows across 24 AUT hours (2h each)
const RAY_WINDOWS: RayWindow[] = [
  { name: "Red", start: 0, end: 2, color: "#ef4444" },
  { name: "Orange", start: 2, end: 4, color: "#f97316" },
  { name: "Yellow", start: 4, end: 6, color: "#facc15", labelColor: "#f8fafc" },
  { name: "Green", start: 6, end: 8, color: "#22c55e" },
  { name: "Turquoise", start: 8, end: 10, color: "#2dd4bf" },
  { name: "Blue", start: 10, end: 12, color: "#3b82f6" },
  { name: "Indigo", start: 12, end: 14, color: "#6366f1" },
  { name: "Violet", start: 14, end: 16, color: "#8b5cf6" },
  { name: "Magenta", start: 16, end: 18, color: "#d946ef" },
  { name: "Omni", start: 18, end: 20, color: "#fafafa", labelColor: "#f8fafc" },
  { name: "Crystalline-Carbon", start: 20, end: 22, color: "#a5f3fc", labelColor: "#f8fafc" },
  { name: "Infinite of ALL", start: 22, end: 24, color: "#7dd3fc", labelColor: "#f8fafc" },
];

// Rays of the Week — two 12-hour cycles per day, flowing Saturday → Friday
const WEEK_RAY_DAY_ORDER = [6, 0, 1, 2, 3, 4, 5]; // Saturday first
const WEEK_RAY_TOP_INDEX = 0; // Place Saturday cycle 1 at 12 o'clock
const WEEK_RAY_SEQUENCE_LABELS = [
  "0-1",
  "1-2",
  "2-3",
  "3-4",
  "4-5",
  "5-6",
  "6-7",
  "7-8",
  "8-9",
  "9-10",
  "10-11",
  "11-12",
];

function toLocalISODate(date: Date): string {
  const dt = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return dt.toISOString().slice(0, 10);
}
const WEEK_RAY_CYCLES: WeeklyRayCycle[] = [
  {
    id: "sat-c1",
    dayIndex: 6,
    dayLabel: "Saturday",
    dayAbbrev: "Sat",
    cycle: 1,
    name: "Carbon Red",
    code: "CR",
    description: "Emerging Carbon (black hue) into Red (CR) opens Saturday.",
    color: "#0f0a0a",
    labelColor: "#f8fafc",
  },
  {
    id: "sat-c2",
    dayIndex: 6,
    dayLabel: "Saturday",
    dayAbbrev: "Sat",
    cycle: 2,
    name: "True Red",
    code: "RR",
    description: "True Red (RR) carries the second Saturday cycle.",
    color: "#e02828",
  },
  {
    id: "sun-c1",
    dayIndex: 0,
    dayLabel: "Sunday",
    dayAbbrev: "Sun",
    cycle: 1,
    name: "Red Orange",
    code: "OR",
    description: "Red Orange (OR) opens Sunday with a red-forward glow.",
    color: "#e14b2b",
  },
  {
    id: "sun-c2",
    dayIndex: 0,
    dayLabel: "Sunday",
    dayAbbrev: "Sun",
    cycle: 2,
    name: "True Orange",
    code: "OO",
    description: "True Orange (OO) completes Sunday.",
    color: "#f3741c",
  },
  {
    id: "mon-c1",
    dayIndex: 1,
    dayLabel: "Monday",
    dayAbbrev: "Mon",
    cycle: 1,
    name: "True Yellow",
    code: "YY",
    description: "True Yellow (YY) leads Monday morning.",
    color: "#facc15",
  },
  {
    id: "mon-c2",
    dayIndex: 1,
    dayLabel: "Monday",
    dayAbbrev: "Mon",
    cycle: 2,
    name: "Yellow Green",
    code: "YG",
    description: "Yellow Green (YG) hues Monday evening.",
    color: "#a3e635",
  },
  {
    id: "tue-c1",
    dayIndex: 2,
    dayLabel: "Tuesday",
    dayAbbrev: "Tue",
    cycle: 1,
    name: "True Green",
    code: "GG",
    description: "True Green (GG) anchors Tuesday's first cycle.",
    color: "#22c55e",
  },
  {
    id: "tue-c2",
    dayIndex: 2,
    dayLabel: "Tuesday",
    dayAbbrev: "Tue",
    cycle: 2,
    name: "True Green",
    code: "GG",
    description: "True Green (GG) repeats for Tuesday's second cycle.",
    color: "#16a34a",
  },
  {
    id: "wed-c1",
    dayIndex: 3,
    dayLabel: "Wednesday",
    dayAbbrev: "Wed",
    cycle: 1,
    name: "Green Turquoise Blue",
    code: "GTB",
    description: "Green Turquoise Blue (GTB) ushers in Wednesday.",
    color: "#14b8a6",
  },
  {
    id: "wed-c2",
    dayIndex: 3,
    dayLabel: "Wednesday",
    dayAbbrev: "Wed",
    cycle: 2,
    name: "Turquoise Blue",
    code: "TB",
    description: "Turquoise Blue carries Wednesday's second arc.",
    color: "#0ea5e9",
  },
  {
    id: "thu-c1",
    dayIndex: 4,
    dayLabel: "Thursday",
    dayAbbrev: "Thu",
    cycle: 1,
    name: "Blue Indigo",
    code: "BI",
    description: "Blue Indigo (BI) sets the tone for Thursday.",
    color: "#2563eb",
  },
  {
    id: "thu-c2",
    dayIndex: 4,
    dayLabel: "Thursday",
    dayAbbrev: "Thu",
    cycle: 2,
    name: "Indigo Violet",
    code: "IV",
    description: "Indigo Violet (IV) deepens Thursday night.",
    color: "#6d28d9",
  },
  {
    id: "fri-c1",
    dayIndex: 5,
    dayLabel: "Friday",
    dayAbbrev: "Fri",
    cycle: 1,
    name: "Violet Magenta",
    code: "VM",
    description: "Violet Magenta (VM) opens Friday.",
    color: "#c026d3",
  },
  {
    id: "fri-c2",
    dayIndex: 5,
    dayLabel: "Friday",
    dayAbbrev: "Fri",
    cycle: 2,
    name: "Magenta to Omni",
    code: "MO",
    description: "Magenta to Omni (White) closes the weekly ray wheel.",
    color: "#f5e1ff",
    labelColor: "#0f172a",
  },
];

const WEEK_RAY_READINGS: Record<string, WeekRayReading> = {
  "sat-c1": {
    title: "Cycle 1 — Carbon Red (CR)",
    body:
      "Primordial grounding: the deep “root of roots.” This current stabilizes the nervous system, fortifies boundaries, and anchors choices into the body. Excellent for safety rituals, practical steps, and devotion to embodied integrity.",
  },
  "sat-c2": {
    title: "Cycle 2 — True Red (RR)",
    body:
      "Vital force, courage, and momentum. This current amplifies action, movement, and survival-to-thrive power. Great for workouts, decisive conversations, protection work, and reclaiming personal sovereignty.",
  },
  "sun-c1": {
    title: "Cycle 1 — Red Orange (OR)",
    body:
      "Desire meets devotion. This current stirs creativity through the body—sensuality, play, inspiration, and magnetic confidence. Powerful for art-making, social warmth, and transmuting intensity into creation.",
  },
  "sun-c2": {
    title: "Cycle 2 — True Orange (OO)",
    body:
      "Joyful flow, emotional alchemy, and pleasure with presence. This current supports healing through expression—dance, voice, intimacy with life, and inner-child reconnection. Great for letting the heart laugh and the spirit glow.",
  },
  "mon-c1": {
    title: "Cycle 1 — True Yellow (YY)",
    body:
      "Clarity, will, and empowered focus. This current strengthens decision-making, self-respect, and clean direction. Perfect for planning, leadership, money moves, and aligning daily structure with purpose.",
  },
  "mon-c2": {
    title: "Cycle 2 — Yellow Green (YG)",
    body:
      "Heart-mind coherence: wisdom that grows through kindness. This current supports collaboration, forgiveness, learning, and gentle evolution. Great for community building, relationship healing, and creating sustainable rhythms.",
  },
  "tue-c1": {
    title: "Cycle 1 — True Green (GG)",
    body:
      "Abundance in motion. This current expands manifestation through gratitude, generosity, and grounded optimism. Ideal for building offers, tending home and body, nurturing friendships, and letting prosperity feel safe.",
  },
  "tue-c2": {
    title: "Cycle 2 — True Green (GG)",
    body:
      "Deep-rooted growth: maturity, stamina, and long-game blessings. This current supports discipline that feels loving, steady devotion, and projects that want longevity. Perfect for systems, savings, health routines, and tending what matters most.",
  },
  "wed-c1": {
    title: "Cycle 1 — Green Turquoise Blue (GTB)",
    body:
      "Heart-to-voice bridge. This current helps feelings become language, art, and honest expression. Powerful for poetry, healing conversations, creative communication, and speaking truth with tenderness.",
  },
  "wed-c2": {
    title: "Cycle 2 — Turquoise Blue (TB)",
    body:
      "Flow-state communication and cleansing clarity. This current supports emotional release through water, breath, and sound—tears as medicine, laughter as liberation, voice as channel. Great for writing, sharing, singing, and ocean-minded recalibration.",
  },
  "thu-c1": {
    title: "Cycle 1 — Blue Indigo (BI)",
    body:
      "Truth with depth. This current sharpens discernment, integrity, and clear boundaries in communication. Great for study, research, proposals, accountability, and saying what you mean with clean energetic posture.",
  },
  "thu-c2": {
    title: "Cycle 2 — Indigo Violet (IV)",
    body:
      "Vision opens into mystic knowing. This current supports dreams, intuition, symbols, and spiritual study—messages through synchronicities, ritual, and inner sight. Perfect for divination, shadow integration, and receiving lucid guidance.",
  },
  "fri-c1": {
    title: "Cycle 1 — Violet Magenta (VM)",
    body:
      "Transmutation through love. This current elevates artistry, forgiveness, and spiritual glamour—beauty as blessing, devotion as power. Great for ceremonies, performance, sacred aesthetics, and letting the soul shine outward.",
  },
  "fri-c2": {
    title: "Cycle 2 — Magenta to Omni (MO)",
    body:
      "Integration, completion, and unity. This current gathers the week’s lessons into wholeness—restoration, blessing, and gentle expansion into the wider field. Beautiful for gratitude, closure rituals, healing baths, and calling in the next cycle with reverence.",
  },
};

const RAY_READINGS: Record<string, RayReading> = {
  "Crystalline-Carbon": {
    title: "Crystalline Carbon",
    core: "Ancient remembrance + crystalline-clarity.",
    gifts: "Stability, deep nervous-system settling, “truth in the bones,” clean energetic containment.",
    ideal: "Grounding, boundaries, decluttering, closing loops, body care, sacred minimalism.",
    affirmation: "I hold the pattern that holds me.",
  },
  "Infinite of ALL": {
    title: "Infinite of ALL",
    core: "Cosmogenesis + vast permission.",
    gifts: "Unity-awareness, timeline softening, synchronicity threads revealing themselves.",
    ideal: "Prayer, big vision downloads, blessings, wide-angle perspective, sacred surrender.",
    affirmation: "ALL-ways lead back to our Heartlight.",
  },
  Red: {
    title: "Red",
    core: "Embodiment + sovereignty.",
    gifts: "Courage, protection, stamina, decisive movement, life-force ignition.",
    ideal: "Action steps, workouts, survival-to-thrive power, claiming space.",
    affirmation: "I choose. I move. I live.",
  },
  Orange: {
    title: "Orange",
    core: "Joy + creative lifeblood.",
    gifts: "Play, sensual alchemy, emotional flow, art through the body.",
    ideal: "Creating, dancing, connecting, pleasure with presence, inner-child medicine.",
    affirmation: "My joy creates worlds.",
  },
  Yellow: {
    title: "Yellow",
    core: "Clarity + empowered will.",
    gifts: "Focus, leadership, confidence, clean direction, radiant self-respect.",
    ideal: "Plans, money moves, structure, decisions, speaking with authority.",
    affirmation: "My will blesses my path.",
  },
  Green: {
    title: "Green",
    core: "Manifestation + heart ecology.",
    gifts: "Abundance, growth, devotion, nourishment, relational harmony.",
    ideal: "Building long-term, tending home/body, community weaving, prosperity rituals.",
    affirmation: "What I nurture, flourishes.",
  },
  Turquoise: {
    title: "Turquoise",
    core: "Flow + heart-to-voice bridge.",
    gifts: "Emotional clarity, gentle truth, soothing communication, cleansing movement.",
    ideal: "Writing, sharing, water rituals, breathwork, compassionate conversations.",
    affirmation: "My voice flows from my heart.",
  },
  Blue: {
    title: "Blue",
    core: "Truth + integrity.",
    gifts: "Discernment, precision, boundaries in speech, calm strength.",
    ideal: "Study, proposals, commitments, honest conversations, clean alignment.",
    affirmation: "I speak what is real.",
  },
  Indigo: {
    title: "Indigo",
    core: "Dreams + inner sight.",
    gifts: "Intuition, symbolism, lucid knowing, subconscious communication, sacred pattern recognition.",
    ideal: "Dreamwork, divination, ritual study, shadow integration, receiving messages.",
    affirmation: "My dreams guide my becoming.",
  },
  Violet: {
    title: "Violet",
    core: "Transmutation + higher harmony.",
    gifts: "Spiritual refinement, energetic cleansing, ceremony, artistry as blessing.",
    ideal: "Altar work, prayer, forgiveness, energetic upgrades, devotion to beauty.",
    affirmation: "I transmute through love.",
  },
  Magenta: {
    title: "Magenta",
    core: "Red life-force rising + Violet spirit descending, meeting in the Heart and ascending as sovereign love.",
    gifts:
      "Transmutation of desire into devotion • Magnetic authenticity • Heart-wings (love with altitude) • Embodied spirituality through voice, art, and aligned boundaries.",
    ideal:
      "Heart-led creation • Sacred sensuality • Relationship healing through truth • Broadcasting your message • Choosing boundaries that protect joy • Rituals that turn intensity into beauty.",
    affirmation: "My Heartlight is the bridge.",
  },
  Omni: {
    title: "Omni",
    core: "Integration + completion.",
    gifts: "Wholeness, synthesis, embodied peace, quiet mastery, sacred closure.",
    ideal: "Endings, gratitude, integration, restorative stillness, blessing the next cycle.",
    affirmation: "I am whole. I am ready.",
  },
};

const TOP_RAY_INDEX = (() => {
  const idx = RAY_WINDOWS.findIndex((r) => r.name === "Infinite of ALL");
  return idx === -1 ? 0 : idx;
})();

// Helper: robust ray-index selection with modulo wrap & FP tolerance
function rayIndexForAUT(hours: number): number {
  const eps = 1e-9;
  const hRaw = Number.isFinite(hours) ? Number(hours) : 0;
  // Wrap  …,-1→23 , 24→0 . At exactly 24h we treat as 0h of the new cycle.
  const h = ((hRaw % 24) + 24) % 24;
  for (let i = 0; i < RAY_WINDOWS.length; i++) {
    const r = RAY_WINDOWS[i];
    const start = r.start - eps;
    const end = r.end - eps; // make upper bound a hair inside to avoid double-hit at boundaries
    if (h >= start && h < end) return i;
  }
  return 0; // fallback
}

// Rays of the Week (preview) — use civil/local time so the flow matches local day boundaries.
function weekRayIndexForDateLocal(now: Date): number {
  const day = now.getDay();
  const dayOrderIndex = WEEK_RAY_DAY_ORDER.indexOf(day);
  if (dayOrderIndex === -1) return 0;
  const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const cycleOffset = hours >= 12 ? 1 : 0;
  return dayOrderIndex * 2 + cycleOffset;
}

function SecretLarbSanctum({
  onClose,
  activeRayWindow,
  activeLarbRayId,
  rayProgressPct,
  rayWindowTimes,
  autClock,
  remainingMinutes,
}: SecretLarbSanctumProps) {
  const [selectedRayIds, setSelectedRayIds] = useState<LarbRayId[]>(() =>
    buildInitialLarbChord(activeLarbRayId)
  );
  const [eyeSettings, setEyeSettings] = useState<LarbEyeSettings>({
    shape: "round",
    glow: 68,
    shimmer: 46,
    staticCharge: 35,
  });
  const [savedArchetypes, setSavedArchetypes] = useState<LarbArchetype[]>(() =>
    readSavedLarbArchetypes()
  );
  const [archetypeName, setArchetypeName] = useState("");
  const [orbs, setOrbs] = useState<LarbOrbState[]>(() =>
    Array.from({ length: LARB_TOTAL_ORBS }, (_, idx) => createOrbState(idx))
  );
  const [clusterOffset, setClusterOffset] = useState<LarbClusterOffset>({ x: 0, y: 0 });
  const clusterOffsetRef = useRef(clusterOffset);
  const clusterRef = useRef<HTMLDivElement | null>(null);
  const [clusterSize, setClusterSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [pointerSnapshot, setPointerSnapshot] = useState<{ x: number; y: number } | null>(
    null
  );
  const dragStateRef = useRef<{
    mode: "cluster" | "orb" | null;
    pointerId: number | null;
    startX: number;
    startY: number;
    rect: DOMRect | null;
    originOffset: LarbClusterOffset;
    orbId?: string;
    startLocalX?: number;
    startLocalY?: number;
    moved: boolean;
  }>({
    mode: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    rect: null,
    originOffset: { x: 0, y: 0 },
    moved: false,
  });
  const [bubble, setBubble] = useState<{ id: number; text: string } | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    clusterOffsetRef.current = clusterOffset;
  }, [clusterOffset]);

  useEffect(() => {
    persistLarbArchetypes(savedArchetypes);
  }, [savedArchetypes]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current) {
        window.clearTimeout(bubbleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!clusterRef.current) return;
    const updateSize = () => {
      const rect = clusterRef.current?.getBoundingClientRect();
      if (rect) {
        setClusterSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(clusterRef.current);
    window.addEventListener("resize", updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const rect = clusterRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        setPointerSnapshot({ x, y });
      } else {
        setPointerSnapshot(null);
      }
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  const chordPalette = selectedRayIds.reduce<string[]>((acc, id) => {
    const color = LARB_RAY_LOOKUP[id]?.color;
    if (color) acc.push(color);
    return acc;
  }, []);
  const fallbackPalette = ["#c084fc", "#38bdf8", "#34d399"];
  const auraPalette = chordPalette.length > 0 ? chordPalette : fallbackPalette;
  const sliderAccentComposite = averageHexColor(chordPalette, fallbackPalette[0]);
  const auraGradient = `radial-gradient(circle at 50% 20%, ${auraPalette
    .map((color, idx) => `${color} ${Math.min(95, 18 + idx * 28)}%`)
    .join(", ")})`;
  const sliderAccent = sliderAccentComposite ?? auraPalette[0] ?? activeRayWindow?.color ?? "#c084fc";
  const activeLarbRay = activeLarbRayId ? LARB_RAY_LOOKUP[activeLarbRayId] : undefined;
  const resonanceScore = computeResonanceScore(selectedRayIds, activeLarbRayId, eyeSettings);
  const chordLabel = describeChord(selectedRayIds);
  const minutesLabel =
    remainingMinutes >= 1
      ? `${Math.round(remainingMinutes)} min remaining`
      : "Moments until the next window";
  const canSave = selectedRayIds.length > 0;
  const energySynced = activeLarbRayId ? selectedRayIds.includes(activeLarbRayId) : false;
  const eyeColorPrimary = auraPalette[0] ?? sliderAccent;
  const eyeColorSecondary = auraPalette[1] ?? eyeColorPrimary;
  const glowRadius = 8 + (eyeSettings.glow / 100) * 22;
  const shimmerRadius = 4 + (eyeSettings.shimmer / 100) * 18;
  const clusterCenter = useMemo(
    () => ({
      x: LARB_CLUSTER_BASE.x + clusterOffset.x,
      y: LARB_CLUSTER_BASE.y + clusterOffset.y,
    }),
    [clusterOffset]
  );

  const bubbleMessages = useMemo(() => {
    const pool: string[] = [];
    if (activeLarbRay?.mantra) pool.push(activeLarbRay.mantra);
    if (activeRayWindow?.name) {
      pool.push(`${activeRayWindow.name} window humming at ${rayProgressPct}%`);
      if (activeLarbRay?.virtue) {
        pool.push(`${activeLarbRay.virtue} ripples through this chord.`);
      }
      pool.push(minutesLabel);
    }
    if (chordLabel) pool.push(`Chord weaving: ${chordLabel}`);
    pool.push(`Resonance steady at ${resonanceScore}%.`);
    return pool.filter((text) => text && text.trim().length > 0);
  }, [
    activeLarbRay?.mantra,
    activeLarbRay?.virtue,
    activeRayWindow?.name,
    chordLabel,
    minutesLabel,
    resonanceScore,
    rayProgressPct,
  ]);

  const maybeShowBubble = useCallback(() => {
    if (Math.random() < 0.45) return;
    if (!bubbleMessages.length) return;
    const choice = bubbleMessages[Math.floor(Math.random() * bubbleMessages.length)];
    setBubble({ id: Date.now(), text: choice });
    if (bubbleTimerRef.current) {
      window.clearTimeout(bubbleTimerRef.current);
    }
    bubbleTimerRef.current = window.setTimeout(() => setBubble(null), 6000);
  }, [bubbleMessages]);

  const resetDragState = () => {
    dragStateRef.current = {
      mode: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      rect: null,
      originOffset: clusterOffsetRef.current,
      moved: false,
    };
  };

  const handleOrbTap = useCallback(
    (orbId: string) => {
      setOrbs((prev) => {
        const target = prev.find((orb) => orb.id === orbId);
        if (!target) return prev;
        const updated = randomizeOrbPosition(target);
        const partnerBand =
          target.kind === "eye"
            ? target.band === LARB_EYE_INDICES[0]
              ? LARB_EYE_INDICES[1]
              : LARB_EYE_INDICES[0]
            : null;
        const partnerAngle =
          partnerBand !== null
            ? Math.atan2(Math.sin(updated.angle), -Math.cos(updated.angle))
            : null;
        return prev.map((orb) => {
          if (orb.id === orbId) return updated;
          if (partnerBand !== null && orb.band === partnerBand && partnerAngle !== null) {
            return { ...orb, angle: partnerAngle, radius: updated.radius };
          }
          return orb;
        });
      });
      setClusterOffset((prev) =>
        clampClusterOffset({
          x: prev.x + (Math.random() - 0.5) * 2,
          y: prev.y + (Math.random() - 0.5) * 1.4,
        })
      );
      maybeShowBubble();
    },
    [maybeShowBubble]
  );

  const handleClusterPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement | null)?.dataset?.orbId) return;
    const rect = clusterRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      mode: "cluster",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rect,
      originOffset: clusterOffsetRef.current,
      moved: false,
    };
  };

  const handleClusterPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.mode !== "cluster" || drag.pointerId !== event.pointerId || !drag.rect) return;
    const dxPercent = ((event.clientX - drag.startX) / drag.rect.width) * 100;
    const dyPercent = ((event.clientY - drag.startY) / drag.rect.height) * 100;
    if (Math.abs(dxPercent) > 0.4 || Math.abs(dyPercent) > 0.4) {
      drag.moved = true;
    }
    setClusterOffset(
      clampClusterOffset({
        x: drag.originOffset.x + dxPercent,
        y: drag.originOffset.y + dyPercent,
      })
    );
  };

  const handleClusterPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.mode !== "cluster" || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.moved) {
      maybeShowBubble();
    }
    resetDragState();
  };

  const handleClusterPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.mode !== "cluster" || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    resetDragState();
  };

  const handleOrbPointerDown = (orbId: string) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = clusterRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = ((event.clientX - rect.left) / rect.width) * 100;
    const localY = ((event.clientY - rect.top) / rect.height) * 100;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      mode: "orb",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rect,
      originOffset: clusterOffsetRef.current,
      orbId,
      startLocalX: localX,
      startLocalY: localY,
      moved: false,
    };
  };

  const handleOrbPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.mode !== "orb" || drag.pointerId !== event.pointerId || !drag.rect || !drag.orbId) return;
    const activeOrb = orbs.find((orb) => orb.id === drag.orbId);
    if (!activeOrb) return;
    const localX = ((event.clientX - drag.rect.left) / drag.rect.width) * 100;
    const localY = ((event.clientY - drag.rect.top) / drag.rect.height) * 100;
    const center = {
      x: LARB_CLUSTER_BASE.x + clusterOffsetRef.current.x,
      y: LARB_CLUSTER_BASE.y + clusterOffsetRef.current.y,
    };
    const dx = localX - center.x;
    const yScale = activeOrb.kind === "head" ? 0.4 : activeOrb.kind === "eye" ? 0.55 : LARB_CLUSTER_Y_SCALE;
    const dy = (localY - center.y) / yScale;
    const radius = Math.sqrt(dx * dx + dy * dy);
    if (!drag.moved) {
      drag.moved =
        Math.abs(localX - (drag.startLocalX ?? localX)) > 0.5 ||
        Math.abs(localY - (drag.startLocalY ?? localY)) > 0.5;
    }
    const newAngle = Math.atan2(dy, dx);
    const minRadius = activeOrb.kind === "head" ? 4 : activeOrb.kind === "eye" ? 10 : 16;
    const maxRadius = activeOrb.kind === "head" ? 14 : activeOrb.kind === "eye" ? 26 : 48;
    const newRadius = clamp(radius, minRadius, maxRadius);
    const partnerBand =
      activeOrb.kind === "eye"
        ? activeOrb.band === LARB_EYE_INDICES[0]
          ? LARB_EYE_INDICES[1]
          : LARB_EYE_INDICES[0]
        : null;
    const partnerAngle = partnerBand !== null ? Math.atan2(dy, -dx) : null;
    setOrbs((prev) =>
      prev.map((orb) => {
        if (orb.id === drag.orbId) {
          return { ...orb, angle: newAngle, radius: newRadius };
        }
        if (partnerBand !== null && orb.band === partnerBand && partnerAngle !== null) {
          return { ...orb, angle: partnerAngle, radius: newRadius };
        }
        return orb;
      })
    );
    setClusterOffset((prev) =>
      clampClusterOffset({
        x: prev.x + dx * 0.01,
        y: prev.y + (localY - center.y) * 0.006,
      })
    );
  };

  const handleOrbPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.mode !== "orb" || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.moved && drag.orbId) {
      handleOrbTap(drag.orbId);
    }
    resetDragState();
  };

  const handleOrbPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.mode !== "orb" || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    resetDragState();
  };

  const handleClusterKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      maybeShowBubble();
    }
  };

  const staticChargeScale = eyeSettings.staticCharge / 100;
  const staticHaloColor = hexToRgba(eyeColorSecondary, 0.25 + staticChargeScale * 0.45);
  const computedOrbs = orbs.map((orb) => {
    const wobbleAngle = orb.angle + orb.wobble * 0.01;
    const yScale = orb.kind === "head" ? 0.4 : orb.kind === "eye" ? 0.55 : LARB_CLUSTER_Y_SCALE;
    const offsetX = Math.cos(wobbleAngle) * orb.radius;
    const offsetY = Math.sin(wobbleAngle) * orb.radius * yScale;
    const left = clamp(clusterCenter.x + offsetX, 3, 97);
    const top = clamp(clusterCenter.y + offsetY, 3, 97);
    const color =
      auraPalette[orb.band % auraPalette.length] ?? fallbackPalette[orb.band % fallbackPalette.length];
    return { orb, left, top, color };
  });
  const eyeOffsets = useMemo(() => {
    const width = clusterSize.width;
    const height = clusterSize.height;
    if (!width || !height)
      return {} as Record<string, { dx: number; dy: number }>;
    return computedOrbs.reduce((acc, entry) => {
      if (entry.orb.kind !== "eye") return acc;
      let dx = 0;
      let dy = 0;
      if (pointerSnapshot) {
        const centerX = (entry.left / 100) * width;
        const centerY = (entry.top / 100) * height;
        const pointerX = clamp(pointerSnapshot.x, 0, width);
        const pointerY = clamp(pointerSnapshot.y, 0, height);
        dx = pointerX - centerX;
        dy = pointerY - centerY;
        const dist = Math.hypot(dx, dy) || 1;
        const eyeballRadius = entry.orb.size / 2;
        const pupilRadius = (entry.orb.size * 0.55) / 2;
        const maxOffset = Math.max(0, eyeballRadius - pupilRadius - 3);
        const limited = Math.min(dist, maxOffset);
        dx = (dx / dist) * limited;
        dy = (dy / dist) * limited;
      }
      acc[entry.orb.id] = { dx, dy };
      return acc;
    }, {} as Record<string, { dx: number; dy: number }>);
  }, [clusterSize.height, clusterSize.width, computedOrbs, pointerSnapshot]);

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-zinc-950/95 p-4 sm:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl backdrop-blur-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-zinc-400">Secret Portal</p>
            <h2 className="text-3xl font-semibold text-white">Welcome Home, Atlastizen!</h2>
            <p className="text-sm text-zinc-300">
              Sculpt a Living Aura Ray Being — drag the auric cluster, nudge the orbs, and call for a wisdom bubble when the Ray feels ready ({autClock}).
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-white/20"
            onClick={onClose}
          >
            Exit Sanctum
          </button>
        </div>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/50 to-zinc-950/70 p-5 shadow-inner shadow-black/30 space-y-6">
              <div
                ref={clusterRef}
                className="relative h-[460px] overflow-hidden rounded-[2.25rem] border border-white/10 bg-gradient-to-b from-zinc-950/85 via-zinc-900/40 to-zinc-950/85 shadow-[0_0_90px_rgba(8,8,15,0.9)]"
                role="button"
                tabIndex={0}
            aria-label="Living Aura Ray Being"
            style={{ touchAction: "none" }}
            onPointerDown={handleClusterPointerDown}
            onPointerMove={handleClusterPointerMove}
            onPointerUp={handleClusterPointerUp}
            onPointerCancel={handleClusterPointerCancel}
            onKeyDown={handleClusterKey}
          >
            <div
              className="pointer-events-none absolute inset-10 rounded-full blur-3xl larb-aura-shell"
              style={{ background: auraGradient, opacity: 0.85 }}
            />
            <div
              className="pointer-events-none absolute inset-0 larb-gradient-sheen"
              style={{
                backgroundImage: `linear-gradient(120deg, ${hexToRgba(auraPalette[0] ?? "#a855f7", 0.22)}, transparent, ${hexToRgba(
                  auraPalette[1] ?? "#38bdf8",
                  0.22
                )})`,
              }}
            />
            {computedOrbs.map(({ orb, left, top, color }) => {
              const pupilOffset = eyeOffsets[orb.id] ?? { dx: 0, dy: 0 };
              const pupilDiameter = orb.kind === "eye" ? orb.size * 0.55 : orb.size;
              const containerStyle: CSSProperties = {
                position: "absolute",
                left: `${left}%`,
                top: `${top}%`,
                width: `${orb.size}px`,
                height: `${orb.size}px`,
                transform: "translate(-50%, -50%)",
              };
              const buttonStyle: CSSProperties = {
                position: "absolute",
                inset: 0,
                zIndex: orb.kind === "eye" ? 50 : orb.kind === "head" ? 45 : 10 + orb.band,
                borderRadius:
                  orb.kind === "eye"
                    ? eyeSettings.shape === "nova"
                      ? "42% 58% 58% 42% / 48% 52% 44% 56%"
                      : eyeSettings.shape === "crescent"
                      ? "58% 42% 70% 30% / 60% 40% 65% 35%"
                      : "50%"
                    : orb.kind === "head"
                    ? "45% 55% 60% 40% / 65% 35% 60% 40%"
                    : "9999px",
                border:
                  orb.kind === "eye"
                    ? "1px solid rgba(255,255,255,0.55)"
                    : orb.kind === "head"
                    ? "1px solid rgba(255,255,255,0.25)"
                    : "1px solid rgba(255,255,255,0.12)",
                background:
                  orb.kind === "head"
                    ? `radial-gradient(circle at 52% 30%, ${hexToRgba(
                        auraPalette[0] ?? "#f472b6",
                        0.85
                      )}, ${hexToRgba(auraPalette[auraPalette.length - 1] ?? "#38bdf8", 0.35)})`
                    : orb.kind === "eye"
                    ? `radial-gradient(circle at 40% 35%, rgba(255,255,255,0.95), ${hexToRgba(eyeColorPrimary, 0.45)})`
                    : `radial-gradient(circle, rgba(255,255,255,0.9) 0%, ${hexToRgba(color, 0.55)} 60%, transparent 85%)`,
                boxShadow:
                  orb.kind === "eye"
                    ? `0 0 ${glowRadius}px ${hexToRgba(
                        eyeColorPrimary,
                        0.35
                      )}, inset 0 0 ${shimmerRadius}px rgba(255,255,255,0.85)${
                        staticChargeScale > 0.05 ? `, 0 0 ${12 + staticChargeScale * 24}px ${staticHaloColor}` : ""
                      }`
                    : orb.kind === "head"
                    ? `0 0 60px ${hexToRgba(auraPalette[0] ?? "#f472b6", 0.3)}, inset 0 0 25px ${hexToRgba(
                        auraPalette[1] ?? "#38bdf8",
                        0.45
                      )}`
                    : `0 0 32px ${hexToRgba(color, 0.45)}`,
                filter:
                  orb.kind === "eye"
                    ? `drop-shadow(0 0 ${glowRadius / 2}px ${hexToRgba(eyeColorSecondary, 0.35)})`
                    : orb.kind === "head"
                    ? `drop-shadow(0 0 40px ${hexToRgba(auraPalette[0] ?? "#f472b6", 0.35)})`
                    : `blur(${orb.blur}px)`,
                animationDuration: `${orb.speed}s`,
              };
              return (
                <div key={orb.id} style={containerStyle}>
                  <button
                    type="button"
                    data-orb-id={orb.id}
                    className="w-full h-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    style={buttonStyle}
                    onPointerDown={handleOrbPointerDown(orb.id)}
                    onPointerMove={handleOrbPointerMove}
                    onPointerUp={handleOrbPointerUp}
                    onPointerCancel={handleOrbPointerCancel}
                    aria-label={orb.kind === "head" ? "Head orb" : orb.kind === "eye" ? "Eye orb" : "Aura orb"}
                  />
                  {orb.kind === "eye" ? (
                    <PlasmaEyeCanvas
                      id={orb.id}
                      diameter={pupilDiameter}
                      charge={eyeSettings.staticCharge}
                      primaryColor={eyeColorPrimary}
                      secondaryColor={eyeColorSecondary}
                      offsetX={pupilOffset.dx}
                      offsetY={pupilOffset.dy}
                    />
                  ) : null}
                </div>
              );
            })}
            {bubble ? (
              <div className="absolute left-5 top-5 max-w-xs rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white shadow-xl backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-200">World Bubble</p>
                <p className="mt-2 leading-relaxed text-white/90">{bubble.text}</p>
              </div>
            ) : (
              <div className="absolute left-5 top-5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/70">
                Tap or drag to coax a wisdom bubble.
              </div>
            )}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[11px] uppercase tracking-[0.28em] text-zinc-300">
              Drag anywhere or nudge an orb — they share one gravity.
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Chord</p>
              <p className="mt-2 text-sm font-semibold text-white">{chordLabel}</p>
                <p className="text-xs text-emerald-200">
                  {energySynced ? "In sync with the live Ray." : "Add the live Ray to sync energy."}
                </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Resonance</p>
                <span className="text-sm text-white">{resonanceScore}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-sky-400 to-fuchsia-400" style={{ width: `${resonanceScore}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Live Cycle</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {activeRayWindow ? activeRayWindow.name : "Awaiting Ray"}
              </p>
              <p className="text-xs text-zinc-400">{minutesLabel}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Ray Wheel</p>
                  <p className="text-sm text-zinc-300">Connect with any Rays you resonate with.</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => {
                    if (!activeLarbRayId) return;
                    setSelectedRayIds((prev) => {
                      if (prev.includes(activeLarbRayId)) return prev;
                      const next = [...prev, activeLarbRayId];
                      return next.slice(-LARB_MAX_RAY_SLOTS);
                    });
                  }}
                  disabled={!activeLarbRayId}
                >
                  Tune to Now
                </button>
              </div>
              <div className="relative mx-auto mt-6 h-64 w-64">
                <div
                  className="pointer-events-none absolute inset-[34%] rounded-full border border-white/10 bg-white/5 shadow-inner shadow-white/5"
                  aria-hidden="true"
                />
                {LARB_RAYS.map((ray, index) => {
                  const angle = (index / LARB_RAYS.length) * Math.PI * 2 - Math.PI / 2;
                  const left = 50 + 40 * Math.cos(angle);
                  const top = 50 + 40 * Math.sin(angle);
                  const isSelected = selectedRayIds.includes(ray.id);
                  return (
                    <button
                      key={ray.id}
                      type="button"
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80 shadow-lg transition focus:outline-none focus:ring-2 focus:ring-white/70 ${
                        isSelected ? "scale-110 border-white/80 bg-white/20" : "border-white/10 bg-white/10"
                      }`}
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        backgroundImage: `linear-gradient(135deg, ${hexToRgba(ray.color, 0.65)}, ${hexToRgba(ray.color, 0.3)})`,
                      }}
                      onClick={() => {
                        setSelectedRayIds((prev) => {
                          if (prev.includes(ray.id as LarbRayId)) {
                            return prev.filter((id) => id !== ray.id);
                          }
                          if (prev.length >= LARB_MAX_RAY_SLOTS) {
                            return [...prev.slice(1), ray.id as LarbRayId];
                          }
                          return [...prev, ray.id as LarbRayId];
                        });
                      }}
                      aria-pressed={isSelected}
                      aria-label={`Toggle ${ray.name}`}
                    >
                      {ray.virtue}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-4 shadow-inner shadow-white/5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-zinc-400">
                  <span>Ray Chord</span>
                  <span className="text-zinc-200">{selectedRayIds.length}/{LARB_MAX_RAY_SLOTS}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {Array.from({ length: LARB_MAX_RAY_SLOTS }, (_, idx) => selectedRayIds[idx] ?? null).map(
                    (rayId, idx) => {
                      const ray = rayId ? LARB_RAY_LOOKUP[rayId] : null;
                      return (
                        <div
                          key={`chord-slot-${idx}`}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                        >
                          <span className="text-xs uppercase tracking-[0.3em] text-zinc-400">Slot {idx + 1}</span>
                          <span className="text-sm font-medium">
                            {ray ? `${ray.name} • ${ray.virtue}` : "Open frequency"}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
                <p className="mt-2 text-xs text-emerald-200">
                  {energySynced
                    ? "In resonance with the current window."
                    : "Add the live Ray to sync energy."}
                </p>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Eye settings</p>
                <p className="text-sm text-zinc-300">The two brightest orbs act as eyes.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {LARB_EYE_MODES.map((mode) => {
                  const isActive = eyeSettings.shape === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      className={`flex-1 rounded-xl border px-3 py-2 text-left transition ${
                        isActive ? "border-white/70 bg-white/15 text-white" : "border-white/10 bg-white/5 text-zinc-300"
                      }`}
                      onClick={() => setEyeSettings((prev) => ({ ...prev, shape: mode.id }))}
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.25em]">{mode.label}</div>
                      <div className="text-[11px] text-zinc-400">{mode.detail}</div>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-3">
                <label className="flex justify-between text-xs uppercase tracking-[0.35em] text-zinc-400">
                  <span>Glow</span>
                  <span>{eyeSettings.glow}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                value={eyeSettings.glow}
                onChange={(event) =>
                  setEyeSettings((prev) => ({ ...prev, glow: Number(event.target.value) }))
                }
                className="w-full"
                style={{ accentColor: sliderAccent }}
              />
              </div>
              <div className="space-y-3">
                <label className="flex justify-between text-xs uppercase tracking-[0.35em] text-zinc-400">
                  <span>Shimmer</span>
                  <span>{eyeSettings.shimmer}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={eyeSettings.shimmer}
                  onChange={(event) =>
                    setEyeSettings((prev) => ({ ...prev, shimmer: Number(event.target.value) }))
                  }
                  className="w-full"
                  style={{ accentColor: sliderAccent }}
                />
              </div>
              <div className="space-y-3">
                <label className="flex justify-between text-xs uppercase tracking-[0.35em] text-zinc-400">
                  <span>Static Charge</span>
                  <span>{eyeSettings.staticCharge}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={eyeSettings.staticCharge}
                  onChange={(event) =>
                    setEyeSettings((prev) => ({ ...prev, staticCharge: Number(event.target.value) }))
                  }
                  className="w-full"
                  style={{ accentColor: sliderAccent }}
                />
                <p className="text-[10px] text-zinc-400">Higher charge adds static electricity around the eyes.</p>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/5">
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Archetype archive</p>
                <p className="text-sm text-zinc-300">Save this being’s chord + gaze.</p>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <input
                  type="text"
                  value={archetypeName}
                  onChange={(event) => setArchetypeName(event.target.value)}
                  placeholder="Name your Archetype"
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
                />
                <button
                  type="button"
                  className="rounded-xl border border-white/20 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => {
                    if (selectedRayIds.length === 0) return;
                    const trimmed = archetypeName.trim();
                    const name =
                      trimmed ||
                      `LARB ${new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
                    const entry: LarbArchetype = {
                      id:
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                          ? crypto.randomUUID()
                          : `larb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      name,
                      rayChord: selectedRayIds.slice(0, LARB_MAX_RAY_SLOTS),
                      eye: { ...eyeSettings },
                      savedAt: Date.now(),
                    };
                    setSavedArchetypes((prev) => [entry, ...prev].slice(0, LARB_ARCHIVE_LIMIT));
                    setArchetypeName("");
                  }}
                  disabled={!canSave}
                >
                  Save Archetype
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                {savedArchetypes.length === 0 ? (
                  <p className="text-zinc-400">No archived beings yet — your next save will appear here.</p>
                ) : (
                  savedArchetypes.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">{entry.name}</div>
                        <div className="text-[11px] text-zinc-400">
                          {describeChord(entry.rayChord)} • {new Date(entry.savedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-white/20 px-2 py-1 text-xs text-emerald-200 hover:bg-white/10"
                          onClick={() => {
                            setSelectedRayIds(entry.rayChord.slice(0, LARB_MAX_RAY_SLOTS));
                            setEyeSettings(entry.eye);
                          }}
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-white/20 px-2 py-1 text-xs text-rose-200 hover:bg-white/10"
                          onClick={() => setSavedArchetypes((prev) => prev.filter((item) => item.id !== entry.id))}
                          aria-label={`Delete ${entry.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/5">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-zinc-400">
                <span>Ray Wheel Sync</span>
                <span className="text-zinc-100">
                  {activeRayWindow ? `${activeRayWindow.name} Cycle` : "Awaiting Ray"}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-zinc-300">
                <div>
                  {rayWindowTimes
                    ? `${rayWindowTimes.start.aut} → ${rayWindowTimes.end.aut} AUT`
                    : "Timing data pending"}
                </div>
                <div className="text-xs text-zinc-400">
                  {rayWindowTimes
                    ? `${rayWindowTimes.start.local} → ${rayWindowTimes.end.local} local`
                    : "—"}
                </div>
                <div className="text-xs text-zinc-400">
                  Progress {rayProgressPct}% • {minutesLabel}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Ray telemetry</p>
                  <p className="text-sm text-zinc-300">Chord + gaze diagnostics</p>
                </div>
                <div className="text-xs text-emerald-200">
                  {energySynced ? "Synced with live Ray" : "Tune to live Ray for extra resonance"}
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Chord</div>
                  <div className="text-sm text-white">{chordLabel}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Eyes</div>
                  <div className="text-sm text-white capitalize">
                    {eyeSettings.shape} • glow {eyeSettings.glow}% • shimmer {eyeSettings.shimmer}%
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function AUTClock() {
  useAliceAndPWA();

  // Charlotte NoDa fallback
  const fallback = useMemo<Coordinates>(() => ({ lat: 35.25, lon: -80.8 }), []);
  const { coords, status, setCoords } = useGeolocation(fallback);
  const { placeLabel, placeStatus, retry } = useReverseGeocode(coords, status, FALLBACK_PLACE_LABEL);
  const [zipInput, setZipInput] = useState("");
  const [zipStatus, setZipStatus] = useState<ZipStatus>("idle");
  const [zipError, setZipError] = useState<string | null>(null);
  const zipControllerRef = useRef<AbortController | null>(null);
  const [timeZoneInfo, setTimeZoneInfo] = useState<TimeZoneInfo | null>(null);
  const [timeZoneStatus, setTimeZoneStatus] = useState<TimeZoneStatus>("idle");
  const [timeZoneError, setTimeZoneError] = useState<string | null>(null);
  const timeZoneControllerRef = useRef<AbortController | null>(null);
  const [now, setNow] = useState(new Date());
  const [compassStatus, setCompassStatus] = useState<CompassStatus>("idle");
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [compassPitch, setCompassPitch] = useState<number | null>(null);
  const [compassRoll, setCompassRoll] = useState<number | null>(null);
  const [compassAbsolute, setCompassAbsolute] = useState(false);
  const [uiTheme, setUiTheme] = useState<UITheme>(() => readStoredTheme());
  const [sparkleEnabled, setSparkleEnabled] = useState(true);
  const [atlasTone, setAtlasTone] = useState<"lux" | "umbra">("umbra");
  const [atlasHueA, setAtlasHueA] = useState("#f6c453");
  const [atlasHueB, setAtlasHueB] = useState("#b98cff");
  const [atlasHueBorder, setAtlasHueBorder] = useState("#f6c453");
  const [atlasHuePanel, setAtlasHuePanel] = useState("#0f172a");
  const [atlasHueBg, setAtlasHueBg] = useState("#0b1220");
  const [atlasHueText, setAtlasHueText] = useState("#fffbef");
  const [atlasThemeName, setAtlasThemeName] = useState("");
  const [savedAtlasThemes, setSavedAtlasThemes] = useState<
    Array<{
      id: string;
      name: string;
      tone: "lux" | "umbra";
      hueA: string;
      hueB: string;
      hueBorder: string;
      huePanel: string;
      hueBg?: string;
      hueText?: string;
    }>
  >([]);
  const [coreProfile, setCoreProfile] = useState<CoreSignatureProfile>({
    name: "",
    code: "",
    photoData: undefined,
    photoName: undefined,
    adminCes: undefined,
    updatedAt: undefined,
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passkeyStatus, setPasskeyStatus] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeySignedIn, setPasskeySignedIn] = useState(false);
  const profileSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshot = useRef<string>("");
  const refreshCoreProfileRef = useRef<(() => Promise<void>) | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>(() => {
    return [];
  });
  const [draftPost, setDraftPost] = useState<{ message: string; imageData?: string; imageName?: string }>({
    message: "",
  });
  const [postImageError, setPostImageError] = useState<string | null>(null);
  const postImageInputRef = useRef<HTMLInputElement | null>(null);
  const postFormRef = useRef<HTMLFormElement | null>(null);
  const [profileSavedAt, setProfileSavedAt] = useState<number | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [showPostRequirement, setShowPostRequirement] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<PanelId>("clock");
  const [showCoords, setShowCoords] = useState(false);
  const panelSelectId = useId();
  const themeSelectId = useId();
  const messageInputId = useId();
  const _isRetroTheme = uiTheme === "retro";
  void _isRetroTheme; // suppress unused warning; referenced in sibling panels via closure scope
  const atmosphere = useAtmosphereSnapshot(coords);
  const [climateNonce, setClimateNonce] = useState(0);
  const todayKey = useMemo(
    () => {
      const stamp = new Date(now);
      stamp.setUTCHours(0, 0, 0, 0);
      return stamp.toISOString().slice(0, 10);
    },
    [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()]
  );
  const todayDate = useMemo(() => new Date(`${todayKey}T00:00:00Z`), [todayKey]);
  const historicalTemp = useHistoricalTemperatureNormal(coords, todayKey, climateNonce);
  const [secretOpen, setSecretOpen] = useState(false);
  const secretTapRef = useRef<{
    count: number;
    last: number;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ count: 0, last: 0, timer: null });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let storedId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!storedId) {
      storedId = generateDeviceId();
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, storedId);
    }
    setDeviceId(storedId);

    const localProfileRaw = localStorage.getItem(CES_PROFILE_STORAGE_KEY);
    if (localProfileRaw) {
      try {
        const parsed = JSON.parse(localProfileRaw) as Partial<CoreSignatureProfile>;
        const localProfile: CoreSignatureProfile = {
          name: typeof parsed.name === "string" ? parsed.name : "",
          code: typeof parsed.code === "string" ? parsed.code : "",
          photoData: typeof parsed.photoData === "string" ? parsed.photoData : undefined,
          photoName: typeof parsed.photoName === "string" ? parsed.photoName : undefined,
          adminCes: typeof parsed.adminCes === "string" ? parsed.adminCes : undefined,
          updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : undefined,
        };
        setCoreProfile(localProfile);
      } catch {
        // ignore parse errors; continue with defaults
      }
    }

    // restore theme from cached profile if present
    try {
      const parsed = localProfileRaw ? (JSON.parse(localProfileRaw) as any) : null;
      if (parsed?.uiTheme && THEME_PRESETS[parsed.uiTheme as UITheme]) {
        setUiTheme(parsed.uiTheme as UITheme);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(CES_PROFILE_STORAGE_KEY, JSON.stringify(coreProfile));
    } catch {
      // ignore storage errors
    }
  }, [coreProfile]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("DeviceOrientationEvent" in window)) {
      setCompassStatus("unsupported");
    }
  }, []);

  useEffect(() => {
    return () => {
      zipControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      timeZoneControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    persistTheme(uiTheme);
    if (typeof document !== "undefined") {
      const presetBase = THEME_PRESETS[uiTheme];
      const tonePreset =
        uiTheme === "atlas"
          ? atlasTone === "lux"
            ? { ...presetBase, ...(presetBase.lux ?? {}) }
            : { ...presetBase, ...(presetBase.umbra ?? {}) }
          : presetBase;

      const preset =
        uiTheme === "atlas"
          ? (() => {
              const accentSoft = hexToRgba(atlasHueA, 0.22);
              const buttonBorder = hexToRgba(atlasHueA, 0.65);
              const inputBorder = hexToRgba(atlasHueA, 0.45);
              const panelBorder = hexToRgba(atlasHueBorder, 0.78);
              const panel = `linear-gradient(160deg, ${hexToRgba(atlasHuePanel, 0.9)}, ${hexToRgba(
                atlasHuePanel,
                0.72
              )})`;
              const background = atlasHueBg;
              const backgroundSoft = hexToRgba(atlasHueBg, 0.65);
              const baseButtonBg = tonePreset.buttonBg ?? "";
              const buttonBg = baseButtonBg
                ? baseButtonBg.replace("#f6c453", atlasHueA).replace("#b98cff", atlasHueB)
                : `linear-gradient(145deg, ${hexToRgba(atlasHueA, 0.9)}, ${hexToRgba(atlasHueB, 0.78)})`;
              const textColor = atlasHueText;
              const muted = hexToRgba(atlasHueText, 0.75);
              return {
                ...tonePreset,
                accent: atlasHueA,
                accent2: atlasHueB,
                accentSoft,
                buttonBg,
                buttonBorder,
                inputBorder,
                panel,
                background,
                backgroundSoft,
                panelBorder,
                panelShadow: tonePreset.panelShadow?.replace(/rgba\(\s*255\s*,\s*223\s*,\s*128[^)]*\)/g, hexToRgba(atlasHueBorder, 0.45)) ?? tonePreset.panelShadow,
                text: textColor,
                muted,
              };
            })()
          : tonePreset;

      const root = document.documentElement;
      root.dataset.theme = uiTheme;
      const vars: Record<string, string> = {
        "--bg": preset.background,
        "--bg-soft": preset.backgroundSoft ?? preset.background,
        "--bg-overlay": preset.backgroundOverlay ?? "none",
        "--panel": preset.panel,
        "--panel-border": preset.panelBorder,
        "--panel-shadow": preset.panelShadow,
        "--text": preset.text,
        "--muted": preset.muted,
        "--accent": preset.accent,
        "--accent-soft": preset.accentSoft,
        "--accent-2": preset.accent2,
        "--button-bg": preset.buttonBg,
        "--button-border": preset.buttonBorder,
        "--input-bg": preset.inputBg,
        "--input-border": preset.inputBorder,
        "--font-body": preset.fontFamily,
      };
      Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
      document.body.dataset.autTheme = uiTheme;
    }
  }, [uiTheme, atlasTone, atlasHueA, atlasHueB, atlasHueBorder, atlasHuePanel, atlasHueBg, atlasHueText]);


  useEffect(() => {
    return () => {
      const state = secretTapRef.current;
      if (state.timer) {
        clearTimeout(state.timer);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!secretOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [secretOpen]);

  const requestCompass = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("DeviceOrientationEvent" in window)) {
      setCompassStatus("unsupported");
      return;
    }
    const deviceOrientationEvent = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<PermissionState | "granted" | "denied" | "prompt">;
    };
    if (
      deviceOrientationEvent &&
      typeof deviceOrientationEvent.requestPermission === "function"
    ) {
      try {
        const permission = await deviceOrientationEvent.requestPermission();
        if (permission !== "granted") {
          setCompassStatus("denied");
          return;
        }
      } catch {
        setCompassStatus("denied");
        return;
      }
    }
    setCompassAbsolute(false);
    setCompassStatus("active");
  }, []);

  const handleSecretBannerClick = useCallback(() => {
    const state = secretTapRef.current;
    const nowTs = Date.now();
    if (nowTs - state.last > 900) {
      state.count = 0;
    }
    state.count += 1;
    state.last = nowTs;
    if (state.timer) {
      clearTimeout(state.timer);
    }
    state.timer = setTimeout(() => {
      secretTapRef.current.count = 0;
      secretTapRef.current.timer = null;
    }, 900);
    if (state.count >= 3) {
      setSecretOpen(true);
      state.count = 0;
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
    }
  }, []);

  const closeSecretSanctum = useCallback(() => {
    setSecretOpen(false);
  }, []);

  useEffect(() => {
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) {
      return;
    }
    timeZoneControllerRef.current?.abort();
    const controller = new AbortController();
    timeZoneControllerRef.current = controller;
    setTimeZoneStatus("loading");
    setTimeZoneError(null);

    const url = `https://timeapi.io/api/Time/current/coordinate?latitude=${coords.lat}&longitude=${coords.lon}`;

    fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Time lookup failed (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const zone: string | undefined =
          data?.timeZone ?? data?.timezone ?? data?.time_zone ?? data?.tz ?? undefined;
        const abbreviation: string | undefined =
          data?.timeZoneAbbreviation ?? data?.abbreviation ?? data?.dstName ?? undefined;

        let offsetMinutes: number | undefined;
        const localTime = data?.currentLocalTime ?? data?.dateTime ?? data?.localTime ?? null;
        const utcTime = data?.utcTime ?? data?.utcDateTime ?? data?.currentUtcTime ?? null;
        if (typeof localTime === "string" && typeof utcTime === "string") {
          const localMs = Date.parse(localTime);
          const utcMs = Date.parse(utcTime);
          if (Number.isFinite(localMs) && Number.isFinite(utcMs)) {
            offsetMinutes = Math.round((localMs - utcMs) / 60000);
          }
        } else if (typeof data?.timeZoneOffset === "number") {
          offsetMinutes = data.timeZoneOffset;
        } else if (typeof data?.utcOffset === "number") {
          offsetMinutes = data.utcOffset;
        }

        if (!zone) {
          throw new Error("Time zone unavailable for these coordinates.");
        }

        setTimeZoneInfo({ timeZone: zone, abbreviation, offsetMinutes });
        setTimeZoneStatus("success");
        setTimeZoneError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setTimeZoneStatus("error");
        setTimeZoneError(err instanceof Error ? err.message : "Time zone lookup failed.");
        setTimeZoneInfo(null);
      });
  }, [coords.lat, coords.lon]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (compassStatus !== "active") return;

    const handler = (
      event: DeviceOrientationEvent & {
        webkitCompassHeading?: number;
        webkitCompassAccuracy?: number;
      }
    ) => {
      if (typeof event.webkitCompassHeading === "number" && !Number.isNaN(event.webkitCompassHeading)) {
        setCompassHeading(normalizeDegrees(event.webkitCompassHeading));
        setCompassAbsolute(true);
      } else if (event.absolute && typeof event.alpha === "number" && !Number.isNaN(event.alpha)) {
        setCompassHeading(normalizeDegrees(360 - event.alpha));
        setCompassAbsolute(true);
      } else if (typeof event.alpha === "number" && !Number.isNaN(event.alpha)) {
        setCompassHeading(normalizeDegrees(360 - event.alpha));
        setCompassAbsolute(false);
      }

      if (typeof event.beta === "number" && !Number.isNaN(event.beta)) {
        setCompassPitch(event.beta);
      }
      if (typeof event.gamma === "number" && !Number.isNaN(event.gamma)) {
        setCompassRoll(event.gamma);
      }
    };

    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, [compassStatus]);

  const data = useMemo<AUTResult>(
    () => computeAUT(now, coords.lat, coords.lon),
    [now, coords]
  );
  const sol = useMemo(() => {
    try {
      return SolRuntime.now(coords.lat, coords.lon, now);
    } catch {
      return null;
    }
  }, [coords.lat, coords.lon, now]);
  const luna = useMemo(() => {
    try {
      return LunaRuntime.now(coords.lat, coords.lon, now);
    } catch {
      return null;
    }
  }, [coords.lat, coords.lon, now]);
  const solArc = useMemo(() => buildHorizonArc(sol?.track ?? [], now), [sol, now]);
  const moonArc = useMemo(() => buildHorizonArc(luna?.tonight ?? [], now), [luna, now]);
  const pct = Math.max(0, Math.min(100, Math.round(data.progress * 100)));
  void pct; // suppress unused warning; may be used in future panels

  const locationTimeZoneId = timeZoneInfo?.timeZone;
  const { formatShortTime, formatLongTime, formatDate } = useMemo(() => {
    if (locationTimeZoneId) {
      const shortFmt = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: locationTimeZoneId,
      });
      const longFmt = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: locationTimeZoneId,
      });
      const dateFmt = new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: locationTimeZoneId,
      });
      return {
        formatShortTime: (date: Date) => shortFmt.format(date),
        formatLongTime: (date: Date) => longFmt.format(date),
        formatDate: (date: Date) => dateFmt.format(date),
      };
    }
    return {
      formatShortTime: (date: Date) =>
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      formatLongTime: (date: Date) =>
        date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      formatDate: (date: Date) =>
        date.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" }),
    };
  }, [locationTimeZoneId]);
  const formatSolTime = (date?: Date) => (date ? formatShortTime(date) : "—");
  const formatMoonTime = (date?: Date) => (date ? formatShortTime(date) : "—");
  const autDateLabel = formatDate(data.sunriseLocal);
  const localDateLabel = formatDate(now);
  const autEarthSolarCycles = useMemo(() => {
    const yearsSinceEarthFormation = EARTH_FORMATION_YEARS_AGO;
    const cycles = Math.floor(yearsSinceEarthFormation); // one orbit per Earth year
    return cycles.toLocaleString("en-US");
  }, []);
  const autLunarCycles = useMemo(() => {
    const daysSinceMoonFormation = MOON_FORMATION_YEARS_AGO * DAYS_PER_YEAR_APPROX;
    const cycles = Math.floor(daysSinceMoonFormation / SYNODIC_MONTH_DAYS);
    return cycles.toLocaleString("en-US");
  }, []);
  const solDeclStr = sol ? `${sol.decDeg >= 0 ? "+" : ""}${sol.decDeg.toFixed(2)}°` : "—";
  const solAltStr = sol ? `${sol.altDeg >= 0 ? "+" : ""}${sol.altDeg.toFixed(1)}°` : "—";
  const solAzStr = sol ? `${sol.azDeg.toFixed(1)}°` : "—";
  const solRiseLocal = formatSolTime(sol?.rise);
  const solTransitLocal = formatSolTime(sol?.transit);
  const solSetLocal = formatSolTime(sol?.set);
  const solTransitAltStr =
    typeof sol?.transitAltDeg === "number" ? `${sol.transitAltDeg.toFixed(1)}°` : "—";
  const moonDeclStr = luna ? `${luna.decDeg >= 0 ? "+" : ""}${luna.decDeg.toFixed(2)}°` : "—";
  const moonAltStr = luna ? `${luna.altDeg >= 0 ? "+" : ""}${luna.altDeg.toFixed(1)}°` : "—";
  const moonAzStr = luna ? `${luna.azDeg.toFixed(1)}°` : "—";
  const moonIllumPct = luna ? Math.round(luna.illum * 100) : null;
  const moonPhaseName = luna?.phaseName ?? "—";
  const solsticeLinked = !!luna && Math.abs(luna.decDeg) >= 23.44;
  const solRiseAut = sol?.rise ? computeAUT(sol.rise, coords.lat, coords.lon).autClock : "—";
  const solTransitAut = sol?.transit
    ? computeAUT(sol.transit, coords.lat, coords.lon).autClock
    : "—";
  const solSetAut = sol?.set ? computeAUT(sol.set, coords.lat, coords.lon).autClock : "—";
  const moonRiseLocal = formatMoonTime(luna?.rise);
  const moonTransitLocal = formatMoonTime(luna?.transit);
  const moonSetLocal = formatMoonTime(luna?.set);
  const moonRiseAut = luna?.rise ? computeAUT(luna.rise, coords.lat, coords.lon).autClock : "—";
  const moonTransitAut = luna?.transit
    ? computeAUT(luna.transit, coords.lat, coords.lon).autClock
    : "—";
  const moonSetAut = luna?.set ? computeAUT(luna.set, coords.lat, coords.lon).autClock : "—";
  const moonTransitAltStr =
    typeof luna?.transitAltDeg === "number" ? `${luna.transitAltDeg.toFixed(1)}°` : "—";
  const solArcStart = sol && sol.track.length > 0 ? sol.track[0]?.ts : undefined;
  const solArcEnd = sol && sol.track.length > 0 ? sol.track[sol.track.length - 1]?.ts : undefined;
  const solArcStartLabel = formatSolTime(solArcStart);
  const solArcEndLabel = formatSolTime(solArcEnd);
  const solArcRangeLabel =
    solArcStartLabel && solArcEndLabel
      ? `${solArcStartLabel} → ${solArcEndLabel}${
          solArcStart && solArcEnd && solArcEnd.getTime() - solArcStart.getTime() >= 23 * 60 * 60 * 1000
            ? " (next day)"
            : ""
        }`
      : "—";
  const moonArcStart = luna && luna.tonight.length > 0 ? luna.tonight[0]?.ts : undefined;
  const moonArcEnd =
    luna && luna.tonight.length > 0 ? luna.tonight[luna.tonight.length - 1]?.ts : undefined;
  const moonArcStartLabel = formatMoonTime(moonArcStart);
  const moonArcEndLabel = formatMoonTime(moonArcEnd);
  const moonArcRangeLabel =
    moonArcStartLabel && moonArcEndLabel
      ? `${moonArcStartLabel} → ${moonArcEndLabel}${
          moonArcStart && moonArcEnd && moonArcEnd.getTime() - moonArcStart.getTime() >= 23 * 60 * 60 * 1000
            ? " (next day)"
            : ""
        }`
      : "—";
  const solArcColor = sol
    ? "rgba(253,224,71,0.9)"
    : "rgba(250,250,250,0.7)";
  const solArcFillColor = sol
    ? "rgba(253,224,71,0.2)"
    : "rgba(226,232,240,0.12)";
  const solLegendPathColor = solArcColor;
  const solLegendHorizonColor = "rgba(248,250,252,0.45)";
  const solLegendBandColor = "rgba(253,224,71,0.3)";
  const solLegendIconColor = "#fde68a";
  const moonArcColor = luna
    ? luna.decDeg >= 0
      ? "rgba(56,189,248,0.85)"
      : "rgba(244,114,182,0.85)"
    : "rgba(148,163,184,0.75)";
  const moonArcFillColor = luna
    ? luna.decDeg >= 0
      ? "rgba(56,189,248,0.18)"
      : "rgba(244,114,182,0.18)"
    : "rgba(148,163,184,0.12)";
  const moonLegendPathColor = moonArcColor;
  const moonLegendHorizonColor = "rgba(248,250,252,0.45)";
  const moonLegendBandColor = "rgba(148,163,184,0.28)";
  const moonLegendIconColor = "#f8fafc";
  const compassHeadingDeg = compassHeading !== null ? normalizeDegrees(compassHeading) : null;
  const compassHeadingLabel = compassHeadingDeg !== null ? headingToLabel(compassHeadingDeg) : null;
  const compassHeadingDisplay =
    compassHeadingDeg !== null && compassHeadingLabel
      ? `${Math.round(compassHeadingDeg)}° ${compassHeadingLabel}`
      : "—";
  const compassPitchDisplay = compassPitch !== null ? `${Math.round(compassPitch)}°` : "—";
  const compassRollDisplay = compassRoll !== null ? `${Math.round(compassRoll)}°` : "—";
  const compassPointerRotation = compassHeadingDeg ?? 0;
  const compassTickAngles = useMemo(() => Array.from({ length: 36 }, (_, i) => i * 10), []);
  const compassMajorAngles = useMemo(() => Array.from({ length: 4 }, (_, i) => i * 90), []);
  const compassStatusHint = (() => {
    switch (compassStatus) {
      case "active":
        return compassAbsolute
          ? "Live device orientation (true north locked)"
          : "Move your device in a gentle figure-eight to calibrate true north.";
      case "denied":
        return "Permission denied — enable sensor access in browser settings.";
      case "unsupported":
        return "Device orientation not supported in this browser.";
      default:
        return "Tap “Enable Gyro” to activate the compass.";
    }
  })();

  const locationPrimary = (() => {
    if (status === "pending") return "Requesting location…";
    if (status === "granted") {
      if (placeStatus === "loading") return "Locating your place…";
      return placeLabel;
    }
    if (status === "denied" || status === "unavailable") {
      return `${FALLBACK_PLACE_LABEL} (fallback)`;
    }
    return FALLBACK_PLACE_LABEL;
  })();

  const timeZoneLine = (() => {
    if (timeZoneStatus === "loading") return "Resolving time zone…";
    if (timeZoneStatus === "error") {
      return timeZoneError ? `Time zone unavailable (${timeZoneError})` : "Time zone unavailable.";
    }
    if (timeZoneInfo?.timeZone) {
      const abbr = timeZoneInfo.abbreviation ? ` (${timeZoneInfo.abbreviation})` : "";
      const offset =
        typeof timeZoneInfo.offsetMinutes === "number"
          ? ` UTC${formatOffset(timeZoneInfo.offsetMinutes)}`
          : "";
      return `Time zone: ${timeZoneInfo.timeZone}${abbr}${offset}`;
    }
    return "Time zone: Device time";
  })();

  const timeZoneTone =
    timeZoneStatus === "error"
      ? "text-amber-300"
      : timeZoneStatus === "loading"
      ? "text-zinc-400"
      : "text-zinc-400";

  const locationHint = (() => {
    if (status === "granted") {
      if (placeStatus === "loading") return "Fetching location name…";
      if (placeStatus === "error") return "Could not resolve a friendly place name.";
      return null;
    }
    if (status === "denied") {
      return "Permission denied — using fallback coordinates.";
    }
    if (status === "unavailable") {
      return "Geolocation unavailable — using fallback coordinates.";
    }
    return null;
  })();

  const locationHintTone =
    status === "granted" && placeStatus === "error" ? "text-amber-300" : "text-zinc-400";

  const signatureDetails = useMemo(() => deriveSignatureSegments(coreProfile.code), [coreProfile.code]);
  const signatureGradient = useMemo(
    () => buildSignatureGradient(signatureDetails.colors, signatureDetails.special),
    [signatureDetails.colors, signatureDetails.special]
  );
  const signatureRingStyle: CSSProperties = useMemo(
    () => ({
      background: signatureGradient,
      padding: "5px",
      borderRadius: "9999px",
      boxShadow:
        "0 12px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.15), 0 0 0 1px rgba(255,255,255,0.06)",
    }),
    [signatureGradient]
  );
  const signatureRingStyleThin: CSSProperties = useMemo(
    () => ({
      background: signatureGradient,
      padding: "2px",
      borderRadius: "9999px",
      boxShadow:
        "0 6px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1px rgba(255,255,255,0.05)",
    }),
    [signatureGradient]
  );
  const profileImageSrc = coreProfile.photoData;

  // Use a stable, wrapped AUT hour value
  const autH = ((Number(data.autHours) % 24) + 24) % 24;
  const [weekPickerDate, setWeekPickerDate] = useState(() => toLocalISODate(new Date()));
  const [weekPickerLocalHour, setWeekPickerLocalHour] = useState<number>(() => {
    const nowLocal = new Date();
    return nowLocal.getHours() + nowLocal.getMinutes() / 60;
  });
  const autHoursToLocalDate = useCallback(
    (hour: number): Date | null => {
      if (!data.sunriseLocal || !data.sunsetLocal) return null;
      const dayLen = data.dayLenMin ?? 0;
      const nightLen = data.nightLenMin ?? 0;
      const isFullCycle = hour >= 24;
      const normalized =
        hour >= 24 || hour < 0 ? ((hour % 24) + 24) % 24 + (isFullCycle ? 24 : 0) : hour;
      if (normalized < 12) {
        const ratio = Math.max(0, Math.min(1, normalized / 12));
        return new Date(data.sunriseLocal.getTime() + ratio * dayLen * 60_000);
      }
      const nightHours = normalized === 24 ? 12 : normalized - 12;
      const ratio = Math.max(0, Math.min(1, nightHours / 12));
      return new Date(data.sunsetLocal.getTime() + ratio * nightLen * 60_000);
    },
    [data]
  );
  const formatAutWindow = useCallback(
    (hour: number) => {
      const aut = formatClock(hour);
      const localDate = autHoursToLocalDate(hour);
      const local = localDate ? formatShortTime(localDate) : "—";
      return { aut, local };
    },
    [autHoursToLocalDate, formatShortTime]
  );

  // Active Ray window + progress within that window
  const rayIndex = rayIndexForAUT(autH);
  const activeRay = RAY_WINDOWS[rayIndex];
  const activeLarbRayId = useMemo(
    () => resolveLarbIdFromRayName(activeRay?.name),
    [activeRay?.name]
  );
  const rayRange = Math.max(1e-6, activeRay.end - activeRay.start);
  const rawProgress = (autH - activeRay.start) / rayRange;
  const rayProgress = Math.min(1, Math.max(0, rawProgress));
  const remainingAUTHours = Math.max(0, activeRay.end - autH);
  const minutesPerAutHour = data.segmentLabel?.includes("Daylight")
    ? data.dayLenMin / 12
    : data.nightLenMin / 12;
  const remainingRealMin = Math.max(0, remainingAUTHours * minutesPerAutHour);
  const rayProgressPct = Math.round(rayProgress * 100);

  // Atlas theme sparkle click effect (Ray-hued accent)
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!sparkleEnabled) return;

    const styleId = "atlas-sparkle-styles";
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.textContent = `
        .atlas-sparkle {
          position: fixed;
          pointer-events: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.9), transparent 65%);
          mix-blend-mode: screen;
          animation: atlas-sparkle-bloom 520ms ease-out forwards;
          filter: drop-shadow(0 0 6px var(--atlas-ray, #a855f7));
          z-index: 9999;
        }
        .atlas-sparkle::after {
          content: "";
          position: absolute;
          inset: 2px;
          background: conic-gradient(from 0deg, var(--atlas-ray, #a855f7), rgba(255,255,255,0.75), var(--atlas-ray, #a855f7));
          mask: radial-gradient(circle, transparent 35%, black 36%);
          border-radius: 50%;
          opacity: 0.85;
        }
        .atlas-dust {
          position: fixed;
          pointer-events: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: radial-gradient(circle at 45% 45%, rgba(255,255,255,0.9), rgba(255,255,255,0.6) 30%, var(--atlas-ray, #d946ef) 60%, rgba(0,0,0,0) 78%);
          mix-blend-mode: screen;
          animation: atlas-dust-drift 620ms ease-out forwards;
          z-index: 9999;
          filter: drop-shadow(0 0 8px var(--atlas-ray, #d946ef));
        }
        @keyframes atlas-dust-drift {
          0% { transform: translate(var(--dx,0), var(--dy,0)) scale(0.5); opacity: 0.85; }
          40% { opacity: 0.9; }
          100% { transform: translate(calc(var(--dx,0) * 1.4), calc(var(--dy,0) * 1.6 - 6px)) scale(0.2); opacity: 0; }
        }
        .atlas-trail {
          position: fixed;
          pointer-events: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 40%, #ffffff 0%, #ffffff 15%, rgba(255,255,255,0.65) 28%, var(--atlas-ray, #d946ef) 55%, rgba(0,0,0,0) 75%);
          box-shadow:
            0 0 10px rgba(255,255,255,0.7),
            0 0 16px var(--atlas-ray, #d946ef),
            0 0 28px rgba(255,255,255,0.25);
          animation: atlas-trail-drift 820ms ease-out forwards;
          opacity: 0.9;
          z-index: 9998;
          transform: translate(-50%, -50%) scale(0.9);
          mix-blend-mode: screen;
        }
        .atlas-trail::after {
          content: "";
          position: absolute;
          inset: 2px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.8), transparent 70%);
          filter: blur(4px);
          opacity: 0.85;
        }
        @keyframes atlas-trail-drift {
          0% { transform: translate(-50%, -50%) scale(0.9) rotate(0deg); opacity: 0.95; }
          35% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx, 6px)), calc(-50% + var(--dy, -10px))) scale(0.3) rotate(25deg); opacity: 0; }
        }
        @keyframes atlas-sparkle-bloom {
          0% { transform: translate(-50%, -50%) scale(0.65); opacity: 0.9; }
          40% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
          100% { transform: translate(-50%, calc(-50% - 8px)) scale(0.9); opacity: 0; }
        }
      `;
      document.head.appendChild(styleEl);
    }

    const handler = (ev: MouseEvent) => {
      if (uiTheme !== "atlas") return;
      if (!activeRay) return;
      // Ignore synthetic or zeroed coordinates (avoid top-left flashes)
      if (ev.clientX === 0 && ev.clientY === 0) return;
      const hue = activeRay.color;

      const spawnDust = (count: number) => {
        for (let i = 0; i < count; i++) {
          const dust = document.createElement("span");
          dust.className = "atlas-dust";
          const angle = Math.random() * Math.PI * 2;
          const radius = 6 + Math.random() * 10;
          const dx = Math.cos(angle) * radius;
          const dy = Math.sin(angle) * radius;
          dust.style.left = `${ev.clientX}px`;
          dust.style.top = `${ev.clientY}px`;
          dust.style.setProperty("--dx", `${dx}px`);
          dust.style.setProperty("--dy", `${dy}px`);
          dust.style.filter = `drop-shadow(0 0 5px ${hue})`;
          document.body.appendChild(dust);
          setTimeout(() => dust.remove(), 700);
        }
      };

      const spark = document.createElement("span");
      spark.className = "atlas-sparkle";
      spark.style.left = `${ev.clientX}px`;
      spark.style.top = `${ev.clientY}px`;
      spark.style.setProperty("--atlas-ray", hue);
      document.body.appendChild(spark);
      spawnDust(5);
      setTimeout(() => spark.remove(), 560);
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [uiTheme, activeRay?.color, sparkleEnabled]);

  // Atlas pointer trail (sparkle dust following mouse)
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!sparkleEnabled) return;
    const lastSpawn = { t: 0 };
    const onMove = (ev: PointerEvent) => {
      if (uiTheme !== "atlas") return;
      if (!activeRay) return;
      if (ev.pointerType !== "mouse") return;
      if (ev.clientX === 0 && ev.clientY === 0) return;
      const nowMs = performance.now();
      if (nowMs - lastSpawn.t < 28) return; // throttle
      lastSpawn.t = nowMs;

      const hue = activeRay.color;
      const trail = document.createElement("span");
      trail.className = "atlas-trail";
      trail.style.left = `${ev.clientX}px`;
      trail.style.top = `${ev.clientY}px`;
      const angle = Math.random() * Math.PI * 2;
      const radius = 6 + Math.random() * 10;
      trail.style.setProperty("--dx", `${Math.cos(angle) * radius}px`);
      trail.style.setProperty("--dy", `${Math.sin(angle) * radius - 4}px`);
      trail.style.setProperty("--atlas-ray", hue);
      document.body.appendChild(trail);
      setTimeout(() => trail.remove(), 900);
    };
    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [uiTheme, activeRay?.color, sparkleEnabled]);
  const segmentAngle = (2 * Math.PI) / RAY_WINDOWS.length;
  const progressPct = Math.round(rayProgress * 100);
  const ringSizeClass = PRESENT_ONLY
    ? "max-w-[16rem] sm:max-w-[19rem] xl:max-w-[22rem]"
    : "max-w-[18rem] sm:max-w-[20rem] lg:max-w-[24rem] xl:max-w-[26rem]";
  const ringLayoutClass = "flex flex-col items-center justify-center gap-5";
  const rayHeaderClass = PRESENT_ONLY
    ? "flex flex-col items-center gap-2 text-center"
    : "flex flex-wrap items-end justify-between gap-3";
  const weekRingSizeClass =
    "max-w-[18rem] sm:max-w-[21rem] lg:max-w-[23rem]";
  const weekRingLayoutClass = "flex flex-col items-center justify-center gap-6";
  const weekHeaderClass = "flex flex-wrap items-start justify-between gap-3";
  const ringViewBox = `${RING_VIEWBOX_MIN} ${RING_VIEWBOX_MIN} ${RING_VIEWBOX_SIZE} ${RING_VIEWBOX_SIZE}`;

  // Rays of the Week: active cycle + progress within current 12h band
  const weekBaseDate = useMemo(() => {
    const candidate = new Date(`${weekPickerDate}T00:00:00`);
    return Number.isNaN(candidate.getTime()) ? new Date() : candidate;
  }, [weekPickerDate]);
  const weekSegmentAngle = (2 * Math.PI) / WEEK_RAY_CYCLES.length;
  const weekDialSegments = useMemo(() => {
    const count = WEEK_RAY_CYCLES.length;
    const offset = -Math.PI / 2;
    return WEEK_RAY_CYCLES.map((cycle, index) => {
      const dialPosition = ((index - WEEK_RAY_TOP_INDEX + count) % count + count) % count;
      const startAngle = offset + dialPosition * weekSegmentAngle;
      const endAngle = startAngle + weekSegmentAngle;
      const midAngle = startAngle + weekSegmentAngle / 2;
      const path = describeWedge(RING_OUTER_RADIUS, RING_INNER_RADIUS, startAngle, endAngle);
      const labelPosition = polarToCartesian(WEEK_LABEL_RADIUS, midAngle);
      const sequenceLabel = WEEK_RAY_SEQUENCE_LABELS[index] ?? `${index}-${index + 1}`;
      const labelLines = [cycle.dayLabel, sequenceLabel];
      return {
        cycle,
        index,
        dialPosition,
        startAngle,
        endAngle,
        path,
        labelX: labelPosition.x,
        labelY: labelPosition.y,
        labelLines,
      };
    });
  }, [weekSegmentAngle]);
  const weekSelectedLocal = useMemo(() => {
    const d = new Date(weekBaseDate);
    const hours = Math.floor(weekPickerLocalHour);
    const minutes = Math.round((weekPickerLocalHour - hours) * 60);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }, [weekBaseDate, weekPickerLocalHour]);
  const weekRayIndex = weekRayIndexForDateLocal(weekSelectedLocal);
  const weekActiveCycle = WEEK_RAY_CYCLES[weekRayIndex] ?? WEEK_RAY_CYCLES[0];
  const weekCycleStart = useMemo(
    () => {
      const start = new Date(weekSelectedLocal);
      start.setHours(weekPickerLocalHour < 12 ? 0 : 12, 0, 0, 0);
      return start;
    },
    [weekPickerLocalHour, weekSelectedLocal]
  );
  const weekCycleEnd = useMemo(
    () => new Date(weekCycleStart.getTime() + 12 * 60 * 60 * 1000),
    [weekCycleStart]
  );
  const weekRayRangeMs = Math.max(
    1,
    weekCycleStart && weekCycleEnd ? weekCycleEnd.getTime() - weekCycleStart.getTime() : 12 * 60 * 60 * 1000
  );
  const weekRayProgress = Math.min(
    1,
    Math.max(
      0,
      weekCycleStart && weekCycleEnd && weekSelectedLocal
        ? (weekSelectedLocal.getTime() - weekCycleStart.getTime()) / weekRayRangeMs
        : 0
    )
  );
  const weekProgressPct = Math.round(weekRayProgress * 100);
  const weekRemainingMinutes = Math.max(
    0,
    weekCycleEnd && weekSelectedLocal
      ? (weekCycleEnd.getTime() - weekSelectedLocal.getTime()) / 60000
      : 0
  );
  const weekRayWindowTimes: WeekRayWindowTimes = useMemo(
    () => ({
      start: weekCycleStart ? formatShortTime(weekCycleStart) : "—",
      end: weekCycleEnd ? formatShortTime(weekCycleEnd) : "—",
    }),
    [formatShortTime, weekCycleEnd, weekCycleStart]
  );
  const weekPickerLocalClock = formatClock(weekPickerLocalHour);
  const weekSelectedLocalLabel = weekSelectedLocal ? formatShortTime(weekSelectedLocal) : "—";
  const weekActiveSegment = weekDialSegments[weekRayIndex] ?? weekDialSegments[0];
  const weekPointerAngle = weekActiveSegment
    ? weekActiveSegment.startAngle + weekRayProgress * weekSegmentAngle
    : -Math.PI / 2;
  const weekPointerCoord = polarToCartesian(POINTER_RADIUS, weekPointerAngle);
  const weekPointerInner = polarToCartesian(RING_INNER_RADIUS - 6, weekPointerAngle);
  const weekReading = WEEK_RAY_READINGS[weekActiveCycle.id];
  const rayReading = RAY_READINGS[activeRay?.name ?? ""];
  const weekCyclesByDay = useMemo(() => {
    const buckets = WEEK_RAY_DAY_ORDER.map((dayIndex) => ({
      dayIndex,
      dayLabel: WEEK_RAY_CYCLES.find((c) => c.dayIndex === dayIndex)?.dayLabel ?? "Day",
      cycles: WEEK_RAY_CYCLES.filter((c) => c.dayIndex === dayIndex).sort((a, b) => a.cycle - b.cycle),
    }));
    return buckets;
  }, []);
  const [openWeekDayIdx, setOpenWeekDayIdx] = useState(() => {
    const todayIdx = WEEK_RAY_DAY_ORDER.indexOf(now.getDay());
    return todayIdx === -1 ? 0 : todayIdx;
  });
  const activeWeekDay = useMemo(
    () => weekCyclesByDay.find((d) => d.dayIndex === weekActiveCycle.dayIndex),
    [weekCyclesByDay, weekActiveCycle.dayIndex]
  );
  const activeWeekGradient = useMemo(() => {
    const c1 = activeWeekDay?.cycles[0]?.color ?? "#475569";
    const c2 = activeWeekDay?.cycles[1]?.color ?? c1;
    return `linear-gradient(90deg, ${c1} 0%, ${c1} 50%, ${c2} 50%, ${c2} 100%)`;
  }, [activeWeekDay]);
  const rayWindowsDetailed = useMemo(
    () =>
      RAY_WINDOWS.map((win, idx) => ({
        ...win,
        idx,
        window: {
          start: formatAutWindow(win.start),
          end: formatAutWindow(win.end),
        },
        reading: RAY_READINGS[win.name],
      })),
    [formatAutWindow]
  );
  const [openRayIdx, setOpenRayIdx] = useState(() => rayIndex);
  const dialSegments = useMemo(() => {
    const count = RAY_WINDOWS.length;
    const offset = -Math.PI / 2;
    return RAY_WINDOWS.map((ray, index) => {
      const dialPosition = ((index - TOP_RAY_INDEX + count) % count + count) % count;
      const startAngle = offset + dialPosition * segmentAngle;
      const endAngle = startAngle + segmentAngle;
      const midAngle = startAngle + segmentAngle / 2;
      const path = describeWedge(RING_OUTER_RADIUS, RING_INNER_RADIUS, startAngle, endAngle);
      const labelPosition = polarToCartesian(RAY_LABEL_RADIUS, midAngle);
      const labelLines = splitRayLabel(ray.name);
      return {
        ray,
        index,
        dialPosition,
        startAngle,
        endAngle,
        path,
        labelX: labelPosition.x,
        labelY: labelPosition.y,
        labelLines,
      };
    });
  }, [segmentAngle]);
  const activeSegment = dialSegments[rayIndex];
  const rayWindowTimes = activeRay
    ? {
        start: formatAutWindow(activeRay.start),
        end: formatAutWindow(activeRay.end),
      }
    : null;
  const pointerAngle = activeSegment
    ? activeSegment.startAngle + rayProgress * segmentAngle
    : -Math.PI / 2;
  const pointerCoord = polarToCartesian(POINTER_RADIUS, pointerAngle);
  const pointerInner = polarToCartesian(RING_INNER_RADIUS - 6, pointerAngle);
  const atmosphereSample = atmosphere.sample;
  const atmosphereStatusLine = (() => {
    switch (atmosphere.status) {
      case "loading":
        return "Fetching latest readings…";
      case "error":
        return atmosphere.error ? `Error: ${atmosphere.error}` : "Unable to fetch readings.";
      case "ready":
        return atmosphereSample?.updated
          ? `Updated ${formatLongTime(atmosphereSample.updated)}`
          : "Fresh snapshot ready.";
      default:
        return "Awaiting snapshot…";
    }
  })();
  const unavailableLabel = atmosphere.status === "loading" ? "Loading…" : "Unavailable";
  const temperatureDisplay =
    typeof atmosphereSample?.temperatureC === "number" &&
    typeof atmosphereSample?.temperatureF === "number"
      ? `${atmosphereSample.temperatureC.toFixed(1)} °C / ${atmosphereSample.temperatureF.toFixed(
          1
        )} °F`
      : unavailableLabel;
  const pressureDisplay =
    typeof atmosphereSample?.seaLevelPressure === "number"
      ? `${atmosphereSample.seaLevelPressure.toFixed(1)} hPa`
      : unavailableLabel;
  const ozoneDisplay =
    typeof atmosphereSample?.ozone === "number"
      ? `${Math.round(atmosphereSample.ozone)} ${atmosphereSample.ozoneUnits ?? "DU"}`
      : "Unavailable";
  const atmosphereLocalTime =
    atmosphereSample?.updated ? formatShortTime(atmosphereSample.updated) : null;
  const historicalTempDisplay =
    historicalTemp.status === "ready" && typeof historicalTemp.avgC === "number"
      ? `${historicalTemp.avgC.toFixed(1)} °C / ${historicalTemp.avgF?.toFixed(1)} °F`
      : historicalTemp.status === "error"
      ? `Unavailable${historicalTemp.error ? ` (${historicalTemp.error})` : ""}`
      : "Loading…";
  const climateRangeLabel = `${HISTORICAL_START_YEAR}–${now.getUTCFullYear()}`;
  const ozoneInfoLine =
    atmosphereSample?.ozoneUnits === "µg/m³"
      ? "Surface ozone mass concentration near ground level, expressed in micrograms per cubic meter (µg/m³)."
      : "Total-column ozone (Dobson Units) integrating the entire stratospheric column from TEMIS composites.";
  const ozoneRangeLine =
    atmosphereSample?.ozoneUnits === "µg/m³"
      ? "Values above ~180 µg/m³ can trigger local air-quality alerts; <60 µg/m³ is typical of clean background air."
      : "Values below 220 DU signal potential ozone-hole conditions; 250–350 DU are common at mid-latitudes.";

  const lookupZip = useCallback(async () => {
    const raw = zipInput.trim();
    if (!raw) {
      setZipError("Enter a postal or ZIP code.");
      setZipStatus("error");
      return;
    }

    let country = "us";
    let code = raw;
    const prefixMatch = raw.match(/^([A-Za-z]{2})[:\s-]+(.+)$/);
    if (prefixMatch) {
      country = prefixMatch[1].toLowerCase();
      code = prefixMatch[2];
    }

    let normalized = code.trim();
    if (country === "us") {
      normalized = normalized.replace(/[^0-9]/g, "");
      if (normalized.length >= 5) {
        normalized = normalized.slice(0, 5);
      }
      if (!/^\d{5}$/.test(normalized)) {
        setZipError("US ZIP codes must include 5 digits (you can include the +4).");
        setZipStatus("error");
        return;
      }
    } else {
      normalized = normalized.replace(/[\s-]+/g, "").toUpperCase();
      if (!/^[A-Z0-9]{3,}$/u.test(normalized)) {
        setZipError("Postal codes must be alphanumeric and at least 3 characters.");
        setZipStatus("error");
        return;
      }
    }

    zipControllerRef.current?.abort();
    const controller = new AbortController();
    zipControllerRef.current = controller;
    setZipStatus("loading");
    setZipError(null);

    try {
      const url = new URL(ZIP_LOOKUP_ENDPOINT);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      url.searchParams.set("postalcode", normalized);
      url.searchParams.set("countrycodes", country.toLowerCase());
      url.searchParams.set("addressdetails", "1");

      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": ZIP_LOOKUP_USER_AGENT,
        },
      });
      if (!res.ok) {
        throw new Error(`Lookup failed (${res.status})`);
      }
      const data = await res.json();
      const place =
        Array.isArray(data) && data.length > 0
          ? data[0]
          : data && Array.isArray(data.places) && data.places.length > 0
          ? data.places[0]
          : undefined;
      const lat = place ? parseFloat(place.lat ?? place.latitude) : NaN;
      const lon = place ? parseFloat(place.lon ?? place.longitude) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error("Invalid coordinates in response");
      }
      setCoords({ lat, lon });
      setZipStatus("success");
      setZipError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setZipStatus("error");
      setZipError(err instanceof Error ? err.message : "Could not resolve that postal code.");
    }
  }, [zipInput, setCoords]);

  const onZipSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void lookupZip();
    },
    [lookupZip]
  );

  const computeProfileSnapshot = useCallback(
    (profile: CoreSignatureProfile) =>
      JSON.stringify({
        name: profile.name.trim(),
        code: normalizeSignatureCode(profile.code),
        photoData: profile.photoData ?? "",
        photoName: profile.photoName ?? "",
      }),
    []
  );

  const startPasskeyRegistration = useCallback(async () => {
    const cleanCode = normalizeSignatureCode(coreProfile.code);
    if (cleanCode.length !== 9) {
      setPasskeyStatus("Enter your 9-digit CES first.");
      return;
    }
    const displayName = coreProfile.name.trim() || `CES ${cleanCode}`;
    if (!deviceId) {
      setPasskeyStatus("Device ID missing; reload the app.");
      return;
    }
    setPasskeyBusy(true);
    setPasskeyStatus("Starting passkey setup…");
    try {
      const optRes = await fetch("/api/passkey-register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ces: cleanCode, deviceId, name: displayName }),
      });
      const optJson = await optRes.json().catch(() => null);
      if (!optRes.ok) throw new Error(optJson?.error || `Options failed (${optRes.status})`);
      const attestation = await startRegistration(optJson.options);
      const verifyRes = await fetch("/api/passkey-register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ces: cleanCode, deviceId, attestation, name: displayName }),
      });
      const verifyJson = await verifyRes.json().catch(() => null);
      if (!verifyRes.ok) throw new Error(verifyJson?.error || `Verify failed (${verifyRes.status})`);
      if (verifyJson?.verified) {
        setPasskeyStatus("Passkey saved — you can now sign in with it.");
        setPasskeySignedIn(true);
      } else {
        setPasskeyStatus("Passkey verification did not complete.");
      }
    } catch (err: any) {
      setPasskeyStatus(err?.message ?? "Passkey setup failed.");
    } finally {
      setPasskeyBusy(false);
    }
  }, [coreProfile.code, coreProfile.name, deviceId]);

  const startPasskeyAuth = useCallback(async () => {
    const cleanCode = normalizeSignatureCode(coreProfile.code);
    if (cleanCode.length !== 9) {
      setPasskeyStatus("Enter your 9-digit CES to select the account.");
      return;
    }
    if (!deviceId) {
      setPasskeyStatus("Device ID missing; reload the app.");
      return;
    }
    setPasskeyBusy(true);
    setPasskeyStatus("Waiting for passkey…");
    try {
      const optRes = await fetch("/api/passkey-auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ces: cleanCode, deviceId }),
      });
      const optJson = await optRes.json().catch(() => null);
      if (!optRes.ok) throw new Error(optJson?.error || `Options failed (${optRes.status})`);
      const assertion = await startAuthentication(optJson.options);
      const verifyRes = await fetch("/api/passkey-auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ces: cleanCode, deviceId, assertion }),
      });
      const verifyJson = await verifyRes.json().catch(() => null);
      if (!verifyRes.ok) throw new Error(verifyJson?.error || `Verify failed (${verifyRes.status})`);
      if (verifyJson?.verified) {
        setPasskeyStatus("Signed in with passkey.");
        setPasskeySignedIn(true);
        setCoreProfile((prev) => ({ ...prev, code: cleanCode }));
        refreshCoreProfileRef.current?.();
      } else {
        setPasskeyStatus("Passkey verification did not complete.");
      }
    } catch (err: any) {
      setPasskeyStatus(err?.message ?? "Passkey sign-in failed.");
    } finally {
      setPasskeyBusy(false);
    }
  }, [coreProfile.code, deviceId]);

  const refreshCoreProfile = useCallback(async () => {
    if (typeof fetch === "undefined") return;
    if (!deviceId) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const cleanCode = normalizeSignatureCode(coreProfile.code);
      const query = cleanCode.length === 9 ? `ces=${encodeURIComponent(cleanCode)}` : `deviceId=${encodeURIComponent(deviceId)}`;
      const res = await fetch(`/api/ces-profile?${query}`);
      if (!res.ok) throw new Error(`CES profile fetch failed (${res.status})`);
      const data = (await res.json()) as Partial<CoreSignatureProfile> | null;
      if (!data) {
        return;
      }
      const loadedProfile: CoreSignatureProfile = {
        name: typeof data.name === "string" ? data.name : "",
        code: typeof data.code === "string" ? data.code : "",
        photoData: typeof data.photoData === "string" && data.photoData.length > 0 ? data.photoData : undefined,
        photoName: typeof data.photoName === "string" && data.photoName.length > 0 ? data.photoName : undefined,
        adminCes: typeof data.adminCes === "string" ? data.adminCes : undefined,
        updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : undefined,
      };
      setCoreProfile(loadedProfile);
      lastSavedSnapshot.current = computeProfileSnapshot(loadedProfile);
      if (typeof data.updatedAt === "number") {
        setProfileSavedAt(data.updatedAt);
      }
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(CES_PROFILE_STORAGE_KEY, JSON.stringify(loadedProfile));
        } catch {
          // ignore storage errors
        }
      }
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Could not load CES profile.");
    } finally {
      setProfileLoading(false);
    }
  }, [computeProfileSnapshot, deviceId]);

  refreshCoreProfileRef.current = refreshCoreProfile;

  useEffect(() => {
    void refreshCoreProfile();
  }, [refreshCoreProfile]);

  const saveProfileToVercel = useCallback(
    async (profile: CoreSignatureProfile) => {
      const cleanCode = normalizeSignatureCode(profile.code);
      if (cleanCode.length !== 9) {
        setProfileError("Core Energetic Signature must be exactly 9 digits to sync.");
        return;
      }
      if (typeof fetch === "undefined") return;
      if (!deviceId) {
        setProfileError("Device ID missing; please reload the app.");
        return;
      }
      try {
        setProfileSaving(true);
        setProfileError(null);
        const res = await fetch("/api/ces-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...profile, code: cleanCode, deviceId, ces: cleanCode }),
        });
        if (!res.ok) throw new Error(`CES profile save failed (${res.status})`);
        const saved = (await res.json()) as Partial<CoreSignatureProfile>;
        const updatedAt = typeof saved?.updatedAt === "number" ? saved.updatedAt : Date.now();
        // Only update the saved snapshot, not coreProfile state — user may have continued typing
        lastSavedSnapshot.current = computeProfileSnapshot({
          name: saved?.name ?? profile.name ?? "",
          code: saved?.code ?? cleanCode,
          photoData:
            typeof saved?.photoData === "string" && saved.photoData.length > 0
              ? saved.photoData
              : profile.photoData,
          photoName:
            typeof saved?.photoName === "string" && saved.photoName.length > 0
              ? saved.photoName
              : profile.photoName,
        });
        setProfileSavedAt(updatedAt);
        if (typeof saved?.photoData === "string" && saved.photoData.length > 0) {
          // Only update photo-related fields silently
          setCoreProfile((prev) => ({
            ...prev,
            photoData: saved.photoData,
            photoName: typeof saved.photoName === "string" ? saved.photoName : prev.photoName,
            updatedAt,
          }));
        }
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(CES_PROFILE_STORAGE_KEY, JSON.stringify(coreProfile));
          } catch {
            // ignore storage errors
          }
        }
      } catch (err) {
        setProfileError(err instanceof Error ? err.message : "Could not save CES profile.");
      } finally {
        setProfileSaving(false);
      }
    },
    [computeProfileSnapshot, deviceId]
  );

  useEffect(() => {
    const cleanCode = normalizeSignatureCode(coreProfile.code);
    const snapshot = computeProfileSnapshot(coreProfile);
    if (profileLoading) return;
    if (snapshot === lastSavedSnapshot.current) return;
    if (snapshot === "") return; // don't auto-save empty profiles before initialization
    if (!deviceId) return;
    if (cleanCode.length !== 9 || !coreProfile.name.trim()) {
      setProfileError(null);
      return;
    }
    if (profileSaveTimer.current) {
      clearTimeout(profileSaveTimer.current);
    }
    profileSaveTimer.current = setTimeout(() => {
      void saveProfileToVercel({ ...coreProfile, code: cleanCode });
    }, 600);
    return () => {
      if (profileSaveTimer.current) {
        clearTimeout(profileSaveTimer.current);
      }
    };
  }, [coreProfile, computeProfileSnapshot, saveProfileToVercel, profileLoading, deviceId]);

  const refreshCommunity = useCallback(async () => {
    if (typeof fetch === "undefined") return;
    try {
      setCommunityLoading(true);
      setCommunityError(null);
      const res = await fetch("/api/community");
      if (!res.ok) throw new Error(`Community fetch failed (${res.status})`);
      const data: CommunityPost[] = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      setCommunityError(err instanceof Error ? err.message : "Unable to load community posts.");
    } finally {
      setCommunityLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCommunity();
  }, [refreshCommunity]);

  const onPostSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedMessage = draftPost.message.trim();
      if (!trimmedMessage) return;
      const cleanCode = normalizeSignatureCode(coreProfile.code);
      const name = coreProfile.name.trim();
      if (!name || cleanCode.length !== 9) {
        setCommunityError("Add your CES profile (name + 9-digit code) before posting.");
        setShowPostRequirement(true);
        return;
      }
      if (!passkeySignedIn) {
        setCommunityError("Passkey sign-in required before posting.");
        return;
      }
      try {
        setCommunityLoading(true);
        setCommunityError(null);
        const res = await fetch("/api/community", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            code: cleanCode,
            message: trimmedMessage,
            photoData: coreProfile.photoData ?? "",
            photoName: coreProfile.photoName ?? "",
            imageData: draftPost.imageData ?? "",
            imageName: draftPost.imageName ?? "",
          }),
        });
        if (!res.ok) throw new Error(`Post failed (${res.status})`);
        await refreshCommunity();
        setDraftPost({ message: "", imageData: "", imageName: "" });
      } catch (err) {
        setCommunityError(err instanceof Error ? err.message : "Could not post message.");
      } finally {
        setCommunityLoading(false);
      }
    },
    [draftPost.imageData, draftPost.imageName, draftPost.message, coreProfile.code, coreProfile.name, passkeySignedIn, refreshCommunity]
  );

  useEffect(() => {
    const cleanCode = normalizeSignatureCode(coreProfile.code);
    const hasProfile = coreProfile.name.trim() && cleanCode.length === 9;
    if (hasProfile) {
      setShowPostRequirement(false);
      if (communityError?.includes("Add your CES profile")) {
        setCommunityError(null);
      }
    }
  }, [coreProfile.code, coreProfile.name, communityError]);

  const handleProfileFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : undefined;
      setCoreProfile((prev) => ({
        ...prev,
        photoData: dataUrl,
        photoName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePostImageFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setDraftPost((prev) => ({ ...prev, imageData: "", imageName: "" }));
      setPostImageError(null);
      return;
    }
    setPostImageError(null);
    if (file.size > MAX_POST_IMAGE_BYTES) {
      setPostImageError("Image too large (max 2 MB). Please choose a smaller file.");
      setDraftPost((prev) => ({ ...prev, imageData: "", imageName: "" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : undefined;
      setDraftPost((prev) => ({
        ...prev,
        imageData: dataUrl,
        imageName: file.name,
      }));
      setPostImageError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const themePreset = THEME_PRESETS[uiTheme];
  const backdropClass = themePreset.backdropClass ?? "";
  const panelClass = themePreset.panelClass ?? "";

  const handleThemeChange = useCallback((theme: UITheme) => {
    setUiTheme(theme);
    // local-only: theme persists in localStorage via persistTheme()
  }, []);

  return (
    <div
      className={`min-h-screen w-full flex justify-center items-start md:items-center px-4 py-5 sm:px-5 md:p-6 theme-shell ${backdropClass}`}
      style={{ fontFamily: themePreset.fontFamily }}
    >
      <div
        className={`w-full max-w-5xl rounded-2xl shadow-xl p-5 sm:p-6 md:p-7 space-y-5 panel-surface ${panelClass}`}
      >
        <header className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-1 pr-28 md:pr-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
              Atlastizen Universal
              <br />
              Time & Tools
            </h1>
          </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-end sm:gap-5">
              <div className="flex flex-col gap-2 text-xs uppercase tracking-wide text-zinc-400">
                <label htmlFor={panelSelectId}>Dashboard Panel</label>
                <select
                  id={panelSelectId}
                  className="themed-input rounded-lg px-2 py-1 text-xs uppercase tracking-wide shadow-sm"
                value={activePanel}
                onChange={(event) => setActivePanel(event.target.value as PanelId)}
              >
                {PANEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="absolute top-0 right-0 md:static flex flex-col items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full hover:opacity-80 transition"
                onClick={() => setActivePanel("coreSignature")}
              >
                <span className="inline-flex items-center justify-center" style={signatureRingStyleThin}>
                  <span className="relative h-11 w-11 rounded-full overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
                    {profileImageSrc ? (
                      <img src={profileImageSrc} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-base text-zinc-100">
                        {coreProfile.name ? coreProfile.name[0]?.toUpperCase() : "✧"}
                      </span>
                    )}
                    {signatureDetails.special === "diamond" ? (
                      <div
                        className="pointer-events-none absolute inset-0 rounded-full mix-blend-screen opacity-80"
                        style={{
                          background:
                            "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.6) 0deg 10deg, rgba(255,255,255,0.05) 10deg 20deg)",
                        }}
                      />
                    ) : null}
                    {signatureDetails.special === "rainbow" ? (
                      <div
                        className="pointer-events-none absolute inset-[6%] rounded-full mix-blend-screen opacity-75 blur-[0.6px]"
                        style={{ background: CORE_SPECIAL_GRADIENT }}
                      />
                    ) : null}
                    {signatureDetails.special === "white" ? (
                      <div
                        className="pointer-events-none absolute inset-[6%] rounded-full mix-blend-screen opacity-75 blur-[0.6px]"
                        style={{ background: "#ffffff" }}
                      />
                    ) : null}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="themed-button rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                onClick={() => setActivePanel("settings")}
              >
                Settings
              </button>
            </div>
          </div>
        </header>

        {activePanel === "settings" && (
          <section className="themed-card p-5 space-y-4">
            <div className="flex flex-col gap-1">
              <div className="text-sm uppercase tracking-wide text-zinc-400">Interface Settings</div>
              <p className="text-xs text-zinc-400">
                Choose a theme and toggle the Atlas sparkles without leaving the dashboard.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-zinc-400">
                <label htmlFor={themeSelectId}>UI Mode</label>
                <select
                  id={themeSelectId}
                  className="themed-input rounded-lg px-2 py-2 text-sm shadow-sm"
                  value={uiTheme}
                  onChange={(event) => handleThemeChange(event.target.value as UITheme)}
                >
                  <option value="normal">Normal</option>
                  <option value="retro">Retro Sci-Fi</option>
                  <option value="atlas">Atlas Island</option>
                </select>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">
                <span>Atlas Sparkles</span>
                <button
                  type="button"
                  className="themed-button rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                  onClick={() => setSparkleEnabled((v) => !v)}
                >
                  {sparkleEnabled ? "On" : "Off"}
                </button>
              </div>
            </div>
            {uiTheme === "atlas" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-sm text-zinc-200 flex items-center gap-2">
                    <span role="img" aria-label="mode">🌙</span>
                    <label className="text-xs uppercase tracking-wide text-zinc-400">Umbra / Lux</label>
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <button
                      type="button"
                      className={`themed-button px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${atlasTone === "umbra" ? "opacity-100" : "opacity-70"}`}
                      onClick={() => setAtlasTone("umbra")}
                    >
                      Umbra
                    </button>
                    <button
                      type="button"
                      className={`themed-button px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${atlasTone === "lux" ? "opacity-100" : "opacity-70"}`}
                      onClick={() => setAtlasTone("lux")}
                    >
                      Lux
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col text-xs uppercase tracking-wide text-zinc-400">
                      <span>Hue A</span>
                      <input
                        type="color"
                        value={atlasHueA}
                        onChange={(e) => setAtlasHueA(e.target.value)}
                        className="w-16 h-10 rounded-md border border-white/20 bg-transparent"
                      />
                    </div>
                    <div className="flex flex-col text-xs uppercase tracking-wide text-zinc-400">
                      <span>Hue B</span>
                      <input
                        type="color"
                        value={atlasHueB}
                        onChange={(e) => setAtlasHueB(e.target.value)}
                        className="w-16 h-10 rounded-md border border-white/20 bg-transparent"
                      />
                    </div>
                    <div className="flex flex-col text-xs uppercase tracking-wide text-zinc-400">
                      <span>Panel Border Hue</span>
                      <input
                        type="color"
                        value={atlasHueBorder}
                        onChange={(e) => setAtlasHueBorder(e.target.value)}
                        className="w-16 h-10 rounded-md border border-white/20 bg-transparent"
                      />
                    </div>
                    <div className="flex flex-col text-xs uppercase tracking-wide text-zinc-400">
                      <span>Panel Hue</span>
                      <input
                        type="color"
                        value={atlasHuePanel}
                        onChange={(e) => setAtlasHuePanel(e.target.value)}
                        className="w-16 h-10 rounded-md border border-white/20 bg-transparent"
                      />
                    </div>
                    <div className="flex flex-col text-xs uppercase tracking-wide text-zinc-400">
                      <span>Background Hue</span>
                      <input
                        type="color"
                        value={atlasHueBg}
                        onChange={(e) => setAtlasHueBg(e.target.value)}
                        className="w-16 h-10 rounded-md border border-white/20 bg-transparent"
                      />
                    </div>
                    <div className="flex flex-col text-xs uppercase tracking-wide text-zinc-400">
                      <span>Text Hue</span>
                      <input
                        type="color"
                        value={atlasHueText}
                        onChange={(e) => setAtlasHueText(e.target.value)}
                        className="w-16 h-10 rounded-md border border-white/20 bg-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <label className="text-xs uppercase tracking-wide text-zinc-400 sm:min-w-[92px]">
                      Theme Name
                    </label>
                    <input
                      type="text"
                      value={atlasThemeName}
                      onChange={(e) => setAtlasThemeName(e.target.value)}
                      placeholder="e.g. Aurora Lagoon"
                      className="themed-input w-full rounded-lg px-3 py-2 text-sm shadow-sm"
                    />
                    <button
                      type="button"
                      className="themed-button sm:ml-auto rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                      onClick={() => {
                        const trimmed = atlasThemeName.trim();
                        const name =
                          trimmed ||
                          `Atlas ${atlasTone === "lux" ? "Lux" : "Umbra"} ${new Date().toLocaleTimeString()}`;
                        setSavedAtlasThemes((list) => [
                          ...list,
                          {
                            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
                            name,
                            tone: atlasTone,
                            hueA: atlasHueA,
                            hueB: atlasHueB,
                            hueBorder: atlasHueBorder,
                            huePanel: atlasHuePanel,
                            hueBg: atlasHueBg,
                            hueText: atlasHueText,
                          },
                        ]);
                        setAtlasThemeName("");
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
            {uiTheme === "atlas" && savedAtlasThemes.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-zinc-400">Saved Atlas Themes</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {savedAtlasThemes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="themed-subcard text-left px-3 py-2 text-sm text-zinc-100 flex items-center justify-between"
                      style={{ background: `linear-gradient(135deg, ${t.hueA}20, ${t.hueB}30)` }}
                      onClick={() => {
                        setAtlasTone(t.tone);
                        setAtlasHueA(t.hueA);
                        setAtlasHueB(t.hueB);
                        setAtlasHueBorder(t.hueBorder ?? t.hueA);
                        setAtlasHuePanel(t.huePanel ?? "#0f172a");
                        setAtlasHueBg(t.hueBg ?? "#0b1220");
                        setAtlasHueText(t.hueText ?? "#fffbef");
                        setUiTheme("atlas");
                        setAtlasThemeName(t.name);
                      }}
                    >
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-xs uppercase tracking-wide text-zinc-300">{t.tone}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {["sol", "luna", "ray", "postal"].includes(activePanel) && (
          <section className="themed-card p-5 space-y-3">
            <div className="flex flex-col gap-3">
              <div className="space-y-1">
                <div className="text-xs md:text-sm uppercase text-zinc-400">AUT</div>
                <div className="text-3xl md:text-4xl font-semibold text-white leading-tight">{data.autClock}</div>
                <div className="text-sm md:text-base text-zinc-200">Local {formatLongTime(now)}</div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                  <span>Location:</span>
                  <span className="text-[12px] text-zinc-300">{locationPrimary}</span>
                  <button
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-100 hover:bg-white/10 transition"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos: GeolocationPosition) =>
                            setCoords({
                              lat: pos.coords.latitude,
                              lon: pos.coords.longitude,
                            }),
                          () => setCoords(fallback),
                          { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 }
                        );
                      }
                    }}
                  >
                    Recenter
                  </button>
                </div>
              </div>
            </div>
            <div className={`flex flex-wrap items-center gap-2 text-[11px] ${timeZoneTone}`}>
              <span>{timeZoneLine}</span>
              <button
                className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-100 hover:bg-white/10 transition"
                onClick={() => setShowCoords((v) => !v)}
              >
                {showCoords ? "Hide" : "Show"}
              </button>
              <span className="text-[11px] text-zinc-400">
                Lat/Lon: {showCoords ? `lat ${coords.lat.toFixed(4)}°, lon ${coords.lon.toFixed(4)}°` : "—"}
              </span>
            </div>
            {locationHint ? (
              <div className={`flex flex-wrap items-center gap-2 text-xs ${locationHintTone}`}>
                <span className="break-words">{locationHint}</span>
                {status === "granted" && placeStatus === "error" ? (
                  <button
                    className="rounded-lg px-2 py-1 text-xs text-emerald-300 transition hover:text-emerald-200"
                    onClick={() => retry()}
                  >
                    Try again
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        )}

        {/* Location panel removed from Sol/Luna/Ray/Postal to avoid duplication */}

        {activePanel === "coreSignature" && (
          <section className="themed-card p-5 space-y-5">
            <div className="flex flex-col gap-1">
              <div className="text-sm uppercase tracking-wide text-zinc-400">Core Energetic Signature Profile</div>
              <p className="text-sm text-zinc-300">
                Encode your Core Energetic Signature as nine digits, choose a name, and wrap it around your profile.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-[1.35fr_1fr] md:items-start max-w-full">
              <form className="space-y-4 max-w-full" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-xs uppercase tracking-[0.28em] text-zinc-400">Name</span>
                    <input
                      type="text"
                      value={coreProfile.name}
                      onChange={(event) =>
                        setCoreProfile((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Your name or handle"
                      className="themed-input w-full rounded-lg px-3 py-2 text-base shadow-sm"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-xs uppercase tracking-[0.28em] text-zinc-400">Core Energetic Signature</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={9}
                      value={coreProfile.code}
                      onChange={(event) =>
                        setCoreProfile((prev) => ({
                          ...prev,
                          code: normalizeSignatureCode(event.target.value),
                        }))
                      }
                      placeholder="123456789"
                      className="themed-input w-full rounded-lg px-3 py-2 font-mono text-lg tracking-[0.3em] shadow-sm"
                    />
                    <span className="text-[11px] text-zinc-400 leading-relaxed">
                      9 digits. Each digit colors one ring slice. Last two digits: 10 → white hue, 11 → crystalline
                      diamond effect, 12 → rainbow spectrum.
                    </span>
                  </label>
                </div>

                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-xs uppercase tracking-[0.28em] text-zinc-400">Upload CES Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfileFile}
                    className="text-sm text-zinc-300 w-full max-w-full file:mr-3 file:rounded-md file:border file:border-white/15 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:uppercase file:tracking-wide file:text-zinc-100"
                  />
                  <span className="text-[11px] text-zinc-400">
                    Image is synced with your Vercel profile (base64). Clear to remove it from storage.
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xs text-zinc-200">
                    {profileSaving
                      ? "Auto-saving to Vercel…"
                      : profileLoading
                      ? "Loading from Vercel…"
                      : profileSavedAt
                      ? `Saved ${new Date(profileSavedAt).toLocaleTimeString()}`
                      : "Changes auto-save when name + 9-digit code are set."}
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-white/20 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/10"
                    onClick={() =>
                      setCoreProfile((prev) => ({
                        ...prev,
                        photoData: undefined,
                        photoName: undefined,
                      }))
                    }
                    disabled={profileSaving}
                  >
                    Clear photo
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="themed-button rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wide disabled:opacity-60"
                    onClick={startPasskeyRegistration}
                    disabled={passkeyBusy}
                  >
                    Set up passkey
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/25 px-3 py-2 text-xs text-zinc-100 transition hover:bg-white/10 disabled:opacity-60"
                    onClick={startPasskeyAuth}
                    disabled={passkeyBusy}
                  >
                    Sign in with passkey
                  </button>
                  {passkeyStatus ? (
                    <div className="text-xs text-emerald-300">{passkeyStatus}</div>
                  ) : null}
                </div>
                {profileError ? <div className="text-xs text-rose-300">{profileError}</div> : null}
              </form>

              <div className="w-full max-w-[420px] mx-auto rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/10">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="relative inline-flex items-center justify-center" style={signatureRingStyle}>
                    <div className="relative h-36 w-36 rounded-full overflow-hidden border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 shadow-inner">
                      {profileImageSrc ? (
                        <img
                          src={profileImageSrc}
                          alt="Profile"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl text-zinc-500">
                          {coreProfile.name ? coreProfile.name[0]?.toUpperCase() : "✧"}
                        </div>
                      )}
                      {signatureDetails.special === "diamond" ? (
                        <div
                          className="pointer-events-none absolute inset-0 rounded-full mix-blend-screen opacity-80"
                          style={{
                            background:
                              "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.6) 0deg 10deg, rgba(255,255,255,0.05) 10deg 20deg)",
                          }}
                        />
                      ) : null}
                      {signatureDetails.special === "rainbow" ? (
                        <div
                          className="pointer-events-none absolute inset-[6%] rounded-full mix-blend-screen opacity-75 blur-[0.6px]"
                          style={{ background: CORE_SPECIAL_GRADIENT }}
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="text-lg font-semibold">{coreProfile.name || "Unnamed Traveller"}</div>
                  <div className="text-sm text-zinc-300">
                    Core Code:{" "}
                    <span className="font-mono tracking-[0.28em]">{formatSignatureDisplay(signatureDetails.sanitized)}</span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {signatureDetails.special
                      ? signatureDetails.special === "white"
                        ? "Last two digits → 10 (White hue highlight)"
                        : signatureDetails.special === "diamond"
                        ? "Last two digits → 11 (Crystalline overlay)"
                        : "Last two digits → 12 (Full-spectrum rainbow)"
                      : "Each digit paints one ninth of the ring."}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activePanel === "community" && (
          <section className="themed-card p-5 space-y-5">
            <div className="flex flex-col gap-1">
              <div className="text-sm uppercase tracking-wide text-zinc-400">Community Message Board</div>
              <p className="text-sm text-zinc-300">
                Share reflections, coordinates, or Ray sightings. Add an optional image to accompany your message.
              </p>
            </div>

            <form
              ref={postFormRef}
              className="space-y-4"
              onSubmit={onPostSubmit}
            >
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-[0.28em] text-zinc-400">Core Energetic Signature:</span>
                    {coreProfile.name.trim() ? (
                      <span className="text-sm text-zinc-200">{coreProfile.name.trim()}</span>
                    ) : (
                      <button
                        type="button"
                        className="text-sm text-emerald-300 underline-offset-2 hover:underline"
                        onClick={() => setActivePanel("coreSignature")}
                      >
                        Create CES Profile
                      </button>
                    )}
                    <span className="text-[11px] text-zinc-500">
                    {normalizeSignatureCode(coreProfile.code).length === 9
                      ? `Core # ${formatSignatureDisplay(normalizeSignatureCode(coreProfile.code))}`
                      : " "}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    {!passkeySignedIn ? (
                      <div className="flex items-center gap-2 text-[11px] text-amber-300">
                        <span>Sign in with your passkey to post.</span>
                        <button
                          type="button"
                          className="rounded-full border border-white/20 px-2 py-1 text-[10px] uppercase tracking-wide text-amber-50 hover:bg-white/10 disabled:opacity-50"
                          onClick={() => startPasskeyAuth()}
                          disabled={passkeyBusy}
                        >
                          Sign in
                        </button>
                      </div>
                    ) : null}
                    {showPostRequirement ? <div className="text-[11px] text-amber-300">CES Profile required to post</div> : null}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor={messageInputId} className="flex flex-col gap-1 text-sm">
                    <span className="text-xs uppercase tracking-[0.28em] text-zinc-400">Message</span>
                  </label>
                  <div className="relative">
                    <textarea
                      id={messageInputId}
                      value={draftPost.message}
                      onChange={(event) =>
                        setDraftPost((prev) => ({
                          ...prev,
                          message: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          postFormRef.current?.requestSubmit();
                        }
                      }}
                      rows={2}
                      placeholder="What’s resonating right now?"
                      className="themed-input w-full rounded-lg px-3 py-2 pr-40 pb-14 text-base shadow-sm resize-y min-h-[60px]"
                    />
                    <button
                      type="submit"
                      className="absolute bottom-2 right-2 inline-flex items-center justify-center rounded-full border border-white/20 bg-emerald-500/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-400/80 disabled:opacity-50 disabled:hover:bg-emerald-500/80"
                      disabled={
                        !draftPost.message.trim() ||
                        normalizeSignatureCode(coreProfile.code).length !== 9 ||
                        !coreProfile.name.trim() ||
                        communityLoading ||
                        !passkeySignedIn
                      }
                    >
                      Share
                    </button>
                    <button
                      type="button"
                      className="absolute bottom-2 right-20 inline-flex items-center justify-center rounded-full border border-white/25 bg-black/40 px-2.5 py-2 text-sm text-zinc-100 shadow-sm transition hover:bg-white/10"
                      onClick={() => postImageInputRef.current?.click()}
                      aria-label="Add photo"
                    >
                      📷
                    </button>
                    <input
                      ref={postImageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePostImageFile}
                      className="hidden"
                    />
                  </div>
                  {postImageError ? <div className="text-[11px] text-rose-300">{postImageError}</div> : null}
                  {draftPost.imageData ? (
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30 shadow-inner shadow-black/40">
                      <img
                        src={draftPost.imageData}
                        alt={draftPost.imageName || "Attached image"}
                        className="w-full max-h-72 object-cover"
                      />
                      <div className="flex items-center justify-between px-3 py-2 text-[11px] text-zinc-200">
                        <span className="truncate">{draftPost.imageName || "Attached image"}</span>
                        <button
                          type="button"
                          className="text-rose-200 underline-offset-2 hover:underline"
                          onClick={() => setDraftPost((prev) => ({ ...prev, imageData: "", imageName: "" }))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-500">Optional photo or screenshot; it will show under your post.</p>
                  )}
                </div>

                {communityLoading || communityError ? (
                  <div className={`text-xs ${communityError ? "text-rose-300" : "text-zinc-400"}`}>
                    {communityLoading ? "Posting…" : communityError}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 border-t border-white/10 pt-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <div className="text-xs uppercase tracking-[0.28em] text-zinc-400">Message Board</div>
                  <div className="text-sm text-zinc-200">
                    {communityLoading
                      ? "Loading posts…"
                      : posts.length === 0
                      ? "No posts yet — start the thread."
                      : `${posts.length} message(s) synced`}
                  </div>
                </div>
                {communityError ? <div className="text-xs text-rose-300">{communityError}</div> : null}
                <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
                  {posts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-3 text-sm text-zinc-400">
                      Be the first to post. Add your Core code to paint a ring beside your note.
                    </div>
                  ) : (
                    posts.map((post) => {
                      const postSignature = deriveSignatureSegments(post.code);
                      const chipBg = buildSignatureGradient(postSignature.colors, postSignature.special);
                      const postImage =
                        typeof post.photoData === "string" && post.photoData.length > 0 ? post.photoData : null;
                      const postInitial = post.name?.trim()?.[0]?.toUpperCase() ?? "✧";
                      const attachedImage =
                        typeof post.imageData === "string" && post.imageData.length > 0 ? post.imageData : null;
                      return (
                        <article
                          key={post.id}
                          className="rounded-xl border border-white/10 bg-black/30 p-3 shadow-sm shadow-black/40"
                        >
                          <div className="flex items-start gap-3">
                            <div className="shrink-0">
                              <div
                                className="h-11 w-11 rounded-full p-[3px]"
                                style={{ background: chipBg, boxShadow: "0 6px 14px rgba(0,0,0,0.4)" }}
                              >
                                <div className="relative h-full w-full overflow-hidden rounded-full border border-white/15 bg-zinc-950/80 flex items-center justify-center text-sm font-semibold text-zinc-400">
                                  {postImage ? (
                                    <img
                                      src={postImage}
                                      alt={`${post.name || "Community member"} CES photo`}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <span>{postInitial}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <div className="font-semibold text-white">{post.name || "Anonymous"}</div>
                                <div className="text-[11px] text-zinc-400">
                                  {new Date(post.createdAt).toLocaleString()}
                                </div>
                              </div>
                              <div className="text-sm text-zinc-200 whitespace-pre-wrap break-words">
                                {post.message}
                              </div>
                              {attachedImage ? (
                                <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                                  <img
                                    src={attachedImage}
                                    alt={post.imageName || "Attached image"}
                                    className="w-full max-h-80 object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              ) : null}
                              {post.code ? (
                                <div className="text-[11px] font-mono tracking-[0.24em] text-zinc-400">
                                  {formatSignatureDisplay(post.code)}
                                </div>
                              ) : null}
                            </div>
                  {/* Delete button hidden for non-admin; admin may call API with token manually */}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </form>
          </section>
        )}

        {activePanel === "clock" && (
          <section className="rounded-2xl border border-zinc-700 bg-gradient-to-br from-indigo-800/40 via-cyan-700/30 to-emerald-700/20 p-6 shadow-inner">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-zinc-300">
                  AUT (Alastizen Universal Time)
                </div>
                <div className="text-xs text-zinc-400">
                  Sunrise → 00:00 AUT • Sunset → 12:00 AUT • Next Sunrise → 24:00/00:00 AUT
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-200">
                  <span className="font-medium text-white">{locationPrimary}</span>
                  <button
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-100 hover:bg-white/10 transition"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos: GeolocationPosition) =>
                            setCoords({
                              lat: pos.coords.latitude,
                              lon: pos.coords.longitude,
                            }),
                          () => setCoords(fallback),
                          { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 }
                        );
                      }
                    }}
                  >
                    Recenter
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                  <span className={timeZoneTone}>{timeZoneLine}</span>
                  <button
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-100 hover:bg-white/10 transition"
                    onClick={() => setShowCoords((v) => !v)}
                  >
                    {showCoords ? "Hide" : "Show"} Lat/Lon
                  </button>
                  <span className="text-[11px] text-zinc-300">
                    {showCoords ? `lat ${coords.lat.toFixed(4)}°, lon ${coords.lon.toFixed(4)}°` : "—"}
                  </span>
                </div>
                {locationHint ? (
                  <div className={`mt-1 flex flex-wrap items-center gap-2 text-[11px] ${locationHintTone}`}>
                    <span className="break-words">{locationHint}</span>
                    {status === "granted" && placeStatus === "error" ? (
                      <button
                        className="rounded-lg px-2 py-1 text-[11px] text-emerald-300 transition hover:text-emerald-200"
                        onClick={() => retry()}
                      >
                        Try again
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div className="text-5xl md:text-6xl font-bold tabular-nums">
                  {data.autClock}
                </div>
                <div className="text-sm text-zinc-300">
                  Local {formatLongTime(now)}
                  {data.dayLenMin > 0 && (
                    <span className="text-zinc-500">
                      {" "}·{" "}
                      {data.autHours < 12
                        ? `1 AUT sec = ${(data.dayLenMin / 720).toFixed(2)} real sec`
                        : `1 AUT sec = ${(data.nightLenMin / 720).toFixed(2)} real sec`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Ray Dial — primary feature below the clock */}
            <div className="mt-2 space-y-5 overflow-hidden rounded-2xl p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-zinc-400">Ray Dial</div>
                  <div className="text-lg font-semibold" style={{ color: activeRay.color }}>
                    Active Cycle: <span className="underline decoration-dotted">{activeRay.name}</span>
                  </div>
                  {rayWindowTimes ? (
                    <div className="text-xs text-zinc-400">
                      AUT {rayWindowTimes.start.aut} → {rayWindowTimes.end.aut} • Local {rayWindowTimes.start.local} →{" "}
                      {rayWindowTimes.end.local}
                    </div>
                  ) : null}
                </div>
                <div className="text-sm text-zinc-300 text-right">
                  <div>{rayProgressPct}% through this cycle</div>
                  <div>≈ {Math.ceil(remainingAUTHours * 60)} AUT min left • ≈ {Math.ceil(remainingRealMin)} real min</div>
                </div>
              </div>

              <div className="flex justify-center">
                <div className={`relative aspect-square w-full overflow-hidden ${ringSizeClass}`}>
                  <svg
                    viewBox={ringViewBox}
                    className="block h-auto w-full overflow-hidden text-zinc-100 drop-shadow-[0_10px_26px_rgba(15,23,42,0.55)]"
                  >
                    <circle
                      cx="0"
                      cy="0"
                      r={RING_OUTER_RADIUS + 4}
                      fill="#0f172a"
                      fillOpacity="0.35"
                      stroke="#1e293b"
                      strokeWidth="0.8"
                    />
                    {dialSegments.map((segment) => {
                      const isActive = segment.index === rayIndex;
                      return (
                        <g key={segment.index}>
                          <path
                            d={segment.path}
                            fill={segment.ray.color}
                            fillOpacity={isActive ? 1 : 0.78}
                            stroke={isActive ? "#f8fafc" : "rgba(15,23,42,0.55)"}
                            strokeWidth={isActive ? 1.6 : 0.6}
                          />
                          <text
                            x={segment.labelX.toFixed(3)}
                            y={segment.labelY.toFixed(3)}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="4.1"
                            fill={segment.ray.labelColor ?? "#e2e8f0"}
                          >
                            {segment.labelLines.map((line, lineIdx) => (
                              <tspan
                                key={`${segment.index}-${lineIdx}`}
                                x={segment.labelX.toFixed(3)}
                                dy={lineIdx === 0 ? (segment.labelLines.length > 1 ? "-0.2em" : "0") : "1.1em"}
                              >
                                {line}
                              </tspan>
                            ))}
                          </text>
                        </g>
                      );
                    })}
                    <line
                      x1={pointerInner.x.toFixed(3)}
                      y1={pointerInner.y.toFixed(3)}
                      x2={pointerCoord.x.toFixed(3)}
                      y2={pointerCoord.y.toFixed(3)}
                      stroke="#f8fafc"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <circle cx="0" cy="0" r="6" fill="#0b1120" stroke="#f1f5f9" strokeWidth="1" />
                  </svg>
                </div>
              </div>

              <div className="themed-subcard p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className="mt-1 h-3 w-3 rounded-full ring-2 ring-white/25"
                    style={{ backgroundColor: activeRay.color }}
                  />
                  <div className="space-y-2">
                    <div className="text-base font-semibold text-zinc-50">
                      {rayReading?.title ?? activeRay.name}
                    </div>
                    {rayReading ? (
                      <div className="space-y-1 text-sm leading-relaxed text-zinc-200">
                        <div><span className="font-semibold text-zinc-100">Core Energetic Signature: </span>{rayReading.core}</div>
                        <div><span className="font-semibold text-zinc-100">Gifts: </span>{rayReading.gifts}</div>
                        <div><span className="font-semibold text-zinc-100">Ideal For: </span>{rayReading.ideal}</div>
                        <div><span className="font-semibold text-zinc-100">Affirmation: </span>{rayReading.affirmation}</div>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed text-zinc-200">
                        Ray reading unavailable for this cycle.
                      </p>
                    )}
                    <div className="text-xs text-zinc-400">
                      AUT {rayWindowTimes?.start.aut} → {rayWindowTimes?.end.aut} • Local {rayWindowTimes?.start.local} → {rayWindowTimes?.end.local}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Solar timing — Sunrise → Apex → Sunset → Next Sunrise */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
                <div className="text-sm text-zinc-400">Sunrise (00:00 AUT)</div>
                <div className="text-xl font-semibold">{formatShortTime(data.sunriseLocal)}</div>
              </div>
              <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
                <div className="text-sm text-zinc-400">Solar Apex (06:00 AUT)</div>
                <div className="text-xl font-semibold">{formatShortTime(data.solarNoonLocal)}</div>
              </div>
              <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
                <div className="text-sm text-zinc-400">Solar Sunset (12:00 AUT)</div>
                <div className="text-xl font-semibold">{formatShortTime(data.sunsetLocal)}</div>
              </div>
              <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
                <div className="text-sm text-zinc-400">Next Sunrise (24:00 AUT)</div>
                <div className="text-xl font-semibold">{formatShortTime(data.nextSunriseLocal)}</div>
              </div>
            </div>
          </section>
        )}

        {activePanel === "cosmic" && (
          <CosmicCalendarPanel
            autClock={data.autClock}
            autDateLabel={autDateLabel}
            autEarthSolarCyclesLabel={autEarthSolarCycles}
            autLunarCyclesLabel={autLunarCycles}
            localTimeLabel={formatLongTime(now)}
            localDateLabel={localDateLabel}
            locationLabel={locationPrimary}
          />
        )}

        {activePanel === "sol" && (
          <>
        {/* Sol Panel */}
        <section className="themed-card p-5 space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm uppercase tracking-wide text-zinc-400">Sol (Sun)</div>
              <div className="text-4xl font-bold tabular-nums">
                δ☉ <span className="text-amber-300">{solDeclStr}</span>
              </div>
              <div className="text-sm text-zinc-300">
                Alt {solAltStr} • Az {solAzStr}
              </div>
            </div>
          </div>
          {solArc ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-zinc-400">
                Day Horizon Track
                <span className="normal-case">{solArcRangeLabel}</span>
              </div>
              <div className="relative mx-auto w-full max-w-xl">
                <svg
                  viewBox={`0 0 ${solArc.width} ${solArc.height}`}
                  className="w-full drop-shadow-[0_10px_24px_rgba(12,18,30,0.35)]"
                  role="presentation"
                >
                  <rect
                    x="0"
                    y="0"
                    width={solArc.width}
                    height={solArc.height}
                    fill="rgba(20,24,40,0.35)"
                    rx="14"
                  />
                  {solArc.areaPath ? (
                    <path d={solArc.areaPath} fill={solArcFillColor} stroke="none" />
                  ) : null}
                  {solArc.bands.map((band) => (
                    <line
                      key={band.label}
                      x1={solArc.leftPadding}
                      x2={solArc.width - solArc.rightPadding}
                      y1={band.y}
                      y2={band.y}
                      stroke={solLegendBandColor}
                      strokeDasharray="6 6"
                      strokeWidth="1"
                    />
                  ))}
                  <line
                    x1={solArc.leftPadding}
                    x2={solArc.width - solArc.rightPadding}
                    y1={solArc.horizonY}
                    y2={solArc.horizonY}
                    stroke={solLegendHorizonColor}
                    strokeDasharray="4 4"
                    strokeWidth="1.4"
                  />
                  <path
                    d={solArc.path}
                    fill="none"
                    stroke={solArcColor}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  {solArc.current ? (
                    <g>
                      <circle
                        cx={solArc.current.x}
                        cy={solArc.current.y}
                        r={7}
                        fill={solLegendIconColor}
                        stroke={solArcColor}
                        strokeWidth="1.5"
                      />
                      <path
                        d={`
                          M ${solArc.current.x - 4} ${solArc.current.y}
                          q 4 -7 8 0
                          q -4 7 -8 0
                        `}
                        fill={solArcColor}
                        fillOpacity={0.35}
                      />
                    </g>
                  ) : null}
                </svg>
                <span className="pointer-events-none absolute left-0 bottom-6 -translate-x-1/2 text-[0.65rem] uppercase tracking-[0.2em] text-zinc-500">
                  East
                </span>
                <span className="pointer-events-none absolute right-0 bottom-6 translate-x-1/2 text-[0.65rem] uppercase tracking-[0.2em] text-zinc-500">
                  West
                </span>
                <span className="pointer-events-none absolute left-1/2 bottom-2 -translate-x-1/2 text-[0.65rem] uppercase tracking-[0.2em] text-zinc-500">
                  South
                </span>
                <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[0.65rem] uppercase tracking-[0.2em] text-zinc-500">
                  Up / Zenith
                </span>
              </div>
              <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-2 w-10 rounded-full"
                    style={{ backgroundColor: solLegendPathColor }}
                    aria-hidden="true"
                  />
                  <span>Sun path (East → West)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex w-10 border-b border-dashed"
                    style={{ borderBottomColor: solLegendHorizonColor }}
                    aria-hidden="true"
                  />
                  <span>Horizon (0° altitude)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-3 w-3 rounded-full"
                    style={{ backgroundColor: solLegendIconColor, boxShadow: `0 0 0 1px ${solArcColor}` }}
                    aria-hidden="true"
                  />
                  <span>Live Sun position</span>
                </div>
              </div>
              <div className="text-xs text-zinc-500">
                δ☉ = Sun declination (°) — angular height of the Sun’s path relative to Earth’s equator.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-400">
              Solar track unavailable for this location/time.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <div className="uppercase tracking-wide text-amber-200/70">Sunrise</div>
              <div className="text-2xl font-semibold text-amber-100">{solRiseAut}</div>
              <div className="text-xs text-amber-100/80">Local {solRiseLocal}</div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <div className="uppercase tracking-wide text-amber-200/70">Solar Noon</div>
              <div className="text-2xl font-semibold text-amber-100">{solTransitAut}</div>
              <div className="text-xs text-amber-100/80">
                Local {solTransitLocal} • Alt {solTransitAltStr}
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <div className="uppercase tracking-wide text-amber-200/70">Sunset</div>
              <div className="text-2xl font-semibold text-amber-100">{solSetAut}</div>
              <div className="text-xs text-amber-100/80">Local {solSetLocal}</div>
            </div>
          </div>
        </section>
          </>
        )}

        {activePanel === "luna" && (
          <>
        {/* Luna Panel */}
        <section className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/40 p-4 sm:p-6 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm uppercase tracking-wide text-zinc-400">Luna (Moon)</div>
              <div className="text-4xl font-bold tabular-nums">
                δₘ <span className="text-emerald-200">{moonDeclStr}</span>
              </div>
              <div className="text-sm text-zinc-300">
                Alt {moonAltStr} • Az {moonAzStr}
              </div>
            </div>
            <div className="flex items-center justify-end gap-4">
              <MoonPhaseIcon phaseName={moonPhaseName} />
              <div className="space-y-1 text-right">
                <div className="text-sm text-zinc-300">Illumination</div>
                <div className="text-2xl font-semibold">
                  {moonIllumPct !== null ? `${moonIllumPct}%` : "—"}
                </div>
                <div className="text-xs uppercase tracking-wide text-zinc-400">
                  Phase <span className="text-zinc-200 normal-case">{moonPhaseName}</span>
                </div>
                {solsticeLinked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
                    Solstice-Linked Arc
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400">|δₘ| &lt; 23.44°</span>
                )}
              </div>
            </div>
          </div>

          {moonArc ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-zinc-400">
                Tonight Horizon Track
                <span className="normal-case">{moonArcRangeLabel}</span>
              </div>
              <div className="relative mx-auto w-full max-w-xl">
                <svg
                  viewBox={`0 0 ${moonArc.width} ${moonArc.height}`}
                  className="w-full drop-shadow-[0_10px_24px_rgba(11,15,30,0.35)]"
                  role="presentation"
                >
                  <rect
                    x="0"
                    y="0"
                    width={moonArc.width}
                    height={moonArc.height}
                    fill="rgba(12,17,31,0.25)"
                    rx="14"
                  />
                  {moonArc.areaPath ? (
                    <path d={moonArc.areaPath} fill={moonArcFillColor} stroke="none" />
                  ) : null}
                  {moonArc.bands.map((band) => (
                    <line
                      key={band.label}
                      x1={moonArc.leftPadding}
                      x2={moonArc.width - moonArc.rightPadding}
                      y1={band.y}
                      y2={band.y}
                      stroke={moonLegendBandColor}
                      strokeDasharray="6 6"
                      strokeWidth="1"
                    />
                  ))}
                  <line
                    x1={moonArc.leftPadding}
                    x2={moonArc.width - moonArc.rightPadding}
                    y1={moonArc.horizonY}
                    y2={moonArc.horizonY}
                    stroke={moonLegendHorizonColor}
                    strokeDasharray="4 4"
                    strokeWidth="1.4"
                  />
                  <path
                    d={moonArc.path}
                    fill="none"
                    stroke={moonArcColor}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                  {moonArc.current ? (
                    <g>
                      <circle
                        cx={moonArc.current.x}
                        cy={moonArc.current.y}
                        r={7}
                        fill={moonLegendIconColor}
                        stroke={moonArcColor}
                        strokeWidth="1.5"
                      />
                      <path
                        d={`
                          M ${moonArc.current.x - 3.5} ${moonArc.current.y}
                          q 3.5 -6 7 0
                          q -3.5 6 -7 0
                        `}
                        fill={moonArcColor}
                        fillOpacity={0.35}
                      />
                    </g>
                  ) : null}
                </svg>
                <span className="pointer-events-none absolute left-0 bottom-6 -translate-x-1/2 text-[0.65rem] uppercase tracking-[0.2em] text-zinc-500">
                  East
                </span>
                <span className="pointer-events-none absolute right-0 bottom-6 translate-x-1/2 text-[0.65rem] uppercase tracking-[0.2em] text-zinc-500">
                  West
                </span>
                <span className="pointer-events-none absolute left-1/2 bottom-2 -translate-x-1/2 text-[0.65rem] uppercase tracking-[0.2em] text-zinc-500">
                  South
                </span>
                <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[0.65rem] uppercase tracking-[0.2em] text-zinc-500">
                  Up / Zenith
                </span>
              </div>
              <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-2 w-10 rounded-full"
                    style={{ backgroundColor: moonLegendPathColor }}
                    aria-hidden="true"
                  />
                  <span>Moon path (East → West)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex w-10 border-b border-dashed"
                    style={{ borderBottomColor: moonLegendHorizonColor }}
                    aria-hidden="true"
                  />
                  <span>Horizon (0° altitude)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-3 w-3 rounded-full"
                    style={{ backgroundColor: moonLegendIconColor, boxShadow: `0 0 0 1px ${moonArcColor}` }}
                    aria-hidden="true"
                  />
                  <span>Live Moon position</span>
                </div>
              </div>
              <div className="text-xs text-zinc-500">
                δₘ = Moon declination (°) — angular height of the Moon’s path relative to Earth’s equator.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-400">
              Lunar track unavailable for this location/time.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
              <div className="text-sm text-zinc-400">Moonrise</div>
              <div className="text-2xl font-semibold">{moonRiseAut}</div>
              <div className="text-xs text-zinc-400">Local {moonRiseLocal}</div>
            </div>
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
              <div className="text-sm text-zinc-400">Transit</div>
              <div className="text-2xl font-semibold">{moonTransitAut}</div>
              <div className="text-xs text-zinc-400">Local {moonTransitLocal}</div>
              <div className="text-xs text-zinc-400">Alt {moonTransitAltStr}</div>
            </div>
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
              <div className="text-sm text-zinc-400">Moonset</div>
              <div className="text-2xl font-semibold">{moonSetAut}</div>
              <div className="text-xs text-zinc-400">Local {moonSetLocal}</div>
            </div>
          </div>
        </section>
          </>
        )}

        {activePanel === "compass" && (
          <>
        {/* Gyro Compass */}
        <section className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/40 p-4 sm:p-6 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm uppercase tracking-wide text-zinc-400">Gyro Compass</div>
              <div className="text-4xl font-bold tabular-nums text-zinc-100">
                {compassHeadingDisplay}
              </div>
              <div className="text-xs text-zinc-400">{compassStatusHint}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3 text-sm text-zinc-300">
                <span>Tilt β</span>
                <span className="rounded-lg bg-zinc-800/70 px-2 py-1 font-medium text-zinc-100">
                  {compassPitchDisplay}
                </span>
                <span>Roll γ</span>
                <span className="rounded-lg bg-zinc-800/70 px-2 py-1 font-medium text-zinc-100">
                  {compassRollDisplay}
                </span>
              </div>
              <button
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => requestCompass()}
                disabled={compassStatus === "active" || compassStatus === "unsupported"}
              >
                {compassStatus === "active" ? "Compass Active" : "Enable Gyro"}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-900/60 p-6 shadow-inner">
              <div className="relative mx-auto w-full max-w-sm">
                <svg viewBox="0 0 220 220" className="w-full">
                  <defs>
                    <radialGradient id="compass-face" cx="50%" cy="45%" r="60%">
                      <stop offset="0%" stopColor="rgba(30,41,59,0.9)" />
                      <stop offset="100%" stopColor="rgba(15,23,42,0.75)" />
                    </radialGradient>
                  </defs>
                  <circle cx="110" cy="110" r="100" fill="url(#compass-face)" stroke="rgba(148,163,184,0.45)" strokeWidth="1.6" />
                  {compassTickAngles.map((angle) => {
                    const rad = (angle * Math.PI) / 180;
                    const outerR = angle % 30 === 0 ? 100 : 98;
                    const innerR = angle % 30 === 0 ? 84 : 90;
                    const x1 = 110 + outerR * Math.sin(rad);
                    const y1 = 110 - outerR * Math.cos(rad);
                    const x2 = 110 + innerR * Math.sin(rad);
                    const y2 = 110 - innerR * Math.cos(rad);
                    return (
                      <line
                        key={`tick-${angle}`}
                        x1={x1.toFixed(1)}
                        y1={y1.toFixed(1)}
                        x2={x2.toFixed(1)}
                        y2={y2.toFixed(1)}
                        stroke={angle % 30 === 0 ? "rgba(248,250,252,0.55)" : "rgba(148,163,184,0.35)"}
                        strokeWidth={angle % 30 === 0 ? 1.6 : 1}
                      />
                    );
                  })}
                  {compassMajorAngles.map((angle) => {
                    const rad = (angle * Math.PI) / 180;
                    const x = 110 + 70 * Math.sin(rad);
                    const y = 110 - 70 * Math.cos(rad);
                    const label = headingToLabel(angle);
                    const fontSize = label.length === 1 ? 12 : 10;
                    return (
                      <text
                        key={`label-${angle}`}
                        x={x.toFixed(1)}
                        y={(y + 4).toFixed(1)}
                        textAnchor="middle"
                        fontSize={fontSize}
                        fill={label === "N" ? "#f8fafc" : "#cbd5f5"}
                        fontWeight={label === "N" ? 700 : 500}
                      >
                        {label}
                      </text>
                    );
                  })}
                  <g transform={`rotate(${compassPointerRotation}, 110, 110)`}>
                    <polygon
                      points="110,30 117,110 110,102 103,110"
                      fill="#f97316"
                      stroke="#fcd34d"
                      strokeWidth="1.4"
                    />
                    <polygon
                      points="110,190 117,120 110,126 103,120"
                      fill="rgba(148,163,184,0.45)"
                    />
                  </g>
                  <circle cx="110" cy="110" r="6" fill="#0f172a" stroke="#f8fafc" strokeWidth="1.2" />
                </svg>
              </div>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/50 p-5 text-sm text-zinc-200">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Sensor status</span>
                <span className="font-medium capitalize">{compassStatus}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Heading</span>
                <span className="font-medium">{compassHeadingDisplay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Tilt β</span>
                <span className="font-medium">{compassPitchDisplay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Roll γ</span>
                <span className="font-medium">{compassRollDisplay}</span>
              </div>
              <p className="text-xs text-zinc-500">
                Heading uses the device gyro; accuracy improves when your device is level and away from magnetic interference.
              </p>
            </div>
          </div>
        </section>
          </>
        )}

        {activePanel === "heartlight" && (
          <>
        {/* Heartlight System Map */}
        <section className="rounded-2xl border border-sky-500/30 bg-slate-900/60 p-6 space-y-4">
          <AtlasCometMap />
        </section>
          </>
        )}

        {activePanel === "ray" && (
          <>
        {/* Ray Dial */}
        <section className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/40 p-4 sm:p-6 space-y-6">
          <div className={rayHeaderClass}>
            <div>
              <div className="text-sm uppercase text-zinc-400 tracking-wide">
                Ray Dial
              </div>
              <div className="text-lg font-semibold text-zinc-100">
                Active Cycle: <span className="underline decoration-dotted">{activeRay.name}</span>
              </div>
              {rayWindowTimes ? (
                <div className="text-xs text-zinc-400">
                  AUT {rayWindowTimes.start.aut} → {rayWindowTimes.end.aut} • Local{" "}
                  {rayWindowTimes.start.local} → {rayWindowTimes.end.local}
                </div>
              ) : null}
            </div>
            <div className={`text-sm text-zinc-300 ${PRESENT_ONLY ? "" : "text-right"}`}>
              <div>{progressPct}% through this cycle</div>
              <div>
                ≈ {Math.ceil(remainingAUTHours * 60)} AUT min left • ≈ {Math.ceil(remainingRealMin)} real min
              </div>
            </div>
          </div>

          <div className={ringLayoutClass}>
            <div className={`relative mx-auto aspect-square w-full overflow-hidden ${ringSizeClass}`}>
              <svg
                viewBox={ringViewBox}
                className="block h-auto w-full overflow-hidden text-zinc-100 drop-shadow-[0_6px_16px_rgba(15,23,42,0.45)]"
              >
                <circle
                  cx="0"
                  cy="0"
                  r={RING_OUTER_RADIUS + 4}
                  fill="#0f172a"
                  fillOpacity="0.35"
                  stroke="#1e293b"
                  strokeWidth="0.8"
                />
                {dialSegments.map((segment) => {
                  const isActive = segment.index === rayIndex;
                  return (
                    <g key={segment.index}>
                      <path
                        d={segment.path}
                        fill={segment.ray.color}
                        fillOpacity={isActive ? 1 : 0.78}
                        stroke={isActive ? "#f8fafc" : "rgba(15,23,42,0.55)"}
                        strokeWidth={isActive ? 1.6 : 0.6}
                      />
                      <text
                        x={segment.labelX.toFixed(3)}
                        y={segment.labelY.toFixed(3)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="4.1"
                        fill={segment.ray.labelColor ?? "#e2e8f0"}
                      >
                        {segment.labelLines.map((line, lineIdx) => (
                          <tspan
                            key={`${segment.index}-${lineIdx}`}
                            x={segment.labelX.toFixed(3)}
                            dy={lineIdx === 0 ? (segment.labelLines.length > 1 ? "-0.2em" : "0") : "1.1em"}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    </g>
                  );
                })}
                <line
                  x1={pointerInner.x.toFixed(3)}
                  y1={pointerInner.y.toFixed(3)}
                  x2={pointerCoord.x.toFixed(3)}
                  y2={pointerCoord.y.toFixed(3)}
                  stroke="#f8fafc"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <circle cx="0" cy="0" r="6" fill="#0b1120" stroke="#f1f5f9" strokeWidth="1" />
              </svg>
            </div>
          </div>

          <div className="themed-subcard p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div
                className="mt-1 h-3 w-3 rounded-full ring-2 ring-white/25"
                style={{ backgroundColor: activeRay.color }}
              />
              <div className="space-y-2">
                <div className="text-base font-semibold text-zinc-50">
                  {rayReading?.title ?? activeRay.name}
                </div>
                {rayReading ? (
                  <div className="space-y-1 text-sm leading-relaxed text-zinc-200">
                    <div><span className="font-semibold text-zinc-100">Core Energetic Signature: </span>{rayReading.core}</div>
                    <div><span className="font-semibold text-zinc-100">Gifts: </span>{rayReading.gifts}</div>
                    <div><span className="font-semibold text-zinc-100">Ideal For: </span>{rayReading.ideal}</div>
                    <div><span className="font-semibold text-zinc-100">Affirmation: </span>{rayReading.affirmation}</div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-zinc-200">
                    Ray reading unavailable for this cycle.
                  </p>
                )}
                <div className="text-xs text-zinc-400">
                  AUT {rayWindowTimes?.start.aut} → {rayWindowTimes?.end.aut} • Local {rayWindowTimes?.start.local} → {rayWindowTimes?.end.local}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {rayWindowsDetailed.map((win) => {
              const isOpen = openRayIdx === win.idx;
              const isActive = win.idx === rayIndex;
              const pillStyle: CSSProperties = { ["--pill-accent" as string]: win.color };
              return (
                <div key={win.idx} className="themed-subcard overflow-hidden p-0">
                  <button
                    type="button"
                    className="ray-pill text-left"
                    onClick={() => setOpenRayIdx(isOpen ? -1 : win.idx)}
                    aria-expanded={isOpen}
                    style={pillStyle}
                  >
                    <div className="ray-pill-header">
                      <div className="ray-pill-dot" style={{ backgroundColor: win.color }} aria-hidden="true" />
                      <div className="flex flex-col leading-tight">
                        <span className="ray-pill-title">{win.name}</span>
                        <span className="ray-pill-time">
                          AUT {win.window.start.aut} → {win.window.end.aut} • Local {win.window.start.local} → {win.window.end.local}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <span className="ray-pill-show" aria-live="polite">
                          Active now
                        </span>
                      ) : null}
                      <span className="ray-pill-show">{isOpen ? "Hide" : "Show"}</span>
                    </div>
                  </button>
                  {isOpen ? (
                    <div className="border-t border-zinc-700/40 bg-black/10 px-4 py-4 space-y-2">
                      {win.reading ? (
                        <div className="space-y-1 text-sm leading-relaxed text-zinc-200">
                          <div>
                            <span className="font-semibold text-zinc-100">Core Energetic Signature: </span>
                            {win.reading.core}
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-100">Gifts: </span>
                            {win.reading.gifts}
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-100">Ideal For: </span>
                            {win.reading.ideal}
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-100">Affirmation: </span>
                            {win.reading.affirmation}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-200">Ray reading unavailable for this cycle.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

        </section>
          </>
        )}

        {activePanel === "weekrays" && (
          <>
        {/* Rays of the Week */}
        <section className="themed-card p-6 space-y-6">
          <div className="themed-subcard p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs uppercase tracking-wide text-indigo-200/80">Preview</div>
                <div className="text-sm text-slate-100">
                  Date + AUT time drive the wheel and labels below.
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg border border-indigo-500/50 bg-indigo-600/80 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-indigo-500"
                onClick={() => {
                  const nowLocal = new Date();
                  setWeekPickerDate(toLocalISODate(nowLocal));
                  setWeekPickerLocalHour(nowLocal.getHours() + nowLocal.getMinutes() / 60);
                }}
              >
                Use Now
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-slate-100">
                <span className="text-xs uppercase tracking-wide text-slate-400">Date</span>
                <input
                  type="date"
                  className="rounded-lg border border-indigo-500/40 bg-slate-900/60 px-3 py-2 text-slate-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={weekPickerDate}
                  onChange={(e) => setWeekPickerDate(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-100">
                <span className="text-xs uppercase tracking-wide text-slate-400">Local time</span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={24}
                    step={0.25}
                    value={weekPickerLocalHour}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setWeekPickerLocalHour(Number.isFinite(v) ? v : 0);
                    }}
                    className="flex-1 accent-indigo-400"
                  />
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step={0.25}
                    value={weekPickerLocalHour}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setWeekPickerLocalHour(Number.isFinite(v) ? v : 0);
                    }}
                    className="w-20 rounded-lg border border-indigo-500/40 bg-slate-900/60 px-2 py-1 text-right text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div className="text-xs text-slate-300">
                  Local {weekSelectedLocalLabel} • {weekPickerLocalClock} (24h)
                </div>
              </label>
            </div>
          </div>

          <div className={weekHeaderClass}>
              <div className="space-y-1">
                <div className="text-sm uppercase tracking-wide text-indigo-200/80">
                  Rays of the Week
                </div>
                <div className="text-lg font-semibold text-slate-100">
                  {weekActiveCycle.dayLabel} • Cycle {weekActiveCycle.cycle} —{" "}
                  <span className="underline decoration-dotted">{weekActiveCycle.name}</span>
                </div>
              <p className="text-xs text-indigo-100/90">{weekActiveCycle.description}</p>
              <div className="text-xs text-slate-400">
                Local {weekRayWindowTimes.start} → {weekRayWindowTimes.end}
              </div>
            </div>
            <div className="text-sm text-slate-100 text-right">
              <div>{weekProgressPct}% through this 12h shift</div>
              <div>≈ {Math.ceil(weekRemainingMinutes)} min left</div>
            </div>
          </div>

          <div className={weekRingLayoutClass}>
            <div className={`relative mx-auto aspect-square w-full overflow-hidden ${weekRingSizeClass}`}>
              <svg
                viewBox={ringViewBox}
                className="block h-auto w-full overflow-hidden text-slate-100 drop-shadow-[0_8px_18px_rgba(15,23,42,0.45)]"
                role="img"
                aria-label="Rays of the Week dial"
              >
                <circle
                  cx="0"
                  cy="0"
                  r={RING_OUTER_RADIUS + 4}
                  fill="#0f172a"
                  fillOpacity="0.32"
                  stroke="#312e81"
                  strokeWidth="0.8"
                />
                {weekDialSegments.map((segment) => {
                  const isActive = segment.index === weekRayIndex;
                  return (
                    <g key={segment.cycle.id}>
                      <path
                        d={segment.path}
                        fill={segment.cycle.color}
                        fillOpacity={isActive ? 1 : 0.78}
                        stroke={isActive ? "#f8fafc" : "rgba(12,17,31,0.55)"}
                        strokeWidth={isActive ? 1.6 : 0.75}
                      />
                      <text
                        x={segment.labelX.toFixed(3)}
                        y={segment.labelY.toFixed(3)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="3.4"
                        fill={segment.cycle.labelColor ?? "#e2e8f0"}
                        letterSpacing="0.02em"
                      >
                        {segment.labelLines.map((line, lineIdx) => (
                          <tspan
                            key={`${segment.cycle.id}-${lineIdx}`}
                            x={segment.labelX.toFixed(3)}
                            dy={lineIdx === 0 ? "-0.2em" : "1.05em"}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    </g>
                  );
                })}
                <line
                  x1={weekPointerInner.x.toFixed(3)}
                  y1={weekPointerInner.y.toFixed(3)}
                  x2={weekPointerCoord.x.toFixed(3)}
                  y2={weekPointerCoord.y.toFixed(3)}
                  stroke="#f8fafc"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <circle cx="0" cy="0" r="6" fill="#0b1120" stroke="#f1f5f9" strokeWidth="1" />
              </svg>
            </div>
            <div className="text-xs text-slate-300 text-center max-w-2xl">
              12-hour AUT shifts (sunrise→sunset, sunset→next sunrise), flowing in order from Saturday dawn
              through Friday night.
            </div>
          </div>

          <div className="space-y-3">
            {weekCyclesByDay.map((day, idx) => {
              const isOpen = idx === openWeekDayIdx;
              const c1 = day.cycles[0];
              const c2 = day.cycles[1];
              const headerBg = `linear-gradient(120deg, ${c1?.color ?? "#334155"} 0%, ${c1?.color ?? "#334155"} 35%, ${c2?.color ?? "#475569"} 100%)`;
              const pillStyle: CSSProperties = { ["--pill-accent" as string]: c1?.color ?? "#c084fc" };
              const isToday = day.dayIndex === weekActiveCycle.dayIndex;
              return (
                <div key={day.dayIndex} className="themed-subcard overflow-hidden p-0">
                  <button
                    type="button"
                    className="ray-pill text-left"
                    onClick={() => setOpenWeekDayIdx(isOpen ? -1 : idx)}
                    aria-expanded={isOpen}
                    style={{ ...pillStyle, backgroundImage: headerBg }}
                  >
                    <div className="ray-pill-header">
                      <div className="ray-pill-dot" style={{ background: headerBg }} aria-hidden="true" />
                      <div className="flex flex-col leading-tight">
                        <span className="ray-pill-title">{day.dayLabel}</span>
                        <span className="ray-pill-time">00:00 → 12:00 • 12:00 → 24:00 local</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isToday ? <span className="ray-pill-show">Current day</span> : null}
                      <span className="ray-pill-show">{isOpen ? "Hide" : "Show"}</span>
                    </div>
                  </button>
                  {isOpen ? (
                    <div className="border-t border-slate-700/40 bg-black/10 px-4 py-4 space-y-3">
                      {day.cycles.map((cycle) => {
                        const reading = WEEK_RAY_READINGS[cycle.id];
                        const isActive = cycle.id === weekActiveCycle.id;
                        return (
                          <div
                            key={cycle.id}
                            className={`themed-subcard px-3 py-3 space-y-2 ${
                              isActive ? "ring-1 ring-[var(--accent-2)]" : ""
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                Cycle {cycle.cycle}
                              </span>
                              <span className="text-xs text-slate-300">{cycle.dayLabel}</span>
                              {isActive ? (
                                <span className="ml-auto text-[11px] rounded-full bg-indigo-500/25 px-2 py-0.5 text-indigo-100">
                                  Active
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-start gap-3">
                              <div
                                className="mt-1 h-3 w-3 rounded-full ring-2 ring-white/25"
                                style={{ backgroundColor: cycle.color }}
                              />
                              <div className="space-y-1">
                                <div className="text-sm font-semibold text-slate-100">
                                  {cycle.name} ({cycle.code})
                                </div>
                                <p className="text-sm text-slate-200">
                                  {reading?.body ?? cycle.description}
                                </p>
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                  Local {cycle.cycle === 1 ? "00:00 → 12:00" : "12:00 → 24:00"}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="themed-subcard p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div
                className="mt-1 h-3 w-3 rounded-full ring-2 ring-white/30"
                style={{ backgroundColor: weekActiveCycle.color }}
              />
              <div className="space-y-2">
                <div className="text-base font-semibold text-slate-50">
                  {weekReading?.title ?? "Current cycle"}
                </div>
                <p className="text-sm leading-relaxed text-slate-200">
                  {weekReading?.body ?? "Rays of the Week reading unavailable for this cycle."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="uppercase tracking-wide">Cycle</span>
              <span className="text-slate-200">
                Local {weekRayWindowTimes.start} → {weekRayWindowTimes.end}
              </span>
            </div>
          </div>

          <div className="themed-subcard p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div
                className="mt-1 h-3 w-3 rounded-full ring-2 ring-white/30"
                style={{ backgroundColor: activeRay.color }}
              />
              <div className="space-y-2">
                <div className="text-base font-semibold text-slate-50">
                  {rayReading?.title ?? activeRay.name}
                </div>
                {rayReading ? (
                  <div className="space-y-1 text-sm leading-relaxed text-slate-200">
                    <div><span className="font-semibold text-slate-100">Core Energetic Signature: </span>{rayReading.core}</div>
                    <div><span className="font-semibold text-slate-100">Gifts: </span>{rayReading.gifts}</div>
                    <div><span className="font-semibold text-slate-100">Ideal For: </span>{rayReading.ideal}</div>
                    <div><span className="font-semibold text-slate-100">Affirmation: </span>{rayReading.affirmation}</div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-slate-200">
                    Ray reading unavailable for this cycle.
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="uppercase tracking-wide">Ray Dial Cycle</span>
              <span className="text-slate-200">
                AUT {rayWindowTimes?.start.aut} → {rayWindowTimes?.end.aut} • Local {rayWindowTimes?.start.local} → {rayWindowTimes?.end.local}
              </span>
            </div>
          </div>
        </section>
          </>
        )}

        {activePanel === "rayreading" && (
          <>
        {/* Ray Reading */}
        <section className="themed-card p-6 space-y-5">
          <div className="flex flex-col gap-1">
            <div className="text-sm uppercase tracking-wide text-indigo-200/80">Ray Reading</div>
            <div className="flex items-center gap-3 text-base font-semibold text-slate-100">
              <div
                className="h-4 w-4 rounded-full ring-2 ring-white/40"
                style={{ backgroundColor: activeRay.color }}
              />
              <span>Ray Dial: {activeRay.name}</span>
            </div>
            <div className="flex items-center gap-3 text-base font-semibold text-slate-100">
              <div
                className="h-4 w-4 rounded-full ring-2 ring-white/40"
                style={{ background: activeWeekGradient }}
              />
              <span>
                Ray of the Week: {weekActiveCycle.dayLabel} — {weekActiveCycle.name}
              </span>
            </div>
            <p className="text-sm text-slate-300">
              The AUT Ray Dial follows the flow of the Ray frequencies throughout our Sun's solar cycle.
            </p>
          </div>

          <div className="themed-subcard p-5 space-y-3">
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold text-white">Ray Dial</div>
                  <div
                    className="h-10 w-10 rounded-full ring-2 ring-white/40 shrink-0"
                    style={{ backgroundColor: activeRay.color }}
                  />
                </div>
                <div className="text-base font-semibold text-slate-50">
                  {rayReading?.title ?? activeRay.name}
                </div>
                {rayReading ? (
                  <div className="space-y-1 text-sm leading-relaxed text-slate-200">
                    <div><span className="font-semibold text-slate-100">Core Energetic Signature: </span>{rayReading.core}</div>
                    <div><span className="font-semibold text-slate-100">Gifts: </span>{rayReading.gifts}</div>
                    <div><span className="font-semibold text-slate-100">Ideal For: </span>{rayReading.ideal}</div>
                    <div><span className="font-semibold text-slate-100">Affirmation: </span>{rayReading.affirmation}</div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-slate-200">
                    Ray reading unavailable for this cycle.
                  </p>
                )}
                <div className="text-xs text-slate-400">
                  AUT {rayWindowTimes?.start.aut} → {rayWindowTimes?.end.aut} • Local {rayWindowTimes?.start.local} → {rayWindowTimes?.end.local}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {rayWindowsDetailed.map((win) => {
              const isOpen = openRayIdx === win.idx;
              const isActive = win.idx === rayIndex;
              return (
                <div key={win.idx} className="themed-subcard overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 text-left gap-3"
                    onClick={() => setOpenRayIdx(isOpen ? -1 : win.idx)}
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-full ring-2 ring-white/40 shrink-0"
                        style={{ backgroundColor: win.color }}
                        aria-hidden="true"
                      />
                      <div>
                        <div className="text-sm font-semibold text-zinc-100">{win.name}</div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                          AUT {win.window.start.aut} → {win.window.end.aut} • Local {win.window.start.local} → {win.window.end.local}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-300">
                      {isActive ? (
                        <span className="rounded-full bg-emerald-600/30 px-2 py-1 text-[11px]">
                          Active now
                        </span>
                      ) : null}
                      <span className="text-zinc-400">{isOpen ? "Hide" : "Show"}</span>
                    </div>
                  </button>
                  {isOpen ? (
                    <div className="border-t border-zinc-700/40 bg-black/10 px-4 py-4 space-y-2">
                      {win.reading ? (
                        <div className="space-y-1 text-sm leading-relaxed text-zinc-200">
                          <div>
                            <span className="font-semibold text-zinc-100">Core Energetic Signature: </span>
                            {win.reading.core}
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-100">Gifts: </span>
                            {win.reading.gifts}
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-100">Ideal For: </span>
                            {win.reading.ideal}
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-100">Affirmation: </span>
                            {win.reading.affirmation}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-200">Ray reading unavailable for this window.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="themed-subcard p-5 space-y-3">
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold text-white">Rays of the Week</div>
                  <div
                    className="h-10 w-10 rounded-full ring-2 ring-white/35 shrink-0"
                    style={{ background: activeWeekGradient }}
                  />
                </div>
                <div className="text-base font-semibold text-slate-50">
                  {weekReading?.title ?? "Current cycle"}
                </div>
                <p className="text-sm leading-relaxed text-slate-200">
                  {weekReading?.body ?? "Rays of the Week reading unavailable for this cycle."}
                </p>
              </div>
            </div>
          </div>

          <div className="text-xs uppercase tracking-wide text-indigo-200/80">Weekly Day Accordions</div>
          <div className="space-y-3">
            {weekCyclesByDay.map((day, idx) => {
              const isOpen = idx === openWeekDayIdx;
              const c1 = day.cycles[0];
              const c2 = day.cycles[1];
              const headerBg = `linear-gradient(90deg, ${c1?.color ?? "#334155"} 0%, ${c1?.color ?? "#334155"} 50%, ${c2?.color ?? "#475569"} 50%, ${c2?.color ?? "#475569"} 100%)`;
              const isToday = day.dayIndex === weekActiveCycle.dayIndex;
              return (
                <div key={day.dayIndex} className="themed-subcard overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 text-left gap-3"
                    onClick={() => setOpenWeekDayIdx(isOpen ? -1 : idx)}
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-full ring-2 ring-white/40 shrink-0"
                        style={{ background: headerBg }}
                        aria-hidden="true"
                      />
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{day.dayLabel}</div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          00:00 → 12:00 • 12:00 → 24:00 local
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      {isToday ? <span className="rounded-full bg-indigo-600/40 px-2 py-1 text-[11px]">Current day</span> : null}
                      <span className="text-slate-400">{isOpen ? "Hide" : "Show"}</span>
                    </div>
                  </button>
                  {isOpen ? (
                    <div className="border-t border-slate-700/40 bg-black/10 px-4 py-4 space-y-3">
                      {day.cycles.map((cycle) => {
                        const reading = WEEK_RAY_READINGS[cycle.id];
                        const isActive = cycle.id === weekActiveCycle.id;
                        return (
                          <div
                            key={cycle.id}
                            className={`themed-subcard px-3 py-3 space-y-2 ${
                              isActive ? "ring-1 ring-[var(--accent-2)]" : ""
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                Cycle {cycle.cycle}
                              </span>
                              <span className="text-xs text-slate-300">{cycle.dayLabel}</span>
                              {isActive ? (
                                <span className="ml-auto text-[11px] rounded-full bg-indigo-500/25 px-2 py-0.5 text-indigo-100">
                                  Active
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-start gap-3">
                              <div
                                className="mt-1 h-3 w-3 rounded-full ring-2 ring-white/25"
                                style={{ backgroundColor: cycle.color }}
                              />
                              <div className="space-y-1">
                                <div className="text-sm font-semibold text-slate-100">
                                  {cycle.name} ({cycle.code})
                                </div>
                                <p className="text-sm text-slate-200">
                                  {reading?.body ?? cycle.description}
                                </p>
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                  Local {cycle.cycle === 1 ? "00:00 → 12:00" : "12:00 → 24:00"}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
          </>
        )}

        {activePanel === "atmosphere" && (
          <>
        {/* Atmosphere Panel */}
        <section className="rounded-2xl p-6 bg-gradient-to-br from-slate-900/60 via-sky-900/30 to-emerald-900/20 border border-slate-700 space-y-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm uppercase tracking-wide text-sky-200/80">Atmosphere Panel</div>
              <p className="text-xs text-slate-300">
                Sea-level pressure & temperature from NOAA + TEMIS total-column ozone for your current location.
              </p>
            </div>
            <button
              type="button"
              className="self-start rounded-xl border border-sky-500/50 px-4 py-2 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/10"
              onClick={() => {
                atmosphere.refetch();
                setClimateNonce((n) => n + 1);
              }}
              disabled={atmosphere.status === "loading"}
            >
              {atmosphere.status === "loading" ? "Refreshing…" : "Refresh Snapshot"}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-600 bg-slate-900/50 p-4 text-slate-100">
              <div className="text-xs uppercase tracking-wide text-slate-400">Temperature</div>
              <div className="text-2xl font-semibold">{temperatureDisplay}</div>
            </div>
            <div className="rounded-2xl border border-slate-600 bg-slate-900/50 p-4 text-slate-100">
              <div className="text-xs uppercase tracking-wide text-slate-400">Sea-Level Pressure</div>
              <div className="text-2xl font-semibold">{pressureDisplay}</div>
              <div className="text-xs text-slate-400">hPa (hectopascals)</div>
            </div>
            <div className="rounded-2xl border border-slate-600 bg-slate-900/50 p-4 text-slate-100">
              <div className="text-xs uppercase tracking-wide text-slate-400">TEMIS Ozone Scale</div>
              <div className="text-2xl font-semibold">{ozoneDisplay}</div>
              <div className="text-xs text-slate-400">
                {atmosphereSample?.ozoneUnits === "µg/m³"
                  ? "Surface ozone (µg/m³)"
                  : "Total column (Dobson Units)"}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-300">
            <div>{atmosphereStatusLine}</div>
            {atmosphereSample?.stationId ? (
              <div>
                Station {atmosphereSample.stationId}
                {atmosphereSample.stationName ? ` (${atmosphereSample.stationName})` : ""}
              </div>
            ) : null}
            {atmosphereLocalTime ? <div>Local snapshot {atmosphereLocalTime}</div> : null}
            {atmosphere.error ? (
              <div className="text-rose-300">
                NOAA API error — make sure this device can reach api.weather.gov.
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-3 text-slate-200 text-sm">
            <div className="rounded-2xl border border-slate-600 bg-slate-900/40 p-4 space-y-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">Climatology</div>
              <div className="text-xl font-semibold">{historicalTempDisplay}</div>
              <p className="text-xs text-slate-400">
                30-year mean for {formatMonthDayLong(todayDate)} ({climateRangeLabel})
              </p>
            </div>
            <div className="rounded-2xl border border-slate-600 bg-slate-900/40 p-4 space-y-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">Sea-Level Pressure</div>
              <p>
                Indicates the weight of the air mass reduced to sea level. Typical fair-weather values lie near
                1013&nbsp;hPa; rising pressure suggests clearing, while falling pressure may precede storms.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-600 bg-slate-900/40 p-4 space-y-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">TEMIS Ozone Scale</div>
              <p>{ozoneInfoLine}</p>
              <p className="text-xs text-slate-400">{ozoneRangeLine}</p>
            </div>
          </div>
        </section>
          </>
        )}

        {activePanel === "postal" && (
          <>
        {/* Postal Lookup */}
        <section className="rounded-2xl p-6 bg-zinc-900/40 border border-zinc-700 space-y-4">
          <div className="text-sm uppercase text-zinc-400">Postal / ZIP Lookup</div>
          <form
            onSubmit={onZipSubmit}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start"
          >
            <input
              type="text"
              inputMode="text"
              placeholder="e.g., 28205 or CA H0H0H0"
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:w-64"
              value={zipInput}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setZipInput(e.target.value);
                if (zipStatus !== "idle") {
                  setZipStatus("idle");
                  setZipError(null);
                }
              }}
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition shadow disabled:cursor-not-allowed disabled:opacity-60"
              disabled={zipStatus === "loading"}
            >
              {zipStatus === "loading" ? "Looking up…" : "Use Postal Code"}
            </button>
          </form>
          <div className="text-xs">
            {zipStatus === "loading" ? (
              <span className="text-zinc-400">Fetching coordinates…</span>
            ) : zipStatus === "success" ? (
              <span className="text-emerald-400">Updated location from postal code.</span>
            ) : zipStatus === "error" && zipError ? (
              <span className="text-rose-400">{zipError}</span>
            ) : (
              <span className="text-zinc-500">Enter a postal/ZIP code; prefix with a country (e.g., “CA H0H0H0”).</span>
            )}
          </div>
          <p className="text-xs text-zinc-400">
            Powered by Zippopotam.us — coordinates derived from the first matching place.
          </p>
        </section>
          </>
        )}

        <div className="flex justify-center py-4">
          <img
            src="/AtlasIslandLOGO.png"
            alt="Atlas Island radiant emblem"
            className="max-w-full w-[420px] drop-shadow-[0_12px_35px_rgba(59,130,246,0.35)]"
            loading="lazy"
            onClick={handleSecretBannerClick}
          />
        </div>

        <footer className="text-center text-xs text-zinc-400 mt-2 whitespace-pre-wrap">
          Atlas Island ✨{" "}
          <a
            className="text-zinc-300 underline decoration-dotted hover:text-white"
            href="https://www.atlasisland.co"
            target="_blank"
            rel="noreferrer"
          >
            www.atlasisland.co
          </a>{" "}
          • V6.6.6
        </footer>
      </div>
      {secretOpen && (
        <SecretLarbSanctum
          onClose={closeSecretSanctum}
          activeRayWindow={activeRay}
          activeLarbRayId={activeLarbRayId}
          rayProgressPct={progressPct}
          rayWindowTimes={rayWindowTimes}
          autClock={data.autClock}
          remainingMinutes={remainingRealMin}
        />
      )}
    </div>
  );
}

/**
 * Minimal debug tests (disabled by default). Toggle RUN_TESTS to true if you want console assertions.
 */
const RUN_TESTS = false;
if (typeof window !== "undefined" && RUN_TESTS) {
  // Ensure AUT is monotonic across local midnight for Charlotte coords
  const lat = 35.25;
  const lon = -80.8;
  // Build two local times around midnight (today 23:50, tomorrow 00:10)
  const now = new Date();
  const t1 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 50, 0);
  const t2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 10, 0);
  const a1 = computeAUT(t1, lat, lon).autHours;
  const a2 = computeAUT(t2, lat, lon).autHours;
  console.assert(a2 >= a1, "AUT should be non-decreasing across midnight", { a1, a2 });

  // Within-window progress should be between 0..1
  const probe = computeAUT(new Date(), lat, lon);
  console.assert(
    probe.progress >= 0 && probe.progress <= 1,
    "progress must be within [0,1]",
    probe.progress
  );

  // Ray mapping sanity checks (updated for Turquoise insertion and Orichalcum removal)
  const idx1 = rayIndexForAUT(0.5); // Red
  const idx2 = rayIndexForAUT(19.0); // Omni now 18–20
  const idx3 = rayIndexForAUT(23.9); // Infinite of ALL
  console.assert(RAY_WINDOWS[idx1].name === "Red", "00:30 AUT should be Red");
  console.assert(RAY_WINDOWS[idx2].name.includes("Omni"), "19:00 AUT should be Omni");
  console.assert(RAY_WINDOWS[idx3].name.includes("Infinite"), "23:54 AUT should be Infinite of ALL");
}
