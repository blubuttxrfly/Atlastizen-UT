/* ── Date/Time Selector with Current + Set buttons ──
   Shared across Luna, Sol, and Gaia Ray Dials.
   Uses pendingDate for editing, Set commits to dialDate, Current snaps to now. */

type Props = {
  pendingDate: Date;
  onPendingChange: (date: Date) => void;
  onSet: () => void;
  onCurrent: () => void;
};

function formatDateForInput(date: Date) {
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function formatTimeForInput(date: Date) {
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${min}`;
}

export function DateTimeSelector({ pendingDate, onPendingChange, onSet, onCurrent }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date picker — native input, directly clickable */}
      <input
        type="date"
        value={formatDateForInput(pendingDate)}
        onChange={(e) => {
          if (!e.target.value) return;
          const [y, m, d] = e.target.value.split("-").map(Number);
          const newDate = new Date(pendingDate);
          newDate.setFullYear(y, m - 1, d);
          onPendingChange(newDate);
        }}
        className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 cursor-pointer"
      />
      {/* Time picker */}
      <input
        type="time"
        value={formatTimeForInput(pendingDate)}
        onChange={(e) => {
          if (!e.target.value) return;
          const [h, min] = e.target.value.split(":").map(Number);
          const newDate = new Date(pendingDate);
          newDate.setHours(h, min, 0, 0);
          onPendingChange(newDate);
        }}
        className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 cursor-pointer"
      />
      {/* Current button: snap to live now */}
      <button
        type="button"
        onClick={onCurrent}
        className="rounded-lg border border-cyan-600/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200 transition hover:bg-cyan-500/20"
        title="Reset to current live time"
      >
        Current
      </button>
      {/* Set button: apply pending date to dial */}
      <button
        type="button"
        onClick={onSet}
        className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200 transition hover:bg-amber-500/20"
        title="Apply selected date and time to the Ray Dial"
      >
        Set
      </button>
    </div>
  );
}