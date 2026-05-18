# Atlas Island Canvas Theme Healing — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make the HSM canvas fully honor Atlas Island theme tokens so that the heliocentric view renders visible orbits, radiant sun, and legible labels instead of dissolving into the Island's deep midnight background.

**Architecture:** Pass theme-aware color tokens into `drawScene` and all sub-renderers. On Atlas Island, amplify orbit/luminary visibility with higher-opacity strokes, warmer tints, and a canvas background that complements (rather than vanishes into) the Island's native darkness.

**Tech Stack:** React + TypeScript + Canvas 2D + Tailwind CSS

---

## Discovery Summary

| Element | Current Value | Atlas Island Context | Desired Behavior |
|---------|--------------|----------------------|------------------|
| Canvas background | `#030712` (hardcoded) | Island background: `#070d19` | Use Island-friendly dark tone or transparent |
| Orbit stroke | `rgba(148,163,184,0.55)` | ~slate-400 at 55% | Higher opacity + warm tint on Atlas |
| Sun glow | `rgba(253,211,107,0.6)` | Island accent: `#f6c453` | Amplify glow, use Island gold |
| Zodiac ring | `rgba(56,189,248,0.35)` | ~sky-blue | Warm gold stroke on Atlas |
| Body labels | `#e2e8f0` fallback | Island text: `#fffbef` | Use `themeTextColor` |
| Ray zones | Zodiac hues at low alpha | Island bg is very dark | Increase fill opacity |

**Theme tokens available in `THEME_PRESETS.atlas`:**
- `background`: `#070d19` with glow gradients
- `text`: `#fffbef`
- `accent`: `#f6c453` (gold)
- `accent2`: `#b98cff` (violet)
- `muted`: `rgba(255,245,219,0.82)`

`THEME_TEXT` and `THEME_FONT` are already wired to `drawScene` as props, but `drawScene` ignores background, accent, and zodiac ring colors — it hardcodes them.

---

### Task 1: Extend `drawScene` with theme color props

**Objective:** Give `drawScene` and its helpers a `themeColors` object so every tinted pixel is theme-aware.

**Files:**
- Modify: `src/comet/AtlasCometMap.tsx:1481-1491` (signature)
- Modify: `src/comet/AtlasCometMap.tsx:686-695` (caller)

**Step 1: Define theme colors type**

```typescript
type CanvasThemeColors = {
  background: string;
  orbitStroke: string;
  orbitWidth: number; // multiplier
  sunGlow: string;
  sunInner: string;
  sunOuter: string;
  zodiacRing: string;
  zodiacRingWidth: number;
  bodyLabel: string;
  rayZoneOpacity: number; // fill alpha for ray zones
};
```

**Step 2: Change `drawScene` signature**

```typescript
function drawScene(
  ctx: CanvasRenderingContext2D,
  orbitCache: Map<string, Vec2[]>,
  time: Date,
  worldToScreen: (point: Vec2) => Vec2,
  scale: number,
  overlays: OverlayOptions,
  themeFont: string,
  themeTextColor: string,
  themeColors: CanvasThemeColors
) {
```

**Step 3: Update `drawScene` background fill (line ~1497)**

Replace hardcoded `#030712` with `themeColors.background`:

```typescript
  ctx.fillStyle = themeColors.background;
```

**Step 4: Update orbit stroke (line ~1531)**

Replace hardcoded `rgba(148,163,184,0.55)` with `themeColors.orbitStroke`.
Use `themeColors.orbitWidth` multiplier on `ctx.lineWidth`.

**Step 5: Update `drawSun` call**

Pass `themeColors.sunGlow`, `sunInner`, `sunOuter` into `drawSun` (extend its signature).

**Step 6: Update zodiac ring stroke (line ~1547)**

Replace hardcoded `rgba(56,189,248,0.35)` with `themeColors.zodiacRing`.
Use `themeColors.zodiacRingWidth` for `ctx.lineWidth`.

**Step 7: Update caller at line ~686**

Build `themeColors` from `uiTheme` before calling `drawScene`.

```typescript
const themeColors = useMemo(() => buildCanvasTheme(uiTheme), [uiTheme]);
```

---

### Task 2: Implement `buildCanvasTheme` helper

**Objective:** Return a `CanvasThemeColors` object for each theme, with Atlas Island values designed for visibility on deep midnight.

**Files:**
- Modify: `src/comet/AtlasCometMap.tsx` (add function before component, around line 470)

**Step 1: Write the helper**

```typescript
function buildCanvasTheme(theme: string): CanvasThemeColors {
  const base: CanvasThemeColors = {
    background: "#030712",
    orbitStroke: "rgba(148,163,184,0.55)",
    orbitWidth: 1.5,
    sunGlow: "rgba(253, 211, 107, 0.6)",
    sunInner: "#ffe7a3",
    sunOuter: "#f59e0b",
    zodiacRing: "rgba(56,189,248,0.35)",
    zodiacRingWidth: 1,
    bodyLabel: "#e2e8f0",
    rayZoneOpacity: 0.08,
  };

  if (theme === "atlas") {
    return {
      background: "#060e1a", // slightly lighter than Island #070d19, so canvas frames appear
      orbitStroke: "rgba(246, 196, 83, 0.75)", // Island gold at 75%
      orbitWidth: 2.0, // slightly thicker
      sunGlow: "rgba(255, 230, 160, 0.85)", // brighter gold glow
      sunInner: "#fff2cc",
      sunOuter: "#f6c453",
      zodiacRing: "rgba(246, 196, 83, 0.55)", // gold ring
      zodiacRingWidth: 1.5,
      bodyLabel: "#fffbef", // Island text
      rayZoneOpacity: 0.22, // much more visible on dark bg
    };
  }

  if (theme === "retro") {
    return {
      ...base,
      background: "#020b04",
      orbitStroke: "rgba(96, 255, 176, 0.55)",
      sunGlow: "rgba(96, 255, 176, 0.5)",
      sunInner: "#b8ffd1",
      sunOuter: "#60ffb0",
      zodiacRing: "rgba(96, 255, 176, 0.4)",
      bodyLabel: "#b8ffd1",
      rayZoneOpacity: 0.10,
    };
  }

  return base;
}
```

**Step 2: Wire `themeColors` into the render effect**

Update the `useEffect` dependency array at line ~702 to include `themeColors`.

---

### Task 3: Thread `themeColors` into `drawSun`, `drawZodiacRing`, `drawRayZones`, `drawBodies`

**Objective:** Every renderer that picks up a hardcoded tint now consumes the theme palette.

**Files:**
- Modify: `src/comet/AtlasCometMap.tsx:1805-1827` (`drawSun`)
- Modify: `src/comet/AtlasCometMap.tsx:1555-1581` (`drawZodiacRing`)
- Modify: `src/comet/AtlasCometMap.tsx:1696-1755` (`drawRayZones`)
- Modify: `src/comet/AtlasCometMap.tsx:1856-1955` (`drawBodies`)

**Step 1: `drawSun`**

Add `themeColors` param. Use `sunGlow`, `sunInner`, `sunOuter` in both image-options and fallback gradient. Increase `shadowBlur` slightly for Atlas.

**Step 2: `drawZodiacRing`**

Add `themeColors` param. Use `themeColors.zodiacRing` for stroke, `themeColors.zodiacRingWidth` for width.

**Step 3: `drawRayZones`**

Add `rayZoneOpacity` param. Multiply the existing zodiac hue alpha by this value instead of hardcoded `0.08` / `0.15`.

**Step 4: `drawBodies`**

Label color already uses `themeTextColor`; ensure fallback uses `themeColors.bodyLabel`.

---

### Task 4: Verify build and commit

**Step 1: Build**

```bash
cd ~/.hermes/projects/aut-clock && npm run build
```

Expected: 0 errors.

**Step 2: Commit**

```bash
git add src/comet/AtlasCometMap.tsx
git commit -m "feat(theme): atlas island color tokens for HSM canvas"
```

**Step 3: Push**

```bash
git push origin main
```

---

## Verification Checklist (manual)

- [ ] Load app in **Atlas Island** theme
- [ ] Open **HSM** panel
- [ ] Press **Solar** toggle → canvas shows gold orbits, bright sun, visible zodiac ring
- [ ] Press **Gaian** toggle → canvas shows Sun marker in gold, visible Earth
- [ ] Switch to **Normal** theme → orbits are slate, zodiac ring is sky-blue (unchanged)
- [ ] Switch to **Retro** theme → orbits are emerald, zodiac ring is phosphor green
- [ ] Ray zone fills are visible under all themes
- [ ] Body labels use theme text color (Athens off-white on Atlas, pale green on Retro)

---

## Future Enhancements (out of scope)

1. **Body images vs. fallback gradients:** The Sun/Moon/Earth images may still fail to load; fallback gradients on Atlas should use Island gold palette.
2. **Lux/Umbra sub-variants:** `buildCanvasTheme` can be extended to read `atlasTone` from global state for lighter/darker canvas variants.
3. **CSS Canvas transparency:** Consider making the canvas background `transparent` so the page-level `atlas-bg` texture shows through — would require removing the `fillRect` background entirely.
