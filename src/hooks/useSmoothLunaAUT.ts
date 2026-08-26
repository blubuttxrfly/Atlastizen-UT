import { useEffect, useRef, useState } from "react";

import { SYNODIC_MONTH_DAYS } from "../config/autDate";

// ── Sacred formatting helpers ────────────────────────────────────────────────
function pad(x: number): string {
  return x.toString().padStart(2, "0");
}

function format24Clock(hhFloat: number): string {
  // Luna AUT uses a 24-hour dial: 0..24 wrapping back to 0.
  const totalMin = (((hhFloat % 24) + 24) % 24) * 60;
  const h = Math.floor(totalMin / 60);
  const m = Math.floor(totalMin % 60);
  const s = Math.floor((totalMin * 60) % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * useSmoothLunaAUT
 *
 * A silky, continuous Luna AUT clock synchronized to the Moon's synodic cycle.
 *
 * Sacred math:
 *   • One synodic month = 29.530588853 real days.
 *   • Mapped to 24 Luna AUT hours (0 → New Moon, 12 → Full Moon, 24 → Next New Moon).
 *   • 1 Luna AUT hour  = ~1.230 real days (~29.5 real hours).
 *   • 1 Luna AUT minute = ~1.23 real hours.
 *   • 1 Luna AUT second = ~74 real seconds.
 *
 * The phaseAngle (0..360°) from astronomy-engine is the sacred anchor.
 * It wraps continuously from 0° (New Moon) through 180° (Full Moon)
 * to 360° (Next New Moon).  We convert this to Luna AUT hours once
 * per real second, then interpolate between ticks with requestAnimationFrame
 * so the digits drift like water.
 */
export function useSmoothLunaAUT(phaseAngle: number): string {
  // Seed once on mount.
  const [smoothClock, setSmoothClock] = useState(() =>
    format24Clock((phaseAngle / 360) * 24)
  );

  const phaseRef = useRef(phaseAngle);
  const anchorTimeRef = useRef(Date.now());

  // Update anchor when the discrete phase angle changes (new second).
  useEffect(() => {
    const changed = phaseRef.current !== phaseAngle;
    if (!changed) return;

    phaseRef.current = phaseAngle;
    anchorTimeRef.current = Date.now();

    setSmoothClock(format24Clock((phaseAngle / 360) * 24));
  }, [phaseAngle]);

  useEffect(() => {
    let raf: number;

    function tick() {
      const elapsedMs = Date.now() - anchorTimeRef.current;

      // One synodic month in ms, mapped to 24 Luna AUT hours.
      const synodicMs = SYNODIC_MONTH_DAYS * 24 * 60 * 60 * 1000;
      const lunaHoursPerMs = 24 / synodicMs;

      let smoothHours = (phaseRef.current / 360) * 24 + elapsedMs * lunaHoursPerMs;

      // Wrap into the eternal 0..24 wheel.
      const wrapped = ((smoothHours % 24) + 24) % 24;
      setSmoothClock(format24Clock(wrapped));

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return smoothClock;
}
