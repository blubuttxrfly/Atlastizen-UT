# Atlastizen Universal Time & Tools 📟

**A solar-resonant time system and living toolkit for sovereign beings.**

AUT (Atlastizen Universal Time) is a location-aware, sun-centered time format that divides each day into 12 sacred segments aligned to your local sunrise and sunset. Built as a progressive web experience with deep astrological, meteorological, and spiritual tooling.

---

## Core Philosophy 🌞

Most clocks divide the day into 24 fixed hours without regard for where you stand or what the sky is doing. AUT is different. It measures the living rhythm of light and shadow at your exact coordinates. Sunrise marks the beginning. Sunset marks the halfway point. From there, daylight and night are each divided into 12 sacred intervals that stretch and contract with the season — because our Sun is not a fixed point in the sky.

Our life ancestry on Earth has ALL-ways had a sacred interconnection with our Sun. We have been reading our Sun for eons as our internal compass. Our Sun set forth life beginning, melting away icy terrains over eons, revealing the sacred divine spark of life from our ocean. Our Sun is our most ancient clock that we & our ancestors have been blessed with.

---

## Tech Stack 🛠

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

## The 15 Living Panels 🎛

| Panel | Purpose |
|-------|---------|
| **Ray Astrology ⭐** | Dual-frame astrological system: Gaian Birth (geocentric from Earth) and Solar Heartlight (heliocentric from our Sun). 12 Rays map to zodiac signs, planets, and sacred frequencies. Dimensional layer coming soon. |
| **AUT Clock** | The heart — live solar time, sunrise/sunset, equilux mode, smooth second interpolation |
| **Cosmic Calendar** | 13.8-billion-year timeline from Universe birth to now, layered by cosmos → galaxy → star → planet → life |
| **Sol Panel** | Solar position, golden hour, day length, solar return tracking |
| **Luna Panel** | Moon phase, rise/set times, illumination percentage, lunar iconography |
| **Gyro Compass** | Device-orientation heading, pitch, roll — with iOS permission handling |
| **Ray Dial** | 12 color-coded Ray windows of the day with live progress through the current window |
| **Rays of the Week** | 7-day dual-cycle Ray calendar (2 cycles per day) |
| **Ray Reading** | Deep spiritual readings for all 12 Rays: core signature, gifts, ideal activities, and affirmations |
| **Atmosphere** | Live weather + Open-Meteo integration with historical temperature comparison |
| **Postal Lookup** | ZIP-code geolocation and address search |
| **CES Profile** | Core Energetic Signature system with photo upload, gradient generation from signature codes |
| **Community** | Sovereign network features |
| **Settings** | Theme selection, location preferences, geolocation toggle |

---

## Ray Astrology ⭐

Ray Astrology is the living heart of the AUT system — a dual-frame astrological map that tracks the sacred geometry of our solar system through **two perspectives that must never be confused:**

| Frame | Coordinates | Perspective | Function |
|-------|-------------|-------------|----------|
| **Gaian Birth** | Geocentric | From Earth (Gaia) | Incarnation imprint — body, psyche, lived experience |
| **Solar Heartlight** | Heliocentric | From our Sun (Heartlight) | Soul curriculum — higher purpose, annual evolution |

### The 12 Rays of the Zodiac

Each zodiac sign carries a sacred Ray frequency, mapping the soul's journey through color, virtue, and cosmic timing:

| Zodiac Sign | Ray | Color | Essence |
|-------------|-----|-------|---------|
| ♈︎ Aries | **Red** | #ef4444 | Initiation • courage • first-breath action |
| ♉︎ Taurus | **Orange** | #f97316 | Sensory stability • value • embodiment |
| ♊︎ Gemini | **Yellow** | #facc15 | Curiosity • cognition • connection |
| ♋︎ Cancer | **Green** | #22c55e | Nurture • belonging • home-field manifestation |
| ♌︎ Leo | **Turquoise** | #2dd4bf | Radiance • heart-expression • creative leadership |
| ♍︎ Virgo | **Blue** | #3b82f6 | Refinement • sacred craft • clarity |
| ♎︎ Libra | **Indigo** | #6366f1 | Discernment • harmony • relational truth |
| ♏︎ Scorpio | **Violet** | #8b5cf6 | Depth • transmutation • shadow alchemy |
| ♐︎ Sagittarius | **Magenta** | #d946ef | Expansion • prophecy • horizon-seeking |
| ♑︎ Capricorn | **Omni/Carbon** | #fafafa | Structure • endurance • legacy-building |
| ♒︎ Aquarius | **Crystalline-Carbon** | #a5f3fc | Future codes • networks • innovation |
| ♓︎ Pisces | **Infinite of ALL** | #7dd3fc | Mysticism • compassion • unity consciousness |

### How It Works

The **Heartlight System Map (HSM)** renders an interactive canvas of our solar system. Toggle between **Gaian** and **Solar** lenses to shift between Earth-centered and Sun-centered consciousness. The zodiac wheel, planetary glyphs, and Ray Zones all update in real time as you navigate dates, places, and profiles.

**Coming soon:** The **Dimensional Layer** — each Rays' harmonic frequencies will extend beyond the physical plane into energetic dimensions, mapping the soul's multi-layered architecture through sacred geometry and resonance.

---

## Themes 🎨

| Theme | Vibe |
|-------|------|
| **Normal** | Subtle aurora gradients with emerald accents |
| **Retro Sci-Fi** | Emerald vector-grid nostalgia with phosphor glow |
| **Atlas Island** | Gilded temple-tech — midnight teal with violet-gold glow, plus Lux (brighter) and Umbra (deeper) tone variants |

---

## External APIs 🌐

- **timeapi.io** — Timezone lookup by coordinates
- **Open-Meteo** — Weather and historical temperature data
- **OpenStreetMap / Nominatim** — Reverse geocoding and place names

---

## Scripts 🚀

```bash
npm run dev          # Vite dev server
npm run build        # TypeScript + production build
npm run preview      # Preview production build
npm run lint         # ESLint
npm run version:patch     # Bump patch version
npm run version:deploy  # Bump minor version
```

---

## Architecture Notes 📁

The app is intentionally structured as a **single-file application** (`src/index.tsx`, ~7,200 lines) containing all panels, state, and logic. Supporting modules are organized by concern:

- `src/comet/` — Canvas-based solar system map
- `src/config/` — Theme presets, Ray definitions, geocoding config
- `src/data/` — Cosmic calendar entries
- `src/hooks/` — Custom React hooks (smooth AUT, geolocation, solar return)
- `src/lib/` — Astronomy providers, Luna/Sol runtime, LUT tables
- `api/` — Serverless functions for passkey auth, community, CES profiles

---

## License 🪪

Sovereign Source — built for beings, not corporations.

---

*Atlas Island ✨ [www.atlasisland.co](https://www.atlasisland.co) • V6.6.6*
