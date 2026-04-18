import React, { createContext, useContext, useState, useLayoutEffect } from "react";

type PaletteInfo = {
  id: string;
  name: string;
  description: string;
  swatch: string[];
};

type PaletteColors = {
  primary: string;
  primaryGlow: string;
  accent: string;
  ring: string;
};

type ThemeContextType = {
  palette: string;
  mode: "dark" | "light";
  setPalette: (id: string) => void;
  toggleMode: () => void;
  palettes: PaletteInfo[];
};

const paletteColors: Record<string, PaletteColors> = {
  violet: {
    primary: "280 85% 55%",
    primaryGlow: "320 80% 55%",
    accent: "190 85% 45%",
    ring: "280 85% 55%",
  },
  emerald: {
    primary: "160 84% 39%",
    primaryGlow: "172 66% 50%",
    accent: "190 85% 45%",
    ring: "160 84% 39%",
  },
  amber: {
    primary: "38 92% 50%",
    primaryGlow: "25 95% 53%",
    accent: "0 84% 60%",
    ring: "38 92% 50%",
  },
  blue: {
    primary: "217 91% 60%",
    primaryGlow: "239 84% 67%",
    accent: "263 70% 50%",
    ring: "217 91% 60%",
  },
};

const paletteColorsDark: Record<string, PaletteColors> = {
  violet: {
    primary: "280 95% 70%",
    primaryGlow: "320 90% 70%",
    accent: "190 95% 60%",
    ring: "280 95% 70%",
  },
  emerald: {
    primary: "160 90% 55%",
    primaryGlow: "172 80% 60%",
    accent: "190 95% 60%",
    ring: "160 90% 55%",
  },
  amber: {
    primary: "38 95% 60%",
    primaryGlow: "25 95% 63%",
    accent: "0 90% 65%",
    ring: "38 95% 60%",
  },
  blue: {
    primary: "217 95% 70%",
    primaryGlow: "239 90% 75%",
    accent: "263 80% 70%",
    ring: "217 95% 70%",
  },
};

const defaultPalettes: PaletteInfo[] = [
  { id: "violet", name: "Violet Mesh", description: "Default purple-pink gradient theme", swatch: ["#a855f7", "#ec4899", "#06b6d4"] },
  { id: "emerald", name: "Emerald Node", description: "Green-teal nature inspired", swatch: ["#10b981", "#14b8a6", "#06b6d4"] },
  { id: "amber", name: "Amber Signal", description: "Warm amber-orange tones", swatch: ["#f59e0b", "#ef4444", "#f97316"] },
  { id: "blue", name: "Blue Circuit", description: "Cool blue-indigo palette", swatch: ["#3b82f6", "#6366f1", "#8b5cf6"] },
];

const ThemeContext = createContext<ThemeContextType>({
  palette: "violet",
  mode: "dark",
  setPalette: () => {},
  toggleMode: () => {},
  palettes: defaultPalettes,
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getInitialMode(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("meshlink-mode");
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

function applyPaletteColors(root: HTMLElement, paletteId: string, isDark: boolean) {
  const colors = isDark
    ? (paletteColorsDark[paletteId] || paletteColorsDark.violet)
    : (paletteColors[paletteId] || paletteColors.violet);

  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--primary-glow", colors.primaryGlow);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--ring", colors.ring);
  root.style.setProperty("--sidebar-primary", colors.primary);
  root.style.setProperty("--sidebar-ring", colors.primary);

  // Update gradients
  root.style.setProperty(
    "--gradient-primary",
    `linear-gradient(135deg, hsl(${colors.primary}), hsl(${colors.primaryGlow}))`,
  );
  root.style.setProperty(
    "--gradient-accent",
    `linear-gradient(135deg, hsl(${colors.accent}), hsl(${colors.primary}))`,
  );
  root.style.setProperty(
    "--gradient-bubble-own",
    isDark
      ? `linear-gradient(135deg, hsl(${colors.primary} / 0.7), hsl(${colors.primaryGlow} / 0.7))`
      : `linear-gradient(135deg, hsl(${colors.primary}), hsl(${colors.primaryGlow}))`,
  );
  root.style.setProperty(
    "--gradient-mesh",
    `radial-gradient(at 27% 37%, hsl(${colors.primary} / ${isDark ? "0.15" : "0.08"}) 0px, transparent 50%), ` +
    `radial-gradient(at 97% 21%, hsl(${colors.accent} / ${isDark ? "0.12" : "0.06"}) 0px, transparent 50%), ` +
    `radial-gradient(at 52% 99%, hsl(${colors.primaryGlow} / ${isDark ? "0.10" : "0.05"}) 0px, transparent 50%), ` +
    `radial-gradient(at 10% 90%, hsl(240 80% 50% / ${isDark ? "0.10" : "0.05"}) 0px, transparent 50%)`,
  );

  // Update shadows
  root.style.setProperty(
    "--shadow-glow",
    `0 0 ${isDark ? "40px" : "30px"} hsl(${colors.primary} / ${isDark ? "0.3" : "0.15"})`,
  );
  root.style.setProperty(
    "--shadow-elegant",
    `0 20px 60px -15px hsl(${colors.primary} / ${isDark ? "0.4" : "0.2"})`,
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("meshlink-palette") || "violet" : "violet",
  );
  const [mode, setMode] = useState<"dark" | "light">(getInitialMode);

  const setPalette = (id: string) => {
    setPaletteState(id);
    localStorage.setItem("meshlink-palette", id);
  };

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("meshlink-mode", next);
      return next;
    });
  };

  // Apply dark class + palette colors
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    applyPaletteColors(root, palette, mode === "dark");
  }, [mode, palette]);

  return (
    <ThemeContext.Provider value={{ palette, mode, setPalette, toggleMode, palettes: defaultPalettes }}>
      {children}
    </ThemeContext.Provider>
  );
}
