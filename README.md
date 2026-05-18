# ⏳ Atlastizen Universal Time & Tools

**A solar-resonant time system and living toolkit for sovereign beings.**

AUT (Atlastizen Universal Time) is a location-aware, sun-centered time format that divides each day into 12 sacred segments aligned to your local sunrise and sunset. Built as a progressive web experience with deep astrological, meteorological, and spiritual tooling.

---

## 🌞 Core Philosophy

Traditional clocks ignore our Sun. AUT listens. By anchoring midnight to solar noon and scaling the day into 12 equal "hours" between sunrise and sunset, AUT reconnects human rhythm with the actual light cycle of your exact coordinates.

> *"Our Sun is the oldest clock. We are only remembering how to read them."*

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 (TypeScript) |
| Bundler | Vite 7 |
| Styling | Tailwind CSS 3 + custom CSS properties |
| Astronomy | `astronomy-engine` (vendored) |
| Auth | WebAuthn / Passkeys (`@simplewebauthn`) |
| Backend | Firebase + Vercel KV |
| 3D | Three.js (ready for future expansion) |

---

## 🎛 The 15 Living Panels

| Panel | Purpose |
|-------|---------|
| **AUT Clock** | The heart — live solar time, sunrise/sunset, equilux mode, smooth second interpolation |
| **Cosmic Calendar** | 13.8-billion-year timeline from Universe birth to now, layered by cosmos → galaxy → star → planet → life |
| **Sol Panel** | Solar position, golden hour, day length, solar return tracking |
| **Luna Panel** | Moon phase, rise/set times, illumination percentage, lunar iconography |
| **Gyro Compass** | Device-orientation heading, pitch, roll — with iOS permission handling |
| **Ray Astrology** | Interactive heliocentric/geocentric solar system canvas with zodiac wheel, planetary positions, and configurable orbital overlays |
| **Ray Dial** | 12 color-coded Ray windows of the day with live progress through the current window |
| **Rays of the Week** | 7-day dual-cycle Ray calendar (2 cycles per day) |
| **Ray Reading** | Deep spiritual readings for all 12 Rays: core signature, gifts, ideal activities, and affirmations |
| **Atmosphere** | Live weather + Open-Meteo integration with historical temperature comparison |
| **Postal Lookup** | ZIP-code geolocation and address search |
| **CES Profile** | Core Energetic Signature system with photo upload, gradient generation from signature codes |
| **Community** | Sovereign network features |
| **Settings** | Theme selection, location preferences, geolocation toggle |

---

## 🔮 The Secret Portal

Triple-tap the **Atlas Island** emblem at the bottom of the app to open a hidden overlay:

- **Living Aura Ray Being** — A cluster of 12 interactive orbs (1 head, 2 eyes, 9 aura orbs)
- **Ray Wheel** — Select any chord of Rays to attune the being's palette
- **Plasma Eye Canvas** — Reactive pupils that track your pointer across the screen
- **Eye Shapes** — Round (gentle), Nova (faceted), Crescent (dreaming)
- **Resonance Scoring** — Live percentage based on chord harmony with the active Ray
- **Archetype Saving** — Name and store your favorite configurations to localStorage
- **Wisdom Bubbles** — Random affirmations and live-cycle messages
- **Draggable Physics** — Drag the cluster or nudge individual orbs; they share one gravity
- **Frequency-Scaled Animation** — Aura orbs drift at speeds mapped to their Ray frequency (Red = majestic slow, Magenta = energetic fast)

---

## 🎨 Themes

| Theme | Vibe |
|-------|------|
| **Normal** | Subtle aurora gradients with emerald accents |
| **Retro Sci-Fi** | Emerald vector-grid nostalgia with phosphor glow |
| **Atlas Island** | Gilded temple-tech — midnight teal with violet-gold glow, plus Lux (brighter) and Umbra (deeper) tone variants |

---

## 🌐 External APIs

- **timeapi.io** — Timezone lookup by coordinates
- **Open-Meteo** — Weather and historical temperature data
- **OpenStreetMap / Nominatim** — Reverse geocoding and place names

---

## 🚀 Scripts

```bash
npm run dev          # Vite dev server
npm run build        # TypeScript + production build
npm run preview      # Preview production build
npm run lint         # ESLint
npm run version:patch     # Bump patch version
npm run version:deploy  # Bump minor version
```

---

## 📁 Architecture Notes

The app is intentionally structured as a **single-file application** (`src/index.tsx`, ~7,200 lines) containing all panels, state, and logic. Supporting modules are organized by concern:

- `src/comet/` — Canvas-based solar system map
- `src/config/` — Theme presets, Ray definitions, geocoding config
- `src/data/` — Cosmic calendar entries
- `src/hooks/` — Custom React hooks (smooth AUT, geolocation, solar return)
- `src/lib/` — Astronomy providers, Luna/Sol runtime, LUT tables
- `api/` — Serverless functions for passkey auth, community, CES profiles

---

## 🪪 License

Sovereign Source — built for beings, not corporations.

---

*Atlas Island ✨ [www.atlasisland.co](https://www.atlasisland.co) • V6.6.6*
