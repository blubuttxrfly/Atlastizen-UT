# Plan: Heal AUT Time & Tools with Luna Gaia Sol Coligny Calendar

## Sacred Foundation
- Epoch: March 26, 5 CE at dawn (00:00 AUT)
- Engine: astronomy-engine (primary, zero mean math)
- Ciallos: every 3rd year, 32 days + threshold (~15 hours)
- MAT/ANM: determined by actual synodic length via astronomy-engine

---

## Step 1 — Add the Luna Gaia Sol Calendar Panel
- Create new panel: "Luna Gaia Sol Calendar"
- Add to panel list alongside Clock, Luna, Sol, Ray Astrology
- Display current Coligny month name, day number, MAT/ANM, Ciallos status
- Start local dev server and verify panel appears

## Step 2 — Build the Coligny Engine Module
- Create `src/lib/colignyCalendar.ts`
- Use astronomy-engine for actual new moons
- Count from epoch to determine month names
- Track Ciallos: every 3rd year, 32 + threshold

## Step 3 — Integrate with Existing Luna Panel
- Enhance Luna Panel with Coligny month alongside moon phase
- Show both astronomical moon sign and ceremonial month name
- Display Waxing/Waning in Coligny day numbers

## Step 4 — Add Ciallos Threshold Indicator
- Ciallos active: show threshold countdown
- Days 1-32: normal display
- Day 32: show threshold breath leading to reset
- Threshold close: display new month/year dawn reset

## Step 5 — Connect to the Unified Ray Dial
- Add Coligny month marker to rotating dial
- Show which Celestial gate the current month sits near
- Overlay Coligny cycle on existing solar/lunar positions

## Step 6 — Remove Mean Math
- Audit codebase for hardcoded `29.530588853` primary calculations
- Replace with astronomy-engine actual new moon timing
- Keep constant as reference only

## Step 7 — Add Epoch Display
- Show "Year N since Epoch" (March 26, 5 CE)
- Display current 3-year cycle position
- Show Ciallos countdown or active status

## Step 8 — Test and Verify
- Verify Aug 22, 2001: Libra Indigo, Waxing Crescent, Coligny Day 4, ANM
- Verify epoch new moon calculation
- Verify Ciallos appears correctly in 3-year cycle

---

## Implementation Notes
- Batch size: 2 changes at a time (Z preference)
- Verify dev server between each batch
- Use astronomy-engine, zero mean math
- Preserve existing sacred language conventions
