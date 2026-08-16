import { useEffect, useRef, useState } from "react";

// ── Sacred formatting helpers ────────────────────────────────────────────────
function minutesToHHMMSS(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  const s = Math.floor((mins * 60) % 60);
  const pad = (x: number) => x.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatClock(hhFloat: number): string {
  const totalMin = (((hhFloat % 12) + 12) % 12) * 60;
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
 * Note: autHours and cycleLenMin are passed as separate primitives so React can
 * compare them stably.  Passing an inline object would recreate the reference
 * on every parent render and break the smooth flow.
 */
export function useSmoothAUT(autHours: number, cycleLenMin: number): string {
  // Seed once on mount so the first frame is never blank.
  const [smoothClock, setSmoothClock] = useState(() => formatClock(autHours));

  const autHoursRef = useRef(autHours);
  const cycleLenRef = useRef(cycleLenMin);
  const anchorTimeRef = useRef(Date.now());

  // Update refs and anchor when the discrete AUT value changes (new second),
  // but do NOT thrash when the parent re-renders for unrelated reasons.
  useEffect(() => {
    const hoursChanged = autHoursRef.current !== autHours;
    const cycleChanged = cycleLenRef.current !== cycleLenMin;
    if (!hoursChanged && !cycleChanged) return;

    autHoursRef.current = autHours;
    cycleLenRef.current = cycleLenMin;
    anchorTimeRef.current = Date.now();

    // Snap to the new exact discrete base so the next interpolation starts
    // from the true sacred anchor, not a drifting phantom.
    setSmoothClock(formatClock(autHours));
  }, [autHours, cycleLenMin]);

  useEffect(() => {
    let raf: number;

    function tick() {
      const nowMs = Date.now();
      const elapsedMs = nowMs - anchorTimeRef.current;

      // Rate: 12 AUT hours span the full sunrise-to-sunrise cycle.
      // cycleLenMin tells us how many real minutes that full cycle truly lasts.
      const cycleLenMs = cycleLenRef.current * 60_000;
      const autHoursPerMs = 12 / cycleLenMs;

      let smoothHours = autHoursRef.current + elapsedMs * autHoursPerMs;

      // Wrap into the eternal 0..12 wheel
      const wrapped = ((smoothHours % 12) + 12) % 12;
      setSmoothClock(formatClock(wrapped));

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return smoothClock;
}
