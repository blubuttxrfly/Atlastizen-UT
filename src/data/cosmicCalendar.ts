export type CosmicCalendarLayer = "cosmos" | "galaxy" | "star" | "planet" | "life";

export type CosmicCalendarEntry = {
  id: string;
  title: string;
  yearsAgo: number; // whole-number years before present
  epoch: string; // AUT-style label (e.g., U-Epoch, E-Epoch, L-Epoch)
  layer: CosmicCalendarLayer;
  summary?: string;
};

export type CosmicCalendarTimelineEntry = CosmicCalendarEntry & {
  sinceOrigin: number; // AUT years since Creation of ALL (origin year 0)
};

export const COSMIC_ORIGIN_LABEL = "Creation of ALL";
export const COSMIC_PRESENT_AUT_YEAR = 13_800_000_000; // Whole-number years since origin to now

const BASE_ENTRIES: CosmicCalendarEntry[] = [
  {
    id: "origin",
    title: "Universe birth",
    yearsAgo: 13_800_000_000,
    epoch: "U-Epoch 0",
    layer: "cosmos",
    summary: "Creation of ALL — origin point; rapid expansion sets AUT Year 0.",
  },
  {
    id: "milky-way",
    title: "Milky Way forms (approx)",
    yearsAgo: 13_600_000_000,
    epoch: "G-Epoch 200,000,000",
    layer: "galaxy",
    summary: "Halo stars and protodisk coalesce; our home galaxy takes shape within the first few hundred million years.",
  },
  {
    id: "sun",
    title: "Sun ignites",
    yearsAgo: 4_600_000_000,
    epoch: "S-Epoch 9,200,000,000",
    layer: "star",
    summary: "Solar nebula collapses; fusion begins in the proto-Sun that will define our local day-night rhythm.",
  },
  {
    id: "earth",
    title: "Earth solidifies",
    yearsAgo: 4_540_000_000,
    epoch: "E-Epoch 9,260,000,000",
    layer: "planet",
    summary: "Early Earth cools, crust forms, and oceans start pooling from outgassed steam and cometary ice.",
  },
  {
    id: "life",
    title: "Life on Earth emerges",
    yearsAgo: 3_700_000_000,
    epoch: "L-Epoch 10,100,000,000",
    layer: "life",
    summary: "Earliest biosignatures (stromatolite-style mats and carbon isotopes) point to microbial life taking hold.",
  },
];

export const COSMIC_CALENDAR_TIMELINE: CosmicCalendarTimelineEntry[] = BASE_ENTRIES.map((entry) => ({
  ...entry,
  sinceOrigin: Math.max(0, COSMIC_PRESENT_AUT_YEAR - entry.yearsAgo),
})).sort((a, b) => a.sinceOrigin - b.sinceOrigin);
