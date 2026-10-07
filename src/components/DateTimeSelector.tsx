/* ── Date/Time Selector with Now + Set buttons ──
   Shared across Luna, Sol, and Gaia Ray Dials.
   Uses pendingDate for editing, Set commits to dialDate, Now snaps to now.
   When displayTimeZone is provided, formats date/time in that IANA zone. */

import type { ReactNode } from "react";

type Props = {
  pendingDate: Date;
  onPendingChange: (date: Date) => void;
  onSet: () => void;
  onCurrent: () => void;
  /** IANA timezone name for display formatting (e.g., "America/Indiana/Indianapolis").
   *  When provided, the date/time inputs show in this timezone instead of the browser's. */
  displayTimeZone?: string;
  /** Optional node rendered inline right after the Set button (e.g., the 💫 Gaia Birth button). */
  trailing?: ReactNode;
};

function formatDateForInput(date: Date, timeZone?: string) {
  if (timeZone) {
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      // en-CA gives YYYY-MM-DD format
      return fmt.format(date);
    } catch {
      // fall through to default
    }
  }
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function formatTimeForInput(date: Date, timeZone?: string) {
  if (timeZone) {
    try {
      const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const parts = fmt.formatToParts(date);
      const h = parts.find((p) => p.type === "hour")?.value ?? "0";
      const m = parts.find((p) => p.type === "minute")?.value ?? "0";
      return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    } catch {
      // fall through to default
    }
  }
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${min}`;
}

/** Parse a date string and time string in a given timezone,
 *  producing a UTC Date that represents the same wall-clock instant. */
function parseDateTimeInZone(dateStr: string, timeStr: string, timeZone?: string, fallbackDate?: Date): Date {
  if (timeZone) {
    try {
      // Use Intl to find the offset for the date in the target timezone,
      // then construct the UTC date manually.
      const [y, m, d] = dateStr.split("-").map(Number);
      const [h, min] = timeStr.split(":").map(Number);
      // Create a probe date at noon UTC (avoid midnight DST edge cases)
      const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "shortOffset",
      });
      const parts = fmt.formatToParts(probe);
      const tzPart = parts.find((p) => p.type === "timeZoneName");
      if (tzPart && tzPart.value.startsWith("GMT")) {
        const offsetHours = parseFloat(tzPart.value.slice(3));
        const offsetMin = Math.round(offsetHours * 60);
        // UTC = local - offset (offset is negative for west)
        const localMinutes = h * 60 + min;
        const utcMinutes = localMinutes - offsetMin;
        const utcHour = Math.floor(utcMinutes / 60);
        const utcMinute = utcMinutes % 60;
        // Handle day rollover
        let dayOffset = 0;
        let finalHour = utcHour;
        if (utcHour < 0) {
          finalHour = utcHour + 24;
          dayOffset = -1;
        } else if (utcHour >= 24) {
          finalHour = utcHour - 24;
          dayOffset = 1;
        }
        return new Date(Date.UTC(y, m - 1, d + dayOffset, finalHour, utcMinute, 0));
      }
    } catch {
      // fall through to default
    }
  }
  // Default: browser timezone
  const newDate = new Date(fallbackDate ?? new Date());
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  newDate.setFullYear(y, m - 1, d);
  newDate.setHours(h, min, 0, 0);
  return newDate;
}

export function DateTimeSelector({ pendingDate, onPendingChange, onSet, onCurrent, displayTimeZone, trailing }: Props) {
  const tz = displayTimeZone;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {/* Date picker — native input, directly clickable */}
      <input
        type="date"
        value={formatDateForInput(pendingDate, tz)}
        onChange={(e) => {
          if (!e.target.value) return;
          const timeStr = formatTimeForInput(pendingDate, tz);
          const newDate = parseDateTimeInZone(e.target.value, timeStr, tz, pendingDate);
          onPendingChange(newDate);
        }}
        className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900/60 px-1.5 py-1 text-xs text-zinc-300 cursor-pointer"
      />
      {/* Time picker */}
      <input
        type="time"
        value={formatTimeForInput(pendingDate, tz)}
        onChange={(e) => {
          if (!e.target.value) return;
          const dateStr = formatDateForInput(pendingDate, tz);
          const newDate = parseDateTimeInZone(dateStr, e.target.value, tz, pendingDate);
          onPendingChange(newDate);
        }}
        className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900/60 px-1.5 py-1 text-xs text-zinc-300 cursor-pointer"
      />
      {/* Now + Set + trailing (💫 Gaia Birth) — grouped so they stay together on any screen */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onCurrent}
          className="rounded-lg border border-cyan-600/40 bg-cyan-500/10 px-1.5 py-1 text-xs text-cyan-200 transition hover:bg-cyan-500/20"
          title="Reset to current live time"
        >
          Now
        </button>
        <button
          type="button"
          onClick={onSet}
          className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-1.5 py-1 text-xs text-amber-200 transition hover:bg-amber-500/20"
          title="Apply selected date and time to the Ray Dial"
        >
          Set
        </button>
        {trailing}
      </div>
    </div>
  );
}