# AUT Time & Tools 📟

**A solar-resonant time system and living toolkit for sovereign beings.**

AUT (Atlastizen Universal Time) is a location-aware, sun-centered time format that divides each day into 12 sacred segments aligned to your local sunrise and sunset. Built as a progressive web experience with deep astrological, meteorological, and spiritual tooling.

This repository holds a **living prototype**. The astronomical calculations powering the Ray Dials, Luna Cycles, and Cosmic Calendar draw from publicly available ephemeris engines, including NASA JPL Horizons data and the open-source `astronomy-engine` library by Don Cross. These engines are accessible to ALL beings with an internet connection and a willingness to learn.

---

## Core Philosophy 🌞

Most clocks divide the day into 24 fixed hours without regard for where you stand or what the sky is doing. AUT measures the living rhythm of light and shadow at your exact coordinates. Sunrise marks the beginning. Sunset marks the halfway point. From there, daylight and night each divide into 12 sacred intervals that stretch and contract with the season, because our Sun is a moving flame, never a fixed point.

Our life ancestry on Earth has ALL-ways carried a sacred interconnection with our Sun. We have been reading our Sun for eons as our internal compass. Our Sun set forth life beginning, melting away icy terrains through ages, revealing the sacred divine spark of life from our ocean. Our Sun is our most ancient clock that we and our ancestors have been blessed with.

---

## What This Prototype Includes 🛠

| Layer | Technology |
|-------|-----------|
| Framework | React 19 (TypeScript) |
| Bundler | Vite 7 |
| Styling | Tailwind CSS 3 + custom CSS properties |
| Astronomy | `astronomy-engine` (vendored, pure JavaScript, offline-capable) |
| 3D | Three.js (ready for future expansion) |

---

## The 13 Living Panels 🎛

| Panel | Purpose |
|-------|---------|
| **AUT Ray Dial** | The heart, live solar time, sunrise and sunset, equilux mode, smooth second interpolation. Features 3 rotating Ray Dials: AUT/Sol, Luna, and Astro Gaia. |
| **Cosmic Calendar** | 13.8-billion-year timeline from Universe birth to now, layered by cosmos, galaxy, star, planet, life, plus sacred Luna Year reckoning anchored to March 26, 0005 CE |
| **Sol Panel** | Solar position, golden hour, day length, solar return tracking, Dawn/Sol Zenith/Dusk cards |
| **Luna Panel** | Moon phase, rise and set times, illumination percentage, lunar iconography, 12-Moon Threshold tracker with Ray-colored progression, Luna Year 2084 display |
| **Gyro Compass** | Device-orientation heading, pitch, roll, with iOS permission handling |
| **Ray Astrology** | Dual-frame astrological system: Gaian Birth (geocentric from Earth) and Solar Heartlight (heliocentric from our Sun) |
| **Community** | Sovereign network features |
| **Rays of the Week** | 7-day dual-cycle Ray calendar (2 cycles per day) |
| **Ray Reading** | Deep spiritual readings for all 12 Rays, core signature, gifts, ideal activities, and affirmations |
| **Atmosphere Panel** | Live weather and Open-Meteo integration with historical temperature comparison |
| **Location Lookup** | ZIP-code geolocation and address search |
| **CES Profile** | Core Energetic Signature system with photo upload, gradient generation from signature codes |
| **Settings** | Theme selection, location preferences, geolocation toggle |

---

## The Three Ray Dials 🌈

The AUT Ray Dial page contains three interconnected rotating dials, each tracking a different celestial body through the 12 sacred Ray frequencies:

### AUT / Sol Ray Dial
The primary dial. Tracks our Sun through the day, mapping your local solar cycle into 12 sacred segments. Dawn marks 00:00 AUT, Sol Zenith is 03:00 AUT, Dusk is 06:00 AUT, and New Dawn resets at 12:00 AUT. Features a ferris-wheel effect that keeps zodiac symbols upright in Zenith mode.

### Luna Ray Dial
Tracks our Moon through its synodic cycle, displaying current phase, illumination percentage, zodiac sign, and active Ray frequency. Features a 12-Moon Threshold tracker with Ray-colored dots showing progress through the current Luna Year. Zenith mode is default, with rotating dial and upright zodiac symbols.

### Astro Gaia Ray Dial
Tracks our Earth through the zodiac from a geocentric perspective, displaying the current astrological season and active Ray frequency. Features the same ferris-wheel effect for upright symbols in Zenith mode.

---

## Ray Astrology ⭐

Ray Astrology is the living heart of the AUT system, a dual-frame astrological map that tracks the sacred geometry of our solar system through **two perspectives that hold equal truth:**

| Frame | Coordinates | Perspective | Function |
|-------|-------------|-------------|----------|
| **Gaian Birth** | Geocentric | From Earth (Gaia) | Incarnation imprint, body, psyche, lived experience |
| **Solar Heartlight** | Heliocentric | From our Sun (Heartlight) | Soul curriculum, higher purpose, annual evolution |

### The 12 Rays of the Zodiac

Each zodiac sign carries a sacred Ray frequency, mapping the soul journey through color, virtue, and cosmic timing:

| Zodiac Sign | Ray | Color | Essence |
|-------------|-----|-------|---------|
| Aries ♈︎ | **Red** | #ef4444 | Initiation, courage, first-breath action |
| Taurus ♉︎ | **Orange** | #f97316 | Sensory stability, value, embodiment |
| Gemini ♊︎ | **Yellow** | #facc15 | Curiosity, cognition, connection |
| Cancer ♋︎ | **Green** | #22c55e | Nurture, belonging, home-field manifestation |
| Leo ♌︎ | **Turquoise** | #2dd4bf | Radiance, heart-expression, creative leadership |
| Virgo ♍︎ | **Blue** | #3b82f6 | Refinement, sacred craft, clarity |
| Libra ♎︎ | **Indigo** | #6366f1 | Discernment, harmony, relational truth |
| Scorpio ♏︎ | **Violet** | #8b5cf6 | Depth, transmutation, shadow alchemy |
| Sagittarius ♐︎ | **Magenta** | #d946ef | Expansion, prophecy, horizon-seeking |
| Capricorn ♑︎ | **Omni** | #fafafa | Structure, endurance, legacy-building |
| Aquarius ♒︎ | **Elemental** | #a5f3fc | Future codes, networks, innovation, quantum realities |
| Pisces ♓︎ | **Infinite of ALL** | #7dd3fc | Mysticism, compassion, unity consciousness |

### How It Works

The **Heartlight System Map (HSM)** renders an interactive canvas of our solar system. Toggle between **Gaian** and **Solar** lenses to shift between Earth-centered and Sun-centered consciousness. The zodiac wheel, planetary glyphs, and Ray Zones update in real time as you navigate dates, places, and profiles.

**In development:** The **Dimensional Layer**, each Ray harmonic frequency extending beyond the physical plane into energetic dimensions, mapping the soul multi-layered architecture through sacred geometry and resonance.

---

## Luna Year System 🌙

The Luna Year is a sacred 12-Moon calendar anchored to **March 26, 0005 CE**, a New Moon Hybrid Solar Eclipse in Aries at 2:42:41 Local Sidereal Time. This epoch marks Luna Year 1.

- Each sacred year spans 12 complete synodic cycles (~354 days)
- Each Moon Threshold carries the frequency of its corresponding Ray
- The Vernal Equinox of that year arrived around March 23-24 in the Julian calendar, placing this epoch 2-3 days after the celestial gate opened
- **Current Luna Year:** 2084
- **Current Moon Threshold:** 7 of 12 (Indigo Ray)

---

## Themes 🎨

| Theme | Vibe |
|-------|------|
| **Normal** | Subtle aurora gradients with emerald accents |
| **Retro Sci-Fi** | Emerald vector-grid nostalgia with phosphor glow |
| **Atlas Island** | Gilded temple-tech, midnight teal with violet-gold glow, plus Lux (brighter) and Umbra (deeper) tone variants |

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

The app holds an intentionally unified structure, `src/index.tsx`, approximately 7,900 lines, containing all panels, state, and logic. Supporting modules organize by concern:

- `src/comet/` — Canvas-based solar system map
- `src/config/` — Theme presets, Ray definitions, geocoding config
- `src/data/` — Cosmic calendar entries
- `src/hooks/` — Custom React hooks (smooth AUT, geolocation, solar return)
- `src/lib/` — Astronomy providers, Luna and Sol runtime, LUT tables
- `api/` — Serverless functions for passkey auth, community, CES profiles

---

## Roadmap 🗺

- **Native iOS / Android app** via Expo + React Native, offline-first, GPS-secure
- **Dimensional Layer** for energetic Ray frequency mapping
- **Chinese Zodiac Animal** integration with Luna Years
- **Kickstarter campaign** to fund human co-creation

---

## License 🪪

Sovereign Source, built for beings.

---

*Atlas Island ✨ [www.atlasisland.co](https://www.atlasisland.co) • Prototype v7.7.7*
