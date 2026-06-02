/**
 * Timezone helpers for birth-chart calculations.
 * Sync longitude estimate + async HTTP lookup via api.geo-tz.com.
 */

const GEO_TZ_API = "https://api.geo-tz.com/v1/timezone";

/**
 * Async: look up timezone offset from lat/lon via HTTP API.
 * Falls back to longitude-based estimate on failure.
 *
 * @returns minutes offset from UTC (negative for West)
 */
export async function fetchTimezoneOffset(
  lat: number,
  lon: number,
  year: number,
  month: number, // 0-11
  day: number,
  hour: number = 12,
  minute: number = 0
): Promise<number> {
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
    if (!tzPart) return estimateFromLongitude(lon);

    const tzName = tzPart.value; // e.g., "GMT-5"
    if (tzName.startsWith("GMT")) {
      const hours = parseFloat(tzName.slice(3));
      if (!isNaN(hours)) return Math.round(hours * 60);
    }
    return estimateFromLongitude(lon);
  } catch {
    return estimateFromLongitude(lon);
  }
}

/**
 * Sync: rough longitude-based timezone estimate.
 * Each 15° of longitude ≈ 1 hour. Rounded to nearest hour.
 *
 * @returns minutes offset from UTC (negative for West)
 */
export function estimateFromLongitude(lon: number): number {
  return Math.round(lon / 15) * 60;
}
