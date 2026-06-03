import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Astronomy from "astronomy-engine";
import { useSolarReturn, type SolarReturnProfile } from "../hooks/useSolarReturn";
import { useForwardGeocode } from "../hooks/useForwardGeocode";
import {
  type ExtendedChartData,
  type ChartAngle,
  HOUSE_THEMES,
  buildChart,
  buildLiveChart,
  buildNatalChart,
  makeBirthDateUTC,
  findSolarReturnMoment,
} from "../lib/extendedChart";
import { estimateFromLongitude } from "../lib/timezone";
import { fetchTimezoneOffset } from "../lib/timezone";
type Vec2 = { x: number; y: number };

type ViewMode = "heliocentric" | "geocentric";

type BodyName =
  | "Sun"
  | "Moon"
  | "Mercury"
  | "Venus"
  | "Earth"
  | "Mars"
  | "Jupiter"
  | "Saturn"
  | "Uranus"
  | "Neptune"
  | "Pluto";

type Planet = {
  name: string;
  a: number; // semi-major axis in AU
  e: number; // eccentricity
  periodDays: number;
  baseColor: string;
  bands?: string[];
  gradient?: { inner: string; outer: string };
  ring?: { color: string; width: number; opacity: number };
  spots?: Array<{ color: string; radius: number; offset: Vec2 }>;
};

type OverlayOptions = {
  viewMode: ViewMode;
  showZodiac: boolean;
  showEclipticGrid: boolean;
  scaleLabels: boolean;
  showRayZones: boolean;
};

const PLANETS: Planet[] = [
  { name: "Mercury", a: 0.387, e: 0.2056, periodDays: 87.969, baseColor: "#a8a8a8", gradient: { inner: "#f4f4f4", outer: "#7b7b7b" } },
  { name: "Venus", a: 0.723, e: 0.0068, periodDays: 224.701, baseColor: "#e0c080", gradient: { inner: "#fff2cc", outer: "#c89f60" } },
  { name: "Earth", a: 1.0, e: 0.0167, periodDays: 365.256, baseColor: "#4aa3ff", gradient: { inner: "#6fd3ff", outer: "#1359a0" }, spots: [{ color: "#4ade80", radius: 0.18, offset: { x: -0.2, y: 0.05 } }] },
  { name: "Mars", a: 1.524, e: 0.0934, periodDays: 686.98, baseColor: "#ff6a3d", gradient: { inner: "#ffb48a", outer: "#a23a27" } },
  { name: "Jupiter", a: 5.2, e: 0.0489, periodDays: 4332.589, baseColor: "#f2c078", bands: ["#f3d8ab", "#d4a46c", "#f6e5c7", "#c78f57"], spots: [{ color: "#d86b41", radius: 0.35, offset: { x: 0.25, y: 0.05 } }] },
  { name: "Saturn", a: 9.58, e: 0.0565, periodDays: 10759.22, baseColor: "#dccaa6", gradient: { inner: "#f6e7c4", outer: "#cdaa7a" } },
  { name: "Uranus", a: 19.2, e: 0.046, periodDays: 30685.4, baseColor: "#7dd3fc", gradient: { inner: "#b0f0ff", outer: "#459bbf" } },
  { name: "Neptune", a: 30.07, e: 0.009, periodDays: 60189, baseColor: "#7aa2ff", gradient: { inner: "#8ad0ff", outer: "#2843c2" } },
  { name: "Pluto", a: 39.48, e: 0.2488, periodDays: 90560, baseColor: "#cdb4ff", gradient: { inner: "#e6dcff", outer: "#9d86c6" } },
];

const MOON: Planet = {
  name: "Moon",
  a: 0.00257,
  e: 0.0549,
  periodDays: 27.321582,
  baseColor: "#d4d4d8",
  gradient: { inner: "#f8fafc", outer: "#9ca3af" },
};

const ORBIT_SAMPLES = 512;
const INITIAL_DATE = new Date();
const DEG2RAD = Math.PI / 180;

/* ── Fixed Visual Solar System (Apple Watch style) ───────────────────────── */
// Canvas is fixed at 560×560 CSS px. All distances are in pixels from center.
// The outer edge of the zodiac ring sits ~260 px from center.
// We fit Mercury→Pluto between the Sun edge and ~245 px (just inside zodiac).
// Responsive constants
const MOON_ORBIT_PX = 18; // Moon circles Earth at fixed px radius
const RING_PX: Record<BodyName, number> = {
  Sun: 0,
  Mercury: 45,
  Venus: 68,
  Earth: 92,
  Mars: 116,
  Jupiter: 152,
  Saturn: 184,
  Uranus: 214,
  Neptune: 238,
  Pluto: 258,
  Moon: 0,
};

// Fixed body radii in px. No dynamic scaling — they stay visible.
const BODY_PX: Record<BodyName, number> = {
  Sun: 34,
  Mercury: 3.5,
  Venus: 6,
  Earth: 6.2,
  Mars: 4.8,
  Jupiter: 14,
  Saturn: 12,
  Uranus: 8.5,
  Neptune: 8.2,
  Pluto: 3.2,
  Moon: 2.8,
};

// Default font for canvas labels
const BODY_FONT = "11px 'JetBrains Mono', ui-monospace, monospace";
const GEO_RING_PX = 210;
// Geocentric ring radii: spread bodies across the zodiacal band
const GEO_BODY_RADIUS: Partial<Record<BodyName, number>> = {
  Sun: 145,
  Mercury: 165,
  Venus: 180,
  Mars: 190,
  Jupiter: 205,
  Saturn: 220,
  Uranus: 235,
  Neptune: 248,
  Pluto: 258,
};
const ZODIAC_SIGNS = [
  { name: "Aries", symbol: "♈︎" },
  { name: "Taurus", symbol: "♉︎" },
  { name: "Gemini", symbol: "♊︎" },
  { name: "Cancer", symbol: "♋︎" },
  { name: "Leo", symbol: "♌︎" },
  { name: "Virgo", symbol: "♍︎" },
  { name: "Libra", symbol: "♎︎" },
  { name: "Scorpio", symbol: "♏︎" },
  { name: "Sagittarius", symbol: "♐︎" },
  { name: "Capricorn", symbol: "♑︎" },
  { name: "Aquarius", symbol: "♒︎" },
  { name: "Pisces", symbol: "♓︎" },
];
// Hue sequence mirrors Ray Dial windows 1–12 (Red → Infinite of ALL)
const ZODIAC_HUES = [
  "#ef4444", // Aries
  "#f97316", // Taurus
  "#facc15", // Gemini
  "#22c55e", // Cancer
  "#2dd4bf", // Leo
  "#3b82f6", // Virgo
  "#6366f1", // Libra
  "#8b5cf6", // Scorpio
  "#d946ef", // Sagittarius
  "#0f0a0a", // Capricorn (Carbon)
  "#a5f3fc", // Aquarius (Crystalline-Carbon)
  "#7dd3fc", // Pisces (Infinite of ALL)
];

const CAPRICORN_INDEX = 9; // Carbon — needs white border on dark bg

function carbonTextStyle(index: number): React.CSSProperties {
  const color = ZODIAC_HUES[index] ?? "#e2e8f0";
  if (index === CAPRICORN_INDEX) {
    return {
      color,
      WebkitTextStroke: "0.4px rgba(255,255,255,0.7)",
      textShadow: "0 0 3px rgba(255,255,255,0.5), 0 0 6px rgba(255,255,255,0.25)",
    };
  }
  return { color };
}

const ZODIAC_RAY_NAMES = [
  "Red Ray",
  "Orange Ray",
  "Yellow Ray",
  "Green Ray",
  "Turquoise Ray",
  "Blue Ray",
  "Indigo Ray",
  "Violet Ray",
  "Magenta Ray",
  "Omni/Carbon Ray",
  "Crystalline-Carbon Ray",
  "Infinite of ALL Ray",
];

const ZODIAC_RAY_ESSENCE = [
  "Initiation • courage • first-breath action • forward ignition",
  "Sensory stability • value • embodiment • pleasure-as-presence",
  "Curiosity • cognition • language • connection • mental motion",
  "Nurture • belonging • home-field manifestation • devotion",
  "Radiance • heart-expression • creative leadership • joy-force",
  "Refinement • sacred craft • clarity • healing through precision",
  "Discernment • harmony • relational truth • aesthetic intelligence",
  "Depth • transmutation • shadow alchemy • soul power",
  "Expansion • prophecy • horizon-seeking • meaning + adventure",
  "Structure • endurance • legacy-building • sovereign discipline",
  "Future codes • networks • innovation • liberation through design",
  "Mysticism • compassion • dreamfield • unity consciousness",
];

/* ── Ray hue helpers for canvas ─────────────────────────────────────────── */

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}


const PLANETARY_INFO: { body: BodyName; title: string; detail: string }[] = [
  {
    body: "Sun",
    title: "Heartlight Source • Vitality • Sovereign Will",
    detail: "Radiates life-force, confidence, direction, purpose, creative fire.",
  },
  {
    body: "Mercury",
    title: "Mind-Messenger • Language • Synchronicity Weaving",
    detail: "Guides communication, learning, signals, timing, clever pathways, trade of ideas.",
  },
  {
    body: "Venus",
    title: "Resonant Love • Beauty • Value + Pleasure",
    detail: "Tunes attraction, relationships, art, devotion, sensual harmony, worth.",
  },
  {
    body: "Earth",
    title: "Embodiment Temple • Grounded Manifestation • Belonging",
    detail: "Anchors presence, body-wisdom, stewardship, material creation, community.",
  },
  {
    body: "Mars",
    title: "Sacred Action • Boundaries • Courageous Momentum",
    detail: "Ignites drive, protection, decisive movement, desire, focused stamina.",
  },
  {
    body: "Jupiter",
    title: "Expansion • Blessings • Higher Meaning",
    detail: "Opens growth, opportunity, wisdom, optimism, teaching, benevolent abundance.",
  },
  {
    body: "Saturn",
    title: "Sacred Structure • Time Mastery • Integrity",
    detail: "Cultivates discipline, responsibility, maturation, devotion, long-form legacy.",
  },
  {
    body: "Uranus",
    title: "Liberation • Innovation • Future Codes",
    detail: "Awakens change, breakthroughs, originality, collective upgrades, freedom-paths.",
  },
  {
    body: "Neptune",
    title: "Mystic Ocean • Dreams • Unity Field",
    detail: "Deepens intuition, imagination, compassion, spiritual sensitivity, poetic vision.",
  },
  {
    body: "Moon",
    title: "Soul Mirror • Emotional Tide • Cyclic Wisdom",
    detail: "Reflects inner landscape, receptivity, instinctual rhythm, memory, and the felt current beneath thought.",
  },
  {
    body: "Pluto",
    title: "Underworld Alchemy • Death/Rebirth • Soul Power",
    detail: "Transmutates identity, exposes truth, empowers renewal, clears distorted control.",
  },
];
const BODIES: BodyName[] = ["Sun", "Moon", "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
// Presentation order for the alignment list: highlight Sun/Moon/Earth first.
const BODY_ORDER: BodyName[] = ["Sun", "Earth", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
const DEFAULT_SCALE: Record<ViewMode, number> = {
  heliocentric: 0.03,
  geocentric: 0.03,
};

type Placement = {
  body: BodyName;
  lon: number;
  lat: number;
  dist: number;
  vector: Astronomy.Vector;
  world: Vec2;
  mode: ViewMode;
};

type ZodiacPlacement = {
  body: BodyName;
  signName: string;
  signSymbol: string;
  signIndex: number;
  degrees: number;
  minutes: number;
  longitude: number;
  latitude: number;
  distanceAu: number;
};

const BODY_GLYPHS: Record<BodyName, string> = {
  Sun: "☉",
  Moon: "☾",
  Mercury: "☿",
  Venus: "♀",
  Earth: "⊕",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
};

function planetIconSrc(body: BodyName): string {
  return `/hsm-planets/${body}.png`;
}

// ── Module-level planet image cache ────────────────────────────────────────
const planetImageCache = new Map<BodyName, HTMLImageElement>();
let planetImagesLoading = false;

function loadPlanetImages(): Promise<void> {
  if (planetImagesLoading) return Promise.resolve();
  planetImagesLoading = true;
  const bodies: BodyName[] = ["Sun", "Moon", "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
  let loaded = 0;
  return new Promise((resolve) => {
    bodies.forEach((body) => {
      const img = new Image();
      img.src = planetIconSrc(body);
      img.onload = () => {
        planetImageCache.set(body, img);
        loaded++;
        if (loaded === bodies.length) resolve();
      };
      img.onerror = () => {
        loaded++;
        if (loaded === bodies.length) resolve();
      };
    });
  });
}

function getPlanetImage(body: BodyName): HTMLImageElement | undefined {
  return planetImageCache.get(body);
}

function drawPlanetImage(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  radius: number,
  body: BodyName,
  glow?: { color: string; blur: number }
) {
  const img = getPlanetImage(body);
  if (!img || !img.complete || img.naturalWidth === 0) return false;

  ctx.save();
  if (glow) {
    ctx.shadowColor = glow.color;
    ctx.shadowBlur = glow.blur;
  }

  // Clip to circle
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.clip();

  // Cover crop: maintain aspect ratio, crop from center
  const destSize = radius * 2;
  const srcAspect = img.naturalWidth / img.naturalHeight;
  const destAspect = 1; // square destination

  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

  if (srcAspect > destAspect) {
    // Image wider than tall — crop sides
    sw = img.naturalHeight * destAspect;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    // Image taller than wide — crop top/bottom
    sh = img.naturalWidth / destAspect;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(
    img,
    sx, sy, sw, sh,           // source crop (centered)
    center.x - radius, center.y - radius, destSize, destSize  // destination
  );

  ctx.restore();
  return true;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDegrees(degrees: number) {
  const mod = degrees % 360;
  return mod < 0 ? mod + 360 : mod;
}

function asTime(date: Date) {
  return Astronomy.MakeTime(date);
}

function toEcliptic(vector: Astronomy.Vector) {
  const equatorial = Astronomy.EquatorFromVector(vector);
  const ecliptic = Astronomy.Ecliptic(equatorial.vec);
  return {
    lon: normalizeDegrees(ecliptic.elon),
    lat: ecliptic.elat,
    dist: equatorial.dist,
    vector,
  };
}

function heliocentricPlacement(body: BodyName, when: Date): Placement {
  const time = asTime(when);
  if (body === "Sun") {
    const vector = new Astronomy.Vector(0, 0, 0, time);
    return {
      body,
      lon: 0,
      lat: 0,
      dist: 0,
      vector,
      world: { x: 0, y: 0 },
      mode: "heliocentric",
    };
  }
  const vector = Astronomy.HelioVector(body as Astronomy.Body, time);
  const { lon, lat, dist } = toEcliptic(vector);
  const ringPx = RING_PX[body] ?? 0;
  const rad = lon * DEG2RAD;
  const world: Vec2 = {
    x: ringPx * Math.cos(rad),
    y: ringPx * Math.sin(rad),
  };
  return { body, lon, lat, dist, vector, world, mode: "heliocentric" };
}

function geocentricPlacement(body: BodyName, when: Date): Placement {
  if (body === "Earth") {
    const time = asTime(when);
    const vector = new Astronomy.Vector(0, 0, 0, time);
    return {
      body,
      lon: 0,
      lat: 0,
      dist: 0,
      vector,
      world: { x: 0, y: 0 },
      mode: "geocentric",
    };
  }
  const time = asTime(when);
  const vector = Astronomy.GeoVector(body as Astronomy.Body, time, true);
  const { lon, lat, dist } = toEcliptic(vector);

  // In geocentric mode Earth is at the center; each body gets its own
  // visually-placed ring radius so planets don't cluster on one line.
  const radius = GEO_BODY_RADIUS[body] ?? GEO_RING_PX;
  const rad = lon * DEG2RAD;
  const latitudeFactor = clamp(lat / 40, -1, 1);
  const world: Vec2 = {
    x: radius * Math.cos(rad),
    y: radius * Math.sin(rad) * (1 - 0.12 * Math.abs(latitudeFactor)),
  };
  return { body, lon, lat, dist, vector, world, mode: "geocentric" };
}

function getPlacements(viewMode: ViewMode, when: Date): Placement[] {
  if (viewMode === "heliocentric") {
    return BODIES.map((body) => heliocentricPlacement(body, when));
  }
  return BODIES.map((body) => geocentricPlacement(body, when));
}

function sampleOrbit(planet: Planet): Vec2[] {
  const orbit: Vec2[] = [];
  const R = RING_PX[planet.name as BodyName] ?? 0;
  for (let i = 0; i <= ORBIT_SAMPLES; i += 1) {
    const angle = (i / ORBIT_SAMPLES) * Math.PI * 2;
    orbit.push({
      x: R * Math.cos(angle),
      y: R * Math.sin(angle),
    });
  }
  return orbit;
}

function zodiacFromLongitude(lon: number) {
  const normalized = normalizeDegrees(lon);
  let signIndex = Math.floor(normalized / 30) % 12;
  let degrees = normalized - signIndex * 30;
  let minutes = Math.round((degrees - Math.floor(degrees)) * 60);
  let degInt = Math.floor(degrees);

  if (minutes === 60) {
    minutes = 0;
    degInt += 1;
    if (degInt === 30) {
      degInt = 0;
      signIndex = (signIndex + 1) % 12;
    }
  }

  const sign = ZODIAC_SIGNS[signIndex];
  return {
    sign,
    signIndex,
    degrees: degInt,
    minutes,
    longitude: normalized,
  };
}

type CanvasThemeColors = {
  background: string;
  orbitStroke: string;
  orbitWidth: number;
  sunGlow: string;
  sunInner: string;
  sunOuter: string;
  zodiacRing: string;
  zodiacRingWidth: number;
  zodiacTickMajor: string;
  zodiacTickMinor: string;
  bodyLabel: string;
  rayZoneOpacity: number;
};

function buildCanvasTheme(theme: string): CanvasThemeColors {
  const base: CanvasThemeColors = {
    background: "#030712",
    orbitStroke: "rgba(148,163,184,0.55)",
    orbitWidth: 1.5,
    sunGlow: "rgba(253,211,107,0.6)",
    sunInner: "#ffe7a3",
    sunOuter: "#f59e0b",
    zodiacRing: "rgba(56,189,248,0.35)",
    zodiacRingWidth: 1,
    zodiacTickMajor: "rgba(56,189,248,0.30)",
    zodiacTickMinor: "rgba(56,189,248,0.15)",
    bodyLabel: "#e2e8f0",
    rayZoneOpacity: 0.08,
  };

  if (theme === "atlas") {
    return {
      background: "#060e1a",
      orbitStroke: "rgba(246,196,83,0.75)",
      orbitWidth: 2.0,
      sunGlow: "rgba(255,230,160,0.85)",
      sunInner: "#fff2cc",
      sunOuter: "#f6c453",
      zodiacRing: "rgba(246,196,83,0.55)",
      zodiacRingWidth: 1.5,
      zodiacTickMajor: "rgba(246,196,83,0.50)",
      zodiacTickMinor: "rgba(246,196,83,0.25)",
      bodyLabel: "#fffbef",
      rayZoneOpacity: 0.22,
    };
  }

  if (theme === "retro") {
    return {
      ...base,
      background: "#020b04",
      orbitStroke: "rgba(96,255,176,0.55)",
      sunGlow: "rgba(96,255,176,0.5)",
      sunInner: "#b8ffd1",
      sunOuter: "#60ffb0",
      zodiacRing: "rgba(96,255,176,0.4)",
      zodiacRingWidth: 1,
      zodiacTickMajor: "rgba(96,255,176,0.35)",
      zodiacTickMinor: "rgba(96,255,176,0.18)",
      bodyLabel: "#b8ffd1",
      rayZoneOpacity: 0.10,
    };
  }

  return base;
}

function HeartlightSystemMap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<Vec2>({ x: 0, y: 0 });
  const scaleRef = useRef(DEFAULT_SCALE["heliocentric"]);
  const timeRef = useRef(INITIAL_DATE.getTime());
  const runningRef = useRef(false);
  const timeScaleRef = useRef(4);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 560, height: 560 });
  const viewportScaleRef = useRef(1);

  const [when, setWhen] = useState(INITIAL_DATE);
  const [running, setRunning] = useState(false);
  const [timeScale] = useState(4);
  const [hsmViewMode, setHsmViewMode] = useState<ViewMode>("geocentric");
  const [rayViewMode, setRayViewMode] = useState<"gaian" | "solar">("gaian");
  const [showZodiac, setShowZodiac] = useState(true);
  const [showEclipticGrid, setShowEclipticGrid] = useState(false);
  const [scaleLabels, setScaleLabels] = useState(true);
  const [showRayZones, setShowRayZones] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [rayOpen, setRayOpen] = useState(false);
  const [uiTheme, setUiTheme] = useState(() => {
    try {
      return (localStorage.getItem("aut-ui-theme") ?? "normal") as "normal" | "retro" | "atlas";
    } catch {
      return "normal";
    }
  });

  // Listen for theme changes while HSM is open
  useEffect(() => {
    const handler = () => {
      try {
        setUiTheme((localStorage.getItem("aut-ui-theme") ?? "normal") as "normal" | "retro" | "atlas");
      } catch { /* ignore */ }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const THEME_FONT: Record<string, string> = {
    normal: "'Alice', ui-sans-serif",
    retro: "'JetBrains Mono', ui-monospace, monospace",
    atlas: "'Alice', ui-sans-serif",
  };
  const THEME_TEXT: Record<string, string> = {
    normal: "#e4e4e7",
    retro: "#b8ffd1",
    atlas: "#fffbef",
  };
  const [keyOpen, setKeyOpen] = useState(false);
  /* ── Extended Chart ──────────────────────────────────────────────── */
  const [houseInfoOpen, setHouseInfoOpen] = useState(false);
  const [extChartOpen, setExtChartOpen] = useState(false);
  const [extChartMode, setExtChartMode] = useState<"live" | "solar" | "natal">("live");
  const [srTargetYear, setSrTargetYear] = useState(() => new Date().getFullYear());

  /* ── Live Sky location (can differ from birth location) ──────────── */
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lon: number; displayName: string } | null>(null);
  const [liveLocQuery, setLiveLocQuery] = useState("");
  const { results: liveGeocodeResults } = useForwardGeocode(liveLocQuery);
  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLiveLocation({ lat: latitude, lon: longitude, displayName: "Current Location" });
        setLiveLocQuery("");
      },
      (err) => {
        console.error("Geolocation error:", err);
        alert("Unable to retrieve your location.");
      }
    );
  }, []);

  /* ── Solar Return constellation ─────────────────────────────────────────── */
  const {
    profiles,
    activeProfile,
    activeId,
    setActiveId,
    addProfile,
    updateProfile,
    removeProfile,
  } = useSolarReturn();

  // Add/Edit form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Add form fields
  const [addName, setAddName] = useState("");
  const [addDateStr, setAddDateStr] = useState("");
  const [addTimeStr, setAddTimeStr] = useState("12:00");
  const [addTimezoneOffset, setAddTimezoneOffset] = useState(-300);
  const [addLocationQuery, setAddLocationQuery] = useState("");
  const [addSelectedLocation, setAddSelectedLocation] = useState<{ lat: number; lon: number; displayName: string } | null>(null);
  const { results: addGeocodeResults } = useForwardGeocode(addLocationQuery);

  // Edit form fields (mirror add, scoped to editingId)
  const [editName, setEditName] = useState("");
  const [editDateStr, setEditDateStr] = useState("");
  const [editTimeStr, setEditTimeStr] = useState("12:00");
  const [editTimezoneOffset, setEditTimezoneOffset] = useState(-300);
  const [editLocationQuery, setEditLocationQuery] = useState("");
  const [editSelectedLocation, setEditSelectedLocation] = useState<{ lat: number; lon: number; displayName: string } | null>(null);
  const { results: editGeocodeResults } = useForwardGeocode(editLocationQuery);

  const startAdd = useCallback(() => {
    setAddName("");
    setAddDateStr("");
    setAddTimeStr("12:00");
    setAddTimezoneOffset(-300);
    setAddLocationQuery("");
    setAddSelectedLocation(null);
    setShowAddForm(true);
  }, []);

  const startEdit = useCallback((profile: SolarReturnProfile) => {
    setEditName(profile.name);
    const d = new Date(profile.birthYear ?? 2000, profile.birthMonth, profile.birthDay);
    const mStr = (d.getMonth() + 1).toString().padStart(2, "0");
    const dayStr = d.getDate().toString().padStart(2, "0");
    setEditDateStr(`${profile.birthYear ?? 2000}-${mStr}-${dayStr}`);
    const hStr = (profile.birthHour ?? 12).toString().padStart(2, "0");
    const minStr = (profile.birthMinute ?? 0).toString().padStart(2, "0");
    setEditTimeStr(`${hStr}:${minStr}`);
    setEditTimezoneOffset(profile.birthTimezoneOffset ?? -300);
    setEditLocationQuery("");
    setEditSelectedLocation({ lat: profile.birthLat, lon: profile.birthLon, displayName: profile.birthPlaceLabel });
    setEditingId(profile.id);
  }, []);

  const applySolarReturn = useCallback(() => {
    if (!activeProfile) return;
    const tzOffset =
      activeProfile.birthTimezoneOffset ??
      estimateFromLongitude(activeProfile.birthLon);
    const natalDate = makeBirthDateUTC(
      activeProfile.birthYear ?? 2000,
      activeProfile.birthMonth,
      activeProfile.birthDay,
      activeProfile.birthHour ?? 12,
      activeProfile.birthMinute ?? 0,
      tzOffset
    );
    timeRef.current = natalDate.getTime();
    setWhen(new Date(natalDate));
  }, [activeProfile, setWhen]);

  const getFormLocation = useCallback((formLoc: typeof addSelectedLocation) => {
    if (formLoc) return formLoc;
    return { lat: 35.25, lon: -80.8, displayName: "Charlotte, NC" };
 }, []);

  const orbitCache = useMemo(() => {
    const cache = new Map<string, Vec2[]>();
    PLANETS.forEach((planet) => {
      cache.set(planet.name, sampleOrbit(planet));
    });
    return cache;
  }, []);

  useEffect(() => {
    loadPlanetImages();
  }, []);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    timeScaleRef.current = timeScale;
  }, [timeScale]);

  const worldToScreen = (point: Vec2): Vec2 => {
    const s = viewportScaleRef.current;
    const cx = sizeRef.current.width / 2;
    const cy = sizeRef.current.height / 2;
    return {
      x: point.x * s + cx,
      y: cy - point.y * s,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let accumulator = 0;

    const render = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (runningRef.current) {
        timeRef.current += dt * timeScaleRef.current * 86400000;
      }

      accumulator += dt;
      if (accumulator > 0.2) {
        setWhen(new Date(timeRef.current));
        accumulator = 0;
      }

      const dpr = window.devicePixelRatio ?? 1;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      const width = cssWidth * dpr;
      const height = cssHeight * dpr;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      sizeRef.current = { width: cssWidth, height: cssHeight };

      // Compute responsive scale: fit the full solar system into ~78% of viewport.
      // Leaves a zodiac band (names + ring) in the outer 22%.
      const minDim = Math.min(cssWidth, cssHeight);
      const solarDiameter = minDim * 0.78;  // planets fill 78% of canvas
      const designDiameter = RING_PX["Pluto"] * 2 + 12;
      const viewportScale = solarDiameter / designDiameter;
      viewportScaleRef.current = Math.max(0.40, Math.min(1, viewportScale));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      drawScene(
        ctx,
        orbitCache,
        new Date(timeRef.current),
        worldToScreen,
        viewportScaleRef.current,
        { showZodiac, showEclipticGrid, scaleLabels, showRayZones, viewMode: hsmViewMode },
        THEME_FONT[uiTheme],
        THEME_TEXT[uiTheme],
        buildCanvasTheme(uiTheme)
      );

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [orbitCache, showZodiac, showEclipticGrid, scaleLabels, showRayZones, hsmViewMode, uiTheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Fixed viewport: no zoom/pan needed. The solar system auto-fits.
    // We still listen for pointer events to allow click detection if desired,
    // but disable scroll/drag behavior.
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
    };

    const handlePointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (_event: PointerEvent) => {
      // no-op: fixed viewport
    };

    const handlePointerUp = (event: PointerEvent) => {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* no-op */
      }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  const stepDays = (days: number) => {
    timeRef.current += days * 86400000;
    setWhen(new Date(timeRef.current));
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (!value) return;
    const [year, month, day] = value.split("-").map((n) => parseInt(n, 10));
    if (!year || !month || !day) return;
    const updated = new Date(when);
    updated.setFullYear(year, month - 1, day);
    timeRef.current = updated.getTime();
    setWhen(updated);
  };

  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (!value) return;
    const [hours, minutes] = value.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
    const updated = new Date(when);
    updated.setHours(hours, minutes, 0, 0);
    timeRef.current = updated.getTime();
    setWhen(updated);
  };

  const resetView = () => {
    cameraRef.current = { x: 0, y: 0 };
    scaleRef.current = DEFAULT_SCALE[hsmViewMode];
  };

  useEffect(() => {
    resetView();
  }, [hsmViewMode]);

  const zodiacPlacements = useMemo<ZodiacPlacement[]>(() => {
    const mode = rayViewMode === "solar" ? "heliocentric" : "geocentric";
    const placements = getPlacements(mode, when);
    const byBody = new Map<BodyName, Placement>();
    placements.forEach((placement) => {
      byBody.set(placement.body, placement);
    });

    return BODY_ORDER.map((body) => {
        const placement = byBody.get(body);
        if (!placement) {
          return null;
        }

        let effectivePlacement = placement;

        // Gaian (geocentric) lens: Earth faces the anti-solar point.
        // The zodiac belt wraps around Earth, so Earth's astrological
        // position is opposite the Sun at 180° — distance is 0 in this frame.
        if (mode === "geocentric" && body === "Earth") {
          const sun = byBody.get("Sun");
          if (sun) {
            effectivePlacement = {
              ...placement,
              lon: normalizeDegrees(sun.lon + 180),
              lat: sun.lat,
              dist: 0,
            };
          }
        }

        // Solar (heliocentric) lens: Sun shows its geocentric sign
        // (Solar Returns are defined by the Sun's geocentric longitude).
        // The Sun is the center of this frame — distance is 0.
        if (mode === "heliocentric" && body === "Sun") {
          effectivePlacement = {
            ...geocentricPlacement("Sun", when),
            dist: 0,
          };
        }

        const zodiac = zodiacFromLongitude(effectivePlacement.lon);
        return {
          body,
          signName: zodiac.sign.name,
          signSymbol: zodiac.sign.symbol,
          signIndex: zodiac.signIndex,
          degrees: zodiac.degrees,
          minutes: zodiac.minutes,
          longitude: zodiac.longitude,
          latitude: effectivePlacement.lat,
          distanceAu: effectivePlacement.dist,
        };
      })
      .filter(Boolean) as ZodiacPlacement[];
  }, [when, rayViewMode]);

  const formatDateForInput = (date: Date) => {
    // Keep the local calendar day (avoid UTC conversion that can shift the date).
    const tzAdjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return tzAdjusted.toISOString().slice(0, 10);
  };

  const formattedDate = useMemo(() => formatDateForInput(when), [when]);
  const formattedTime = useMemo(
    () =>
      when.toLocaleTimeString([], {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
    [when]
  );
  const heliocentricButtonClass = `px-3 py-1.5 text-xs font-bold transition ${
    hsmViewMode === "heliocentric"
      ? uiTheme === "atlas"
        ? "bg-stone-100 text-amber-950 shadow-md shadow-amber-900/20 ring-1 ring-stone-300/50"
        : "bg-white text-slate-900 shadow-lg shadow-white/25 ring-1 ring-white/70"
      : uiTheme === "atlas"
      ? "text-stone-300/90 bg-stone-900/80 border border-stone-600/40 hover:bg-stone-700 hover:text-stone-100 font-medium"
      : "text-slate-400 bg-slate-900/70 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-200 font-medium"
  }`;
  const gaianButtonClass = `px-3 py-1.5 text-xs font-bold transition ${
    hsmViewMode === "geocentric"
      ? uiTheme === "atlas"
        ? "bg-stone-100 text-amber-950 shadow-md shadow-amber-900/20 ring-1 ring-stone-300/50"
        : "bg-white text-slate-900 shadow-lg shadow-white/25 ring-1 ring-white/70"
      : uiTheme === "atlas"
      ? "text-stone-300/90 bg-stone-900/80 border border-stone-600/40 hover:bg-stone-700 hover:text-stone-100 font-medium"
      : "text-slate-400 bg-slate-900/70 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-200 font-medium"
  }`;
  const raySolarButtonClass = `px-3 py-1.5 text-xs font-bold transition ${
    rayViewMode === "solar"
      ? uiTheme === "atlas"
        ? "bg-stone-100 text-amber-950 shadow-md shadow-amber-900/20 ring-1 ring-stone-300/50"
        : "bg-white text-slate-900 shadow-lg shadow-white/25 ring-1 ring-white/70"
      : uiTheme === "atlas"
      ? "text-stone-300/90 bg-stone-900/80 border border-stone-600/40 hover:bg-stone-700 hover:text-stone-100 font-medium"
      : "text-slate-400 bg-slate-900/70 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-200 font-medium"
  }`;
  const rayGaianButtonClass = `px-3 py-1.5 text-xs font-bold transition ${
    rayViewMode === "gaian"
      ? uiTheme === "atlas"
        ? "bg-stone-100 text-amber-950 shadow-md shadow-amber-900/20 ring-1 ring-stone-300/50"
        : "bg-white text-slate-900 shadow-lg shadow-white/25 ring-1 ring-white/70"
      : uiTheme === "atlas"
      ? "text-stone-300/90 bg-stone-900/80 border border-stone-600/40 hover:bg-stone-700 hover:text-stone-100 font-medium"
      : "text-slate-400 bg-slate-900/70 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-200 font-medium"
  }`;

  return (
    <div className="flex flex-col gap-4">
      {/* 1) Zodiac alignment cards */}
      <div className="space-y-3 text-slate-100">
        <div className="flex flex-col gap-2">
          <div className="text-xs uppercase tracking-wide text-sky-200/80">Ray Astrology</div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <span className="text-sky-200/80">Date</span>
              <input
                type="date"
                value={formattedDate}
                onChange={handleDateChange}
                className="rounded-md border border-sky-500/50 bg-slate-900 px-2 py-1 text-sky-100"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sky-200/80">Time</span>
              <input
                type="time"
                value={formattedTime}
                step={60}
                onChange={handleTimeChange}
                className="rounded-md border border-sky-500/50 bg-slate-900 px-2 py-1 text-sky-100"
              />
            </label>
            <button
              type="button"
              className="rounded-md border border-sky-500/50 px-2 py-1 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/20"
              onClick={() => {
                const now = new Date();
                timeRef.current = now.getTime();
                setWhen(now);
              }}
            >
              Current Date
            </button>
            <div className="inline-flex overflow-hidden rounded-xl ml-1">
              <button
                type="button"
                className={`atlas-theme-toggle ${rayGaianButtonClass}`}
                aria-pressed={rayViewMode === "gaian"}
                onClick={() => setRayViewMode("gaian")}
              >
                Gaian
              </button>
              <button
                type="button"
                className={`atlas-theme-toggle ${raySolarButtonClass}`}
                aria-pressed={rayViewMode === "solar"}
                onClick={() => setRayViewMode("solar")}
              >
                Solar
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {zodiacPlacements.map((placement) => {
            const rayName = ZODIAC_RAY_NAMES[placement.signIndex] ?? "";
            const isLongRay = rayName.length > 9;
            const isCarbonRay = placement.signIndex === 9; // Capricorn / Carbon
            const outlineShadow = "-0.6px 0 #fff, 0 0.6px #fff, 0.6px 0 #fff, 0 -0.6px #fff";
            const carbonShadow = `${outlineShadow}, 0 0 8px rgba(0,0,0,0.35)`;
            return (
              <div
                key={placement.body}
                className="rounded-xl border border-sky-500/20 bg-slate-800/50 px-2 py-2 backdrop-blur-sm"
              >
                <div
                  className="mb-0.5 h-0.5 w-full rounded-full"
                  style={{ background: ZODIAC_HUES[placement.signIndex] ?? "rgba(125,211,252,0.6)" }}
                />
                <div className="flex w-full items-start justify-between gap-x-1 pt-0.5 text-sm leading-[1.05] text-slate-200">
                  <div className="flex items-center gap-2 leading-[1.05] shrink-0">
                    <img
                      src={planetIconSrc(placement.body)}
                      alt={placement.body}
                      className="h-8 w-8 rounded-full object-cover shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                      aria-hidden
                    />
                    <div className="flex items-center gap-1.5 leading-tight">
                      <span className="font-semibold text-sky-100">{placement.body}</span>
                      <span className="text-sm text-sky-200">{BODY_GLYPHS[placement.body]}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0 text-right leading-[1.05] shrink-0">
                    <div
                      className="flex items-center gap-1 text-sm font-bold whitespace-nowrap"
                      style={{
                        color: ZODIAC_HUES[placement.signIndex] ?? "#e2e8f0",
                        textShadow: isCarbonRay ? carbonShadow : "0 0 8px rgba(0,0,0,0.25)",
                      }}
                    >
                      <span className="text-base">{placement.signSymbol}</span>
                      <span className="uppercase tracking-wide">{placement.signName}</span>
                    </div>
                    <div
                      className={`${isLongRay ? "text-[0.65rem]" : "text-[0.72rem]"} font-semibold whitespace-nowrap`}
                      style={{
                        color: ZODIAC_HUES[placement.signIndex] ?? "#e2e8f0",
                        textShadow: isCarbonRay ? carbonShadow : undefined,
                      }}
                    >
                      {rayName}
                    </div>
                    <div className="text-sm font-semibold text-sky-100 whitespace-nowrap">
                      {placement.degrees.toString().padStart(2, "0")}°{placement.minutes.toString().padStart(2, "0")}′
                    </div>
                  </div>
                </div>
                <div className="text-right text-[0.6rem] text-slate-300 whitespace-nowrap">
                  λ {placement.longitude.toFixed(2)}° • β {Math.abs(placement.latitude || 0) < 0.0001 ? "0.00" : (placement.latitude || 0).toFixed(2)}° • Δ {placement.distanceAu.toFixed(3)} AU
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Extended Chart */}
      <div className="rounded-xl border border-sky-500/20 bg-slate-800/60 p-3">
        <button
          type="button"
          className="flex w-full items-center justify-between font-semibold text-sky-100"
          onClick={() => setExtChartOpen((v) => !v)}
        >
          <span>Extended Chart</span>
          <span className="text-xs text-sky-200/80">{extChartOpen ? "Hide" : "Show"}</span>
        </button>
        {extChartOpen && (
          <ChartPanel
            activeProfile={activeProfile}
            extChartMode={extChartMode}
            setExtChartMode={setExtChartMode}
            srTargetYear={srTargetYear}
            setSrTargetYear={setSrTargetYear}
            liveLocation={liveLocation}
            setLiveLocation={setLiveLocation}
            liveLocQuery={liveLocQuery}
            setLiveLocQuery={setLiveLocQuery}
            liveGeocodeResults={liveGeocodeResults}
            detectCurrentLocation={detectCurrentLocation}
          />
        )}
      </div>

      {/* 1b) Solar Return Constellation */}
      <div className="space-y-2 text-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-sky-200/80">
            Solar Return — {profiles.length} constellation{profiles.length !== 1 ? "s" : ""}
          </div>
          <button
            type="button"
            className="rounded-md border border-sky-500/50 px-2 py-1 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/20"
            onClick={startAdd}
          >
            + Add
          </button>
        </div>

        {profiles.length === 0 && !showAddForm ? (
          <div className="text-sm text-slate-300">No constellations yet. Click "+ Add" to create one.</div>
        ) : null}

        <div className="space-y-1.5">
          {profiles.map((profile) => {
            const isExpanded = activeId === profile.id;
            const isEditing = editingId === profile.id;
            const isConfirming = confirmRemoveId === profile.id;

            return (
              <div key={profile.id} className="rounded-lg border border-sky-500/20 bg-slate-800/50 px-3 py-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="text-xs text-sky-200/70 transition hover:text-sky-100"
                    onClick={() => setActiveId(isExpanded ? null : profile.id)}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? "▼" : "▶"}
                  </button>
                  <span className="text-sm font-medium text-sky-100">{profile.name}</span>
                  <span className="text-xs text-slate-400">
                    {profile.birthMonth + 1}/{profile.birthDay}/{profile.birthYear ?? "??"}
                    {profile.birthHour != null ? ` at ${profile.birthHour.toString().padStart(2,"0")}:${(profile.birthMinute ?? 0).toString().padStart(2,"0")}` : ""}
                    {" @ "}{profile.birthPlaceLabel || "Unknown"}
                  </span>
                  {isExpanded ? (
                    <div className="flex items-center gap-1 sm:ml-0">
                      <button
                        type="button"
                        className="rounded-md border border-sky-500/30 px-1.5 py-0.5 text-xs text-sky-100 transition hover:bg-sky-500/20"
                        title="Show natal chart"
                        onClick={applySolarReturn}
                      >
                        💫
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-sky-500/30 px-1.5 py-0.5 text-xs text-sky-100 transition hover:bg-sky-500/20"
                        title="Edit"
                        onClick={() => startEdit(profile)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-sky-500/30 px-1.5 py-0.5 text-xs text-sky-100 transition hover:bg-red-500/20"
                        title="Remove"
                        onClick={() => setConfirmRemoveId(profile.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  ) : null}
                </div>

                {isConfirming ? (
                  <div className="mt-1.5 flex items-center gap-2 text-xs">
                    <span className="text-slate-300">Remove this constellation?</span>
                    <button
                      type="button"
                      className="rounded bg-red-500/20 px-2 py-0.5 text-red-200 transition hover:bg-red-500/30"
                      onClick={() => { removeProfile(profile.id); setConfirmRemoveId(null); }}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className="rounded border border-sky-500/30 px-2 py-0.5 text-sky-100 transition hover:bg-sky-500/20"
                      onClick={() => setConfirmRemoveId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : null}

                {isEditing ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" className="w-full rounded border border-sky-500/50 bg-slate-900 px-2 py-1 text-sm text-sky-100 sm:w-28" />
                      <input type="date" value={editDateStr} onChange={(e) => setEditDateStr(e.target.value)} className="rounded border border-sky-500/50 bg-slate-900 px-2 py-1 text-sm text-sky-100" />
                      <input type="time" step={60} value={editTimeStr} onChange={(e) => setEditTimeStr(e.target.value)} className="rounded border border-sky-500/50 bg-slate-900 px-2 py-1 text-sm text-sky-100" />
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-sky-200">UTC offset:</label>
                        <select
                          value={editTimezoneOffset}
                          onChange={(e) => setEditTimezoneOffset(Number(e.target.value))}
                          className="rounded border border-sky-500/50 bg-slate-900 px-2 py-1 text-sm text-sky-100"
                        >
                          {Array.from({ length: 29 }, (_, i) => i - 14).map((h) => (
                            <option key={h} value={h * 60}>
                              {h >= 0 ? `UTC+${h}` : `UTC${h}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        value={editLocationQuery}
                        onChange={(e) => {
                          setEditLocationQuery(e.target.value);
                          setEditSelectedLocation(null);
                        }}
                        placeholder="Search location…"
                        className="w-full max-w-xs rounded border border-sky-500/50 bg-slate-900 px-2 py-1 text-sm text-sky-100"
                      />
                      {editGeocodeResults.length > 0 && editLocationQuery.trim().length >= 2 && !editSelectedLocation ? (
                        <ul className="absolute z-10 mt-1 max-h-48 w-full max-w-xs overflow-auto rounded border border-sky-500/40 bg-slate-800 shadow-lg">
                          {editGeocodeResults.map((r, idx) => (
                            <li key={idx}>
                              <button
                                type="button"
                                className="w-full px-2 py-1 text-left text-xs text-sky-100 transition hover:bg-sky-500/20"
                                onClick={async () => {
                                  const dateParts = editDateStr.split("-").map(Number);
                                  const [year, month, day] = dateParts;
                                  const [hour, minute] = editTimeStr.split(":").map(Number);
                                  const tzOffset = await fetchTimezoneOffset(
                                    r.lat, r.lon,
                                    year || 2000,
                                    (month || 1) - 1,
                                    day || 1,
                                    hour ?? 12,
                                    minute ?? 0
                                  );
                                  setEditTimezoneOffset(tzOffset);
                                  setEditSelectedLocation({ lat: r.lat, lon: r.lon, displayName: r.displayName });
                                  setEditLocationQuery(r.displayName);
                                }}
                              >
                                {r.displayName}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-sky-500/50 px-2 py-1 text-xs text-sky-100 transition hover:bg-sky-500/20"
                        onClick={() => {
                          const [yStr, mStr, dStr] = editDateStr.split("-").map(Number);
                          const [hStr, minStr] = editTimeStr.split(":").map(Number);
                          const loc = getFormLocation(editSelectedLocation);
                          updateProfile(profile.id, {
                            name: editName.trim() || profile.name,
                            birthMonth: (mStr || 1) - 1,
                            birthDay: dStr || 1,
                            birthYear: yStr || 2000,
                            birthHour: hStr ?? 12,
                            birthMinute: minStr ?? 0,
                            birthTimezoneOffset: editTimezoneOffset,
                            birthLat: loc.lat,
                            birthLon: loc.lon,
                            birthPlaceLabel: loc.displayName,
                          });
                          setEditingId(null);
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-sky-500/50 px-2 py-1 text-xs text-slate-300 transition hover:bg-sky-500/10"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Add form */}
        {showAddForm ? (
          <div className="rounded-lg border border-sky-500/30 bg-slate-800/60 p-3">
            <div className="mb-2 text-sm font-medium text-sky-100">New Constellation</div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Name" className="w-full rounded border border-sky-500/50 bg-slate-900 px-2 py-1 text-sm text-sky-100 sm:w-28" />
                <input type="date" value={addDateStr} onChange={(e) => setAddDateStr(e.target.value)} className="rounded border border-sky-500/50 bg-slate-900 px-2 py-1 text-sm text-sky-100" />
                <input type="time" step={60} value={addTimeStr} onChange={(e) => setAddTimeStr(e.target.value)} className="rounded border border-sky-500/50 bg-slate-900 px-2 py-1 text-sm text-sky-100" />
                <div className="flex items-center gap-1">
                  <label className="text-xs text-sky-200">UTC offset:</label>
                  <select
                    value={addTimezoneOffset}
                    onChange={(e) => setAddTimezoneOffset(Number(e.target.value))}
                    className="rounded border border-sky-500/50 bg-slate-900 px-2 py-1 text-sm text-sky-100"
                  >
                    {Array.from({ length: 29 }, (_, i) => i - 14).map((h) => (
                      <option key={h} value={h * 60}>
                        {h >= 0 ? `UTC+${h}` : `UTC${h}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="relative">
                <input
                  value={addLocationQuery}
                  onChange={(e) => {
                    setAddLocationQuery(e.target.value);
                    setAddSelectedLocation(null);
                  }}
                  placeholder="Search location…"
                  className="w-full max-w-xs rounded border border-sky-500/50 bg-slate-900 px-2 py-1 text-sm text-sky-100"
                />
                {addGeocodeResults.length > 0 && addLocationQuery.trim().length >= 2 && !addSelectedLocation ? (
                  <ul className="absolute z-10 mt-1 max-h-48 w-full max-w-xs overflow-auto rounded border border-sky-500/40 bg-slate-800 shadow-lg">
                    {addGeocodeResults.map((r, idx) => (
                      <li key={idx}>
                        <button
                          type="button"
                          className="w-full px-2 py-1 text-left text-xs text-sky-100 transition hover:bg-sky-500/20"
                          onClick={async () => {
                            const dateParts = addDateStr.split("-").map(Number);
                            const [year, month, day] = dateParts;
                            const [hour, minute] = addTimeStr.split(":").map(Number);
                            const tzOffset = await fetchTimezoneOffset(
                              r.lat, r.lon,
                              year || 2000,
                              (month || 1) - 1,
                              day || 1,
                              hour ?? 12,
                              minute ?? 0
                            );
                            setAddTimezoneOffset(tzOffset);
                            setAddSelectedLocation({ lat: r.lat, lon: r.lon, displayName: r.displayName });
                            setAddLocationQuery(r.displayName);
                          }}
                        >
                          {r.displayName}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md border border-sky-500/50 px-2 py-1 text-xs text-sky-100 transition hover:bg-sky-500/20"
                  onClick={() => {
                    if (!addDateStr) return;
                    const [yStr, mStr, dStr] = addDateStr.split("-").map(Number);
                    const [hStr, minStr] = addTimeStr.split(":").map(Number);
                    const loc = getFormLocation(addSelectedLocation);
                    addProfile({
                      name: addName.trim() || "Unnamed",
                      birthMonth: (mStr || 1) - 1,
                      birthDay: dStr || 1,
                      birthYear: yStr || 2000,
                      birthHour: hStr ?? 12,
                      birthMinute: minStr ?? 0,
                      birthTimezoneOffset: addTimezoneOffset,
                      birthLat: loc.lat,
                      birthLon: loc.lon,
                      birthPlaceLabel: loc.displayName,
                    });
                    setShowAddForm(false);
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="rounded-md border border-sky-500/50 px-2 py-1 text-xs text-slate-300 transition hover:bg-sky-500/10"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* 2) HSM title */}
      <div className="space-y-1 text-slate-100">
        <div className="text-sm uppercase tracking-wide text-sky-200/80">HSM: Heartlight System Map</div>
        <p className="text-sm text-slate-300">Pan, zoom, and sweep through time to watch each planet trace its Keplerian ellipse.</p>
      </div>

      {/* 3) Map controls: time + date + perspective */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 text-sky-100">
        {/* 🗓 Date picker */}
        <div className="group relative inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-500/50 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-sky-100 shadow-sm transition hover:bg-sky-500/20 hover:border-sky-400/60">
          <span className="pointer-events-none select-none">🗓</span>
          <span className="pointer-events-none select-none tabular-nums">{formattedDate}</span>
          <input
            type="date"
            value={formattedDate}
            onChange={handleDateChange}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
            aria-label="Select date for the Heartlight System Map"
          />
        </div>
        <button
          type="button"
          className="rounded-md border border-sky-500/50 px-2 py-1 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/20"
          onClick={() => {
            const now = new Date();
            timeRef.current = now.getTime();
            setWhen(now);
          }}
        >
          Current Date
        </button>

        {/* Play / Pause */}
        <button
          type="button"
          className="rounded-full bg-sky-500 px-3 py-2 text-sm font-semibold text-sky-950 transition hover:bg-sky-400"
          aria-label={running ? "Pause" : "Play"}
          onClick={() => setRunning((v) => !v)}
        >
          {running ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <polygon points="8,5 20,12 8,19" />
            </svg>
          )}
        </button>

        {/* Time step buttons */}
        <button
          type="button"
          className="rounded-lg border border-sky-500/60 px-3 py-1 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/20"
          onClick={() => stepDays(-30)}
        >
          −30 days
        </button>
        <button
          type="button"
          className="rounded-lg border border-sky-500/60 px-3 py-1 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/20"
          onClick={() => stepDays(-1)}
        >
          −1 day
        </button>
        <button
          type="button"
          className="rounded-lg border border-sky-500/60 px-3 py-1 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/20"
          onClick={() => stepDays(1)}
        >
          +1 day
        </button>
        <button
          type="button"
          className="rounded-lg border border-sky-500/60 px-3 py-1 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/20"
          onClick={() => stepDays(30)}
        >
          +30 days
        </button>

        {/* Perspective toggle */}
        <div className="inline-flex overflow-hidden rounded-xl">
          <button
            type="button"
            className={`atlas-theme-toggle ${gaianButtonClass}`}
            aria-pressed={hsmViewMode === "geocentric"}
            onClick={() => setHsmViewMode("geocentric")}
          >
            Gaian
          </button>
          <button
            type="button"
            className={`atlas-theme-toggle ${heliocentricButtonClass}`}
            aria-pressed={hsmViewMode === "heliocentric"}
            onClick={() => setHsmViewMode("heliocentric")}
          >
            Solar
          </button>
        </div>
      </div>

      {/* 4) Overlays toggles */}
      <div className="flex w-full flex-wrap items-center gap-3 border-t border-sky-500/20 pt-3 text-[0.65rem] uppercase tracking-wide text-sky-200/80">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-sky-500 bg-slate-900/80 text-sky-500 focus:ring-sky-400"
            checked={showZodiac}
            onChange={(event) => setShowZodiac(event.target.checked)}
          />
          Zodiac
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-sky-500 bg-slate-900/80 text-sky-500 focus:ring-sky-400"
            checked={showEclipticGrid}
            onChange={(event) => setShowEclipticGrid(event.target.checked)}
          />
          Ecliptic Grid
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-sky-500 bg-slate-900/80 text-sky-500 focus:ring-sky-400"
            checked={scaleLabels}
            onChange={(event) => setScaleLabels(event.target.checked)}
          />
          Labels Scale
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-sky-500 bg-slate-900/80 text-sky-500 focus:ring-sky-400"
            checked={showRayZones}
            onChange={(event) => setShowRayZones(event.target.checked)}
          />
          Ray Zones
        </label>
      </div>

      {/* 6) Map */}
      <div className="relative mx-auto flex w-full max-w-[640px] flex-col items-center gap-3 rounded-2xl border border-sky-500/30 bg-slate-900/70 p-4">
        <div className="relative aspect-square w-full max-w-[560px] overflow-hidden rounded-full border border-sky-500/50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-inner">
          <canvas
            ref={canvasRef}
            width={560}
            height={560}
            className="absolute inset-0 h-full w-full rounded-full"

          />
        </div>
      </div>

      {/* 7) Info drop-downs */}
      <div className="mt-3 space-y-3 text-[0.82rem] text-slate-200">
        <div className="rounded-xl border border-sky-500/20 bg-slate-800/60 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between font-semibold text-sky-100"
            onClick={() => setInfoOpen((v) => !v)}
          >
            <span>Planetary Body Information</span>
            <span className="text-xs text-sky-200/80">{infoOpen ? "Hide" : "Show"}</span>
          </button>
          {infoOpen ? (
            <div className="mt-2 space-y-2">
              {PLANETARY_INFO.map((info) => (
                <div key={info.body} className="flex flex-col gap-0.5">
                  <span className="font-semibold text-sky-100">
                    {BODY_GLYPHS[info.body]} {info.body}
                  </span>
                  <span className="text-slate-100">{info.title}</span>
                  <span className="text-slate-300">{info.detail}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-sky-500/20 bg-slate-800/60 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between font-semibold text-sky-100"
            onClick={() => setRayOpen((v) => !v)}
          >
            <span>Ray Essences</span>
            <span className="text-xs text-sky-200/80">{rayOpen ? "Hide" : "Show"}</span>
          </button>
          {rayOpen ? (
            <div className="mt-2 text-[0.8rem] text-slate-100">
              {ZODIAC_SIGNS.map((sign, idx) => {
                const hue = ZODIAC_HUES[idx] ?? "#e2e8f0";
                const isCarbonRay = idx === 9; // Capricorn / Omni‑Carbon
                const outlineShadow = [
                  "-0.6px 0 #fff",
                  "0.6px 0 #fff",
                  "0 -0.6px #fff",
                  "0 0.6px #fff",
                  "-0.6px -0.6px #fff",
                  "0.6px 0.6px #fff",
                  "-0.6px 0.6px #fff",
                  "0.6px -0.6px #fff",
                ].join(", ");
                const carbonShadow = `${outlineShadow}, 0 0 8px rgba(0,0,0,0.25)`;
                const labelStyle = isCarbonRay
                  ? {
                      color: hue,
                      textShadow: carbonShadow,
                    }
                  : { color: hue };

                return (
                  <div
                    key={sign.name}
                    className="flex flex-wrap items-start gap-2 border-b border-sky-500/10 pb-2 last:border-b-0 last:pb-0"
                  >
                    <span className="font-semibold" style={labelStyle}>
                      {sign.symbol} {sign.name} — {ZODIAC_RAY_NAMES[idx]}
                    </span>
                    <span className="text-slate-200">{ZODIAC_RAY_ESSENCE[idx]}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-sky-500/20 bg-slate-800/60 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between font-semibold text-sky-100"
            onClick={() => setHouseInfoOpen((v) => !v)}
          >
            <span>House Information</span>
            <span className="text-xs text-sky-200/80">{houseInfoOpen ? "Hide" : "Show"}</span>
          </button>
          {houseInfoOpen ? (
            <div className="mt-2 space-y-3 text-[0.8rem] text-slate-100">
              <p className="text-slate-200">
                The 12 houses are the 12 slices of the sky at your birth moment. Each represents a sphere of life experience. Unlike the zodiac signs (fixed star patterns), the houses are determined by Earth&apos;s rotation and your location on the planet.
              </p>
              <p className="text-slate-200">
                House 1 begins at the <strong className="text-sky-100">Ascendant</strong> — the eastern horizon. The remaining houses follow counter-clockwise.
              </p>
              <div className="mt-1 space-y-1.5">
                {Array.from({ length: 12 }, (_, i) => {
                  const hue = ZODIAC_HUES[i] ?? "#e2e8f0";
                  const isCarbon = i === 9;
                  const labelStyle = isCarbon
                    ? { color: hue, textShadow: "-0.6px 0 #fff, 0.6px 0 #fff, 0 -0.6px #fff, 0 0.6px #fff, 0 0 8px rgba(0,0,0,0.25)" }
                    : { color: hue };
                  return (
                    <div key={i} className="flex flex-wrap items-start gap-x-2 border-b border-sky-500/10 pb-1.5 last:border-b-0 last:pb-0">
                      <span className="font-semibold shrink-0" style={labelStyle}>{`House ${i + 1} — ${ZODIAC_RAY_NAMES[i]}`}</span>
                      <span className="text-slate-200">{HOUSE_THEMES[i]}</span>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-md border border-sky-500/20 bg-sky-900/20 p-2.5">
                <span className="text-xs font-semibold text-sky-300">C.E.S. Cosmology: Elemental Ray</span>
                <p className="mt-1 text-xs leading-relaxed text-sky-200/70">
                  House 11 resonates with the <strong className="text-sky-300">Elemental Ray</strong> honoring our Universe&apos;s C.E.S. — Crystalline-Carbon. Carbon is the foundational element of our reality: carbon-based life forms and the structural basis of our Universe itself.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-sky-500/20 bg-slate-800/60 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between font-semibold text-sky-100"
            onClick={() => setKeyOpen((v) => !v)}
          >
            <span>Ecliptic & Alignment Key</span>
            <span className="text-xs text-sky-200/80">{keyOpen ? "Hide" : "Show"}</span>
          </button>
          {keyOpen ? (
            <>
              {rayViewMode === "gaian" ? (
                <>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>λ: Geocentric ecliptic longitude — degrees along the zodiac band from Earth's view.</div>
                    <div>β: Geocentric ecliptic latitude — degrees above/below the ecliptic plane from Earth.</div>
                    <div>Δ: Distance from Earth in AU. Earth is the Heartlight center of this frame — its own distance is 0.</div>
                    <div>Sign symbol &amp; name: Zodiac sector containing the body at this moment.</div>
                    <div>Earth: Faces the anti-solar point (Sun λ + 180°), the star field Earth gazes toward.</div>
                  </div>
                  <p className="mt-2 text-slate-300">
                    In the Gaian view, Earth is the center of our Universe's Heartlight. The zodiac wraps around her, and all bodies are measured from her sacred soil. Earth faces the star field opposite our Sun — the window through which Gaia gazes into the cosmos.
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>λ: Ecliptic longitude — geocentric for our Sun, heliocentric for all other bodies.</div>
                    <div>β: Ecliptic latitude — geocentric for our Sun, heliocentric for all other bodies.</div>
                    <div>Δ: Distance from our Sun in AU. Sol is the center of this frame — its own distance is 0.</div>
                    <div>Sign symbol &amp; name: Zodiac sector containing the body at this moment.</div>
                    <div>Earth: Real heliocentric orbit around the sovereign fire.</div>
                  </div>
                  <p className="mt-2 text-slate-300">
                    In the Solar view, our Sun is the center of the system. The Sun card shows its geocentric sign (for Solar Return readings), while all other bodies show their true heliocentric positions. Earth orbits the sovereign fire with all her sister worlds.
                  </p>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Extended Chart Panel ──────────────────────────────────────────────── */

function ChartPanel({
  activeProfile,
  extChartMode,
  setExtChartMode,
  srTargetYear,
  setSrTargetYear,
  liveLocation,
  setLiveLocation,
  liveLocQuery,
  setLiveLocQuery,
  liveGeocodeResults,
  detectCurrentLocation,
}: {
  activeProfile: import("../hooks/useSolarReturn").SolarReturnProfile | null;
  extChartMode: "live" | "solar" | "natal";
  setExtChartMode: (m: "live" | "solar" | "natal") => void;
  srTargetYear: number;
  setSrTargetYear: (y: number) => void;
  liveLocation: { lat: number; lon: number; displayName: string } | null;
  setLiveLocation: (loc: { lat: number; lon: number; displayName: string } | null) => void;
  liveLocQuery: string;
  setLiveLocQuery: (q: string) => void;
  liveGeocodeResults: Array<{ lat: number; lon: number; displayName: string }>;
  detectCurrentLocation: () => void;
}) {
  const [chartData, setChartData] = useState<ExtendedChartData | null>(null);

  useEffect(() => {
    if (extChartMode === "live") {
      const lat = liveLocation?.lat ?? activeProfile?.birthLat ?? 35.25;
      const lon = liveLocation?.lon ?? activeProfile?.birthLon ?? -80.8;
      setChartData(buildLiveChart(lat, lon));
      return;
    }

    if (!activeProfile) {
      setChartData(null);
      return;
    }

    if (extChartMode === "natal") {
      const p = activeProfile;
      const tzOffset =
        p.birthTimezoneOffset ??
        estimateFromLongitude(p.birthLon);
      const data = buildNatalChart(
        p.birthMonth, p.birthDay, p.birthYear ?? 2000,
        p.birthHour ?? 12, p.birthMinute ?? 0,
        p.birthLat, p.birthLon,
        tzOffset
      );
      setChartData(data);
      return;
    }

    if (extChartMode === "solar") {
      const p = activeProfile;
      const tzOffset =
        p.birthTimezoneOffset ??
        estimateFromLongitude(p.birthLon);
      const srDate = findSolarReturnMoment(
        p.birthMonth, p.birthDay, p.birthYear ?? 2000,
        p.birthHour ?? 12, p.birthMinute ?? 0,
        p.birthLat, p.birthLon,
        srTargetYear,
        tzOffset
      );
      if (srDate) {
        setChartData(buildChart(srDate, p.birthLat, p.birthLon));
      } else {
        setChartData(null);
      }
    }
  }, [extChartMode, activeProfile, srTargetYear, liveLocation]);

  if (!activeProfile) {
    return (
      <div className="rounded-xl border border-sky-500/20 bg-slate-800/60 p-3 text-sm text-slate-300">
        Add a Solar Return constellation below to unlock the Extended Chart.
      </div>
    );
  }

  const p = activeProfile;
  const hasTime = p.birthHour != null && p.birthMinute != null;

  return (
    <div className="mt-2 space-y-3">
      {/* Active profile banner */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-sky-900/30 px-2.5 py-1.5">
        <span className="text-xs font-semibold text-sky-200">{p.name}</span>
        <span className="text-[0.65rem] text-sky-500">•</span>
        <span className="text-[0.65rem] text-slate-300">
          {extChartMode === "live"
            ? `Live Sky • ${liveLocation?.displayName ?? p.birthPlaceLabel ?? "Current Location"}`
            : extChartMode === "natal"
            ? `Natal Chart • ${p.birthMonth + 1}/${p.birthDay}/${p.birthYear ?? "??"} ${hasTime ? `@ ${p.birthHour}:${p.birthMinute?.toString().padStart(2, "0") ?? "00"}` : ""}`
            : `Solar Return • ${srTargetYear}`}
        </span>
        <span className="ml-auto text-[0.65rem] text-slate-500 truncate max-w-[140px]">{extChartMode === "live" ? (liveLocation?.displayName ?? p.birthPlaceLabel) : p.birthPlaceLabel}</span>
      </div>

      {/* Mode selector — grouped: Chart (Natal / Solar) vs. Moment (Live) */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Primary: Natal — the native chart */}
        <button
          type="button"
          onClick={() => setExtChartMode("natal")}
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
            extChartMode === "natal"
              ? "bg-white text-slate-900 shadow-lg shadow-white/25 ring-1 ring-white/70"
              : "text-slate-400 bg-slate-900/70 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          Natal Chart
        </button>

        {hasTime && (
          <button
            type="button"
            onClick={() => setExtChartMode("solar")}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
              extChartMode === "solar"
                ? "bg-white text-slate-900 shadow-lg shadow-white/25 ring-1 ring-white/70"
                : "text-slate-400 bg-slate-900/70 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            Solar Return
          </button>
        )}

        <span className="text-slate-700">|</span>

        {/* Secondary: Current moment (transit) */}
        <button
          type="button"
          onClick={() => setExtChartMode("live")}
          className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
            extChartMode === "live"
              ? "bg-sky-600 text-white shadow-lg shadow-sky-600/30"
              : "text-slate-500 bg-slate-900/40 border border-slate-700/30 hover:bg-slate-800 hover:text-slate-300"
          }`}
        >
          Live Sky
        </button>
      </div>

      {/* Live Sky location selector */}
      {extChartMode === "live" && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={detectCurrentLocation}
              className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[0.7rem] text-sky-200 transition hover:bg-sky-500/20"
            >
              Use Current Location
            </button>
            <span className="text-[0.65rem] text-slate-500">or search:</span>
            <input
              value={liveLocQuery}
              onChange={(e) => setLiveLocQuery(e.target.value)}
              placeholder="City, country..."
              className="flex-1 min-w-[120px] rounded border border-sky-500/20 bg-slate-900/50 px-2 py-1 text-xs text-sky-100 placeholder-slate-500 outline-none"
            />
          </div>
          {liveGeocodeResults.length > 0 && (
            <ul className="rounded-md border border-sky-500/10 bg-slate-900/60 py-1 text-xs">
              {liveGeocodeResults.slice(0, 6).map((r) => (
                <li key={`${r.lat}-${r.lon}`}>
                  <button
                    type="button"
                    className="w-full px-2 py-1 text-left text-xs text-sky-100 transition hover:bg-sky-500/20"
                    onClick={() => { setLiveLocation({ lat: r.lat, lon: r.lon, displayName: r.displayName }); setLiveLocQuery(""); }}
                  >
                    {r.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {liveLocation && (
            <div className="text-[0.65rem] text-slate-400">
              Live location: <span className="text-sky-200">{liveLocation.displayName}</span>
              {liveLocation.displayName !== "Current Location" && (
                <button
                  type="button"
                  className="ml-2 text-slate-500 hover:text-slate-300"
                  onClick={() => setLiveLocation(null)}
                >
                  (reset)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Year selector for Solar Return */}
      {extChartMode === "solar" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Year:</span>
          <input
            type="number"
            min={1900}
            max={2100}
            value={srTargetYear}
            onChange={(e) => setSrTargetYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
            className="w-20 rounded-md border border-sky-500/30 bg-slate-900/50 px-2 py-1 text-xs text-sky-100 outline-none"
          />
        </div>
      )}

      {/* Four angles */}
      {chartData && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <AngleCard angle={chartData.ascendant} label="Ascendant (Rising)" />
            <AngleCard angle={chartData.descendant} label="Descendant" />
            <AngleCard angle={chartData.midheaven} label="Midheaven (MC)" />
            <AngleCard angle={chartData.ic} label="IC (Imum Coeli)" />
          </div>
          {/* Sun */}
          <div className="flex items-center gap-2 rounded-md border border-sky-500/10 bg-slate-900/40 px-2.5 py-1.5">
            <span className="text-sm font-semibold text-sky-100">Sun:</span>
            <span className="text-base" style={carbonTextStyle(chartData.sun.signIndex)}>{chartData.sun.signSymbol}</span>
            <span className="text-sm font-medium text-slate-200">{chartData.sun.signName} {chartData.sun.degrees}°</span>
            <span className="ml-auto text-xs" style={carbonTextStyle(chartData.sun.signIndex)}>{ZODIAC_RAY_NAMES[chartData.sun.signIndex]}</span>
          </div>
          {/* Houses: 1–6 left column, 7–12 right column */}
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              {chartData.houses.slice(0, 6).map((h) => (
                <HouseRow key={h.houseNumber} house={h} />
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {chartData.houses.slice(6, 12).map((h) => (
                <HouseRow key={h.houseNumber} house={h} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AngleCard({ angle, label }: { angle: ChartAngle; label: string }) {
  return (
    <div className="rounded-md border border-sky-500/10 bg-slate-900/40 px-2.5 py-2 space-y-0.5">
      <div className="text-[0.65rem] uppercase tracking-wide text-sky-200/60">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="text-lg" style={carbonTextStyle(angle.signIndex)}>{angle.signSymbol}</span>
        <span className="text-sm font-semibold text-slate-100">{angle.signName} {angle.degrees}°{angle.minutes > 0 ? ` ${angle.minutes}'` : ""}</span>
      </div>
      <div className="text-[0.65rem] font-medium" style={carbonTextStyle(angle.signIndex)}>{ZODIAC_RAY_NAMES[angle.signIndex]}</div>
    </div>
  );
}

function HouseRow({ house }: { house: import("../lib/extendedChart").House }) {
  const isCarbon = house.cusp.signIndex === CAPRICORN_INDEX;
  return (
    <div className="flex items-center gap-2 rounded-md border border-sky-500/10 bg-slate-900/40 px-2 py-1.5">
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold ${isCarbon ? "text-white border border-white/40" : "text-white"}`}
        style={{ backgroundColor: house.rayColor }}
      >
        {house.houseNumber}
      </div>
      <span
        className="text-[0.8rem] font-medium text-slate-200 shrink-0"
        style={isCarbon ? { WebkitTextStroke: "0.3px rgba(255,255,255,0.6)", textShadow: "0 0 4px rgba(255,255,255,0.4)" } : undefined}
      >
        {house.cusp.signSymbol} {house.cusp.signName}
      </span>
      <span className="text-[0.65rem] text-slate-400 truncate">{house.theme}</span>
      <span
        className="ml-auto text-[0.65rem] font-medium shrink-0"
        style={carbonTextStyle(house.cusp.signIndex)}
      >
        {house.rayName}
      </span>
    </div>
  );
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  orbitCache: Map<string, Vec2[]>,
  time: Date,
  worldToScreen: (point: Vec2) => Vec2,
  scale: number,
  overlays: OverlayOptions,
  themeFont: string,
  themeTextColor: string,
  themeColors: CanvasThemeColors
) {
  const width = ctx.canvas.width / (window.devicePixelRatio ?? 1);
  const height = ctx.canvas.height / (window.devicePixelRatio ?? 1);

  ctx.save();
  ctx.fillStyle = themeColors.background;
  ctx.fillRect(0, 0, width, height);

  // PRE-COMPUTE: all astronomical data before drawing
  const placements = getPlacements(overlays.viewMode, time);
  const geoPlacements = getPlacements("geocentric", time);
  const moonGeo = geoPlacements.find((p) => p.body === "Moon");
  const sunGeo = geoPlacements.find((p) => p.body === "Sun");
  const activeRayIndex = sunGeo ? Math.floor(normalizeDegrees(sunGeo.lon) / 30) % 12 : -1;

  // Circular viewport clip for the system
  const radius = Math.min(width, height) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
  ctx.clip();

  if (overlays.showRayZones) {
    drawRayZones(ctx, radius, activeRayIndex, themeColors.rayZoneOpacity);
  }

  if (overlays.showEclipticGrid) {
    drawEclipticGrid(ctx, worldToScreen, scale);
  }

  if (overlays.viewMode === "heliocentric") {
    orbitCache.forEach((points) => {
      if (points.length === 0) return;
      ctx.beginPath();
      points.forEach((point, idx) => {
        const screen = worldToScreen(point);
        if (idx === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
      });
      ctx.strokeStyle = themeColors.orbitStroke;
      ctx.lineWidth = 1.5 * scale * themeColors.orbitWidth;
      ctx.stroke();
    });

    drawSun(ctx, worldToScreen, scale, themeColors);
  }

  drawBodies(ctx, placements, worldToScreen, scale, overlays, moonGeo, themeFont, themeTextColor, themeColors);
  ctx.restore(); // end clip

  if (overlays.showZodiac) {
    drawZodiacRing(ctx, worldToScreen, scale, themeColors);
  }

  // Outline circular viewport
  ctx.strokeStyle = themeColors.zodiacRing;
  ctx.lineWidth = 1 * themeColors.zodiacRingWidth;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, radius - 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawZodiacRing(
  ctx: CanvasRenderingContext2D,
  _worldToScreen: (point: Vec2) => Vec2,
  scale: number,
  themeColors: CanvasThemeColors
) {
  const dpr = window.devicePixelRatio ?? 1;
  const width = ctx.canvas.width / dpr;
  const height = ctx.canvas.height / dpr;
  const center = { x: width / 2, y: height / 2 };
  const viewportRadius = Math.min(width, height) / 2;

  // Ring sits in the outer zodiac band (between solar system edge and viewport edge)
  const ringRadius = viewportRadius * 0.88;
  const symbolRadius = ringRadius * 0.94;  // just inside ring, outside all planets
  const nameRadius = ringRadius + 5;      // just outside ring

  const symbolPx = clamp(ringRadius * 0.065, 10, 18);
  const namePx   = clamp(ringRadius * 0.042, 7, 13);

  ctx.save();

  // Thin ring outline with first hue (Aries/Red)
  ctx.strokeStyle = hexToRgba(ZODIAC_HUES[0], 0.30);
  ctx.lineWidth = clamp(scale * 0.35, 0.7, 1.4) * themeColors.zodiacRingWidth;
  ctx.beginPath();
  ctx.arc(center.x, center.y, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 12; i += 1) {
    const hue = ZODIAC_HUES[i];
    const isCarbon = i === 9;
    const angle = (i / 12) * Math.PI * 2;

    // Tick marks crossing the ring boundary
    ctx.strokeStyle = isCarbon ? "rgba(255,255,255,0.35)" : hexToRgba(hue, 0.50);
    ctx.lineWidth = clamp(scale * 0.3, 0.6, 1.4);
    const tickLen = ringRadius * 0.03;
    const tInner = {
      x: center.x + Math.cos(angle) * (ringRadius - tickLen),
      y: center.y - Math.sin(angle) * (ringRadius - tickLen),
    };
    const tOuter = {
      x: center.x + Math.cos(angle) * (ringRadius + tickLen),
      y: center.y - Math.sin(angle) * (ringRadius + tickLen),
    };
    ctx.beginPath();
    ctx.moveTo(tInner.x, tInner.y);
    ctx.lineTo(tOuter.x, tOuter.y);
    ctx.stroke();

    const sign = ZODIAC_SIGNS[i];
    const midAngle = angle + Math.PI / 12;

    // ── SYMBOL: inside the ring, centered horizontally ──
    const symX = center.x + Math.cos(midAngle) * symbolRadius;
    const symY = center.y - Math.sin(midAngle) * symbolRadius;
    ctx.font = `${symbolPx}px 'JetBrains Mono', ui-monospace, monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    if (isCarbon) {
      ctx.shadowColor = "rgba(255,255,255,0.9)";
      ctx.shadowBlur = 5;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 0.7;
      ctx.strokeText(sign.symbol, symX, symY);
    }
    ctx.fillStyle = hue;
    ctx.fillText(sign.symbol, symX, symY);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    // ── NAME: curved text following the outer arc ──
    ctx.fillStyle = hue;
    ctx.font = `${namePx}px 'JetBrains Mono', ui-monospace, monospace`;
    drawArcText(ctx, sign.name.toUpperCase(), center.x, center.y, nameRadius, midAngle, isCarbon);
  }

  // Degree ticks every 10°
  for (let deg = 0; deg < 360; deg += 10) {
    const rad = deg * DEG2RAD;
    const isMajor = deg % 30 === 0;
    const innerR = isMajor ? ringRadius * 0.96 : ringRadius * 0.98;
    const outerR = ringRadius * 1.03;
    ctx.beginPath();
    ctx.strokeStyle = isMajor ? themeColors.zodiacTickMajor : themeColors.zodiacTickMinor;
    ctx.lineWidth = isMajor ? clamp(scale * 0.25, 0.4, 1.0) : clamp(scale * 0.18, 0.3, 0.8);
    ctx.moveTo(center.x + Math.cos(rad) * innerR, center.y - Math.sin(rad) * innerR);
    ctx.lineTo(center.x + Math.cos(rad) * outerR, center.y - Math.sin(rad) * outerR);
    ctx.stroke();
  }

  ctx.restore();
}

/** Draw text curved along a circular arc (each char tangent to the circle).
 *  For outside-of-circle placement with bottom of letters toward center. */
function drawArcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  midAngle: number,
  isCarbon: boolean
) {
  const metrics = ctx.measureText("M");
  const charW = metrics.width * 0.9;
  const totalArc = (text.length * charW) / radius;
  let angle = midAngle - totalArc / 2;

  // Upper half (0°–180°): reverse text so it reads L→R along the arc
  const isUpperHalf = Math.sin(midAngle) > 0;
  const drawText = isUpperHalf ? text.split("").reverse().join("") : text;

  for (let i = 0; i < drawText.length; i++) {
    const ch = drawText[i];
    const x = cx + Math.cos(angle) * radius;
    const y = cy - Math.sin(angle) * radius;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(isUpperHalf ? (-angle + Math.PI / 2) : (-angle - Math.PI / 2));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (isCarbon) {
      ctx.shadowColor = "rgba(255,255,255,0.8)";
      ctx.shadowBlur = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 0.5;
      ctx.strokeText(ch, 0, 0);
    }
    ctx.fillText(ch, 0, 0);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    ctx.restore();
    angle += charW / radius;
  }
}

function drawRayZones(
  ctx: CanvasRenderingContext2D,
  viewportRadius: number,
  activeRayIndex: number,
  rayZoneOpacity: number
) {
  const sectorRadius = viewportRadius * 0.92;
  const steps = 12;
  const center = { x: ctx.canvas.width / (window.devicePixelRatio ?? 1) / 2, y: ctx.canvas.height / (window.devicePixelRatio ?? 1) / 2 };

  for (let i = 0; i < 12; i++) {
    const hue = ZODIAC_HUES[i];
    const isActive = i === activeRayIndex;
    const isCarbon = i === 9;
    const startAngle = (i / 12) * Math.PI * 2;
    const endAngle = ((i + 1) / 12) * Math.PI * 2;

    // Build polygon with same trig as labels (CCW: cos, -sin)
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    for (let s = 0; s <= steps; s++) {
      const a = startAngle + (s / steps) * (endAngle - startAngle);
      ctx.lineTo(
        center.x + Math.cos(a) * sectorRadius,
        center.y - Math.sin(a) * sectorRadius
      );
    }
    ctx.closePath();

    // Fill
    if (isCarbon) {
      ctx.fillStyle = isActive ? `rgba(30,25,25,${0.28 * rayZoneOpacity / 0.08})` : `rgba(15,10,10,${0.18 * rayZoneOpacity / 0.08})`;
    } else if (isActive) {
      ctx.fillStyle = hexToRgba(hue, 0.22 * (rayZoneOpacity / 0.08));
    } else {
      ctx.fillStyle = hexToRgba(hue, 0.10 * (rayZoneOpacity / 0.08));
    }
    ctx.fill();

    // Boundary
    ctx.strokeStyle = isCarbon
      ? (isActive ? `rgba(255,255,255,${0.45 * rayZoneOpacity / 0.08})` : `rgba(255,255,255,${0.20 * rayZoneOpacity / 0.08})`)
      : (isActive ? hexToRgba(hue, 0.55 * (rayZoneOpacity / 0.08)) : hexToRgba(hue, 0.22 * (rayZoneOpacity / 0.08)));
    ctx.lineWidth = isActive ? 1.6 : 0.8;
    ctx.stroke();

    // Inner glow for active
    if (isActive) {
      ctx.beginPath();
      const midA = startAngle + (endAngle - startAngle) / 2;
      const gx = center.x + Math.cos(midA) * sectorRadius * 0.65;
      const gy = center.y - Math.sin(midA) * sectorRadius * 0.65;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, sectorRadius * 0.35);
      if (isCarbon) {
        gr.addColorStop(0, `rgba(255,255,255,${rayZoneOpacity})`);
        gr.addColorStop(1, "rgba(255,255,255,0)");
      } else {
        gr.addColorStop(0, hexToRgba(hue, 0.14 * (rayZoneOpacity / 0.08)));
        gr.addColorStop(1, hexToRgba(hue, 0));
      }
      ctx.fillStyle = gr;
      ctx.arc(gx, gy, sectorRadius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawEclipticGrid(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (point: Vec2) => Vec2,
  scale: number
) {
  const center = worldToScreen({ x: 0, y: 0 });
  const maxOrbit = RING_PX["Pluto"];
  const innerRadius = RING_PX["Mercury"] * 0.5;
  const outerRadius = maxOrbit * 1.02;
  ctx.save();
  ctx.strokeStyle = "rgba(125,211,252,0.18)";
  ctx.lineWidth = clamp(scale * 0.25, 0.3, 1.0);

  for (let deg = 0; deg < 360; deg += 30) {
    const rad = deg * DEG2RAD;
    const innerPoint = worldToScreen({
      x: Math.cos(rad) * innerRadius,
      y: Math.sin(rad) * innerRadius,
    });
    const outerPoint = worldToScreen({
      x: Math.cos(rad) * outerRadius,
      y: Math.sin(rad) * outerRadius,
    });
    ctx.beginPath();
    ctx.moveTo(innerPoint.x, innerPoint.y);
    ctx.lineTo(outerPoint.x, outerPoint.y);
    ctx.stroke();
  }

  const latitudes = [-30, -15, 15, 30];
  latitudes.forEach((lat) => {
    const beta = lat * DEG2RAD;
    const r = outerRadius * Math.cos(beta);
    const edge = worldToScreen({ x: r, y: 0 });
    const radiusPx = Math.hypot(edge.x - center.x, edge.y - center.y);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, worldToScreen: (point: Vec2) => Vec2, scale: number, themeColors: CanvasThemeColors) {
  const radius = BODY_PX["Sun"] * scale;
  const center = worldToScreen({ x: 0, y: 0 });

  // Try real Sun image first
  const didDraw = drawPlanetImage(ctx, center, radius, "Sun", {
    color: themeColors.sunGlow,
    blur: 35 * scale,
  });

  if (!didDraw) {
    // Fallback gradient
    const gradient = ctx.createRadialGradient(center.x - radius * 0.3, center.y - radius * 0.3, radius * 0.1, center.x, center.y, radius);
    gradient.addColorStop(0, themeColors.sunInner);
    gradient.addColorStop(1, themeColors.sunOuter);
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.shadowColor = themeColors.sunGlow;
    ctx.shadowBlur = 35 * scale;
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawSunMarker(ctx: CanvasRenderingContext2D, center: Vec2, scale: number) {
  const radius = BODY_PX["Sun"] * 0.85 * scale;

  // Try real Sun image first
  const didDraw = drawPlanetImage(ctx, center, radius, "Sun", {
    color: "rgba(253, 211, 107, 0.45)",
    blur: 18 * scale,
  });

  if (!didDraw) {
    // Fallback gradient
    const gradient = ctx.createRadialGradient(center.x - radius * 0.3, center.y - radius * 0.3, radius * 0.15, center.x, center.y, radius);
    gradient.addColorStop(0, "#fff7d6");
    gradient.addColorStop(1, "#f59e0b");
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.shadowColor = "rgba(253, 211, 107, 0.45)";
    ctx.shadowBlur = 18 * scale;
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawBodies(
  ctx: CanvasRenderingContext2D,
  placements: Placement[],
  worldToScreen: (point: Vec2) => Vec2,
  scale: number,
  overlays: OverlayOptions,
  moonGeo?: Placement,
  themeFont?: string,
  themeTextColor?: string,
  themeColors?: CanvasThemeColors
) {
  const dpr = window.devicePixelRatio ?? 1;
  const canvasWidth = ctx.canvas.width / dpr;
  const cx = canvasWidth / 2;

  ctx.textBaseline = "middle";
  ctx.font = BODY_FONT;

  const earthPlacement = placements.find((placement) => placement.body === "Earth");

  // Inner planets always get centered-below labels (near Sun, keep clean)
  const INNER_BODIES = new Set<BodyName>(["Sun", "Mercury", "Venus", "Earth", "Mars", "Moon"]);
  // Outer planets get smart edge-aware labels
  const OUTER_BODIES = new Set<BodyName>(["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);

  placements.forEach((placement) => {
    const { body } = placement;
    if (overlays.viewMode === "heliocentric" && body === "Sun") return; // drawn separately
    if (body === "Moon") return; // handled below

    const bodyRadius = (BODY_PX[body] ?? 5) * scale;
    const center = worldToScreen(placement.world);

    if (overlays.viewMode === "geocentric" && body === "Sun") {
      drawSunMarker(ctx, center, scale);
    } else {
      const planetDef = PLANETS.find((planet) => planet.name === body);
      if (!planetDef) return;
      drawPlanetGlyph(ctx, center, bodyRadius, planetDef);
    }

    // ── Smart label placement ──
    const labelGap = Math.max(3, 4 * scale);
    ctx.fillStyle = themeTextColor ?? themeColors?.bodyLabel ?? "#e2e8f0";
    ctx.font = `${clamp(11 * scale, 8, 14)}px ${themeFont ?? "'JetBrains Mono', ui-monospace, monospace"}`;

    if (INNER_BODIES.has(body)) {
      // Inner: always centered below
      ctx.textBaseline = "top";
      ctx.textAlign = "center";
      ctx.fillText(body, center.x, center.y + bodyRadius + labelGap);
      ctx.textBaseline = "middle";
    } else if (OUTER_BODIES.has(body)) {
      // Outer: edge-aware horizontal placement
      const isNearRightEdge = center.x > cx + canvasWidth * 0.18;
      const isNearLeftEdge  = center.x < cx - canvasWidth * 0.18;

      if (isNearRightEdge) {
        ctx.textAlign = "right";
        ctx.fillText(body, center.x - bodyRadius - labelGap, center.y);
      } else if (isNearLeftEdge) {
        ctx.textAlign = "left";
        ctx.fillText(body, center.x + bodyRadius + labelGap, center.y);
      } else {
        // Center zone: below planet
        ctx.textBaseline = "top";
        ctx.textAlign = "center";
        ctx.fillText(body, center.x, center.y + bodyRadius + labelGap);
        ctx.textBaseline = "middle";
      }
    }
    ctx.textAlign = "left"; // reset
  });

  // Moon rendering: fixed pixel orbit around Earth.
  if (!earthPlacement || !moonGeo) return;

  const moonAngle = moonGeo.lon * DEG2RAD;
  const earthScreen = worldToScreen(earthPlacement.world);

  const moonOrbitPx = MOON_ORBIT_PX * scale;
  const moonX = earthScreen.x + moonOrbitPx * Math.cos(moonAngle);
  const moonY = earthScreen.y - moonOrbitPx * Math.sin(moonAngle);
  const moonRadius = BODY_PX["Moon"] * scale;
  drawPlanetGlyph(ctx, { x: moonX, y: moonY }, moonRadius, MOON);

  // Moon is an inner body: centered below
  const moonLabelGap = Math.max(3, 4 * scale);
  ctx.fillStyle = themeTextColor ?? themeColors?.bodyLabel ?? "#e2e8f0";
  ctx.font = `${clamp(11 * scale, 8, 14)}px ${themeFont ?? "'JetBrains Mono', ui-monospace, monospace"}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.fillText("Moon", moonX, moonY + moonRadius + moonLabelGap);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
}

function drawPlanetGlyph(ctx: CanvasRenderingContext2D, center: Vec2, radius: number, planet: Planet) {
  const bodyName = planet.name as BodyName;

  // For Saturn (and any wide-ringed body): draw full image without circle clip
  if (bodyName === "Saturn") {
    const img = getPlanetImage(bodyName);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      // Scale image to fit within target radius, but show full width including rings
      const scale = (radius * 2.2) / Math.max(img.naturalWidth, img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      ctx.drawImage(img, center.x - drawW / 2, center.y - drawH / 2, drawW, drawH);
      ctx.restore();
      return;
    }
  }

  // All other planets: circular clip + cover crop
  const didDrawImage = drawPlanetImage(ctx, center, radius, bodyName);

  if (!didDrawImage) {
    // Fallback: gradient + bands + spots (original logic)
    if (planet.bands && planet.bands.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.clip();
      const bandHeight = (radius * 2) / planet.bands.length;
      planet.bands.forEach((color, index) => {
        const y = center.y - radius + index * bandHeight;
        ctx.fillStyle = color;
        ctx.fillRect(center.x - radius, y, radius * 2, bandHeight + 1);
      });
      ctx.restore();
    } else {
      const gradient = ctx.createRadialGradient(
        center.x - radius * 0.35,
        center.y - radius * 0.35,
        radius * 0.1,
        center.x,
        center.y,
        radius
      );
      gradient.addColorStop(0, planet.gradient?.inner ?? lighten(planet.baseColor, 0.2));
      gradient.addColorStop(1, planet.gradient?.outer ?? planet.baseColor);
      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (planet.spots) {
      planet.spots.forEach((spot) => {
        ctx.beginPath();
        ctx.fillStyle = spot.color;
        ctx.arc(center.x + spot.offset.x * radius, center.y + spot.offset.y * radius, radius * spot.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
}

function lighten(hex: string, factor: number) {
  const normalized = hex.startsWith("#") ? hex.substring(1) : hex;
  const num = parseInt(normalized, 16);
  const r = clamp(Math.round(((num >> 16) & 0xff) + 255 * factor), 0, 255);
  const g = clamp(Math.round(((num >> 8) & 0xff) + 255 * factor), 0, 255);
  const b = clamp(Math.round((num & 0xff) + 255 * factor), 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

export { HeartlightSystemMap as AtlasCometMap };
