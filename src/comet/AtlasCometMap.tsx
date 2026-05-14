import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as Astronomy from "astronomy-engine";
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
  showMoon: boolean;
  scaleLabels: boolean;
  showRayZones: boolean;
};

const PLANETS: Planet[] = [
  { name: "Mercury", a: 0.387, e: 0.2056, periodDays: 87.969, baseColor: "#a8a8a8", gradient: { inner: "#f4f4f4", outer: "#7b7b7b" } },
  { name: "Venus", a: 0.723, e: 0.0068, periodDays: 224.701, baseColor: "#e0c080", gradient: { inner: "#fff2cc", outer: "#c89f60" } },
  { name: "Earth", a: 1.0, e: 0.0167, periodDays: 365.256, baseColor: "#4aa3ff", gradient: { inner: "#6fd3ff", outer: "#1359a0" }, spots: [{ color: "#4ade80", radius: 0.18, offset: { x: -0.2, y: 0.05 } }] },
  { name: "Mars", a: 1.524, e: 0.0934, periodDays: 686.98, baseColor: "#ff6a3d", gradient: { inner: "#ffb48a", outer: "#a23a27" } },
  { name: "Jupiter", a: 5.2, e: 0.0489, periodDays: 4332.589, baseColor: "#f2c078", bands: ["#f3d8ab", "#d4a46c", "#f6e5c7", "#c78f57"], spots: [{ color: "#d86b41", radius: 0.35, offset: { x: 0.25, y: 0.05 } }] },
  { name: "Saturn", a: 9.58, e: 0.0565, periodDays: 10759.22, baseColor: "#dccaa6", bands: ["#f6e7c4", "#ceb98d", "#f9eedd", "#cdaa7a"], ring: { color: "rgba(220,202,166,0.7)", width: 0.9, opacity: 0.8 } },
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
const AU_PER_PX_AT_1X = 1 / 260; // 260 px per AU at scale = 1
const SCALE_EXP = 0.45;
const ICON_BASE = 6;
const ICON_MIN = 3;
const ICON_MAX = 36;
const FONT_BASE = 11;
const FONT_MIN = 7;
const FONT_MAX = 20;
const SCALE_MIN = 0.03;
const SCALE_MAX = 18;
const CANVAS_SIZE = 560;
const SPREAD_FACTOR = 1.8;
const MOON_VIS_MIN_PX = 10;
const MOON_VIS_MAX_PX = 28;
const LERP_SOFTEN_PX = 6;
const GEO_SCALE_FACTOR = 0.34;
const DEG2RAD = Math.PI / 180;
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

const HSM_VERSION = "V0.0.1";

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
    body: "Pluto",
    title: "Underworld Alchemy • Death/Rebirth • Soul Power",
    detail: "Transmutates identity, exposes truth, empowers renewal, clears distorted control.",
  },
];
const ZODIAC_RING_RADIUS_AU = 44;
const BODIES: BodyName[] = ["Sun", "Moon", "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
// Presentation order for the alignment list: highlight Sun/Moon/Earth first.
const BODY_ORDER: BodyName[] = ["Sun", "Earth", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
const GEO_BASE_RADIUS_AU = ZODIAC_RING_RADIUS_AU * 0.97;
const DEFAULT_SCALE: Record<ViewMode, number> = {
  heliocentric: 0.25,
  geocentric: 1.85,
};

const FULL_SYSTEM_SCALE: Record<ViewMode, number> = {
  heliocentric: SCALE_MIN,
  geocentric: 0.9,
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

const BODY_COLORS: Record<BodyName, string> = {
  Sun: "#f59e0b",
  Moon: "#d4d4d8",
  Mercury: "#a8a8a8",
  Venus: "#e0c080",
  Earth: "#38bdf8",
  Mars: "#fb6a3d",
  Jupiter: "#f2c078",
  Saturn: "#d8c59f",
  Uranus: "#7dd3fc",
  Neptune: "#7aa2ff",
  Pluto: "#cdb4ff",
};

// Mean radius ratios vs Earth for relative sizing (not applied to Sun/Moon).
const PLANET_SIZE_FACTOR: Record<BodyName, number> = {
  Sun: 1,
  Moon: 1,
  Mercury: 0.38,
  Venus: 0.95,
  Earth: 1,
  Mars: 0.53,
  Jupiter: 11.21,
  Saturn: 9.45,
  Uranus: 4.01,
  Neptune: 3.88,
  Pluto: 0.19,
};

function planetIconStyle(body: BodyName): CSSProperties {
  if (body === "Sun") {
    return {
      background: "radial-gradient(circle at 30% 30%, #fff7d6 10%, #ffd166 45%, #f59e0b 80%, #d97706 100%)",
      boxShadow: "0 0 18px rgba(245, 158, 11, 0.55)",
      border: "1px solid rgba(234, 179, 8, 0.45)",
    };
  }
  if (body === "Moon") {
    return {
      background: "radial-gradient(circle at 25% 30%, #f8fafc 8%, #d6d6da 55%, #9ca3af 95%)",
      boxShadow: "inset 0 0 8px rgba(0,0,0,0.15)",
      border: "1px solid rgba(148,163,184,0.35)",
    };
  }

  // Hand-tuned icon treatments to echo each body's visual character.
  switch (body) {
    case "Mercury":
      return {
        background:
          "radial-gradient(circle at 30% 30%, #f5f5f5 10%, #cfcfcf 32%, #8f8f92 70%, #5d6066 100%), radial-gradient(circle at 65% 65%, rgba(40,40,48,0.35) 0%, rgba(0,0,0,0) 55%)",
        boxShadow: "inset 0 0 8px rgba(0,0,0,0.18)",
        border: "1px solid rgba(148,163,184,0.45)",
      };
    case "Venus":
      return {
        background:
          "radial-gradient(circle at 28% 28%, #fff3d1 18%, #f3cf88 45%, #d6a44f 78%, #b8792e 100%), linear-gradient(145deg, rgba(255,236,179,0.55) 0%, rgba(214,160,79,0.35) 45%, rgba(140,95,28,0.15) 100%)",
        boxShadow: "inset 0 0 10px rgba(0,0,0,0.12)",
        border: "1px solid rgba(214,160,79,0.55)",
      };
    case "Earth":
      return {
        background:
          [
            "radial-gradient(circle at 32% 30%, #9be7ff 0%, #4ab5ff 55%, #0f4aa5 90%)", // ocean depth
            "radial-gradient(ellipse at 58% 60%, rgba(52,199,89,0.85) 0%, rgba(52,199,89,0) 52%)", // continent 1
            "radial-gradient(ellipse at 36% 68%, rgba(34,197,94,0.78) 0%, rgba(34,197,94,0) 60%)", // continent 2
            "radial-gradient(ellipse at 64% 36%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 55%)", // cloud 1
            "radial-gradient(ellipse at 30% 44%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%)", // cloud 2
          ].join(", "),
        boxShadow: "inset 0 0 9px rgba(0,0,0,0.14), 0 0 0 1px rgba(59,130,246,0.35)",
        border: "1px solid rgba(59,130,246,0.6)",
      };
    case "Mars":
      return {
        background:
          "radial-gradient(circle at 30% 28%, #ffb48a 15%, #e46b3c 52%, #a73925 85%, #71241b 100%), radial-gradient(circle at 65% 65%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 55%), radial-gradient(circle at 70% 40%, rgba(46,20,10,0.35) 0%, rgba(46,20,10,0) 60%)",
        boxShadow: "inset 0 0 8px rgba(0,0,0,0.18)",
        border: "1px solid rgba(244,114,82,0.55)",
      };
    case "Jupiter":
      return {
        background:
          "linear-gradient(180deg, #f6e5c7 0%, #d8b27a 22%, #f3d8ab 36%, #c9975f 50%, #f3d8ab 64%, #d8b27a 78%, #f6e5c7 100%), radial-gradient(circle at 68% 46%, rgba(210,93,52,0.65) 0%, rgba(210,93,52,0.0) 48%)",
        boxShadow: "0 0 0 3px rgba(210,180,140,0.35), inset 0 0 10px rgba(0,0,0,0.12)",
        border: "1px solid rgba(217,119,6,0.45)",
      };
    case "Saturn":
      return {
        background:
          "linear-gradient(180deg, #f6e7c4 0%, #d9be8e 28%, #f3e2bc 55%, #cda878 78%, #f6e7c4 100%)",
        boxShadow: "0 0 0 5px rgba(220,202,166,0.7), inset 0 0 10px rgba(0,0,0,0.1)",
        border: "1px solid rgba(214,184,140,0.6)",
      };
    case "Uranus":
      return {
        background:
          "radial-gradient(circle at 32% 28%, #c4f4ff 12%, #9be5f8 45%, #5fb7d8 85%, #3b8fb4 100%)",
        boxShadow: "inset 0 0 8px rgba(0,0,0,0.08)",
        border: "1px solid rgba(125,211,252,0.6)",
      };
    case "Neptune":
      return {
        background:
          "radial-gradient(circle at 30% 30%, #7cc2ff 12%, #4e88ff 55%, #1f3fad 88%, #142a7d 100%), radial-gradient(ellipse at 65% 70%, rgba(124,194,255,0.22) 0%, rgba(124,194,255,0) 60%)",
        boxShadow: "inset 0 0 9px rgba(0,0,0,0.12)",
        border: "1px solid rgba(96,165,250,0.55)",
      };
    case "Pluto":
      return {
        background:
          "radial-gradient(circle at 35% 30%, #f3e9ff 10%, #d6c8ec 45%, #a493c7 80%, #7a699c 100%), radial-gradient(circle at 65% 60%, rgba(60,50,80,0.35) 0%, rgba(60,50,80,0) 55%)",
        boxShadow: "inset 0 0 8px rgba(0,0,0,0.14)",
        border: "1px solid rgba(205,180,255,0.6)",
      };
    default: {
      const planet = PLANETS.find((p) => p.name === body);
      if (planet?.gradient) {
        return {
          background: `radial-gradient(circle at 30% 30%, ${planet.gradient.inner} 20%, ${planet.gradient.outer} 90%)`,
          boxShadow: "inset 0 0 8px rgba(0,0,0,0.12)",
          border: "1px solid rgba(148,163,184,0.35)",
        };
      }
      return {
        background: BODY_COLORS[body] ?? "#94a3b8",
        border: "1px solid rgba(148,163,184,0.35)",
      };
    }
  }
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
  const rad = lon * DEG2RAD;
  const world: Vec2 = {
    x: dist * Math.cos(rad),
    y: dist * Math.sin(rad),
  };
  return { body, lon, lat, dist, vector, world, mode: "heliocentric" };
}

function geocentricWorld(lon: number, lat: number): Vec2 {
  const rad = lon * DEG2RAD;
  const latFactor = clamp(lat / 40, -1.5, 1.5);
  const radius = GEO_BASE_RADIUS_AU * (1 + latFactor * 0.12);
  const scaledRadius = radius * GEO_SCALE_FACTOR;
  return {
    x: scaledRadius * Math.cos(rad),
    y: scaledRadius * Math.sin(rad),
  };
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
  const world = geocentricWorld(lon, lat);
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
  for (let i = 0; i <= ORBIT_SAMPLES; i += 1) {
    const angle = (i / ORBIT_SAMPLES) * Math.PI * 2;
    const M = angle;
    let E = M;
    for (let it = 0; it < 5; it += 1) {
      E = E - (E - planet.e * Math.sin(E) - M) / (1 - planet.e * Math.cos(E));
    }
    const cosE = Math.cos(E);
    const sinE = Math.sin(E);
    orbit.push({
      x: planet.a * (cosE - planet.e),
      y: planet.a * Math.sqrt(1 - planet.e * planet.e) * sinE,
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

function HeartlightSystemMap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<Vec2>({ x: 0, y: 0 });
  const scaleRef = useRef(DEFAULT_SCALE["heliocentric"]);
  const timeRef = useRef(INITIAL_DATE.getTime());
  const runningRef = useRef(false);
  const timeScaleRef = useRef(4);
  const sizeRef = useRef<{ width: number; height: number }>({ width: CANVAS_SIZE, height: CANVAS_SIZE });
  const draggingRef = useRef(false);
  const lastPointerRef = useRef<Vec2>({ x: 0, y: 0 });

  const [when, setWhen] = useState(INITIAL_DATE);
  const [running, setRunning] = useState(false);
  const [timeScale] = useState(4);
  const [viewMode, setViewMode] = useState<ViewMode>("heliocentric");
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroHeading, setGyroHeading] = useState(0);
  const [showZodiac, setShowZodiac] = useState(true);
  const [showEclipticGrid, setShowEclipticGrid] = useState(false);
  const [showMoon, setShowMoon] = useState(true);
  const [scaleLabels, setScaleLabels] = useState(true);
  const [showRayZones, setShowRayZones] = useState(true);
  const [distanceMode, setDistanceMode] = useState<"scaled" | "accurate">("scaled");
  const [infoOpen, setInfoOpen] = useState(false);
  const [rayOpen, setRayOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);

  const orbitCache = useMemo(() => {
    const cache = new Map<string, Vec2[]>();
    PLANETS.forEach((planet) => {
      cache.set(planet.name, sampleOrbit(planet));
    });
    return cache;
  }, []);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    timeScaleRef.current = timeScale;
  }, [timeScale]);

  const worldToScreen = (point: Vec2): Vec2 => {
    const pxPerAU = scaleRef.current / AU_PER_PX_AT_1X;
    const { width, height } = sizeRef.current;
    const adjusted =
      distanceMode === "scaled"
        ? { x: point.x * SPREAD_FACTOR, y: point.y * SPREAD_FACTOR }
        : point;
    return {
      x: (adjusted.x - cameraRef.current.x) * pxPerAU + width / 2,
      y: height / 2 - (adjusted.y - cameraRef.current.y) * pxPerAU,
    };
  };

  const screenToWorld = (point: Vec2): Vec2 => {
    const pxPerAU = scaleRef.current / AU_PER_PX_AT_1X;
    const { width, height } = sizeRef.current;
    return {
      x: (point.x - width / 2) / pxPerAU + cameraRef.current.x,
      y: (height / 2 - point.y) / pxPerAU + cameraRef.current.y,
    };
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!gyroEnabled || viewMode !== "geocentric") return;

    const handler = (event: DeviceOrientationEvent) => {
      if (typeof event.alpha === "number") {
        setGyroHeading(event.alpha);
      }
    };

    const enable = async () => {
      const perm = (DeviceOrientationEvent as any)?.requestPermission;
      if (typeof perm === "function") {
        try {
          const res = await perm();
          if (res !== "granted") return;
        } catch {
          return;
        }
      }
      window.addEventListener("deviceorientation", handler, true);
    };

    enable();
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, [gyroEnabled, viewMode]);

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
      const width = canvas.clientWidth * dpr;
      const height = canvas.clientHeight * dpr;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      sizeRef.current = { width: width / dpr, height: height / dpr };

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      drawScene(
        ctx,
        orbitCache,
        new Date(timeRef.current),
        worldToScreen,
        scaleRef.current,
        { showZodiac, showEclipticGrid, showMoon, scaleLabels, showRayZones, viewMode }
      );

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [orbitCache, showZodiac, showEclipticGrid, showMoon, scaleLabels, showRayZones, viewMode, distanceMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const before = scaleRef.current;
      const factor = Math.exp(-event.deltaY * 0.0015);
      const after = clamp(before * factor, SCALE_MIN, SCALE_MAX);
      if (after === before) return;

      const rect = canvas.getBoundingClientRect();
      const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const worldBefore = screenToWorld(cursor);
      scaleRef.current = after;
      const worldAfter = screenToWorld(cursor);
      cameraRef.current.x += worldBefore.x - worldAfter.x;
      cameraRef.current.y += worldBefore.y - worldAfter.y;
    };

    const handlePointerDown = (event: PointerEvent) => {
      draggingRef.current = true;
      const rect = canvas.getBoundingClientRect();
      lastPointerRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      canvas.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const now = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const dx = now.x - lastPointerRef.current.x;
      const dy = now.y - lastPointerRef.current.y;
      lastPointerRef.current = now;
      const pxPerAU = scaleRef.current / AU_PER_PX_AT_1X;
      cameraRef.current.x -= dx / pxPerAU;
      cameraRef.current.y += dy / pxPerAU;
    };

    const handlePointerUp = (event: PointerEvent) => {
      draggingRef.current = false;
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
    scaleRef.current = DEFAULT_SCALE[viewMode];
  };

  const zoomWholeSystem = () => {
    cameraRef.current = { x: 0, y: 0 };
    scaleRef.current = clamp(FULL_SYSTEM_SCALE[viewMode], SCALE_MIN, SCALE_MAX);
  };

  const nudgeZoom = (direction: "in" | "out") => {
    const factor = direction === "in" ? 1.35 : 1 / 1.35;
    const before = scaleRef.current;
    const after = clamp(before * factor, SCALE_MIN, SCALE_MAX);
    if (after !== before) {
      scaleRef.current = after;
    }
  };

  useEffect(() => {
    resetView();
  }, [viewMode]);

  const zodiacPlacements = useMemo<ZodiacPlacement[]>(() => {
    const placements = getPlacements("geocentric", when);
    const byBody = new Map<BodyName, Placement>();
    placements.forEach((placement) => {
      byBody.set(placement.body, placement);
    });

    return BODY_ORDER
      .filter((body) => (showMoon ? true : body !== "Moon"))
      .map((body) => {
        const placement = byBody.get(body);
        if (!placement) {
          return null;
        }
        // Show Earth opposite the Sun for an intuitive heliocentric sense:
        // Earth longitude = Sun longitude + 180° (geocentric Sun is already apparent ecliptic lon).
        const effectiveLon =
          body === "Earth" && byBody.get("Sun")
            ? normalizeDegrees((byBody.get("Sun")?.lon ?? 0) + 180)
            : placement.lon;
        const zodiac = zodiacFromLongitude(effectiveLon);
        return {
          body,
          signName: zodiac.sign.name,
          signSymbol: zodiac.sign.symbol,
          signIndex: zodiac.signIndex,
          degrees: zodiac.degrees,
          minutes: zodiac.minutes,
          longitude: zodiac.longitude,
          latitude: placement.lat,
          distanceAu: placement.dist,
        };
      })
      .filter(Boolean) as ZodiacPlacement[];
  }, [when, showMoon]);

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
  const heliocentricButtonClass = `px-3 py-1 text-xs font-semibold transition ${
    viewMode === "heliocentric" ? "bg-sky-500 text-sky-950" : "text-sky-100 hover:bg-sky-500/20"
  }`;
  const gaianButtonClass = `px-3 py-1 text-xs font-semibold transition ${
    viewMode === "geocentric" ? "bg-sky-500 text-sky-950" : "text-sky-100 hover:bg-sky-500/20"
  }`;

  return (
    <div className="flex flex-col gap-4">
      {/* 1) Zodiac alignment cards */}
      <div className="space-y-3 text-slate-100">
        <div className="flex flex-col gap-2">
          <div className="text-xs uppercase tracking-wide text-sky-200/80">Zodiac alignments</div>
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
                className="rounded-xl border border-sky-500/20 bg-slate-800/50 px-3 py-1.5 backdrop-blur-sm"
              >
                <div
                  className="mb-0.5 h-0.5 w-full rounded-full"
                  style={{ background: ZODIAC_HUES[placement.signIndex] ?? "rgba(125,211,252,0.6)" }}
                />
                <div className="flex w-full flex-wrap items-start justify-between gap-x-2 gap-y-0 pt-0.5 text-sm leading-[1.05] text-slate-200">
                  <div className="flex items-center gap-3 leading-[1.05]">
                    <span
                      className="h-9 w-9 rounded-full shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                      style={planetIconStyle(placement.body)}
                      aria-hidden
                    />
                    <div className="flex items-center gap-2 leading-tight">
                      <span className="font-semibold text-sky-100">{placement.body}</span>
                      <span className="text-base text-sky-200">{BODY_GLYPHS[placement.body]}</span>
                    </div>
                  </div>
                  <div className="ml-auto flex flex-col items-end gap-0.25 text-right leading-[1.05]">
                  <div
                    className="flex items-center gap-2 text-lg font-bold"
                    style={{
                      color: ZODIAC_HUES[placement.signIndex] ?? "#e2e8f0",
                      textShadow: isCarbonRay ? carbonShadow : "0 0 8px rgba(0,0,0,0.25)",
                    }}
                  >
                    <span className="text-xl">{placement.signSymbol}</span>
                    <span className="uppercase tracking-wide">{placement.signName}</span>
                  </div>
                  <div
                    className={`${isLongRay ? "text-[0.7rem]" : "text-[0.78rem]"} font-semibold`}
                    style={{
                      color: ZODIAC_HUES[placement.signIndex] ?? "#e2e8f0",
                      textShadow: isCarbonRay ? carbonShadow : undefined,
                    }}
                  >
                    {rayName}
                  </div>
                    <div className="text-base font-semibold text-sky-100">
                      {placement.degrees.toString().padStart(2, "0")}°{placement.minutes.toString().padStart(2, "0")}′
                    </div>
                  </div>
                </div>
                <div className="text-right text-[0.75rem] text-slate-300">
                  λ {placement.longitude.toFixed(2)}° • β {placement.latitude.toFixed(2)}° • Δ {placement.distanceAu.toFixed(3)} AU
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2) HSM title */}
      <div className="space-y-1 text-slate-100">
        <div className="text-sm uppercase tracking-wide text-sky-200/80">HSM: Heartlight System Map</div>
        <p className="text-sm text-slate-300">Pan, zoom, and sweep through time to watch each planet trace its Keplerian ellipse.</p>
      </div>

      {/* 3) Time controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 text-sky-100">
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
      </div>

      {/* 4) Date + view controls */}
      <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-sky-200/80">
        <label className="flex items-center gap-2">
          Date
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
        </label>
        <div className="flex items-center gap-2">
          <span>Perspective</span>
          <div className="inline-flex overflow-hidden rounded-xl border border-sky-500/60">
            <button
              type="button"
              className={`${heliocentricButtonClass}`}
              aria-pressed={viewMode === "heliocentric"}
              onClick={() => setViewMode("heliocentric")}
            >
              Solar
            </button>
            <button
              type="button"
              className={`${gaianButtonClass}`}
              aria-pressed={viewMode === "geocentric"}
              onClick={() => setViewMode("geocentric")}
            >
              Gaian
            </button>
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg border border-sky-500/60 px-3 py-1 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/20"
          onClick={resetView}
        >
          Reset View
        </button>
        <button
          type="button"
          className="rounded-lg border border-sky-500/60 px-3 py-1 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/20"
          onClick={() => nudgeZoom("in")}
          aria-label="Zoom in"
        >
          Zoom In
        </button>
        <button
          type="button"
          className="rounded-lg border border-sky-500/60 px-3 py-1 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/20"
          onClick={() => nudgeZoom("out")}
          aria-label="Zoom out"
        >
          Zoom Out
        </button>
        <button
          type="button"
          className="rounded-lg border border-sky-500/60 px-3 py-1 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/20"
          onClick={zoomWholeSystem}
        >
          Full System
        </button>
        <button
          type="button"
          className="rounded-lg border border-sky-500/60 px-3 py-1 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/20"
          onClick={() => setDistanceMode((m) => (m === "scaled" ? "accurate" : "scaled"))}
          aria-pressed={distanceMode === "accurate"}
        >
          {distanceMode === "accurate" ? "Accurate distances" : "Scaled spacing"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-sky-500/60 px-3 py-1 text-xs uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/20 disabled:opacity-50"
          disabled={viewMode !== "geocentric"}
          onClick={() => setGyroEnabled((v) => !v)}
          aria-pressed={gyroEnabled}
        >
          Gyro (Gaian)
        </button>
      </div>

      {/* 5) Overlays toggles */}
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
            checked={showMoon}
            onChange={(event) => setShowMoon(event.target.checked)}
          />
          Show Moon
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
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="absolute inset-0 h-full w-full rounded-full"
            style={gyroEnabled && viewMode === "geocentric" ? { transform: `rotate(${gyroHeading.toFixed(1)}deg)` } : undefined}
          />
        </div>
        {/* HSM version */}
        <div className="mt-1 text-center text-[10px] text-slate-400">
          {HSM_VERSION} • Heartlight System Map
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
            onClick={() => setKeyOpen((v) => !v)}
          >
            <span>Ecliptic & Alignment Key</span>
            <span className="text-xs text-sky-200/80">{keyOpen ? "Hide" : "Show"}</span>
          </button>
          {keyOpen ? (
            <>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>λ: Geocentric ecliptic longitude (degrees along the zodiac band).</div>
                <div>β: Geocentric ecliptic latitude (degrees above/below the ecliptic plane).</div>
                <div>Δ: Distance from Earth in astronomical units (AU).</div>
                <div>Sign symbol & name: Zodiac sector containing the body at this moment.</div>
                <div>Earth placement: shown at Sun λ + 180° to reflect its heliocentric opposition to the Sun.</div>
              </div>
              <p className="mt-2 text-slate-300">
                In the heliocentric view, Earth is always 180° from the Sun along the ecliptic. Displaying Earth opposite the Sun lets the zodiac
                label align with the star field that Earth is “facing” in space.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  orbitCache: Map<string, Vec2[]>,
  time: Date,
  worldToScreen: (point: Vec2) => Vec2,
  scale: number,
  overlays: OverlayOptions
) {
  const width = ctx.canvas.width / (window.devicePixelRatio ?? 1);
  const height = ctx.canvas.height / (window.devicePixelRatio ?? 1);

  ctx.save();
  ctx.fillStyle = "#030712";
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
    drawRayZones(ctx, radius, activeRayIndex);
  }

  if (overlays.showEclipticGrid) {
    drawEclipticGrid(ctx, worldToScreen, scale);
  }

  if (overlays.viewMode === "geocentric") {
    drawGeocentricAlignmentRays(ctx, placements, worldToScreen, scale);
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
      ctx.strokeStyle = "rgba(148,163,184,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    drawSun(ctx, worldToScreen, scale);
  }

  drawBodies(ctx, placements, worldToScreen, scale, overlays, moonGeo);
  ctx.restore(); // end clip

  if (overlays.showZodiac) {
    drawZodiacRing(ctx, worldToScreen, scale);
  }

  // Outline circular viewport
  ctx.strokeStyle = "rgba(56,189,248,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, radius - 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawZodiacRing(
  ctx: CanvasRenderingContext2D,
  _worldToScreen: (point: Vec2) => Vec2,
  scale: number
) {
  // Draw a static ring that hugs the outer edge of the viewport circle,
  // independent of panning/zooming mechanics.
  const dpr = window.devicePixelRatio ?? 1;
  const width = ctx.canvas.width / dpr;
  const height = ctx.canvas.height / dpr;
  const center = { x: width / 2, y: height / 2 };
  const viewportRadius = Math.min(width, height) / 2;
  const edgePadding = 12;
  const ringRadius = Math.max(18, viewportRadius - edgePadding);
  const tickInner = ringRadius - 10;
  const tickOuter = ringRadius + 6;

  ctx.save();
  ctx.textAlign = "center";

  // Draw ring outline with first hue (Aries/Red)
  ctx.strokeStyle = hexToRgba(ZODIAC_HUES[0], 0.28);
  ctx.lineWidth = clamp(scale * 0.35, 0.6, 1.4);
  ctx.beginPath();
  ctx.arc(center.x, center.y, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 12; i += 1) {
    const hue = ZODIAC_HUES[i];
    const isCarbon = i === 9;
    const angle = (i / 12) * Math.PI * 2;

    // Tick marks with Ray hue
    ctx.strokeStyle = isCarbon ? "rgba(255,255,255,0.35)" : hexToRgba(hue, 0.52);
    ctx.lineWidth = clamp(scale * 0.4, 0.8, 1.8);
    const lineInner = {
      x: center.x + Math.cos(angle) * (tickInner - 4),
      y: center.y - Math.sin(angle) * (tickInner - 4),
    };
    const lineOuter = {
      x: center.x + Math.cos(angle) * (tickOuter + 2),
      y: center.y - Math.sin(angle) * (tickOuter + 2),
    };
    ctx.beginPath();
    ctx.moveTo(lineInner.x, lineInner.y);
    ctx.lineTo(lineOuter.x, lineOuter.y);
    ctx.stroke();

    const sign = ZODIAC_SIGNS[i];
    const midAngle = angle + Math.PI / 12;
    const symbolPx = clamp(14 * Math.pow(scale, SCALE_EXP * 0.7), 11, 22);
    const namePx = clamp(10 * Math.pow(scale, SCALE_EXP * 0.6), 9, 14);
    const symbolOffsetPx = clamp(18 * Math.pow(scale, SCALE_EXP * 0.6), 12, 24);
    const nameOffsetPx = clamp(44 * Math.pow(scale, SCALE_EXP * 0.6), 32, 72);
    const labelRadiusPx = ringRadius - symbolOffsetPx;
    const nameRadiusPx = ringRadius - nameOffsetPx;
    const labelPoint = {
      x: center.x + Math.cos(midAngle) * labelRadiusPx,
      y: center.y - Math.sin(midAngle) * labelRadiusPx,
    };
    const namePoint = {
      x: center.x + Math.cos(midAngle) * nameRadiusPx,
      y: center.y - Math.sin(midAngle) * nameRadiusPx,
    };

    // Symbol with Ray hue
    ctx.font = `${symbolPx}px 'JetBrains Mono', ui-monospace, monospace`;
    ctx.textBaseline = "middle";
    if (isCarbon) {
      ctx.shadowColor = "rgba(255,255,255,0.9)";
      ctx.shadowBlur = 6;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 0.8;
      ctx.strokeText(sign.symbol, labelPoint.x, labelPoint.y);
    }
    ctx.fillStyle = hue;
    ctx.fillText(sign.symbol, labelPoint.x, labelPoint.y);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    // Name with Ray hue
    ctx.font = `${namePx}px 'JetBrains Mono', ui-monospace, monospace`;
    if (isCarbon) {
      ctx.shadowColor = "rgba(255,255,255,0.9)";
      ctx.shadowBlur = 5;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 0.6;
      ctx.strokeText(sign.name.toUpperCase(), namePoint.x, namePoint.y);
    }
    ctx.fillStyle = hue;
    ctx.fillText(sign.name.toUpperCase(), namePoint.x, namePoint.y);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }

  // Degree ticks every 10° (use faint blue — independent of Ray hues)
  for (let deg = 0; deg < 360; deg += 10) {
    const rad = deg * DEG2RAD;
    const isMajor = deg % 30 === 0;
    const innerR = isMajor ? ringRadius - 10 : ringRadius - 6;
    const outerR = ringRadius + 6;
    const innerPoint = {
      x: center.x + Math.cos(rad) * innerR,
      y: center.y - Math.sin(rad) * innerR,
    };
    const outerPoint = {
      x: center.x + Math.cos(rad) * outerR,
      y: center.y - Math.sin(rad) * outerR,
    };
    ctx.beginPath();
    ctx.strokeStyle = isMajor ? "rgba(56,189,248,0.35)" : "rgba(56,189,248,0.18)";
    ctx.lineWidth = isMajor ? clamp(scale * 0.35, 0.5, 1.4) : clamp(scale * 0.25, 0.4, 1.0);
    ctx.moveTo(innerPoint.x, innerPoint.y);
    ctx.lineTo(outerPoint.x, outerPoint.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRayZones(
  ctx: CanvasRenderingContext2D,
  viewportRadius: number,
  activeRayIndex: number
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
      ctx.fillStyle = isActive ? "rgba(30,25,25,0.28)" : "rgba(15,10,10,0.18)";
    } else if (isActive) {
      ctx.fillStyle = hexToRgba(hue, 0.22);
    } else {
      ctx.fillStyle = hexToRgba(hue, 0.10);
    }
    ctx.fill();

    // Boundary
    ctx.strokeStyle = isCarbon
      ? (isActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.20)")
      : (isActive ? hexToRgba(hue, 0.55) : hexToRgba(hue, 0.22));
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
        gr.addColorStop(0, "rgba(255,255,255,0.08)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
      } else {
        gr.addColorStop(0, hexToRgba(hue, 0.14));
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
  const outerRadius = ZODIAC_RING_RADIUS_AU * 1.05;
  const innerRadius = 2.5;
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
    const radiusAU = outerRadius * Math.cos(beta);
    const edge = worldToScreen({ x: radiusAU, y: 0 });
    const radiusPx = Math.hypot(edge.x - center.x, edge.y - center.y);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, worldToScreen: (point: Vec2) => Vec2, scale: number) {
  const radius = clamp(ICON_BASE * 1.8 * Math.pow(scale, SCALE_EXP), 12, 42);
  const center = worldToScreen({ x: 0, y: 0 });
  const gradient = ctx.createRadialGradient(center.x - radius * 0.3, center.y - radius * 0.3, radius * 0.1, center.x, center.y, radius);
  gradient.addColorStop(0, "#ffe7a3");
  gradient.addColorStop(1, "#f59e0b");
  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.shadowColor = "rgba(253, 211, 107, 0.6)";
  ctx.shadowBlur = 35;
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawSunMarker(ctx: CanvasRenderingContext2D, center: Vec2, scale: number) {
  const radius = clamp(ICON_BASE * 1.3 * Math.pow(scale, SCALE_EXP * 0.85), ICON_MIN * 0.8, ICON_MAX * 0.8);
  const gradient = ctx.createRadialGradient(center.x - radius * 0.3, center.y - radius * 0.3, radius * 0.15, center.x, center.y, radius);
  gradient.addColorStop(0, "#fff7d6");
  gradient.addColorStop(1, "#f59e0b");
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.shadowColor = "rgba(253, 211, 107, 0.45)";
  ctx.shadowBlur = 18;
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBodies(
  ctx: CanvasRenderingContext2D,
  placements: Placement[],
  worldToScreen: (point: Vec2) => Vec2,
  scale: number,
  overlays: OverlayOptions,
  moonGeo?: Placement
) {
  const isGeocentric = overlays.viewMode === "geocentric";
  const radiusMultiplier = isGeocentric ? 1.55 : 1;
  const minRadius = isGeocentric ? ICON_MIN * 2 : ICON_MIN;
  const maxRadius = isGeocentric ? ICON_MAX * 1.15 : ICON_MAX;
  const radiusPx = clamp(ICON_BASE * radiusMultiplier * Math.pow(scale, SCALE_EXP), minRadius, maxRadius);
  const fontMultiplier = overlays.scaleLabels ? (isGeocentric ? 1.2 : 1) : 1;
  const fontPx = overlays.scaleLabels
    ? clamp(FONT_BASE * fontMultiplier * Math.pow(scale, SCALE_EXP), FONT_MIN, FONT_MAX * (isGeocentric ? 1.1 : 1))
    : FONT_BASE;

  ctx.textBaseline = "middle";
  ctx.font = `${fontPx}px 'JetBrains Mono', ui-monospace, monospace`;
  ctx.fillStyle = "#e2e8f0";

  const earthPlacement = placements.find((placement) => placement.body === "Earth");

  placements.forEach((placement) => {
    const { body } = placement;
    if (!overlays.showMoon && body === "Moon") return;
    if (overlays.viewMode === "heliocentric" && (body === "Sun" || body === "Moon")) return;

    const sizeFactor =
      body === "Sun" || body === "Moon"
        ? 1
        : Math.pow(PLANET_SIZE_FACTOR[body] ?? 1, 0.6);
    const bodyRadius = clamp(radiusPx * sizeFactor, ICON_MIN * 0.7, ICON_MAX * 1.25);

    const center = worldToScreen(placement.world);
    if (overlays.viewMode === "geocentric" && body === "Sun") {
      drawSunMarker(ctx, center, scale);
    } else {
      const planetDef = body === "Moon" ? MOON : PLANETS.find((planet) => planet.name === body);
      if (!planetDef) return;
      drawPlanetGlyph(ctx, center, bodyRadius, planetDef);
    }
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(body, center.x + bodyRadius + 6, center.y);
  });

  // Geocentric Moon positioning: Moon orbits Earth using real sky longitude
  if (overlays.viewMode === "heliocentric" && overlays.showMoon && earthPlacement && moonGeo) {
    const earthScreen = worldToScreen(earthPlacement.world);
    const moonAngle = moonGeo.lon * DEG2RAD;
    const moonOrbitPx = radiusPx * 0.7; // roughly 0.04 of viewport equivalent
    const moonX = earthScreen.x + moonOrbitPx * Math.cos(moonAngle);
    const moonY = earthScreen.y - moonOrbitPx * Math.sin(moonAngle);
    const moonRadius = clamp(radiusPx * 0.35, ICON_MIN * 0.5, ICON_MAX * 0.5);

    drawPlanetGlyph(ctx, { x: moonX, y: moonY }, moonRadius, MOON);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Moon", moonX + moonRadius + 4, moonY);
  }
}

function drawPlanetGlyph(ctx: CanvasRenderingContext2D, center: Vec2, radius: number, planet: Planet) {
  if (planet.ring) {
    ctx.save();
    ctx.strokeStyle = planet.ring.color;
    ctx.globalAlpha = planet.ring.opacity;
    ctx.lineWidth = radius * (1 + planet.ring.width);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius * 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

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

function drawHeliocentricMoonSystem(
  ctx: CanvasRenderingContext2D,
  earthPlacement: Placement,
  moonPlacement: Placement,
  worldToScreen: (point: Vec2) => Vec2,
  planetRadius: number
) {
  const earthScreen = worldToScreen(earthPlacement.world);
  const moonScreenRaw = worldToScreen(moonPlacement.world);
  const dx = moonScreenRaw.x - earthScreen.x;
  const dy = moonScreenRaw.y - earthScreen.y;
  const screenDistance = Math.hypot(dx, dy);
  const theta = Math.atan2(moonPlacement.world.y - earthPlacement.world.y, moonPlacement.world.x - earthPlacement.world.x);
  const rTarget = clamp(screenDistance, MOON_VIS_MIN_PX, MOON_VIS_MAX_PX);
  const weight = smoothClampWeight(screenDistance, MOON_VIS_MIN_PX, MOON_VIS_MAX_PX, LERP_SOFTEN_PX);
  const rVisual = lerp(screenDistance, rTarget, weight);
  const moonScreen = {
    x: earthScreen.x + rVisual * Math.cos(theta),
    y: earthScreen.y + rVisual * Math.sin(theta),
  };

  ctx.save();
  ctx.beginPath();
  ctx.arc(earthScreen.x, earthScreen.y, rVisual, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(148,163,184,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const moonRadius = clamp(planetRadius * 0.55, ICON_MIN * 0.45, ICON_MAX * 0.45);
  drawPlanetGlyph(ctx, moonScreen, moonRadius, MOON);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(MOON.name, moonScreen.x + moonRadius + 4, moonScreen.y);
}

function drawGeocentricAlignmentRays(
  ctx: CanvasRenderingContext2D,
  placements: Placement[],
  worldToScreen: (point: Vec2) => Vec2,
  scale: number
) {
  const lineWidth = clamp(scale * 0.4, 0.45, 1.4);
  ctx.save();
  ctx.strokeStyle = "rgba(56,189,248,0.32)";
  ctx.lineWidth = lineWidth;
  placements.forEach((placement) => {
    if (placement.mode !== "geocentric" || placement.body === "Earth") return;
    const angle = Math.atan2(placement.world.y, placement.world.x);
    const inner = worldToScreen(placement.world);
    const outerWorld = {
      x: Math.cos(angle) * ZODIAC_RING_RADIUS_AU * GEO_SCALE_FACTOR,
      y: Math.sin(angle) * ZODIAC_RING_RADIUS_AU * GEO_SCALE_FACTOR,
    };
    const outer = worldToScreen(outerWorld);
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y);
    ctx.lineTo(outer.x, outer.y);
    ctx.stroke();
  });
  ctx.restore();
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothClampWeight(r: number, lo: number, hi: number, feather: number) {
  if (feather <= 0) return r < lo || r > hi ? 1 : 0;
  if (r < lo) {
    const t = (lo - r) / feather;
    return Math.min(1, (t * t) / (1 + t * t));
  }
  if (r > hi) {
    const t = (r - hi) / feather;
    return Math.min(1, (t * t) / (1 + t * t));
  }
  return 0;
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
