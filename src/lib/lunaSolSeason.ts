import { SearchMoonPhase, MakeTime, Seasons, type SeasonInfo } from "astronomy-engine";
import { countNewMoonsBetween, getAnchorDate } from "./colignyCalendar";

/* ───────────────────────────────────────────────────────────
   Luna Sol Ray Dial Season, Live New Moon Computation
   Threshold Cosmology. Cantlos is the 12/0 gate.
   Anchor: March 26, 5 CE, New Moon Solar Eclipse in Aries
   ─────────────────────────────────────────────────────────── */

export type Hemisphere = "northern" | "southern";

export type ThresholdRay = {
  fromRay: string;
  fromColor: string;
  toRay: string;
  toColor: string;
};

export type ColignyMonth = {
  position: number | "12/0";
  name: string;
  meaning: string;
  fromSign: string;
  toSign: string;
  thresholdRays: ThresholdRay;
  daysLabel: "MAT" | "ANMAT";
  /** Ecliptic longitude (degrees) of the threshold = start of the "to" sign */
  thresholdEclipticDeg: number;
};

export type WheelGate = {
  name: string;
  celticName: string;
  meaning: string;
  rayName: string;
  rayColor: string;
  date: Date;
  daysUntil: number;
  /** Traditional Gregorian threshold date (cross-quarter festivals only) */
  traditionalDate?: Date;
  /** Days until the traditional threshold (cross-quarter festivals only) */
  traditionalDaysUntil?: number;
};

export type LunaSolSeasonInfo = {
  lunaSolYear: number;
  currentMonth: ColignyMonth;
  currentGate: WheelGate;
  nextGate: WheelGate;
  allGates: WheelGate[];
  hemisphere: Hemisphere;
  ciallosActive: boolean;
  ciallosYearInCycle: number;
  daysDrifted: number;
  synodicMonthsSinceAnchor: number;
  nextNewMoon: Date;
};

export const LS_EPOCH_YEAR_CE = 5;
export const SYNODIC_MONTH_DAYS = 29.530588853;
export const SOLAR_YEAR_DAYS = 365.24219;
export const DRIFT_PER_YEAR = SOLAR_YEAR_DAYS - 12 * SYNODIC_MONTH_DAYS; // ~10.89 days

/* ── Anchor: March 26, 5 CE New Moon ──
   astronomy-engine verified: Sun at 5.55° Aries, Moon phase New,
   Moon ecliptic latitude 0.081° (solar eclipse conditions).
   This is the 12/0 gate itself. ── */
const ANCHOR_DATE = new Date(Date.UTC(2005, 2, 26));
ANCHOR_DATE.setUTCFullYear(5);

function normalizeLon(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function zodiacSign(lon: number): string {
  const signs = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  return signs[Math.floor(normalizeLon(lon) / 30) % 12];
}

/* ── The 12 Coligny months as thresholds — CANONICAL ORDER ──
   Index 0 = Samonios (1), through Index 11 = Cantlos (12/0).
   Signs follow the zodiac wheel counter-clockwise from Aquarius/Pisces cusp.
   These are the traditional associations, not real-time Luna positions. ── */
export const COLIGNY_MONTHS: ColignyMonth[] = [
  {
    position: 1,
    name: "Samonios",
    meaning: "Summer's end, warmth dissolving into harvest",
    fromSign: "Aquarius",
    toSign: "Pisces",
    thresholdRays: { fromRay: "Red", fromColor: "#ef4444", toRay: "Orange", toColor: "#f97316" },
    daysLabel: "MAT",
    thresholdEclipticDeg: 330,
  },
  {
    position: 2,
    name: "Dumannios",
    meaning: "The world turns inward, legacy releasing into innovation",
    fromSign: "Capricorn",
    toSign: "Aquarius",
    thresholdRays: { fromRay: "Orange", fromColor: "#f97316", toRay: "Yellow", toColor: "#facc15" },
    daysLabel: "ANMAT",
    thresholdEclipticDeg: 300,
  },
  {
    position: 3,
    name: "Rivros",
    meaning: "Ice-memory, expansion becoming structure",
    fromSign: "Sagittarius",
    toSign: "Capricorn",
    thresholdRays: { fromRay: "Yellow", fromColor: "#facc15", toRay: "Green", toColor: "#22c55e" },
    daysLabel: "MAT",
    thresholdEclipticDeg: 270,
  },
  {
    position: 4,
    name: "Anagantios",
    meaning: "Rest and dream, transmutation becoming prophecy",
    fromSign: "Scorpio",
    toSign: "Sagittarius",
    thresholdRays: { fromRay: "Green", fromColor: "#22c55e", toRay: "Turquoise", toColor: "#2dd4bf" },
    daysLabel: "ANMAT",
    thresholdEclipticDeg: 240,
  },
  {
    position: 5,
    name: "Ogronios",
    meaning: "The first breath of autumn, harmony diving into depth",
    fromSign: "Libra",
    toSign: "Scorpio",
    thresholdRays: { fromRay: "Turquoise", fromColor: "#2dd4bf", toRay: "Blue", toColor: "#3b82f6" },
    daysLabel: "MAT",
    thresholdEclipticDeg: 210,
  },
  {
    position: 6,
    name: "Cutios",
    meaning: "The gate of storms, clarity becoming discernment",
    fromSign: "Leo",
    toSign: "Virgo",
    thresholdRays: { fromRay: "Blue", fromColor: "#3b82f6", toRay: "Indigo", toColor: "#6366f1" },
    daysLabel: "MAT",
    thresholdEclipticDeg: 150,
  },
  {
    position: 7,
    name: "Giamonios",
    meaning: "The return of light, death becoming rebirth",
    fromSign: "Virgo",
    toSign: "Libra",
    thresholdRays: { fromRay: "Indigo", fromColor: "#6366f1", toRay: "Violet", toColor: "#8b5cf6" },
    daysLabel: "ANMAT",
    thresholdEclipticDeg: 180,
  },
  {
    position: 8,
    name: "Simivisonnios",
    meaning: "Half-spring, devotion becoming radiance",
    fromSign: "Cancer",
    toSign: "Leo",
    thresholdRays: { fromRay: "Violet", fromColor: "#8b5cf6", toRay: "Magenta", toColor: "#d946ef" },
    daysLabel: "ANMAT",
    thresholdEclipticDeg: 120,
  },
  {
    position: 9,
    name: "Equos",
    meaning: "The sacred gallop, mind galloping toward nurture",
    fromSign: "Gemini",
    toSign: "Cancer",
    thresholdRays: { fromRay: "Magenta", fromColor: "#d946ef", toRay: "Omni", toColor: "#fafafa" },
    daysLabel: "MAT",
    thresholdEclipticDeg: 90,
  },
  {
    position: 10,
    name: "Elembivios",
    meaning: "Sovereignty and sacrifice, sensory awakening becoming will",
    fromSign: "Taurus",
    toSign: "Gemini",
    thresholdRays: { fromRay: "Omni", fromColor: "#fafafa", toRay: "Elemental", toColor: "#a5f3fc" },
    daysLabel: "ANMAT",
    thresholdEclipticDeg: 60,
  },
  {
    position: 11,
    name: "Edrinios",
    meaning: "Judgment and balance, the seed opens toward essence",
    fromSign: "Aries",
    toSign: "Taurus",
    thresholdRays: { fromRay: "Elemental", fromColor: "#a5f3fc", toRay: "ALL", toColor: "#7dd3fc" },
    daysLabel: "MAT",
    thresholdEclipticDeg: 30,
  },
  {
    position: "12/0",
    name: "Cantlos",
    meaning: "The Song at the Gate, where dissolution becomes emergence",
    fromSign: "Pisces",
    toSign: "Aries",
    thresholdRays: { fromRay: "ALL", fromColor: "#7dd3fc", toRay: "Red", toColor: "#ef4444" },
    daysLabel: "ANMAT",
    thresholdEclipticDeg: 0,
  },
];

/* ── Luna Sol Year ── */
export function getLunaSolYear(date: Date): number {
  return date.getUTCFullYear() - LS_EPOCH_YEAR_CE;
}

/* ── Ciallos: every 3rd year ──
   The manuscript specifies Ciallos every 3rd year (lsYear % 3 === 0).
   This heals the lunar-solar drift of ~10.89 days/year.
   33-day Ciallos month: 32 full days + threshold of ~15 hours. ── */
export function getMetonicYear(year: number): number {
  // Kept for backward compatibility — returns position in 3-year cycle (1, 2, or 3)
  const lsYear = year - LS_EPOCH_YEAR_CE;
  if (lsYear <= 0) return 1;
  return ((lsYear - 1) % 3) + 1;
}

export function isCiallosYear(year: number): boolean {
  const lsYear = year - LS_EPOCH_YEAR_CE;
  if (lsYear <= 0) return false;
  return lsYear % 3 === 0;
}

export function getCiallosInfo(year: number) {
  const cyclePos = getMetonicYear(year);
  const active = cyclePos === 3;
  return {
    active,
    metonicYear: cyclePos,
    name: active ? "Ciallos" : "",
    meaning: active
      ? "The intercalary breath, time pauses so Moon and Sun may realign."
      : "",
  };
}

/**
 * Count Ciallos insertions from epoch to a given date.
 * Ciallos appears every 3rd year (lsYear % 3 === 0).
 */
export function getCiallosCountUpToDate(date: Date): number {
  const currentYear = date.getUTCFullYear();
  let count = 0;
  for (let y = LS_EPOCH_YEAR_CE; y <= currentYear; y++) {
    const lsYear = y - LS_EPOCH_YEAR_CE;
    if (lsYear > 0 && lsYear % 3 === 0) {
      count++;
    }
  }
  return count;
}

/* ── Compute New Moons from anchor using astronomy-engine ── */
function getAnchorTime() {
  return MakeTime(ANCHOR_DATE);
}

export function getNewMoonsFromAnchor(count: number): Date[] {
  const result: Date[] = [];
  let searchTime = getAnchorTime();

  for (let i = 0; i < count; i++) {
    const nm = SearchMoonPhase(0, searchTime, 40);
    if (!nm) break;
    result.push(nm.date);
    // Next search starts after this New Moon
    const nextDate = new Date(nm.date.getTime() + 24 * 60 * 60 * 1000);
    searchTime = MakeTime(nextDate);
  }

  return result;
}

/* ── Get the current Coligny month from live New Moons ──
   A month is the period between two new moons.
   The month name is determined by counting new moons from the anchor
   to the new moon that STARTED the current lunation. ── */
export function getCurrentColignyMonth(date: Date): ColignyMonth {
  const now = date.getTime();
  const anchor = getAnchorDate().getTime();

  if (now < anchor) {
    return COLIGNY_MONTHS[0];
  }

  // Find the new moon that started this lunation
  const searchTime = MakeTime(date);
  const prevNM = SearchMoonPhase(0, searchTime, -40);
  if (!prevNM) return COLIGNY_MONTHS[0];

  // Count actual new moons from epoch to the lunation-start NM
  // Zero mean math. Real sky only.
  // Subtract Ciallos: the 13th month heals drift but does NOT shift
  // the 12-month sacred canon. The month index into the 12-month cycle
  // must account for inserted Ciallos.
  const monthsElapsed = countNewMoonsBetween(getAnchorDate(), prevNM.date);
  const ciallosUpToNow = getCiallosCountUpToDate(date);
  const adjustedMonths = monthsElapsed - ciallosUpToNow;
  const monthIndex = adjustedMonths % 12;

  return COLIGNY_MONTHS[monthIndex];
}

/* ── Compute synodic months since anchor ── */
export function getSynodicMonthsSinceAnchor(date: Date): number {
  const now = date.getTime();
  const anchor = getAnchorDate().getTime();
  if (now < anchor) return 0;
  // Use actual new moon count, not mean math
  return countNewMoonsBetween(getAnchorDate(), date);
}

/* ── Next New Moon from a given date ── */
export function getNextNewMoon(date: Date): Date | null {
  const searchTime = MakeTime(date);
  const result = SearchMoonPhase(0, searchTime, 40);
  return result ? result.date : null;
}

/* ── Current lunation with continuous progress ── */
export function getCurrentLunationProgress(date: Date): { month: ColignyMonth; progress: number } | null {
  const nowMs = date.getTime();

  // Previous New Moon: search window [now - 35d, now + 5d] — guarantees we land before now
  const searchStart = new Date(nowMs - 35 * 86400000);
  const prevResult = SearchMoonPhase(0, MakeTime(searchStart), 40);
  const prevNM = prevResult?.date;

  if (!prevNM || prevNM.getTime() > nowMs) return null;

  // Next New Moon: search forward from the current time
  const nextResult = SearchMoonPhase(0, MakeTime(date), 45);
  const nextNM = nextResult?.date;

  if (!nextNM || nextNM.getTime() <= prevNM.getTime()) return null;

  // Month identity from actual new moon count since epoch
  // Zero mean math. Real sky only.
  // Subtract Ciallos insertions to keep 12-month sacred canon.
  const monthsElapsed = countNewMoonsBetween(getAnchorDate(), prevNM);
  const ciallosUpToNow = getCiallosCountUpToDate(date);
  const adjustedMonths = monthsElapsed - ciallosUpToNow;
  const monthIndex = adjustedMonths % 12;
  const month = COLIGNY_MONTHS[monthIndex];

  // Continuous progress through this actual lunation: 0 = prevNM, 1 = nextNM
  const durationMs = nextNM.getTime() - prevNM.getTime();
  if (durationMs <= 0) return null;
  const elapsedMs = nowMs - prevNM.getTime();
  const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));

  return { month, progress };
}

/* ── Seasonal events cache ──
   Seasons() from astronomy-engine is pure for a given year.
   Cache results to avoid recomputation on every tick. */
const _seasonsCache = new Map<number, SeasonInfo>();

function getCachedSeasons(year: number): SeasonInfo {
  let cached = _seasonsCache.get(year);
  if (!cached) {
    cached = Seasons(year);
    _seasonsCache.set(year, cached);
  }
  return cached;
}

/* ── Wheel of the Year gates ── */
function midpoint(a: Date, b: Date): Date {
  return new Date((a.getTime() + b.getTime()) / 2);
}

export function computeWheelGates(date: Date, hemisphere: Hemisphere): WheelGate[] {
  const year = date.getUTCFullYear();
  const seasons = getCachedSeasons(year);
  const seasonsPrev = getCachedSeasons(year - 1);
  const { mar_equinox, jun_solstice, sep_equinox, dec_solstice } = seasons;

  const gates = [
    {
      name: "Imbolc",
      celticName: "Imbolg",
      meaning: "The first milk, awakening from winter's dream",
      rayName: "Elemental",
      rayColor: "#a5f3fc",
      date: midpoint(seasonsPrev.dec_solstice.date, mar_equinox.date),
      traditionalDate: new Date(year, 1, 1),
    },
    {
      name: "Vernal Equinox",
      celticName: "Ostara",
      meaning: "The balance point, day and night in sacred union. The 12/0 gate.",
      rayName: "Red",
      rayColor: "#ef4444",
      date: mar_equinox.date,
    },
    {
      name: "Beltane",
      celticName: "Bealtaine",
      meaning: "The bright fire, the gate of summer opens",
      rayName: "Orange",
      rayColor: "#f97316",
      date: midpoint(mar_equinox.date, jun_solstice.date),
      traditionalDate: new Date(year, 4, 1),
    },
    {
      name: "Summer Solstice",
      celticName: "Litha",
      meaning: "The Sun stands still, the longest day",
      rayName: "Yellow",
      rayColor: "#facc15",
      date: jun_solstice.date,
    },
    {
      name: "Lughnasadh",
      celticName: "Lughnasadh",
      meaning: "The first harvest, the sacred gathering",
      rayName: "Turquoise",
      rayColor: "#2dd4bf",
      date: midpoint(jun_solstice.date, sep_equinox.date),
      traditionalDate: new Date(year, 7, 1),
    },
    {
      name: "Autumnal Equinox",
      celticName: "Mabon",
      meaning: "The second balance, gratitude and release",
      rayName: "Indigo",
      rayColor: "#6366f1",
      date: sep_equinox.date,
    },
    {
      name: "Samhain",
      celticName: "Samhain",
      meaning: "Summer's end, the veil thins",
      rayName: "Violet",
      rayColor: "#8b5cf6",
      date: midpoint(sep_equinox.date, dec_solstice.date),
      traditionalDate: new Date(year, 9, 31),
    },
    {
      name: "Winter Solstice",
      celticName: "Yule",
      meaning: "The Sun reborn, the longest night",
      rayName: "Magenta",
      rayColor: "#d946ef",
      date: dec_solstice.date,
    },
  ];

  const nowMs = date.getTime();
  const result = gates.map((g) => {
    const daysUntil = Math.round((g.date.getTime() - nowMs) / (1000 * 60 * 60 * 24));
    const traditionalDaysUntil = g.traditionalDate
      ? Math.ceil((g.traditionalDate.getTime() - nowMs) / (1000 * 60 * 60 * 24))
      : undefined;
    return { ...g, daysUntil, traditionalDaysUntil };
  });

  if (hemisphere === "southern") {
    return result.map((g) => {
      const southernMap: Record<string, string> = {
        Imbolc: "Lughnasadh",
        "Vernal Equinox": "Autumnal Equinox",
        Beltane: "Samhain",
        "Summer Solstice": "Winter Solstice",
        Lughnasadh: "Imbolc",
        "Autumnal Equinox": "Vernal Equinox",
        Samhain: "Beltane",
        "Winter Solstice": "Summer Solstice",
      };
      const flippedName = southernMap[g.name] ?? g.name;
      const matched = result.find((x) => x.name === flippedName);
      return matched ? { ...matched, name: g.name, celticName: g.celticName, meaning: g.meaning } : g;
    });
  }

  return result;
}

/* ── Main entry point ── */
export function getLunaSolSeasonInfo(date: Date, hemisphere: Hemisphere): LunaSolSeasonInfo {
  const lunaSolYear = getLunaSolYear(date);
  const colignyMonth = getCurrentColignyMonth(date);
  const allGates = computeWheelGates(date, hemisphere);

  // Current gate: the most recent gate whose date has passed.
  // We are "in" a season from the moment its gate opens until the next gate opens.
  const nowMs = date.getTime();
  let current: WheelGate | null = null;
  for (let i = allGates.length - 1; i >= 0; i--) {
    if (allGates[i].date.getTime() <= nowMs) {
      current = allGates[i];
      break;
    }
  }
  // If none have passed yet this year, current is last year's Winter Solstice
  if (!current) {
    const prevGates = computeWheelGates(new Date(date.getUTCFullYear() - 1, 0, 1), hemisphere);
    current = prevGates[prevGates.length - 1]; // Winter Solstice of previous year
  }

  // Update daysUntil for the current gate (will be <= 0 because it's in the past)
  current = { ...current, daysUntil: Math.round((current.date.getTime() - nowMs) / (1000 * 60 * 60 * 24)) };

  // Next gate: first upcoming gate
  const future = allGates.filter((g) => g.date.getTime() > nowMs)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const next = future.length > 0 ? future[0] : allGates[0];

  const synodicMonthsSinceAnchor = getSynodicMonthsSinceAnchor(date);
  const yearsSinceAnchor = lunaSolYear;
  const drift = yearsSinceAnchor * DRIFT_PER_YEAR;
  const nextNewMoon = getNextNewMoon(date);

  return {
    lunaSolYear,
    currentMonth: colignyMonth,
    currentGate: current,
    nextGate: next,
    allGates,
    hemisphere,
    ciallosActive: isCiallosYear(date.getUTCFullYear()),
    ciallosYearInCycle: getMetonicYear(date.getUTCFullYear()),
    daysDrifted: drift,
    synodicMonthsSinceAnchor,
    nextNewMoon: nextNewMoon ?? date,
  };
}
