import {
  Body,
  Equator,
  Horizon,
  MakeTime,
  Observer,
  SearchHourAngle,
  SearchRiseSet,
  type HorizontalCoordinates,
} from "astronomy-engine";

export type SolTrackPoint = { ts: Date; alt: number; az: number };

export type SolNow = {
  decDeg: number;
  altDeg: number;
  azDeg: number;
  rise?: Date;
  set?: Date;
  transit?: Date;
  transitAltDeg?: number;
  track: SolTrackPoint[];
};

function extractRiseSet(
  observer: Observer,
  start: Date,
  direction: 1 | -1
): Date | undefined {
  const result = SearchRiseSet(Body.Sun, observer, direction, MakeTime(start), 2);
  return result?.date;
}

function computeTransit(
  observer: Observer,
  start: Date
): { date?: Date; altitude?: number } {
  try {
    const event = SearchHourAngle(Body.Sun, observer, 0, MakeTime(start), +1);
    const date = event.time?.date;
    // Explicit guard — avoids silent runtime type mismatches
    const hor = event.hor as HorizontalCoordinates | undefined;
    const altitude = typeof hor?.altitude === "number" ? hor.altitude : undefined;
    return { date, altitude };
  } catch {
    return {};
  }
}

export const SolProvider = {
  now(lat: number, lon: number, date = new Date()): SolNow {
    const observer = new Observer(lat, lon, 0);
    const time = MakeTime(date);

    const eq = Equator(Body.Sun, time, observer, true, true);
    const horizonNow = Horizon(time, observer, eq.ra, eq.dec, "normal");

    // FIX: use UTC midnight so SearchRiseSet / SearchHourAngle always
    // search from a consistent anchor regardless of device timezone.
    // Previously setHours(0,0,0,0) used local-device midnight, which
    // misaligned the search window for any UTC-offset location and
    // produced wrong rise / transit / set times in the Sol Panel.
    const dayStart = startOfDayUTC(date);

    const rise = extractRiseSet(observer, dayStart, +1);
    const set  = extractRiseSet(observer, dayStart, -1);
    const { date: transit, altitude: transitAltDeg } = computeTransit(observer, dayStart);

    const track: SolTrackPoint[] = [];
    for (let minutes = 0; minutes <= 24 * 60; minutes += 5) {
      const tick = new Date(dayStart.getTime() + minutes * 60_000);
      const tickTime = MakeTime(tick);
      const eqTick = Equator(Body.Sun, tickTime, observer, true, true);
      const horiz = Horizon(tickTime, observer, eqTick.ra, eqTick.dec, "normal");
      track.push({ ts: tick, alt: horiz.altitude, az: horiz.azimuth });
    }

    return {
      decDeg: eq.dec,
      altDeg: horizonNow.altitude,
      azDeg: horizonNow.azimuth,
      rise,
      set,
      transit,
      transitAltDeg,
      track,
    };
  },
};

/**
 * Returns UTC midnight of the given date.
 * This keeps all astronomy-engine searches aligned with the same
 * UTC-day anchor that computeAUT uses in index.tsx.
 */
function startOfDayUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}
