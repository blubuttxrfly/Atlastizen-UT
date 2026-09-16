import * as Astronomy from "astronomy-engine";
import { buildChart, zodiacFromLongitude } from "./extendedChart";
import type { ExtendedChartData, ZodiacPlacement } from "./extendedChart";

function wrapAngle(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
}

function apparentLST(date: Date, lonDeg: number): number {
  const time = Astronomy.MakeTime(date);
  const d = time.tt;
  const gmst = wrapAngle(280.46061837 + 360.98564736629 * d);
  return wrapAngle(gmst + lonDeg);
}

function obliquity(date: Date): number {
  const time = Astronomy.MakeTime(date);
  const T = time.tt / 36525.0;
  return 23.439291111
    - 0.013004167 * T
    - 1.63889e-7 * T * T
    + 5.03611e-7 * T * T * T;
}

/**
 * Compute the zenith zodiac sign — the constellation directly overhead.
 *
 * The zenith in equatorial coordinates is:
 *   Right Ascension = Local Sidereal Time
 *   Declination     = observer latitude
 *
 * We convert (RA, Dec) to ecliptic longitude to find the zodiac sign.
 * This rotates through all 12 signs every ~24 hours.
 * At solar noon it IS near the Sun sign.
 * At midnight it IS near the anti-solar sign.
 */
export function computeZenith(date: Date, lat: number, lon: number): ZodiacPlacement {
  const lst = apparentLST(date, lon);
  const obl = obliquity(date);

  // Zenith equatorial coordinates
  const raDeg = lst;   // RA = LST
  const decDeg = lat;  // Dec = observer latitude

  // Convert equatorial (RA, Dec) → ecliptic longitude
  const raRad = (raDeg * Math.PI) / 180;
  const decRad = (decDeg * Math.PI) / 180;
  const oblRad = (obl * Math.PI) / 180;

  const sinLon = Math.sin(raRad) * Math.cos(oblRad) + Math.tan(decRad) * Math.sin(oblRad);
  const cosLon = Math.cos(raRad);

  let lonDeg = (Math.atan2(sinLon, cosLon) * 180) / Math.PI;
  lonDeg = wrapAngle(lonDeg);

  return zodiacFromLongitude(lonDeg);
}

/**
 * Compute the four local sky angles for the current moment.
 */
export function computeLiveAlignments(lat: number, lon: number, now: Date): ExtendedChartData {
  return buildChart(now, lat, lon);
}

/**
 * Compute local sky angles at sunrise.
 * The Descendant at sunrise is the Gaia-facing angle at dawn.
 */
export function computeDawnAlignment(lat: number, lon: number, sunriseDate: Date): ExtendedChartData {
  return buildChart(sunriseDate, lat, lon);
}

/**
 * Compute local sky angles at sunset.
 * The Ascendant at sunset is the Gaia-facing angle at dusk.
 */
export function computeDuskAlignment(lat: number, lon: number, sunsetDate: Date): ExtendedChartData {
  return buildChart(sunsetDate, lat, lon);
}
