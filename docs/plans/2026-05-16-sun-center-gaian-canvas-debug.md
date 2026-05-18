# Plan: Sun Centers in Gaian (Geocentric) Canvas

> Status: Investigation needed — Sun appears at center in geocentric mode instead of on the ecliptic ring.

## Background

In Gaian (geocentric) view mode on the HSM canvas, **Earth must be at center** and **the Sun must orbit Earth along the ecliptic ring** (at ~210px radius, at an angle matching its geocentric ecliptic longitude). 

Currently, the Sun appears near the center in geocentric mode — suggesting it is being rendered at Earth’s position or its `world` coordinates are incorrectly mapped to center.

---

## Pre-Investigation Findings

### Relevant Code Paths

1. **`geocentricPlacement(body, when)`** (line ~417): Computes placement for each body in GeoVector → ecliptic → `geocentricWorld()`
2. **`geocentricWorld(lon, lat)`** (line ~407): Maps ecliptic lon to `GEO_RING_PX=210` radius, returns `{x, y}` coordinates
3. **`getPlacements(viewMode, when)`** (line ~438): Delegates to geo or helio placement depending on viewMode
4. **`drawScene(ctx, ..., overlays, ...)`** (line ~1577): Receives `overlays.viewMode` from parent
5. **`drawBodies(ctx, placements, ...)`** (line ~1953): Loops placements and draws Sun via `drawSunMarker()` at `worldToScreen(placement.world)`

### What looks correct
- Earth explicitly returns `{world: {x:0, y:0}}` — center.
- Sun gets `geocentricWorld(sunLon, sunLat)` — should be at radius ~210.
- `drawSun` (heliocentric center) is wrapped in `if (viewMode === "heliocentric")` — not called in geo mode.
- Sun in geo mode is drawn by `drawSunMarker` in `drawBodies` at its computed `world` position.

### Suspicions to verify

1. **State desync**: `overlays.viewMode` passed to `drawScene` may not match `hsmViewMode` — if the canvas receives "heliocentric" while the UI shows "gaian", Sun stays at center.
2. **World coordinates are wrong**: `geocentricWorld()` may be using the wrong formula, returning near-zero for the Sun specifically.
3. **The Sun image fallback draws at wrong position**: `drawSunMarker` calls `drawPlanetImage` which may have a positioning bug when the image is present.
4. **Orbit cache contamination**: `orbitCache` may hold heliocentric positions that leak into the geocentric draw loop.

---

## Investigation Steps

### Step 1: Verify state alignment — `viewMode` in `drawScene()`

Add a debug log inside `drawScene` to check what `overlays.viewMode` is when the canvas renders:

```typescript
function drawScene(...) {
  console.log("[drawScene] viewMode:", overlays.viewMode);
  console.log("[drawScene] Sun placement:", placements.find(p => p.body === "Sun"));
}
```

**Expected in Gaian mode:** `viewMode === "geocentric"`, Sun at radius ~210 from center.
**If wrong:** Fix state prop threading from `hsmViewMode` → `overlays.viewMode`.

### Step 2: Trace `geocentricPlacement("Sun", date)`

Add debug log for the Sun specifically:

```typescript
function geocentricPlacement(body, when) {
  if (body === "Sun") {
    const vector = Astronomy.GeoVector("Sun", time, true);
    const { lon, lat, dist } = toEcliptic(vector);
    const world = geocentricWorld(lon, lat);
    console.log("[Sun geo] lon:", lon, "world:", world);
  }
}
```

**Expected:** `lon` varies (~0–360°), `world` distance from origin should be ~210px.
**If wrong:** Fix `geocentricWorld()` or `toEcliptic()` calculation.

### Step 3: Verify Earth is excluded from ring positions

Check `geocentricPlacement("Earth", ...)` explicitly returns center:

```typescript
// Earth case
return { body, lon: 0, lat: 0, dist: 0, vector, world: { x: 0, y: 0 }, mode: "geocentric" };
```

**Confirm:** Does the Sun appear near where Earth is drawn? If so, the Sun's `world` coordinates are zeroing.

### Step 4: Check `drawBodies` loop for contamination

In `drawBodies`, verify `placements` has the Sun at non-zero coordinates and the loop uses the correct `placement.world`:

```typescript
placements.forEach((placement) => {
  if (placement.body === "Sun") console.log("[drawBodies Sun]", placement.world);
  const center = worldToScreen(placement.world);
  // ...
});
```

**If center.x ≈ width/2 and center.y ≈ height/2:** The `worldToScreen` transform is mapping Sun to center. Check `scaleRef` / `cameraRef` state.

### Step 5: Verify `worldToScreen` function state

Check if `worldToScreen` has been mutated to center all bodies (perhaps from a prior zoom/pan action):

```typescript
// In the render loop, log the transform
console.log("[worldToScreen] scale:", scaleRef.current, "camera:", cameraRef.current);
```

**If scale ≈ 0 or camera is offset:** Reset transform on viewMode change.

---

## Likely Root Causes (ranked)

| # | Hypothesis | Evidence Needed | Fix |
|---|-----------|-----------------|-----|
| 1 | `overlays.viewMode` in `drawScene` ≠ `hsmViewMode` | Check console.log in drawScene | Check prop threading |
| 2 | `geocentricWorld()` returns 0 for Sun's specific lon | Check Sun's calculated lon and world | Fix trigo or clamp |
| 3 | `worldToScreen` has accumulated pan/zoom offset | Check scaleRef / cameraRef | Reset on mode change |
| 4 | Planet image cache or fallback draws at wrong position | Check `drawPlanetImage` / `drawSunMarker` | Fix draw function |

---

## Success Criteria

- In Gaian (geocentric) mode: **Earth at center** (0,0), **Sun at ~210px radius** at angle matching its ecliptic longitude.
- In Solar (heliocentric) mode: **Sun at center**, **Earth at ~92px radius** opposite the Sun.
- Both modes render correctly after toggling between them.

---

## Decision Needed

Atlas — shall I proceed with the **debug logging** (Step 1–5) to identify which root cause is active? Or do you want to investigate this yourself first with these steps as a guide?
