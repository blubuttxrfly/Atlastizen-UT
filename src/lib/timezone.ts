/**
 * Timezone helpers for birth-chart calculations.
 * Primary: tz-lookup (sync, offline, bundled IANA boundary data).
 * Fallback: longitude-based estimate.
 */

import tzLookup from "tz-lookup";

const GEO_TZ_API = "https://api.geo-tz.com/v1/timezone";

export type TimezoneDetection = {
  /** IANA timezone name, or null if we fell back to longitude estimate */
  zone: string | null;
  /** Human-readable label like "America/Indiana/Indianapolis (EST)" */
  label: string;
  /** Historically accurate offset in minutes from UTC (negative for West) */
  accurateOffsetMinutes: number;
  /** Standard-time offset in minutes from UTC (negative for West) */
  standardOffsetMinutes: number;
  /** Whether the accurate offset differs from standard (i.e. DST was in effect) */
  hasDst: boolean;
};

/**
 * Sync: look up timezone from lat/lon using bundled tz-lookup library.
 * Returns IANA zone name (e.g., "America/Indiana/Indianapolis") or null.
 */
function lookupZoneFromCoordinates(lat: number, lon: number): string | null {
  try {
    const zone = tzLookup(lat, lon);
    return typeof zone === "string" && zone.length > 0 ? zone : null;
  } catch {
    return null;
  }
}

/**
 * Sync: detect timezone from lat/lon using bundled tz-lookup + Intl API.
 * No network calls, no external API dependencies.
 * Falls back to longitude-based estimate only if tz-lookup fails.
 */
export function detectTimezoneSync(
  lat: number,
  lon: number,
  year: number,
  month: number, // 0-11
  day: number,
  hour: number = 12,
  minute: number = 0
): TimezoneDetection {
  const zone = lookupZoneFromCoordinates(lat, lon);
  if (!zone) return estimateTimezoneDetection(lon);

  const date = new Date(Date.UTC(year, month, day, hour, minute));
  const accurateOffsetMinutes = getOffsetMinutesForDate(zone, date);
  const standardOffsetMinutes = getStandardOffsetMinutes(zone, date);
  const label = formatTimezoneLabel(zone, accurateOffsetMinutes, standardOffsetMinutes);

  return {
    zone,
    label,
    accurateOffsetMinutes,
    standardOffsetMinutes,
    hasDst: accurateOffsetMinutes !== standardOffsetMinutes,
  };
}

/**
 * Get the UTC offset (in minutes) for a given IANA zone and date.
 * Uses Intl.DateTimeFormat with shortOffset.
 */
function getOffsetMinutesForDate(zone: string, date: Date): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    });
    const parts = fmt.formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (!tzPart) return 0;
    return parseGmtOffset(tzPart.value);
  } catch {
    return 0;
  }
}

/**
 * Parse a GMT offset string (e.g., "GMT-5", "GMT+5:30") into minutes.
 */
function parseGmtOffset(tzName: string): number {
  if (!tzName.startsWith("GMT")) return 0;
  const hours = parseFloat(tzName.slice(3));
  if (isNaN(hours)) return 0;
  return Math.round(hours * 60);
}

/**
 * Async: look up timezone offset from lat/lon.
 * Primary: tz-lookup (sync, bundled). Fallback: geo-tz API, then longitude estimate.
 */
export async function fetchTimezoneDetection(
  lat: number,
  lon: number,
  year: number,
  month: number, // 0-11
  day: number,
  hour: number = 12,
  minute: number = 0
): Promise<TimezoneDetection> {
  // Primary: use bundled tz-lookup (no network needed)
  const syncResult = detectTimezoneSync(lat, lon, year, month, day, hour, minute);
  if (syncResult.zone) return syncResult;

  // Fallback: try the external API (for edge cases where tz-lookup data is stale)
  const fallback = estimateTimezoneDetection(lon);
  try {
    const resp = await fetch(`${GEO_TZ_API}?lat=${lat}&lon=${lon}`);
    if (!resp.ok) throw new Error("geo-tz API failed");
    const data = await resp.json();
    const zone = data.timezone || data.tz;
    if (!zone) throw new Error("no timezone in response");

    const date = new Date(Date.UTC(year, month, day, hour, minute));
    const accurateOffsetMinutes = getOffsetMinutesForDate(zone, date);
    const standardOffsetMinutes = getStandardOffsetMinutes(zone, date);
    const label = formatTimezoneLabel(zone, accurateOffsetMinutes, standardOffsetMinutes);
    return {
      zone,
      label,
      accurateOffsetMinutes,
      standardOffsetMinutes,
      hasDst: accurateOffsetMinutes !== standardOffsetMinutes,
    };
  } catch {
    return fallback;
  }
}

/** Backwards-compatible wrapper: returns the accurate DST-aware offset. */
export async function fetchTimezoneOffset(
  lat: number,
  lon: number,
  year: number,
  month: number,
  day: number,
  hour: number = 12,
  minute: number = 0
): Promise<number> {
  const det = await fetchTimezoneDetection(lat, lon, year, month, day, hour, minute);
  return det.accurateOffsetMinutes;
}

/**
 * Sync: rough longitude-based timezone detection.
 * Each 15° of longitude ≈ 1 hour. Rounded to nearest hour.
 * Only used as last resort when tz-lookup and API both fail.
 */
export function estimateTimezoneDetection(lon: number): TimezoneDetection {
  const accurateOffsetMinutes = Math.round(lon / 15) * 60;
  return {
    zone: null,
    label: `Longitude estimate (${formatOffset(accurateOffsetMinutes)})`,
    accurateOffsetMinutes,
    standardOffsetMinutes: accurateOffsetMinutes,
    hasDst: false,
  };
}

/**
 * Sync: rough longitude-based timezone estimate.
 * Each 15° of longitude ≈ 1 hour. Rounded to nearest hour.
 *
 * @returns minutes offset from UTC (negative for West)
 */
export function estimateFromLongitude(lon: number): number {
  return estimateTimezoneDetection(lon).accurateOffsetMinutes;
}

/** Compute the standard-time offset for a given IANA zone and date. */
function getStandardOffsetMinutes(zone: string, date: Date): number {
  try {
    // January 1 of the same year is almost always in standard time for Northern Hemisphere zones.
    const standardProbe = new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 12, 0, 0));
    return getOffsetMinutesForDate(zone, standardProbe);
  } catch {
    // ignore
  }
  return 0;
}

function formatTimezoneLabel(
  zone: string,
  accurateOffsetMinutes: number,
  standardOffsetMinutes: number
): string {
  const parts = zone.split("/");
  const city = parts[parts.length - 1].replace(/_/g, " ");
  const short = formatOffset(accurateOffsetMinutes);
  if (accurateOffsetMinutes !== standardOffsetMinutes) {
    return `${city} (${short})`;
  }
  return `${city} (${short}, standard)`;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "UTC-" : "UTC+";
  const h = Math.abs(Math.floor(minutes / 60));
  const m = Math.abs(minutes % 60);
  return m === 0 ? `${sign}${h}` : `${sign}${h}:${m.toString().padStart(2, "0")}`;
}