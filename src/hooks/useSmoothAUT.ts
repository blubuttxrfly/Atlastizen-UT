import { useEffect, useRef, useState } from "react";

// ── Sacred formatting helpers ────────────────────────────────────────────────
function minutesToHHMMSS(mins: number): string {
  const total = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = Math.floor(total % 60);
  const s = Math.floor((total * 60) % 60);
  const pad = (x: number) => x.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatClock(hhFloat: number): string {
  const totalMin = (((hhFloat % 24) + 24) % 24) * 60;
  return minutesToHHMMSS(totalMin);
}

/**
 * useSmoothAUT
 *
 * Wraps the once-per-second AUT snapshot in a silky, continuous display.
 *
 * The sacred math is untouched: computeAUT() remains the single source of truth,
 * called once per real second by the main app. This hook merely interpolates
 * between those anchors so the digits drift like water, revealing the living
 * breath of the Sun — slower, luxurious seconds in long summer days; quicker,
 * urgent seconds in brief winter ones.
 *
 * Note: autHours and segLenMin are passed as separate primitives so React can
 * compare them stably.  Passing an inline object would recreate the reference
 * on every parent render and break the smooth flow.
 */
export function useSmoothAUT(autHours: number, segLenMin: number): string {
  // Seed once on mount so the first frame is never blank.
  const [smoothClock, setSmoothClock] = useState(() => formatClock(autHours));

  const autHoursRef = useRef(autHours);
  const segLenRef = useRef(segLenMin);
  const anchorTimeRef = useRef(Date.now());

  // Update refs and anchor when the discrete AUT value changes (new second),
  // but do NOT thrash when the parent re-renders for unrelated reasons.
  useEffect(() => {
    const hoursChanged = autHoursRef.current !== autHours;
    const segChanged = segLenRef.current !== segLenMin;
    if (!hoursChanged && !segChanged) return;

    autHoursRef.current = autHours;
    segLenRef.current = segLenMin;
    anchorTimeRef.current = Date.now();

    // Snap to the new exact discrete base so the next interpolation starts
    // from the true sacred anchor, not a drifting phantom.
    setSmoothClock(formatClock(autHours));
  }, [autHours, segLenMin]);

  useEffect(() => {
    let raf: number;

    function tick() {
      const nowMs = Date.now();
      const elapsedMs = nowMs - anchorTimeRef.current;

      // Rate: 12 AUT hours span the current segment.
      // segLenMin tells us how many real minutes that segment truly lasts.
      const segmentLenMs = segLenRef.current * 60_000;
      const autHoursPerMs = 12 / segmentLenMs;

      let smoothHours = autHoursRef.current + elapsedMs * autHoursPerMs;

      // Wrap into the eternal 0..24 wheel
      const wrapped = ((smoothHours % 24) + 24) % 24;
      setSmoothClock(formatClock(wrapped));

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return smoothClock;
}
