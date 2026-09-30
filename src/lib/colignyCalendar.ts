/**
 * Coligny Calendar Engine — Luna Gaia Sol Time System
 * Primary engine: astronomy-engine (zero mean math)
 * 
 * Design principle: For any given date, find the actual new moon
 * that started the current lunation. That new moon is the anchor.
 * From it, we derive everything: month name, day count, MAT/ANM.
 * 
 * Epoch: March 26, 5 CE at dawn (new moon solar eclipse)
 * Ciallos: every 3rd year, 32 full days + threshold (~15 hours)
 */

import { SearchMoonPhase, MakeTime, EclipticLongitude, Body } from "astronomy-engine";

/* ───────────────────────────────────────────────────────────
   Epoch Constants
   ─────────────────────────────────────────────────────────── */

export const LS_EPOCH_YEAR_CE = 5;
export const LS_EPOCH_MONTH = 3; // March
export const LS_EPOCH_DAY = 26;

/**
 * The epoch as an astronomy-engine AstroTime object.
 * March 26, 5 CE: new moon solar eclipse at dawn.
 */
export function getAnchorTime() {
  // Use ISO string format to correctly create year 0005 CE
  // Date.UTC(5, ...) creates 1905, not 5 CE!
  return MakeTime(new Date("0005-03-26T06:00:00Z"));
}

/**
 * The anchor date as a plain Date.
 */
export function getAnchorDate(): Date {
  return new Date("0005-03-26T06:00:00Z");
}

/* ───────────────────────────────────────────────────────────
   Coligny Month Data
   ─────────────────────────────────────────────────────────── */

export type ColignyMonth = {
  position: number;
  name: string;
  meaning: string;
  fromSign: string;
  toSign: string;
  fromRay: string;
  fromColor: string;
  toRay: string;
  toColor: string;
};

export const COLIGNY_MONTHS: ColignyMonth[] = [
  {
    position: 1,
    name: "Samonios",
    meaning: "Summer's end, warmth dissolving into harvest",
    fromSign: "Aquarius",
    toSign: "Pisces",
    fromRay: "Red",
    fromColor: "#ef4444",
    toRay: "Orange",
    toColor: "#f97316",
  },
  {
    position: 2,
    name: "Dumannios",
    meaning: "The world turns inward, legacy releasing into innovation",
    fromSign: "Capricorn",
    toSign: "Aquarius",
    fromRay: "Orange",
    fromColor: "#f97316",
    toRay: "Yellow",
    toColor: "#facc15",
  },
  {
    position: 3,
    name: "Rivros",
    meaning: "Ice-memory, expansion becoming structure",
    fromSign: "Sagittarius",
    toSign: "Capricorn",
    fromRay: "Yellow",
    fromColor: "#facc15",
    toRay: "Green",
    toColor: "#22c55e",
  },
  {
    position: 4,
    name: "Anagantios",
    meaning: "Rest and dream, transmutation becoming prophecy",
    fromSign: "Scorpio",
    toSign: "Sagittarius",
    fromRay: "Green",
    fromColor: "#22c55e",
    toRay: "Turquoise",
    toColor: "#2dd4bf",
  },
  {
    position: 5,
    name: "Ogronios",
    meaning: "The first breath of autumn, harmony diving into depth",
    fromSign: "Libra",
    toSign: "Scorpio",
    fromRay: "Turquoise",
    fromColor: "#2dd4bf",
    toRay: "Blue",
    toColor: "#3b82f6",
  },
  {
    position: 6,
    name: "Cutios",
    meaning: "The gate of storms, clarity becoming discernment",
    fromSign: "Leo",
    toSign: "Virgo",
    fromRay: "Blue",
    fromColor: "#3b82f6",
    toRay: "Indigo",
    toColor: "#6366f1",
  },
  {
    position: 7,
    name: "Giamonios",
    meaning: "The return of light, death becoming rebirth",
    fromSign: "Virgo",
    toSign: "Libra",
    fromRay: "Indigo",
    fromColor: "#6366f1",
    toRay: "Violet",
    toColor: "#8b5cf6",
  },
  {
    position: 8,
    name: "Simivisonnios",
    meaning: "Half-spring, devotion becoming radiance",
    fromSign: "Cancer",
    toSign: "Leo",
    fromRay: "Violet",
    fromColor: "#8b5cf6",
    toRay: "Magenta",
    toColor: "#d946ef",
  },
  {
    position: 9,
    name: "Equos",
    meaning: "The sacred gallop, mind galloping toward nurture",
    fromSign: "Gemini",
    toSign: "Cancer",
    fromRay: "Magenta",
    fromColor: "#d946ef",
    toRay: "Omni",
    toColor: "#fafafa",
  },
  {
    position: 10,
    name: "Elembivios",
    meaning: "Sovereignty and sacrifice, sensory awakening becoming will",
    fromSign: "Taurus",
    toSign: "Gemini",
    fromRay: "Omni",
    fromColor: "#fafafa",
    toRay: "Elemental",
    toColor: "#a5f3fc",
  },
  {
    position: 11,
    name: "Edrinios",
    meaning: "Judgment and balance, the seed opens toward essence",
    fromSign: "Aries",
    toSign: "Taurus",
    fromRay: "Elemental",
    fromColor: "#a5f3fc",
    toRay: "ALL",
    toColor: "#7dd3fc",
  },
  {
    position: 12,
    name: "Cantlos",
    meaning: "The Song at the Gate, where dissolution becomes emergence",
    fromSign: "Pisces",
    toSign: "Aries",
    fromRay: "ALL",
    fromColor: "#7dd3fc",
    toRay: "Red",
    toColor: "#ef4444",
  },
];

/* ───────────────────────────────────────────────────────────
   Month Type (MAT / ANM)
   ─────────────────────────────────────────────────────────── */

export type MonthType = "MAT" | "ANM";

/**
 * The Coligny bronze tablet pattern for MAT/ANM.
 * This is the historical sequence from the tablet.
 */
export const BRONZE_TABLET_PATTERN: MonthType[] = [
  "MAT", "ANM", "MAT", "ANM", "MAT", "MAT",
  "ANM", "MAT", "ANM", "MAT", "ANM", "ANM",
];

/**
 * Determine month type from actual synodic length.
 * Uses astronomy-engine observed new moons.
 * 
 * MAT = 30 days (synodic length >= 29.65 days)
 * ANM = 29 days (synodic length < 29.65 days)
 */
export function determineMonthType(synodicLength: number): MonthType {
  return synodicLength >= 29.65 ? "MAT" : "ANM";
}

/* ───────────────────────────────────────────────────────────
   Core Engine: New Moon Finding
   ─────────────────────────────────────────────────────────── */

/**
 * Find the most recent new moon before a given date.
 * This is the anchor of the current lunation.
 * 
 * Uses astronomy-engine SearchMoonPhase — zero mean math.
 */
export function findPreviousNewMoon(date: Date): { date: Date; time: ReturnType<typeof MakeTime> } | null {
  const searchTime = MakeTime(date);
  const nm = SearchMoonPhase(0, searchTime, -40);
  if (!nm) return null;
  return { date: nm.date, time: nm };
}

/**
 * Find the next new moon after a given date.
 * Used to calculate synodic length.
 */
export function findNextNewMoon(date: Date): { date: Date; time: ReturnType<typeof MakeTime> } | null {
  const searchTime = MakeTime(date);
  const nm = SearchMoonPhase(0, searchTime, 40);
  if (!nm) return null;
  return { date: nm.date, time: nm };
}

/**
 * Get the actual synodic length between two new moons.
 * Determines MAT or ANM from the real sky.
 */
export function getActualSynodicLength(newMoon1: Date, newMoon2: Date): number {
  return (newMoon2.getTime() - newMoon1.getTime()) / (24 * 60 * 60 * 1000);
}

/* ───────────────────────────────────────────────────────────
   Coligny Month Indexing
   ─────────────────────────────────────────────────────────── */

/**
 * Get Coligny month index (0-11) from a new moon count.
 * Month 0 = Samonios (first month after epoch).
 */
export function getColignyMonthIndex(newMoonCount: number): number {
  // Ensure positive modulo
  const idx = ((newMoonCount % 12) + 12) % 12;
  return idx;
}

/* ───────────────────────────────────────────────────────────
   Year and Ciallos Tracking
   ─────────────────────────────────────────────────────────── */

/**
 * Get the Luna Sol Year number (years since epoch).
 */
export function getLunaSolYear(date: Date): number {
  return date.getUTCFullYear() - LS_EPOCH_YEAR_CE;
}

/**
 * Determine if a given year has Ciallos.
 * Ciallos appears every 3rd year (years 3, 6, 9, 12...).
 */
export function isCiallosYear(year: number): boolean {
  const lsYear = year - LS_EPOCH_YEAR_CE;
  if (lsYear <= 0) return false;
  return (lsYear % 3) === 0;
}

/**
 * Get position in the 3-year cycle (1, 2, or 3).
 */
export function getCyclePosition(year: number): number {
  const lsYear = year - LS_EPOCH_YEAR_CE;
  if (lsYear <= 0) return 1;
  return ((lsYear - 1) % 3) + 1;
}

/**
 * Count Ciallos insertions from epoch to a given date.
 * Ciallos appears every 3rd year (lsYear % 3 === 0).
 */
export function countCiallosUpToDate(date: Date): number {
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

/**
 * Get Ciallos info for a given year.
 */
export function getCiallosInfo(year: number) {
  const cyclePos = getCyclePosition(year);
  const active = cyclePos === 3;
  return {
    active,
    cyclePosition: cyclePos,
    yearInCycle: cyclePos,
    name: active ? "Ciallos" : "",
    meaning: active
      ? "The intercalary breath. 32 days + threshold. Luna and Sol realign."
      : "",
    fullDays: active ? 32 : 0,
    thresholdHours: active ? 15.0089109 : 0,
    totalDays: active ? 32.625371292 : 0,
  };
}

/* ───────────────────────────────────────────────────────────
   Moon Sign and Ray (Astronomical Truth)
   ─────────────────────────────────────────────────────────── */

const ZODIAC_SIGNS = [
  { name: "Aries", start: 0, ray: "Red", color: "#ef4444" },
  { name: "Taurus", start: 30, ray: "Orange", color: "#f97316" },
  { name: "Gemini", start: 60, ray: "Yellow", color: "#eab308" },
  { name: "Cancer", start: 90, ray: "Green", color: "#22c55e" },
  { name: "Leo", start: 120, ray: "Turquoise", color: "#2dd4bf" },
  { name: "Virgo", start: 150, ray: "Blue", color: "#3b82f6" },
  { name: "Libra", start: 180, ray: "Indigo", color: "#6366f1" },
  { name: "Scorpio", start: 210, ray: "Violet", color: "#8b5cf6" },
  { name: "Sagittarius", start: 240, ray: "Magenta", color: "#d946ef" },
  { name: "Capricorn", start: 270, ray: "Omni", color: "#fafafa" },
  { name: "Aquarius", start: 300, ray: "Elemental", color: "#a5f3fc" },
  { name: "Pisces", start: 330, ray: "ALL", color: "#7dd3fc" },
];

function zodiacSign(eclipticLon: number): { sign: string; ray: string; color: string } {
  const deg = ((eclipticLon % 360) + 360) % 360;
  for (let i = ZODIAC_SIGNS.length - 1; i >= 0; i--) {
    if (deg >= ZODIAC_SIGNS[i].start) {
      return {
        sign: ZODIAC_SIGNS[i].name,
        ray: ZODIAC_SIGNS[i].ray,
        color: ZODIAC_SIGNS[i].color,
      };
    }
  }
  return {
    sign: ZODIAC_SIGNS[0].name,
    ray: ZODIAC_SIGNS[0].ray,
    color: ZODIAC_SIGNS[0].color,
  };
}

/* ───────────────────────────────────────────────────────────
   Full Calendar Reading
   ─────────────────────────────────────────────────────────── */

export type ColignyReading = {
  year: number;
  lunaSolYear: number;
  month: ColignyMonth;
  monthType: MonthType;
  /** Day within current lunation (1-based) */
  day: number;
  /** Total synodic length of current month in days */
  synodicLength: number;
  ciallos: ReturnType<typeof getCiallosInfo>;
  /** Luna's actual zodiac sign (astronomical truth) */
  moonSign: string;
  /** Luna's actual Ray */
  moonRay: string;
  /** Luna's actual Ray color */
  moonColor: string;
  /** Luna's phase description */
  moonPhase: string;
  /** Luna's ecliptic longitude */
  moonEclipticLon: number;
  /** The new moon that started this lunation */
  lunationStart: Date;
  /** The next new moon (for synodic length) */
  nextNewMoon: Date | null;
  /** Number of new moons since the epoch */
  newMoonsSinceEpoch: number;
};

/**
 * Get the complete Coligny calendar reading for a date.
 * 
 * PRIMARY ENGINE: astronomy-engine
 * 1. Find the actual new moon that started the current lunation
 * 2. Count new moons from epoch to determine Coligny month
 * 3. Calculate actual synodic length for MAT/ANM
 * 4. Get actual moon sign and phase from astronomy-engine
 * 
 * Zero mean math. Real sky only.
 */
export function getColignyReading(date: Date): ColignyReading {
  const year = date.getUTCFullYear();
  const lsYear = getLunaSolYear(date);

  // Step 1: Find the new moon that started this lunation
  const currentNewMoon = findPreviousNewMoon(date);
  if (!currentNewMoon) {
    throw new Error("Could not find new moon for date");
  }

  // Step 2: Find the next new moon (for synodic length)
  const nextNewMoon = findNextNewMoon(date);

  // Step 3: Calculate actual synodic length
  const synodicLength = nextNewMoon
    ? getActualSynodicLength(currentNewMoon.date, nextNewMoon.date)
    : 29.53; // fallback (should never hit)

  // Step 4: Determine MAT/ANM from actual synodic length
  const monthType = determineMonthType(synodicLength);

  // Step 5: Count new moons from epoch to current
  // We use a reference-based approach: find new moons since anchor
  const anchorDate = getAnchorDate();
  const newMoonsSinceEpoch = countNewMoonsBetween(anchorDate, currentNewMoon.date);

  // Step 6: Subtract Ciallos insertions (every 3rd year) to keep 12-month sacred canon
  // Ciallos is a 13th month that heals drift but does NOT shift the 12-month cycle.
  // Without subtraction, the month index drifts by one every 3 years.
  const ciallosCount = countCiallosUpToDate(date);
  const adjustedCount = newMoonsSinceEpoch - ciallosCount;

  // Step 7: Get Coligny month index
  const monthIndex = getColignyMonthIndex(adjustedCount);
  const month = COLIGNY_MONTHS[monthIndex];

  // Step 7: Calculate day within lunation
  const day = Math.floor(
    (date.getTime() - currentNewMoon.date.getTime()) / (24 * 60 * 60 * 1000)
  ) + 1;

  // Step 8: Get actual moon sign using astronomy-engine
  const moonEcl = EclipticLongitude(Body.Moon, MakeTime(date));
  const moonLon = moonEcl;
  const moonSign = zodiacSign(moonLon);

  // Step 9: Moon phase
  const moonPhase = determineMoonPhase(day, synodicLength);

  // Step 10: Ciallos info
  const ciallos = getCiallosInfo(year);

  return {
    year,
    lunaSolYear: lsYear,
    month,
    monthType,
    day,
    synodicLength,
    ciallos,
    moonSign: moonSign.sign,
    moonRay: moonSign.ray,
    moonColor: moonSign.color,
    moonPhase,
    moonEclipticLon: moonLon,
    lunationStart: currentNewMoon.date,
    nextNewMoon: nextNewMoon?.date ?? null,
    newMoonsSinceEpoch,
  };
}

/**
 * Daily cache for countNewMoonsBetween to prevent O(n) searches every render tick.
 * The Coligny month only changes at most once per day, so we cache per calendar day.
 */
const _countCache = new Map<string, number>();

function getCacheKey(startDate: Date, endDate: Date): string {
  return `${startDate.toISOString().split("T")[0]}_${endDate.toISOString().split("T")[0]}`;
}

/**
 * Count new moons between two dates.
 * Uses astronomy-engine. Searches backward from endDate to startDate.
 * Caches result per calendar day to prevent lag on every tick.
 */
export function countNewMoonsBetween(startDate: Date, endDate: Date): number {
  const cacheKey = getCacheKey(startDate, endDate);
  const cached = _countCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let count = 0;
  let searchTime = MakeTime(endDate);
  const anchorTime = MakeTime(startDate);

  // From 5 CE to 2026 CE: ~2,021 years * 12.4 months/year = ~25,000 new moons
  const MAX_ITERATIONS = 50000;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const nm = SearchMoonPhase(0, searchTime, -40);
    if (!nm) break;

    if (nm.date.getTime() <= anchorTime.date.getTime()) {
      break;
    }

    count++;

    const nextDate = new Date(nm.date.getTime() - 24 * 60 * 60 * 1000);
    searchTime = MakeTime(nextDate);
  }

  _countCache.set(cacheKey, count);
  return count;
}

/**
 * Determine moon phase description from day in lunation.
 */
function determineMoonPhase(day: number, synodicLength: number): string {
  const fraction = (day - 1) / synodicLength;
  
  if (fraction < 0.03) return "New Moon — the dark between breaths";
  if (fraction < 0.22) return "Waxing Crescent — the first sliver of return";
  if (fraction < 0.28) return "First Quarter — Luna at the threshold of fullness";
  if (fraction < 0.47) return "Waxing Gibbous — swelling toward the full";
  if (fraction < 0.53) return "Full Moon — Luna unveiled, the mirror complete";
  if (fraction < 0.72) return "Waning Gibbous — the release begins";
  if (fraction < 0.78) return "Last Quarter — the turning point of diminishment";
  if (fraction < 0.97) return "Waning Crescent — the final breath before dark";
  return "Dark Moon — Luna rests between cycles";
}
