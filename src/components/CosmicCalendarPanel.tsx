import {
  COSMIC_CALENDAR_TIMELINE,
  COSMIC_ORIGIN_LABEL,
  COSMIC_PRESENT_AUT_YEAR,
  type CosmicCalendarLayer,
  type CosmicCalendarTimelineEntry,
} from "../data/cosmicCalendar";

const LAYER_LABELS: Record<CosmicCalendarLayer, string> = {
  cosmos: "Universe",
  galaxy: "Galaxy",
  star: "Star",
  planet: "Planet",
  life: "Life",
};

const LAYER_BADGES: Record<CosmicCalendarLayer, string> = {
  cosmos: "bg-indigo-500/15 border-indigo-300/40 text-indigo-100",
  galaxy: "bg-fuchsia-500/15 border-fuchsia-300/40 text-fuchsia-100",
  star: "bg-amber-500/15 border-amber-300/40 text-amber-100",
  planet: "bg-emerald-500/15 border-emerald-300/40 text-emerald-100",
  life: "bg-cyan-500/15 border-cyan-300/40 text-cyan-100",
};

function formatWhole(value: number): string {
  return value.toLocaleString("en-US");
}

export type CosmicCalendarPanelProps = {
  entries?: CosmicCalendarTimelineEntry[];
  originLabel?: string;
  presentAutYear?: number;
  autClock?: string;
  autDateLabel?: string;
  autEarthSolarCyclesLabel?: string;
  autLunarCyclesLabel?: string;
  localTimeLabel?: string;
  localDateLabel?: string;
  locationLabel?: string;
};

export function CosmicCalendarPanel({
  entries = COSMIC_CALENDAR_TIMELINE,
  originLabel = COSMIC_ORIGIN_LABEL,
  presentAutYear = COSMIC_PRESENT_AUT_YEAR,
  autClock,
  autDateLabel,
  autEarthSolarCyclesLabel,
  autLunarCyclesLabel,
  localTimeLabel,
  localDateLabel,
  locationLabel,
}: CosmicCalendarPanelProps) {
  const timeline = [...entries].sort((a, b) => a.sinceOrigin - b.sinceOrigin);

  return (
    <section className="themed-card p-4 space-y-5 sm:p-6">
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-[13px] uppercase tracking-[0.12em] text-indigo-200/80 sm:text-sm sm:tracking-wide">
              Cosmic Calendar
            </div>
            <p className="text-[12px] leading-relaxed text-slate-300 sm:text-xs">
              Creation of ALL set as AUT Year 0. Present moment sits at AUT Year {formatWhole(presentAutYear)} — all
              milestones below use whole-number years and AUT-style epoch labels.
            </p>
          </div>
          <div className="rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-4 py-3 text-indigo-50 shadow-inner shadow-black/30 sm:px-5">
            <div className="text-[10px] uppercase tracking-[0.16em] text-indigo-200/80 sm:text-[11px] sm:tracking-[0.2em]">
              Origin Anchor
            </div>
            <div className="text-sm font-semibold sm:text-base">{originLabel}</div>
            <div className="text-[10px] text-indigo-200 sm:text-[11px]">AUT Year 0 → {formatWhole(presentAutYear)}</div>
          </div>
        </div>

        {(autClock || localTimeLabel) && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 shadow-inner shadow-black/30 sm:px-5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-200/80 sm:text-[11px] sm:tracking-[0.2em]">
                Current AUT
              </div>
              <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
                <div className="text-xl font-semibold text-emerald-50 tabular-nums sm:text-2xl">{autClock ?? "—"}</div>
                <div className="text-[10px] text-emerald-200 uppercase tracking-[0.16em] sm:text-[11px] sm:tracking-[0.18em]">
                  {autDateLabel ?? "AUT date (sunrise anchored)"}
                </div>
              </div>
              {autDateLabel ? (
                <div className="mt-1 text-[12px] text-emerald-100 sm:text-[13px]">
                  AUT Date: <span className="font-semibold">{autDateLabel}</span>
                </div>
              ) : null}
              {autLunarCyclesLabel ? (
                <div className="text-[12px] text-emerald-100 sm:text-[13px]">
                  AUT-M (Moon cycles since formation):{" "}
                  <span className="font-semibold">{autLunarCyclesLabel}</span>
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 shadow-inner shadow-black/30 sm:px-5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-sky-200/80 sm:text-[11px] sm:tracking-[0.2em]">
                Local Time{locationLabel ? ` — ${locationLabel}` : ""}
              </div>
              <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
                <div className="text-xl font-semibold text-sky-50 tabular-nums sm:text-2xl">{localTimeLabel ?? "—"}</div>
                <div className="text-[10px] text-sky-200 uppercase tracking-[0.16em] sm:text-[11px] sm:tracking-[0.18em]">
                  {localDateLabel ?? "Local date"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {autEarthSolarCyclesLabel ? (
        <article className="themed-subcard p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-amber-200/80">AUT-E-S Cycle</div>
              <div className="text-3xl font-semibold text-white tabular-nums">{autEarthSolarCyclesLabel}</div>
            </div>
            <span className="rounded-full border border-amber-300/50 bg-amber-500/15 px-3 py-1 text-[11px] uppercase tracking-wide text-amber-100">
              Earth & Sun Orbits
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-200">
            Earth revolutions around the Sun since Earth solidified (~4.54B years ago). One AUT-E-S cycle equals one
            Earth year orbit — a whole-number tally of how many trips Earth has completed around Sol.
          </p>
        </article>
      ) : null}

      {autLunarCyclesLabel ? (
        <article className="themed-subcard p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-indigo-200/80">AUT-M Cycle</div>
              <div className="text-3xl font-semibold text-white tabular-nums">{autLunarCyclesLabel}</div>
            </div>
            <span className="rounded-full border border-indigo-300/50 bg-indigo-500/15 px-3 py-1 text-[11px] uppercase tracking-wide text-indigo-100">
              Lunar Count
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-200">
            Cumulative synodic lunar cycles (New Moon → New Moon) since Moon formation. Anchor ≈4.51B years ago; mean
            synodic month 29.530588853 days. Creation of ALL sets AUT Year 0; AUT-M tracks the Moon’s journey across
            that cosmic span.
          </p>
        </article>
      ) : null}

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        {timeline.map((entry) => (
          <article key={entry.id} className="themed-subcard p-3 space-y-3 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:text-[11px] sm:tracking-[0.22em]">
                  {entry.epoch}
                </div>
                <div className="text-base font-semibold text-white leading-snug sm:text-lg">{entry.title}</div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-wide ${LAYER_BADGES[entry.layer]}`}
              >
                {LAYER_LABELS[entry.layer]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 sm:text-[11px] sm:tracking-wide">
                  AUT Year
                </div>
                <div className="text-sm font-semibold text-white sm:text-base">{formatWhole(entry.sinceOrigin)}</div>
                <div className="text-[10px] text-slate-500 sm:text-[11px]">since Creation of ALL</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 sm:text-[11px] sm:tracking-wide">
                  Years ago
                </div>
                <div className="text-sm font-semibold text-white sm:text-base">{formatWhole(entry.yearsAgo)}</div>
                <div className="text-[10px] text-slate-500 sm:text-[11px]">relative to now</div>
              </div>
            </div>

            {entry.summary ? (
              <p className="text-[13px] leading-relaxed text-slate-200 sm:text-sm">{entry.summary}</p>
            ) : null}
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-emerald-100 sm:text-[11px] sm:tracking-[0.2em]">
        Ready for expansion — add human, civilization, or planetary events by appending entries in
        src/data/cosmicCalendar.ts (whole-number years + epoch label).
      </div>
    </section>
  );
}
