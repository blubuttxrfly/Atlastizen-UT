/**
 * Timezone helpers for birth-chart calculations.
 * Sync longitude estimate + async HTTP lookup via api.geo-tz.com.
 */

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
 * Async: look up timezone offset from lat/lon via HTTP API.
 * Falls back to longitude-based estimate on failure.
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
  const fallback = estimateTimezoneDetection(lon);
  try {
    const resp = await fetch(`${GEO_TZ_API}?lat=${lat}&lon=${lon}`);
    if (!resp.ok) throw new Error("geo-tz API failed");
    const data = await resp.json();
    const zone = data.timezone || data.tz;
    if (!zone) throw new Error("no timezone in response");

    const date = new Date(Date.UTC(year, month, day, hour, minute));
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    });
    const parts = fmt.formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (!tzPart) return fallback;

    const tzName = tzPart.value; // e.g. "GMT-5"
    let accurateOffsetMinutes = fallback.accurateOffsetMinutes;
    if (tzName.startsWith("GMT")) {
      const hours = parseFloat(tzName.slice(3));
      if (!isNaN(hours)) accurateOffsetMinutes = Math.round(hours * 60);
    }

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
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    });
    const parts = fmt.formatToParts(standardProbe);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (!tzPart) return 0;
    const tzName = tzPart.value;
    if (tzName.startsWith("GMT")) {
      const hours = parseFloat(tzName.slice(3));
      if (!isNaN(hours)) return Math.round(hours * 60);
    }
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
