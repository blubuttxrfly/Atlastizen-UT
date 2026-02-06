export type UITheme = "normal" | "retro" | "atlas";

export type ThemeTokens = {
  name: string;
  description: string;
  background: string;
  backgroundSoft: string;
  backgroundOverlay?: string;
  panel: string;
  panelBorder: string;
  panelShadow: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  accent2: string;
  buttonBg: string;
  buttonBorder: string;
  inputBg: string;
  inputBorder: string;
  fontFamily: string;
  backdropClass?: string;
  panelClass?: string;
  // Optional tone variants (Lux/Umbra) for Atlas
  lux?: Partial<ThemeTokens>;
  umbra?: Partial<ThemeTokens>;
};

export const THEME_PRESETS: Record<UITheme, ThemeTokens> = {
  normal: {
    name: "Normal",
    description: "Subtle aurora gradients with emerald accents.",
    background:
      "radial-gradient(ellipse at 30% 20%, rgba(15, 118, 110, 0.08), transparent 40%), radial-gradient(ellipse at 80% 0%, rgba(99, 102, 241, 0.08), transparent 38%), #0b0b0f",
    backgroundSoft: "var(--bg-soft)",
    panel: "rgba(30, 32, 41, 0.92)",
    panelBorder: "rgba(255, 255, 255, 0.06)",
    panelShadow: "0 20px 48px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    text: "#e4e4e7",
    muted: "#a1a1aa",
    accent: "#22c55e",
    accentSoft: "rgba(34, 197, 94, 0.18)",
    accent2: "#38bdf8",
    buttonBg: "rgba(63, 63, 70, 0.9)",
    buttonBorder: "rgba(255, 255, 255, 0.08)",
    inputBg: "rgba(24, 24, 27, 0.9)",
    inputBorder: "rgba(255, 255, 255, 0.08)",
    fontFamily: "'Alice', ui-sans-serif",
    backdropClass: "",
    panelClass: "",
  },
  retro: {
    name: "Retro Sci‑Fi",
    description: "Emerald vector-grid nostalgia with phosphor glow.",
    background: "radial-gradient(ellipse at top, rgba(96, 255, 176, 0.08), transparent 65%) #020b04",
    backgroundSoft: "var(--bg-soft)",
    panel: "rgba(4, 22, 9, 0.94)",
    panelBorder: "rgba(96, 255, 176, 0.35)",
    panelShadow: "inset 0 0 28px rgba(10, 74, 36, 0.78), 0 0 45px rgba(24, 255, 140, 0.12)",
    text: "#b8ffd1",
    muted: "rgba(170, 255, 200, 0.72)",
    accent: "#60ffb0",
    accentSoft: "rgba(96, 255, 176, 0.22)",
    accent2: "#a0ffd4",
    buttonBg: "rgba(3, 38, 18, 0.9)",
    buttonBorder: "rgba(96, 255, 176, 0.4)",
    inputBg: "rgba(2, 26, 12, 0.9)",
    inputBorder: "rgba(96, 255, 176, 0.4)",
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    backdropClass: "retro-theme",
    panelClass: "retro-panel",
  },
  atlas: {
    name: "Atlas Island",
    description: "Gilded temple-tech: deeper midnight teal with violet-gold glow.",
    background:
      "radial-gradient(ellipse at 24% 18%, rgba(255, 211, 128, 0.16), transparent 38%), radial-gradient(ellipse at 70% 12%, rgba(124, 154, 255, 0.18), transparent 42%), radial-gradient(ellipse at 50% 68%, rgba(35, 122, 193, 0.28), transparent 58%), #070d19",
    backgroundSoft: "var(--bg-soft)",
    backgroundOverlay:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='%23f1d58a' fill-opacity='0.22'%3E%3Ccircle cx='12' cy='18' r='1.4'/%3E%3Ccircle cx='88' cy='42' r='0.9'/%3E%3Ccircle cx='140' cy='12' r='1.2'/%3E%3Ccircle cx='52' cy='94' r='1'/%3E%3Ccircle cx='120' cy='108' r='1.6'/%3E%3Ccircle cx='30' cy='140' r='1.1'/%3E%3Ccircle cx='150' cy='150' r='0.8'/%3E%3Ccircle cx='78' cy='130' r='0.9'/%3E%3Ccircle cx='16' cy='70' r='1.5'/%3E%3C/g%3E%3C/svg%3E\")",
    panel:
      "linear-gradient(180deg, rgba(10, 20, 36, 0.9), rgba(6, 14, 26, 0.94)) padding-box, linear-gradient(135deg, rgba(255, 223, 128, 0.8), rgba(165, 125, 247, 0.52)) border-box",
    panelBorder: "rgba(255, 223, 128, 0.75)",
    panelShadow:
      "0 24px 48px rgba(4, 10, 20, 0.7), inset 0 1px 14px rgba(255, 255, 255, 0.07), 0 0 0 1px rgba(165, 125, 247, 0.22)",
    text: "#fffbef",
    muted: "rgba(255, 245, 219, 0.82)",
    accent: "#f6c453",
    accentSoft: "rgba(236, 180, 96, 0.22)",
    accent2: "#b98cff",
    buttonBg:
      "linear-gradient(145deg, rgba(246, 196, 83, 0.9), rgba(185, 140, 255, 0.78)) border-box, linear-gradient(180deg, rgba(8, 16, 30, 0.9), rgba(15, 26, 44, 0.92)) padding-box",
    buttonBorder: "rgba(246, 196, 83, 0.8)",
    inputBg: "rgba(10, 18, 32, 0.92)",
    inputBorder: "rgba(246, 196, 83, 0.42)",
    fontFamily: "'Alice', ui-sans-serif",
    backdropClass: "atlas-bg atlas-hex",
    panelClass: "atlas-panel",
    lux: {
      background:
        "radial-gradient(ellipse at 20% 16%, rgba(255, 233, 181, 0.26), transparent 42%), radial-gradient(ellipse at 72% 12%, rgba(180, 210, 255, 0.22), transparent 48%), #101c2b",
      panel:
        "linear-gradient(180deg, rgba(18, 30, 48, 0.9), rgba(14, 26, 42, 0.92)) padding-box, linear-gradient(135deg, rgba(255, 232, 170, 0.85), rgba(185, 154, 255, 0.58)) border-box",
      text: "#fffdf5",
      muted: "rgba(248, 244, 232, 0.82)",
      accent: "#ffd166",
      accentSoft: "rgba(255, 209, 102, 0.28)",
      accent2: "#cdb6ff",
      buttonBg:
        "linear-gradient(145deg, rgba(255, 214, 102, 0.9), rgba(206, 182, 255, 0.82)) border-box, linear-gradient(180deg, rgba(16, 28, 46, 0.9), rgba(20, 34, 52, 0.94)) padding-box",
      buttonBorder: "rgba(255, 214, 102, 0.82)",
      inputBg: "rgba(14, 24, 40, 0.92)",
      inputBorder: "rgba(255, 214, 102, 0.45)",
    },
    umbra: {
      background:
        "radial-gradient(ellipse at 18% 16%, rgba(255, 193, 120, 0.12), transparent 36%), radial-gradient(ellipse at 70% 10%, rgba(118, 138, 220, 0.12), transparent 38%), #040915",
      panel:
        "linear-gradient(180deg, rgba(8, 14, 26, 0.94), rgba(5, 10, 20, 0.96)) padding-box, linear-gradient(135deg, rgba(255, 210, 122, 0.7), rgba(150, 115, 230, 0.46)) border-box",
      text: "#f7f1e6",
      muted: "rgba(240, 233, 220, 0.8)",
      accent: "#e9b44c",
      accentSoft: "rgba(233, 180, 76, 0.2)",
      accent2: "#a482e6",
      buttonBg:
        "linear-gradient(145deg, rgba(233, 180, 76, 0.82), rgba(164, 130, 230, 0.7)) border-box, linear-gradient(180deg, rgba(5, 10, 20, 0.96), rgba(9, 14, 24, 0.96)) padding-box",
      buttonBorder: "rgba(233, 180, 76, 0.68)",
      inputBg: "rgba(6, 12, 22, 0.94)",
      inputBorder: "rgba(233, 180, 76, 0.38)",
    },
  },
};
