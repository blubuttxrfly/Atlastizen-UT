import {
  Body,
  GeoVector,
  Ecliptic,
  MakeTime,
  Observer,
  Seasons,
  SearchLunarEclipse,
  NextLunarEclipse,
  SearchGlobalSolarEclipse,
  NextGlobalSolarEclipse,
  SearchMoonPhase,
  MoonPhase,
  EclipseKind,
  type SeasonInfo,
  type LunarEclipseInfo,
  type GlobalSolarEclipseInfo,
} from "astronomy-engine";

/* ───────────────────────────────────────────────────────────
   Luna Events Provider
   Solstices, Equinoxes, Eclipses, and Ray Frequency mappings
   for both Sol and Luna panels.
   ─────────────────────────────────────────────────────────── */

export type SolsticeEquinoxEvent = {
  kind: "vernal-equinox" | "summer-solstice" | "autumnal-equinox" | "winter-solstice";
  label: string;
  date: Date;
  /** Ecliptic longitude of the Sun at this moment */
  sunLongitude: number;
};

export type EclipseEvent = {
  kind: "lunar" | "solar";
  /** For lunar: "penumbral" | "partial" | "total". For solar: "partial" | "annular" | "total" */
  eclipseType: string;
  peak: Date;
  /** Days from now until the eclipse peak */
  daysUntil: number;
  /** Obscuration fraction [0..1] if available */
  obscuration?: number;
  /** Human-readable description */
  description: string;
};

export type RayFrequencyInfo = {
  /** Ray index 1-12 (matching RAY_WINDOWS order) */
  index: number;
  name: string;
  color: string;
  labelColor?: string;
  virtue: string;
  affirmation: string;
  /** Zodiac sign name */
  zodiacSign: string;
  /** Zodiac symbol */
  zodiacSymbol: string;
  /** Ecliptic longitude in degrees [0..360) */
  longitude: number;
};

/* ── Ray Frequency lattice (zodiac → Ray) ── */
const ZODIAC_RAY_MAP: Array<{
  sign: string;
  symbol: string;
  rayName: string;
  rayColor: string;
  rayLabelColor?: string;
  virtue: string;
  affirmation: string;
}> = [
  { sign: "Aries", symbol: "\u2648\uFE0E", rayName: "Red", rayColor: "#ef4444", virtue: "Presence", affirmation: "I choose. I move. I live." },
  { sign: "Taurus", symbol: "\u2649\uFE0E", rayName: "Orange", rayColor: "#f97316", virtue: "Essence", affirmation: "My joy creates worlds." },
  { sign: "Gemini", symbol: "\u264A\uFE0E", rayName: "Yellow", rayColor: "#facc15", rayLabelColor: "#f8fafc", virtue: "Sovereignty", affirmation: "My will blesses my path." },
  { sign: "Cancer", symbol: "\u264B\uFE0E", rayName: "Green", rayColor: "#22c55e", virtue: "Union", affirmation: "What I nurture, flourishes." },
  { sign: "Leo", symbol: "\u264C\uFE0E", rayName: "Turquoise", rayColor: "#2dd4bf", virtue: "Harmony", affirmation: "My voice flows from my heart." },
  { sign: "Virgo", symbol: "\u264D\uFE0E", rayName: "Blue", rayColor: "#3b82f6", virtue: "Expression", affirmation: "I speak what is real." },
  { sign: "Libra", symbol: "\u264E\uFE0E", rayName: "Indigo", rayColor: "#6366f1", virtue: "Perception", affirmation: "My dreams guide my becoming." },
  { sign: "Scorpio", symbol: "\u264F\uFE0E", rayName: "Violet", rayColor: "#8b5cf6", virtue: "Integration", affirmation: "I transmute through love." },
  { sign: "Sagittarius", symbol: "\u2650\uFE0E", rayName: "Magenta", rayColor: "#d946ef", virtue: "Reunion", affirmation: "My Heartlight is the bridge." },
  { sign: "Capricorn", symbol: "\u2651\uFE0E", rayName: "Omni", rayColor: "#fafafa", rayLabelColor: "#f8fafc", virtue: "Integration", affirmation: "I am whole. I am ready." },
  { sign: "Aquarius", symbol: "\u2652\uFE0E", rayName: "Elemental", rayColor: "#a5f3fc", rayLabelColor: "#f8fafc", virtue: "Ancient Remembrance", affirmation: "I hold the pattern that holds me." },
  { sign: "Pisces", symbol: "\u2653\uFE0E", rayName: "ALL", rayColor: "#7dd3fc", rayLabelColor: "#f8fafc", virtue: "Cosmogenesis", affirmation: "ALL-ways lead back to our Heartlight." },
];

/* ── Moon phase → Ray resonance mapping ── */
export type MoonPhaseRay = {
  phaseName: string;
  rayName: string;
  rayColor: string;
  rayIndex: number;
  resonance: string;
};

const MOON_PHASE_RAYS: MoonPhaseRay[] = [
  { phaseName: "New Moon", rayName: "Red", rayColor: "#ef4444", rayIndex: 0, resonance: "Initiation, seeding intention in the dark of potential." },
  { phaseName: "Waxing Crescent", rayName: "Orange", rayColor: "#f97316", rayIndex: 1, resonance: "Emerging joy, sensing the first glimmer of form." },
  { phaseName: "First Quarter", rayName: "Yellow", rayColor: "#facc15", rayIndex: 2, resonance: "Clear will, choosing direction with structural clarity." },
  { phaseName: "Waxing Gibbous", rayName: "Green", rayColor: "#22c55e", rayIndex: 3, resonance: "Growing manifestation, nurturing what is taking shape." },
  { phaseName: "Full Moon", rayName: "Turquoise", rayColor: "#2dd4bf", rayIndex: 4, resonance: "Heart-voiced illumination, full expression of what was seeded." },
  { phaseName: "Waning Gibbous", rayName: "Blue", rayColor: "#3b82f6", rayIndex: 5, resonance: "Refining truth, distilling wisdom from the fullness." },
  { phaseName: "Last Quarter", rayName: "Indigo", rayColor: "#6366f1", rayIndex: 6, resonance: "Inner sight, releasing what no longer serves the dream." },
  { phaseName: "Waning Crescent", rayName: "Violet", rayColor: "#8b5cf6", rayIndex: 7, resonance: "Transmutation, dissolving back into the void for renewal." },
];

function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function getZodiacIndex(longitudeDeg: number): number {
  return Math.floor(normalizeDegrees(longitudeDeg) / 30);
}

function eclipticLongitudeOf(body: Body, date: Date, _observer: Observer): number {
  const time = MakeTime(date);
  const gv = GeoVector(body, time, true);
  const ecl = Ecliptic(gv);
  return normalizeDegrees(ecl.elon);
}

/* ── Solstice & Equinox computation ── */
export function getSeasonalEvents(date: Date = new Date()): SolsticeEquinoxEvent[] {
  const year = date.getUTCFullYear();
  const seasons: SeasonInfo = Seasons(year);

  const events: SolsticeEquinoxEvent[] = [
    {
      kind: "vernal-equinox",
      label: "Vernal Equinox",
      date: seasons.mar_equinox.date,
      sunLongitude: 0,
    },
    {
      kind: "summer-solstice",
      label: "Summer Solstice",
      date: seasons.jun_solstice.date,
      sunLongitude: 90,
    },
    {
      kind: "autumnal-equinox",
      label: "Autumnal Equinox",
      date: seasons.sep_equinox.date,
      sunLongitude: 180,
    },
    {
      kind: "winter-solstice",
      label: "Winter Solstice",
      date: seasons.dec_solstice.date,
      sunLongitude: 270,
    },
  ];

  // Sort chronologically
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events;
}

export function getNextSeasonalEvent(date: Date = new Date()): SolsticeEquinoxEvent | null {
  const now = date.getTime();
  const thisYear = getSeasonalEvents(date);
  const next = thisYear.find((e) => e.date.getTime() > now);
  if (next) return next;

  // If all this year's events have passed, get next year's first event
  const nextYear = getSeasonalEvents(new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1)));
  return nextYear[0] ?? null;
}

/* ── Eclipse computation ── */
function describeLunarEclipse(info: LunarEclipseInfo): string {
  const type = info.kind === EclipseKind.Total ? "Total"
    : info.kind === EclipseKind.Partial ? "Partial"
    : "Penumbral";
  return `${type} Lunar Eclipse`;
}

function describeSolarEclipse(info: GlobalSolarEclipseInfo): string {
  const type = info.kind === EclipseKind.Total ? "Total"
    : info.kind === EclipseKind.Annular ? "Annular"
    : "Partial";
  return `${type} Solar Eclipse`;
}

export function getUpcomingEclipses(date: Date = new Date(), count: number = 3): EclipseEvent[] {
  const nowMs = date.getTime();
  const events: EclipseEvent[] = [];

  // Find next lunar eclipses
  try {
    let lunarInfo = SearchLunarEclipse(date);
    for (let i = 0; i < count && lunarInfo; i++) {
      const peakDate = lunarInfo.peak.date;
      const daysUntil = Math.round((peakDate.getTime() - nowMs) / (1000 * 60 * 60 * 24));
      events.push({
        kind: "lunar",
        eclipseType: lunarInfo.kind,
        peak: peakDate,
        daysUntil,
        obscuration: lunarInfo.obscuration,
        description: describeLunarEclipse(lunarInfo),
      });
      lunarInfo = NextLunarEclipse(lunarInfo.peak);
    }
  } catch {
    // SearchLunarEclipse may fail near edge cases
  }

  // Find next solar eclipses
  try {
    let solarInfo = SearchGlobalSolarEclipse(date);
    for (let i = 0; i < count && solarInfo; i++) {
      const peakDate = solarInfo.peak.date;
      const daysUntil = Math.round((peakDate.getTime() - nowMs) / (1000 * 60 * 60 * 24));
      events.push({
        kind: "solar",
        eclipseType: solarInfo.kind,
        peak: peakDate,
        daysUntil,
        obscuration: solarInfo.obscuration,
        description: describeSolarEclipse(solarInfo),
      });
      solarInfo = NextGlobalSolarEclipse(solarInfo.peak);
    }
  } catch {
    // SearchGlobalSolarEclipse may fail near edge cases
  }

  // Sort all events chronologically and take the requested count
  events.sort((a, b) => a.peak.getTime() - b.peak.getTime());
  return events.slice(0, count);
}

/* ── Ray Frequency from ecliptic longitude ── */
export function getRayFrequency(longitudeDeg: number): RayFrequencyInfo {
  const zodiacIndex = getZodiacIndex(longitudeDeg);
  const entry = ZODIAC_RAY_MAP[zodiacIndex];
  return {
    index: zodiacIndex + 1,
    name: entry.rayName,
    color: entry.rayColor,
    labelColor: entry.rayLabelColor,
    virtue: entry.virtue,
    affirmation: entry.affirmation,
    zodiacSign: entry.sign,
    zodiacSymbol: entry.symbol,
    longitude: normalizeDegrees(longitudeDeg),
  };
}

/* ── Moon's current Ray Frequency ── */
export function getMoonRayFrequency(date: Date = new Date(), lat: number = 0, lon: number = 0): RayFrequencyInfo {
  const observer = new Observer(lat, lon, 0);
  void observer;
  const moonLon = eclipticLongitudeOf(Body.Moon, date, observer);
  return getRayFrequency(moonLon);
}

/* ── Sun's current Ray Frequency ── */
export function getSunRayFrequency(date: Date = new Date(), lat: number = 0, lon: number = 0): RayFrequencyInfo {
  const observer = new Observer(lat, lon, 0);
  void observer;
  const sunLon = eclipticLongitudeOf(Body.Sun, date, observer);
  return getRayFrequency(sunLon);
}

/* ── Moon phase → Ray resonance ── */
export function getMoonPhaseRay(phaseName: string): MoonPhaseRay | null {
  const normalized = phaseName.toLowerCase();
  const found = MOON_PHASE_RAYS.find((r) => {
    const rn = r.phaseName.toLowerCase();
    if (normalized === rn) return true;
    // Partial matches for phase names from the provider
    if (normalized.includes("new") && rn === "new moon") return true;
    if (normalized.includes("waxing crescent") && rn === "waxing crescent") return true;
    if (normalized.includes("first quarter") && rn === "first quarter") return true;
    if (normalized.includes("waxing gibbous") && rn === "waxing gibbous") return true;
    if (normalized.includes("full") && rn === "full moon") return true;
    if (normalized.includes("waning gibbous") && rn === "waning gibbous") return true;
    if ((normalized.includes("last quarter") || normalized.includes("third quarter")) && rn === "last quarter") return true;
    if (normalized.includes("waning crescent") && rn === "waning crescent") return true;
    return false;
  });
  return found ?? null;
}

/* ── Solar season → Ray mapping ── */
export type SolarSeasonRay = {
  seasonName: string;
  rayName: string;
  rayColor: string;
  rayIndex: number;
  resonance: string;
};

export function getSolarSeasonRay(date: Date = new Date(), lat: number = 0, lon: number = 0): SolarSeasonRay {
  const observer = new Observer(lat, lon, 0);
  const sunLon = eclipticLongitudeOf(Body.Sun, date, observer);
  const idx = getZodiacIndex(sunLon);

  // Northern hemisphere seasons — the Sun's ecliptic longitude determines the season
  // 0-30 (Aries) = Spring, 90-120 (Cancer) = Summer, etc.
  const seasonIndex = Math.floor(idx / 3);
  const seasons: SolarSeasonRay[] = [
    { seasonName: "Spring", rayName: "Green", rayColor: "#22c55e", rayIndex: 3, resonance: "Manifestation, growth, the rising tide of life." },
    { seasonName: "Late Spring", rayName: "Turquoise", rayColor: "#2dd4bf", rayIndex: 4, resonance: "Harmonizing flow, the bridge between growth and expression." },
    { seasonName: "Summer", rayName: "Blue", rayColor: "#3b82f6", rayIndex: 5, resonance: "Refined expression, the full illumination of Sol." },
    { seasonName: "Late Summer", rayName: "Indigo", rayColor: "#6366f1", rayIndex: 6, resonance: "Deep perception, holding the dream of the harvest." },
    { seasonName: "Autumn", rayName: "Violet", rayColor: "#8b5cf6", rayIndex: 7, resonance: "Transmutation, the alchemy of release and return." },
    { seasonName: "Late Autumn", rayName: "Magenta", rayColor: "#d946ef", rayIndex: 8, resonance: "Reunion, gathering what was scattered across the year." },
    { seasonName: "Winter", rayName: "Omni", rayColor: "#fafafa", rayIndex: 9, resonance: "Crystallization, the still wholeness of the cold months." },
    { seasonName: "Late Winter", rayName: "Elemental", rayColor: "#a5f3fc", rayIndex: 10, resonance: "Ancient remembrance, holding the pattern for what comes next." },
    { seasonName: "Pre-Spring", rayName: "ALL", rayColor: "#7dd3fc", rayIndex: 11, resonance: "Cosmogenesis, the infinite potential before the thaw." },
    { seasonName: "Early Spring", rayName: "Red", rayColor: "#ef4444", rayIndex: 0, resonance: "Initiation, the first spark of returning light." },
    { seasonName: "Mid-Spring", rayName: "Orange", rayColor: "#f97316", rayIndex: 1, resonance: "Essence, the sensory awakening of the body of Earth." },
    { seasonName: "Late Spring Bloom", rayName: "Yellow", rayColor: "#facc15", rayIndex: 2, resonance: "Sovereign will, the clarity of purpose as growth peaks." },
  ];

  return seasons[seasonIndex] ?? seasons[0];
}

/* ── Days until helper ── */
export function daysUntil(target: Date, from: Date = new Date()): number {
  return Math.round((target.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/* ── Format eclipse kind for display ── */
export function formatEclipseType(eclipseType: string): string {
  return eclipseType.charAt(0).toUpperCase() + eclipseType.slice(1);
}

/* ── Upcoming Moon Phase Events (New Moon & Full Moon) ── */
export type MoonPhaseEvent = {
  kind: "new-moon" | "full-moon";
  label: string;
  date: Date;
  /** Days from now until the event */
  daysUntil: number;
  /** Ray Frequency for this phase */
  rayName: string;
  rayColor: string;
  resonance: string;
};

export function getUpcomingMoonPhases(date: Date = new Date(), count: number = 4): MoonPhaseEvent[] {
  const nowMs = date.getTime();
  const events: MoonPhaseEvent[] = [];

  try {
    // Search for next New Moon (targetLon = 0)
    const newMoonTime = SearchMoonPhase(0, date, 40);
    if (newMoonTime) {
      const newMoonDate = newMoonTime.date;
      const dUntil = Math.round((newMoonDate.getTime() - nowMs) / (1000 * 60 * 60 * 24));
      events.push({
        kind: "new-moon",
        label: "New Moon",
        date: newMoonDate,
        daysUntil: dUntil,
        rayName: "Red",
        rayColor: "#ef4444",
        resonance: "Initiation, seeding intention in the dark of potential.",
      });
    }
  } catch { /* search may fail near edge cases */ }

  try {
    // Search for next Full Moon (targetLon = 180)
    const fullMoonTime = SearchMoonPhase(180, date, 40);
    if (fullMoonTime) {
      const fullMoonDate = fullMoonTime.date;
      const dUntil = Math.round((fullMoonDate.getTime() - nowMs) / (1000 * 60 * 60 * 24));
      events.push({
        kind: "full-moon",
        label: "Full Moon",
        date: fullMoonDate,
        daysUntil: dUntil,
        rayName: "Turquoise",
        rayColor: "#2dd4bf",
        resonance: "Heart-voiced illumination, full expression of what was seeded.",
      });
    }
  } catch { /* search may fail near edge cases */ }

  // Sort chronologically and take requested count
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events.slice(0, count);
}

/* ── Get current Moon phase angle (0-360 degrees) ── */
export function getMoonPhaseAngle(date: Date = new Date()): number {
  try {
    return ((MoonPhase(MakeTime(date)) % 360) + 360) % 360;
  } catch {
    return 0;
  }
}