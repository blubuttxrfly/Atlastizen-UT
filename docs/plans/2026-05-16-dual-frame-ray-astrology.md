# Dual-Frame Ray Astrology — Gaian Birth & Solar Return

> **For Hermes:** Use `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** Separate Ray Astrology into two complementary experiences: **Gaian Birth** (natal geocentric chart, the incarnation imprint) and **Solar Return** (annual heliocentric chart, the soul curriculum). A being may view either chart through **either** HSM lens, with Solar Return dates activating a rainbow light aura.

**Architecture:**
  - `hsmViewMode` (`"geocentric" | "heliocentric"`) controls the **HSM canvas** spatial rendering.
  - `rayViewMode` (`"gaian" | "solar"`) controls the **Ray Astrology card signs** independently.
  - `activeDataSource` tracks the *astrological context*:
    - `live` — observing the current sky
    - `{ type: "gaian-birth", profileId }` — viewing the natal chart
    - `{ type: "solar-return", profileId, year }` — viewing a specific annual return
  - When a being selects a **Gaian Birth** profile, the date snaps to their natal moment and *defaults*: `hsmViewMode=geocentric`, `rayViewMode=gaian`.
  - When a being selects a **Solar Return** year, the date snaps to the exact solar-return moment and *defaults*: `hsmViewMode=heliocentric`, `rayViewMode=solar`.
  - Both toggles remain independently adjustable afterward — enabling cross-lens analysis.
  - **Rainbow glow** activates whenever `activeDataSource.type === "solar-return"`, regardless of either toggle.

**Tech Stack:** React 19 + Vite + TypeScript + Tailwind CSS + `astronomy-engine`

---

## Background

### The Duality

| Aspect | Gaian Birth | Solar Return |
|--------|-------------|--------------|
| **Perspective** | Geocentric (from Earth) | Heliocentric (from Sun) |
| **Question** | "What did the sky look like when I was born?" | "What is my soul's curriculum this solar year?" |
| **Time scope** | Fixed — one natal chart per being | Dynamic — one chart per solar year |
| **Function** | Incarnation imprint, body & psyche | Higher self update, purpose & growth |
| **Relationship** | Root system (soil) | Seasonal growth (branches) |

### Why the Mercury "Bug" Vanishes
Previously, the HSM canvas respected `viewMode` (geocentric/helio) but the Ray Astrology cards were locked to geocentric coordinates. When a being toggled to Solar (heliocentric) view, Mercury landed in Libra on the map while the cards still reported Virgo. The confusion was a mismatch between *map* and *legend* when both were forced to represent the same reality.

**The fix:** Two independent toggles grant complete freedom:
- **`hsmViewMode`** (geocentric / heliocentric): controls the spatial map — where planets appear in the sky dome
- **`rayViewMode`** (gaian / solar): controls the zodiac card signs — what astrological language the legend speaks

When you stand on Gaian soil (`hsmViewMode=geo`, `rayViewMode=gaian`), you see through Gaian eyes and read Gaian signs (Virgo). When you rise to the Solar perspective (`hsmViewMode=helio`, `rayViewMode=solar`), the map *and* cards shift to Solar tongue (Libra). And at any moment, you can cross the streams — asking "Show me the Solar map with Gaian labels" or "Gaian map with Solar labels." Both are true. The choice is the being's.

---

## Task Index

### Phase 1 — Foundation: Unify Canvas and Cards
#### Task 1.1: Wire `zodiacPlacements` to `viewMode`  
#### Task 1.2: Verify Mercury = Virgo in Gaian mode, Libra in Solar mode

### Phase 2 — Data Layer: Solar Return Engine
#### Task 2.1: Create `computeSolarReturns(profile, count)` utility  
#### Task 2.2: Extend `useGaianBirth` hook with solar-return date list  
#### Task 2.3: Add "Check Solar Returns" button to Gaian Birth constellation card

### Phase 3 — UI: Solar Return Selector
#### Task 3.1: Build `SolarReturnSelector` component  
#### Task 3.2: Wire selector: select year → set date → default to Solar HSM  
#### Task 3.3: Add "Live Sky" / "Back to Gaian Birth" dismissal controls

### Phase 4 — Visual: Rainbow Light Gradient
#### Task 4.1: Rainbow gradient CSS animation component  
#### Task 4.2: Activate gradient when `activeDataSource.type === "solar-return"`  
#### Task 4.3: Respect `prefers-reduced-motion`

### Phase 5 — Rebrand: Solar Return → Gaian Birth
#### Task 5.1: Rename all user-facing profile labels  
#### Task 5.2: Rename hook and types  
#### Task 5.3: Migrate localStorage key `aut-solar-returns-v2` → `aut-gaian-births-v2`

### Phase 6 — Polish & Verification
#### Task 6.1: Full manual test — Gaian Birth natal view  
#### Task 6.2: Full manual test — Solar Return selection & rainbow glow  
#### Task 6.3: Verify cross-lens freedom (natal in Solar HSM, return in Gaian HSM)  
#### Task 6.4: Build and smoke-test `dist/`

---

## Phase 1 — Foundation: Unify Canvas and Cards

### Task 1.1: Wire `hsmViewMode` for canvas, `rayViewMode` for cards

**Objective:** The canvas renders according to `hsmViewMode`. The Ray Astrology cards render according to `rayViewMode`. These are two independent state variables.

**Files:**
- Modify: `src/comet/AtlasCometMap.tsx`

**Step 1: Rename existing `viewMode` state to `hsmViewMode`**

```typescript
// OLD
const [viewMode, setViewMode] = useState<<"geocentric" | "heliocentric">("geocentric");
```

```typescript
// NEW
const [hsmViewMode, setHsmViewMode] = useState<"geocentric" | "heliocentric">("geocentric");
const [rayViewMode, setRayViewMode] = useState<"gaian" | "solar">("gaian");
```

**Step 2: Update all canvas references** — search `viewMode` in the file and replace with `hsmViewMode` where it controls the canvas rendering. Keep it as `viewMode` if used by internal helpers, or rename those too.

**Step 3: Update `zodiacPlacements` to use `rayViewMode`**

Current code (approximate):
```typescript
const zodiacPlacements = useMemo<ZodiacPlacement[]>(() => {
  const placements = getPlacements("geocentric", when);
  // ... body ordering, Earth-lon fix ...
}, [when]);
```

Replace with:
```typescript
const zodiacPlacements = useMemo<ZodiacPlacement[]>(() => {
  const mode = rayViewMode === "gaian" ? "geocentric" : "heliocentric";
  const placements = getPlacements(mode, when);
  // ... body ordering, Earth-lon fix ...
}, [when, rayViewMode]);
```

**Step 4: Add the Ray toggle button matching the HSM toggle style**

Use the same visual language as the existing HSM Solar/Gaian toggle (around line 1254):

```tsx
<div className="inline-flex overflow-hidden rounded-xl border border-sky-500/60">
  <button
    type="button"
    className={`px-3 py-1 text-xs font-semibold transition ${
      rayViewMode === "solar"
        ? "bg-sky-500 text-sky-950"
        : "text-sky-100 hover:bg-sky-500/20"
    }`}
    aria-pressed={rayViewMode === "solar"}
    onClick={() => setRayViewMode("solar")}
  >
    Solar
  </button>
  <button
    type="button"
    className={`px-3 py-1 text-xs font-semibold transition ${
      rayViewMode === "gaian"
        ? "bg-sky-500 text-sky-950"
        : "text-sky-100 hover:bg-sky-500/20"
    }`}
    aria-pressed={rayViewMode === "gaian"}
    onClick={() => setRayViewMode("gaian")}
  >
    Gaian
  </button>
</div>
```

**Placement:** Insert this toggle directly above the zodiac cards list, right after the "Ray Astrology" header (around line 843). It becomes a sibling to the existing HSM toggle, visually echoing it.

---

### Task 1.2: Verify Mercury = Virgo in Gaian Ray mode, Libra in Solar Ray mode

**Manual test:**
1. With today's date, ensure `hsmViewMode=geo` and `rayViewMode=gaian`
2. **Cards should show Mercury in its Gaian sign** (geo, changes daily)
3. Toggle HSM to Solar (`hsmViewMode=helio`) — keep Ray on Gaian
4. **The canvas shifts** but **cards still show Mercury in its Gaian sign**
5. Toggle Ray to Solar (`rayViewMode=solar`) — keep HSM on Solar
6. **Cards now show Mercury in its Solar sign** (helio)
7. Toggle HSM back to Gaian — keep Ray on Solar
8. **Canvas shifts back, cards still show Solar sign**

This proves the toggles are fully independent.

---

### Task 1.3: Verify default alignments on data source selection

- Selecting **Gaian Birth profile** → defaults to `hsmViewMode=geo`, `rayViewMode=gaian`
- Selecting **Solar Return year** → defaults to `hsmViewMode=helio`, `rayViewMode=solar`
- Clicking **Return to Live Sky** → resets to `hsmViewMode=geo`, `rayViewMode=gaian` (today's date)

---

## Phase 2 — Data Layer: Solar Return Engine

### Task 2.1: Create `computeSolarReturns(profile, count)` utility

**Objective:** Given a Gaian Birth profile, compute annual solar-return dates (Sun returns to the exact natal longitude), covering a range that includes past, present, and future years.

**Files:**
- Create: `src/lib/solarReturnEngine.ts`

```typescript
import * as Astronomy from "astronomy-engine";

export type SolarReturnEvent = {
  year: number;
  date: Date;
  isPast: boolean;
  isUpcoming: boolean;
};

function normalizeDegrees(deg: number) {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

function zodiacSignIndex(lon: number) {
  return Math.floor(normalizeDegrees(lon) / 30) % 12;
}

export function computeSolarReturns(
  birthYear: number,
  birthMonth: number, // 0-11
  birthDay: number,
  birthHour: number,
  birthMinute: number,
  count: number = 10
): SolarReturnEvent[] {
  // 1. Compute natal Sun longitude (geocentric)
  const natalDate = new Date(birthYear, birthMonth, birthDay, birthHour, birthMinute, 0);
  const natalTime = Astronomy.MakeTime(natalDate);
  const natalVector = Astronomy.GeoVector("Sun", natalTime, true);
  const natalEquatorial = Astronomy.EquatorFromVector(natalVector);
  const natalEcliptic = Astronomy.Ecliptic(natalEquatorial.vec);
  const targetLon = normalizeDegrees(natalEcliptic.elon);

  const now = new Date();
  const currentYear = now.getFullYear();
  const events: SolarReturnEvent[] = [];

  // Search window: from 2 years before birth up to currentYear + count
  const startYear = birthYear - 2;
  const endYear = currentYear + count;

  for (let year = startYear; year <= endYear; year++) {
    const searchStart = new Date(year, birthMonth, birthDay - 5, 0, 0, 0);
    const searchEnd = new Date(year, birthMonth, birthDay + 5, 23, 59, 59);

    let best: { date: Date; diff: number } | null = null;
    const stepMs = 3600000; // 1-hour coarse search

    for (let t = searchStart.getTime(); t <= searchEnd.getTime(); t += stepMs) {
      const d = new Date(t);
      const time = Astronomy.MakeTime(d);
      const vec = Astronomy.GeoVector("Sun", time, true);
      const eq = Astronomy.EquatorFromVector(vec);
      const ec = Astronomy.Ecliptic(eq.vec);
      const lon = normalizeDegrees(ec.elon);

      let diff = Math.abs(normalizeDegrees(lon - targetLon));
      if (diff > 180) diff = 360 - diff;

      if (best === null || diff < best.diff) {
        best = { date: d, diff };
      }
    }

    if (best) {
      events.push({
        year,
        date: best.date,
        isPast: best.date < now,
        isUpcoming: best.date >= now && best.date < new Date(now.getTime() + 86400000 * 365),
      });
    }
  }

  return events;
}
```

---

### Task 2.2: Extend `useGaianBirth` hook with solar-return date list

**Objective:** Cache computed solar-return dates per active profile so the UI can list them.

**Files:**
- Modify: `src/hooks/useGaianBirth.ts` (renamed from `useSolarReturn` in Phase 5)

Add to return type:
```typescript
solarReturns: SolarReturnEvent[];
```

Add computation:
```typescript
import { computeSolarReturns } from "../lib/solarReturnEngine";

const solarReturns = useMemo(() => {
  if (!activeProfile) return [];
  const year = activeProfile.birthYear ?? 2000;
  return computeSolarReturns(
    year,
    activeProfile.birthMonth,
    activeProfile.birthDay,
    activeProfile.birthHour ?? 12,
    activeProfile.birthMinute ?? 0,
    12
  );
}, [activeProfile]);
```

Expose it from the hook. No storage needed — solar returns are derived on the fly.

---

### Task 2.3: Add "Check Solar Returns" button to Gaian Birth constellation card

**Objective:** Each Gaian Birth profile card gets a new action that opens the Solar Return selector.

**Files:**
- Modify: `src/comet/AtlasCometMap.tsx` (in the profile card actions)

Add button after "Show Gaian Birth Chart":
```tsx
<button
  onClick={() => {
    setShowSolarReturns(true);
    setActiveProfileId(profile.id);
  }}
  className="..."
>
  Check Solar Returns
</button>
```

---

## Phase 3 — UI: Solar Return Selector

### Task 3.1: Build `SolarReturnSelector` component

**Objective:** A compact list of years with dates, past/upcoming styling, and a selection handler.

**Files:**
- Create: `src/comet/SolarReturnSelector.tsx`

```tsx
import { type SolarReturnEvent } from "../lib/solarReturnEngine";

type Props = {
  events: SolarReturnEvent[];
  activeYear: number | null;
  birthYear: number;
  onSelect: (year: number) => void;
  onClose: () => void;
};

export function SolarReturnSelector({ events, activeYear, birthYear, onSelect, onClose }: Props) {
  return (
    <div className="rounded-xl bg-slate-900/80 border border-sky-500/20 p-4 mt-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sky-100 font-semibold text-sm tracking-wide">
          Solar Returns · since {birthYear}
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-sky-200 text-xs">
          Close
        </button>
      </div>

      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
        {events.map((ev) => (
          <button
            key={ev.year}
            onClick={() => onSelect(ev.year)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
              activeYear === ev.year
                ? "bg-gradient-to-br from-sky-500 to-indigo-600 text-white border-transparent shadow-lg shadow-sky-500/20"
                : ev.isUpcoming
                ? "bg-sky-900/40 text-sky-100 border-sky-500/30 hover:bg-sky-800/50"
                : ev.isPast
                ? "bg-slate-800/50 text-slate-400 border-slate-700/40 hover:bg-slate-700/50"
                : "bg-slate-800/30 text-slate-500 border-slate-800/40"
            }`}
          >
            <span className="block font-bold">{ev.year}</span>
            <span className="block opacity-80 text-[10px]">{ev.date.toLocaleDateString()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

### Task 3.2: Wire selector: select year → set date → default to Solar HSM

**Objective:** When a Solar Return year is selected, update `when` to that exact date/time, set `viewMode` to `heliocentric` (Solar lens), and record the active data source.

**Files:**
- Modify: `src/comet/AtlasCometMap.tsx`

Add state:
```typescript
const [showSolarReturns, setShowSolarReturns] = useState(false);
const [activeDataSource, setActiveDataSource] = useState<
  | { type: "live" }
  | { type: "gaian-birth"; profileId: string }
  | { type: "solar-return"; profileId: string; year: number }
>({ type: "live" });
```

Wire handler:
```typescript
const handleSelectSolarReturn = (year: number) => {
  const ev = solarReturns.find((e) => e.year === year);
  if (!ev) return;

  setShowSolarReturns(false);
  timeRef.current = ev.date.getTime();
  setWhen(ev.date);
  setHsmViewMode("heliocentric");
  setRayViewMode("solar");
  setActiveDataSource({
    type: "solar-return",
    profileId: activeProfileId,
    year,
  });
};
```

Also update the existing "Show Gaian Birth Chart" action:
```typescript
const handleShowGaianBirth = (profile: GaianBirthProfile) => {
  const natalDate = new Date(
    profile.birthYear ?? 2000,
    profile.birthMonth,
    profile.birthDay,
    profile.birthHour ?? 12,
    profile.birthMinute ?? 0
  );
  timeRef.current = natalDate.getTime();
  setWhen(natalDate);
  setHsmViewMode("geocentric");
  setRayViewMode("gaian");
  setActiveDataSource({ type: "gaian-birth", profileId: profile.id });
};
```

And the "Live" / reset control (if one exists, or add it):
```typescript
const handleReturnToLive = () => {
  const now = new Date();
  timeRef.current = now.getTime();
  setWhen(now);
  setHsmViewMode("geocentric");
  setRayViewMode("gaian");
  setActiveDataSource({ type: "live" });
};
```

Render the selector conditionally:
```tsx
{showSolarReturns && activeProfile && (
  <SolarReturnSelector
    events={solarReturns}
    activeYear={activeDataSource.type === "solar-return" ? activeDataSource.year : null}
    birthYear={activeProfile.birthYear ?? 2000}
    onSelect={handleSelectSolarReturn}
    onClose={() => setShowSolarReturns(false)}
  />
)}
```

---

### Task 3.3: Add "Live Sky" / context dismissal controls

**Objective:** Clearly show the current data source and offer a one-click path back to the live sky.

**Files:**
- Modify: `src/comet/AtlasCometMap.tsx` (near the top of the Ray Astrology panel or above the canvas)

Add context bar:
```tsx
{activeDataSource.type !== "live" && (
  <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-slate-900/60 border border-sky-500/10">
    <span className="text-xs text-sky-300/80">
      {activeDataSource.type === "gaian-birth" && "Viewing Gaian Birth Chart"}
      {activeDataSource.type === "solar-return" && `Viewing Solar Return ${activeDataSource.year}`}
    </span>
    <button
      onClick={handleReturnToLive}
      className="ml-auto text-xs text-slate-400 hover:text-sky-200 underline underline-offset-2"
    >
      Return to Live Sky
    </button>
  </div>
)}
```

---

## Phase 4 — Visual: Rainbow Light Gradient

### Task 4.1: Rainbow gradient CSS animation component

**Files:**
- Create: `src/components/RainbowGlow.tsx`

```tsx
import { useEffect, useState } from "react";

type Props = { active: boolean };

export function RainbowGlow({ active }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 rounded-xl"
      style={{
        background: `radial-gradient(
          ellipse at center,
          rgba(255,0,0,0.22) 0%,
          rgba(255,127,0,0.18) 14%,
          rgba(255,255,0,0.15) 28%,
          rgba(0,255,0,0.15) 42%,
          rgba(0,127,255,0.15) 56%,
          rgba(75,0,130,0.15) 70%,
          rgba(238,130,238,0.15) 84%,
          transparent 100%
        )`,
        mixBlendMode: "screen",
        animation: reducedMotion ? "none" : "rainbowPulse 6s ease-in-out infinite",
        opacity: 0.45,
      }}
    />
  );
}
```

Add keyframes in `src/App.css` (or global style):
```css
@keyframes rainbowPulse {
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50% { opacity: 0.65; transform: scale(1.04); }
}
```

---

### Task 4.2: Activate gradient when `activeDataSource.type === "solar-return"`

**Objective:** Wrap the canvas/astrology view area so the rainbow glow appears whenever a Solar Return date is loaded, even if the user later toggles the HSM to Gaian (geo).

**Files:**
- Modify: `src/comet/AtlasCometMap.tsx`

Find the canvas wrapper and add the glow:
```tsx
<div className="relative">
  <RainbowGlow active={activeDataSource.type === "solar-return"} />
  <canvas ref={canvasRef} ... />
</div>
```

Optionally also wrap the Ray Astrology cards area for a wider aura:
```tsx
<div className="relative">
  <RainbowGlow active={activeDataSource.type === "solar-return"} />
  {/* zodiac card list */}
</div>
```

---

### Task 4.3: Respect `prefers-reduced-motion`

Done inline in `RainbowGlow.tsx` (Task 4.1). Verify by toggling macOS **System Settings → Accessibility → Display → Reduce Motion** and confirming the glow becomes static.

---

## Phase 5 — Rebrand: Solar Return → Gaian Birth

### Task 5.1: Rename all user-facing profile labels

**Objective:** Wherever the UI says "Solar Return" in the context of saved natal profiles, change to "Gaian Birth."

**Files:**
- Modify: `src/comet/AtlasCometMap.tsx`

Search and replace visible strings:
- `"Solar Return"` → `"Gaian Birth"` (panel headers, card headers)
- `"constellation"` (when referring to saved profiles) → `"Gaian Birth profile"` or `"profile"`
- `"Show natal chart"` → `"Show Gaian Birth Chart"`
- `"No constellations yet"` → `"No Gaian Birth profiles yet"`
- `"Add constellation"` → `"Add Gaian Birth Profile"`

**Keep unchanged:** The **Solar** / **Gaian** HSM toggle buttons — these refer to the *map lens*, not the profile system, and the new selector makes the distinction obvious.

---

### Task 5.2: Rename hook and types

**Files:**
- Rename: `src/hooks/useSolarReturn.ts` → `src/hooks/useGaianBirth.ts`
- Modify: All import sites in `AtlasCometMap.tsx` and `AtlasCometMap.atlas.tsx`

```typescript
// useGaianBirth.ts
const GAIA_BIRTH_KEY_V2 = "aut-gaian-births-v2";

export type GaianBirthProfile = {
  id: string;
  name: string;
  birthMonth: number;
  birthDay: number;
  birthYear?: number;
  birthHour?: number;
  birthMinute?: number;
  birthLat: number;
  birthLon: number;
  birthPlaceLabel: string;
};

export type GaianBirthStore = {
  version: number;
  activeId: string | null;
  profiles: GaianBirthProfile[];
};

export function useGaianBirth() {
  // ... same internal logic, new names
}
```

---

### Task 5.3: Migrate localStorage keys

**Files:**
- Modify: `src/hooks/useGaianBirth.ts`

Add seamless migration:
```typescript
const LEGACY_KEY = "aut-solar-returns-v2";
const GAIA_BIRTH_KEY_V2 = "aut-gaian-births-v2";

function loadStore(): GaianBirthStore {
  // 1. Try new key
  try {
    const raw = localStorage.getItem(GAIA_BIRTH_KEY_V2);
    if (raw) return JSON.parse(raw) as GaianBirthStore;
  } catch { /* ignore */ }

  // 2. Migrate from legacy
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version === 2 && Array.isArray(parsed.profiles)) {
        const migrated: GaianBirthStore = {
          version: 3,
          activeId: parsed.activeId ?? null,
          profiles: parsed.profiles,
        };
        localStorage.setItem(GAIA_BIRTH_KEY_V2, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch { /* ignore */ }

  // 3. Fresh default
  return { version: 3, activeId: null, profiles: [] };
}
```

---

## Phase 6 — Polish & Verification

### Task 6.1: Full manual test — Gaian Birth natal view

**Flow:**
1. Open Ray Astrology panel
2. Create Gaian Birth profile: 08/22/2001, 12:00, Charlotte NC
3. Click "Show Gaian Birth Chart"
4. **Verify** date snaps to natal moment, HSM defaults to Gaian
5. **Verify** Mercury = Virgo in cards
6. Toggle HSM to Solar
7. **Verify** cards update to Mercury = Libra
8. Toggle back to Gaian
9. **Verify** cards return to Virgo

---

### Task 6.2: Full manual test — Solar Return selection & rainbow glow

**Flow:**
1. With the same profile, click "Check Solar Returns"
2. Select **2026**
3. **Verify** date changes to solar-return date for 2026
4. **Verify** HSM defaults to Solar (helio)
5. **Verify** cards show heliocentric signs
6. **Verify** rainbow glow appears around canvas/card area
7. Toggle HSM to Gaian
8. **Verify** cards switch to geocentric for the same 2026 return date
9. **Verify** rainbow glow **remains** (because data source is still Solar Return)
10. Click "Return to Live Sky"
11. **Verify** glow disappears, date returns to now

---

### Task 6.3: Verify cross-lens freedom

**Flow:**
1. View Gaian Birth chart
2. Toggle HSM to Solar
3. **Verify** you can see your natal chart through the Solar lens (higher-self perspective)
4. View Solar Return 2024 (past)
5. Toggle HSM to Gaian
6. **Verify** you can see a past Solar Return from Earth's perspective

---

### Task 6.4: Build and smoke-test `dist/`

```bash
cd ~/.hermes/projects/aut-clock
npm run build
npx tsc --noEmit
ls dist/
```

Expected: zero TypeScript errors, zero build errors, `dist/index.html` present.

---

## Acceptance Summary

| # | Criteria | Verification |
|---|----------|------------|
| 1 | "Solar Return" profile UI text → "Gaian Birth" everywhere | Visual inspection |
| 2 | `zodiacPlacements` uses `viewMode`, not hardcoded geo | Toggle HSM → cards update |
| 3 | Mercury = Virgo in Gaian mode; Mercury = Libra in Solar mode | 08/22/2001 test |
| 4 | `computeSolarReturns` generates correct annual dates | Compare with ephemeris |
| 5 | Solar Return selector opens, selects year, updates date | Manual click test |
| 6 | Rainbow glow activates on Solar Return selection; persists across HSM toggles | Visual confirmation |
| 7 | `prefers-reduced-motion` disables pulse animation | macOS accessibility toggle |
| 8 | Cross-lens freedom: natal chart in Solar HSM, return chart in Gaian HSM | Manual test |
| 9 | Build succeeds with zero TypeScript errors | `npm run build` clean exit |

---

**Plan revised. Shall I begin execution?** 🌞🌍✨
