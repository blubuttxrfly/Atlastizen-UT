/** Extended Chart calculator — Ascendant, Houses, Solar Return
 *  Built to integrate with the upstream Solar Return profile system
 *  Uses astronomy-engine for all astronomical calculations
 */
import * as Astronomy from "astronomy-engine";

/* ── Zodiac / Ray data (mirrors AtlasCometMap) ─────────────────────────── */
export const ZODIAC_SIGNS = [
  { name: "Aries",     symbol: "♈︎" },
  { name: "Taurus",    symbol: "♉︎" },
  { name: "Gemini",    symbol: "♊︎" },
  { name: "Cancer",    symbol: "♋︎" },
  { name: "Leo",       symbol: "♌︎" },
  { name: "Virgo",     symbol: "♍︎" },
  { name: "Libra",     symbol: "♎︎" },
  { name: "Scorpio",   symbol: "♏︎" },
  { name: "Sagittarius", symbol: "♐︎" },
  { name: "Capricorn", symbol: "♑︎" },
  { name: "Aquarius",  symbol: "♒︎" },
  { name: "Pisces",    symbol: "♓︎" },
] as const;

export const ZODIAC_HUES = [
  "#ef4444", // 0  Aries     — Red
  "#f97316", // 1  Taurus    — Orange
  "#facc15", // 2  Gemini    — Yellow
  "#22c55e", // 3  Cancer    — Green
  "#2dd4bf", // 4  Leo       — Turquoise
  "#3b82f6", // 5  Virgo     — Blue
  "#6366f1", // 6  Libra     — Indigo
  "#8b5cf6", // 7  Scorpio   — Violet
  "#d946ef", // 8  Sagittarius — Magenta
  "#0f0a0a", // 9  Capricorn — Omni / Carbon
  "#a5f3fc", // 10 Aquarius  — Elemental
  "#7dd3fc", // 11 Pisces    — Infinite of ALL
] as const;

export const ZODIAC_RAY_NAMES = [
  "Red Ray",
  "Orange Ray",
  "Yellow Ray",
  "Green Ray",
  "Turquoise Ray",
  "Blue Ray",
  "Indigo Ray",
  "Violet Ray",
  "Magenta Ray",
  "Omni / Carbon Ray",
  "Elemental Ray",
  "Infinite of ALL Ray",
] as const;

export const ZODIAC_RAY_ESSENCE = [
  "Initiation • courage • first-breath action",
  "Sensory stability • value • embodiment",
  "Curiosity • cognition • language • connection",
  "Nurture • belonging • home-field devotion",
  "Radiance • heart-expression • creative fire",
  "Refinement • sacred craft • healing precision",
  "Discernment • harmony • relational truth",
  "Depth • transmutation • shadow alchemy",
  "Expansion • meaning • horizon-seeking",
  "Structure • legacy • sovereign discipline",
  "Future codes • networks • innovation",
  "Mysticism • compassion • unity consciousness",
] as const;

export const HOUSE_THEMES = [
  "Identity, Appearance",
  "Resources, Value",
  "Communication, Siblings",
  "Home, Roots, Lineage",
  "Creativity, Children, Joy",
  "Health, Routines, Service",
  "Partnerships, Marriage",
  "Transformation, Shared Resources",
  "Higher Learning, Travel, Faith",
  "Career, Public Standing",
  "Community, Hopes, Friends",
  "Retreat, Unconscious, Release",
] as const;

/* ── Types ─────────────────────────────────────────────────────────────── */
export type ZodiacPlacement = {
  signIndex: number;
  signName: string;
  signSymbol: string;
  degrees: number;
  minutes: number;
  longitude: number;
};

export type ChartAngle = ZodiacPlacement & { angleName: string };

export type House = {
  houseNumber: number;
  theme: string;
  cusp: ZodiacPlacement;
  rayName: string;
  rayColor: string;
  rayEssence: string;
};

export type ExtendedChartData = {
  ascendant: ChartAngle;
  descendant: ChartAngle;
  midheaven: ChartAngle;
  ic: ChartAngle;
  houses: House[];
  sun: ZodiacPlacement;
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

/** Convert a decimal degree to sign + deg + min  */
export function zodiacFromLongitude(lon: number): ZodiacPlacement {
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
    signIndex,
    signName: sign.name,
    signSymbol: sign.symbol,
    degrees: degInt,
    minutes,
    longitude: normalized,
  };
}

function wrapAngle(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
}

/* ── Sidereal time (sufficiently precise for whole-sign houses) ──────────── */
function apparentLST(date: Date, lonDeg: number): number {
  const time = Astronomy.MakeTime(date);
  const d = time.tt; // already days since J2000.0
  const gmst = wrapAngle(280.46061837 + 360.98564736629 * d);
  return wrapAngle(gmst + lonDeg); // East positive
}

function obliquity(date: Date): number {
  const time = Astronomy.MakeTime(date);
  const T = time.tt / 36525.0;
  return 23.439291111
    - 0.013004167 * T
    - 1.63889e-7 * T * T
    + 5.03611e-7 * T * T * T;
}

/* ── Chart angles ─────────────────────────────────────────────────────────── */
function ascendantLon(latDeg: number, lstDeg: number, oblDeg: number): number {
  const lst = (lstDeg * Math.PI) / 180;
  const lat = (latDeg * Math.PI) / 180;
  const obl = (oblDeg * Math.PI) / 180;
  const y = Math.cos(lst);
  const x = -(Math.sin(lst) * Math.cos(obl) + Math.tan(lat) * Math.sin(obl));
  return wrapAngle((Math.atan2(y, x) * 180) / Math.PI);
}

function midheavenLon(lstDeg: number, oblDeg: number): number {
  const lst = (lstDeg * Math.PI) / 180;
  const obl = (oblDeg * Math.PI) / 180;
  const y = Math.tan(lst);
  const x = Math.cos(obl);
  return wrapAngle((Math.atan2(y, x) * 180) / Math.PI);
}

/** Build a full Extended Chart for any moment + location  */
export function buildChart(date: Date, lat: number, lon: number): ExtendedChartData {
  const lst = apparentLST(date, lon);
  const obl = obliquity(date);

  const asc = ascendantLon(lat, lst, obl);
  const desc = wrapAngle(asc + 180);
  const mc = midheavenLon(lst, obl);
  const ic = wrapAngle(mc + 180);

  const observer = new Astronomy.Observer(lat, lon, 0);
  const sunEq = Astronomy.Equator(
    Astronomy.Body.Sun,
    Astronomy.MakeTime(date),
    observer,
    true,
    true
  );
  const sunEcl = Astronomy.Ecliptic(sunEq.vec);
  const sunLon = wrapAngle(sunEcl.elon);

  // Whole Sign Houses: House 1 = Ascendant sign
  const h1Sign = zodiacFromLongitude(asc).signIndex;
  const houses: House[] = Array.from({ length: 12 }, (_, i) => {
    const signIdx = (h1Sign + i) % 12;
    const cusp = zodiacFromLongitude(signIdx * 30);
    return {
      houseNumber: i + 1,
      theme: HOUSE_THEMES[i],
      cusp,
      rayName: ZODIAC_RAY_NAMES[signIdx],
      rayColor: ZODIAC_HUES[signIdx],
      rayEssence: ZODIAC_RAY_ESSENCE[signIdx],
    };
  });

  // Re-assign cusp to match actual asc degree for House 1
  const ascZod = zodiacFromLongitude(asc);
  houses[0] = { ...houses[0], cusp: ascZod };

  return {
    ascendant: { angleName: "Ascendant", ...ascZod },
    descendant: { angleName: "Descendant", ...zodiacFromLongitude(desc) },
    midheaven: { angleName: "Midheaven", ...zodiacFromLongitude(mc) },
    ic: { angleName: "IC", ...zodiacFromLongitude(ic) },
    houses,
    sun: zodiacFromLongitude(sunLon),
  };
}

/** Build chart for "right now" at a given location  */
export function buildLiveChart(lat: number, lon: number): ExtendedChartData {
  return buildChart(new Date(), lat, lon);
}

/** Build a UTC Date from local birth time + timezone offset (minutes from UTC) */
export function makeBirthDateUTC(
  year: number,
  month: number,   // 0-11
  day: number,
  hour: number,    // 0-23 local time
  minute: number,  // 0-59
  timezoneOffset: number = 0 // minutes from UTC (negative for West)
): Date {
  // Convert local time to UTC by adding offset (e.g., EST = -300, so UTC = local + 5h)
  const localMinutes = hour * 60 + minute;
  const utcMinutes = localMinutes - timezoneOffset; // subtract negative = add
  const utcHour = Math.floor(utcMinutes / 60);
  const utcMinute = utcMinutes % 60;
  return new Date(Date.UTC(year, month, day, utcHour, utcMinute, 0));
}

/** Build chart for a Solar Return profile (month 0-11) with timezone awareness  */
export function buildNatalChart(
  month: number,   // 0-11
  day: number,     // 1-31
  year: number,
  hour: number,    // 0-23
  minute: number,  // 0-59
  lat: number,
  lon: number,
  timezoneOffset: number = 0
): ExtendedChartData {
  const date = makeBirthDateUTC(year, month, day, hour, minute, timezoneOffset);
  return buildChart(date, lat, lon);
}

/** Find solar-return moment for a given target year.
 *  Returns the date when Sun returns to natal longitude.
 */
export function findSolarReturnMoment(
  natalMonth: number,
  natalDay: number,
  natalYear: number,
  natalHour: number,
  natalMinute: number,
  lat: number,
  lon: number,
  targetYear: number,
  timezoneOffset: number = 0
): Date | null {
  // Natal Sun longitude (use UTC-corrected birth time)
  const natal = makeBirthDateUTC(natalYear, natalMonth, natalDay, natalHour, natalMinute, timezoneOffset);
  const observer = new Astronomy.Observer(lat, lon, 0);
  const natalEq = Astronomy.Equator(
    Astronomy.Body.Sun,
    Astronomy.MakeTime(natal),
    observer,
    true,
    true
  );
  const natalEcl = Astronomy.Ecliptic(natalEq.vec);
  const natalLon = wrapAngle(natalEcl.elon);

  // Search target year: Jan 1 → Dec 31
  const start = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0));
  const end = new Date(Date.UTC(targetYear + 1, 0, 1, 0, 0, 0));
  let best: Date | null = null;
  let bestDiff = Infinity;

  for (let t = start.getTime(); t < end.getTime(); t += 3600_000) {
    const d = new Date(t);
    const eq = Astronomy.Equator(Astronomy.Body.Sun, Astronomy.MakeTime(d), observer, true, true);
    const ecl = Astronomy.Ecliptic(eq.vec);
    const lon = wrapAngle(ecl.elon);
    const diff = Math.min(
      Math.abs(lon - natalLon),
      Math.abs(lon - natalLon - 360),
      Math.abs(lon - natalLon + 360)
    );
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d;
    }
    if (diff < 0.001) break;
  }

  if (!best) return null;

  // Fine-tune ±1 hour at 1-minute resolution
  const fineStart = new Date(best.getTime() - 3600_000);
  const fineEnd = new Date(best.getTime() + 3600_000);
  bestDiff = Infinity;
  for (let t = fineStart.getTime(); t <= fineEnd.getTime(); t += 60_000) {
    const d = new Date(t);
    const eq = Astronomy.Equator(Astronomy.Body.Sun, Astronomy.MakeTime(d), observer, true, true);
    const ecl = Astronomy.Ecliptic(eq.vec);
    const lon = wrapAngle(ecl.elon);
    const diff = Math.min(
      Math.abs(lon - natalLon),
      Math.abs(lon - natalLon - 360),
      Math.abs(lon - natalLon + 360)
    );
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d;
    }
  }

  return best;
}
