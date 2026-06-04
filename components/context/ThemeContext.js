// ─────────────────────────────────────────────────────────────────────────────
// ThemeContext.js
// Drop-in light / dark mode provider.
// Wrap your <App /> with <ThemeProvider>, then call useTheme() in any screen.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Palette ───────────────────────────────────────────────────────────────────

export const THEMES = {
  dark: {
    isDark: true,
    bg:           "#050914",
    bg2:          "#0b1120",
    card:         "#0f1629",
    card2:        "#111827",
    border:       "#1e2d4a",
    border2:      "#1a2540",
    text:         "#ffffff",
    textSub:      "#9ca3af",
    textMuted:    "#6b7280",
    textFaint:    "#4b5563",
    accent:       "#7c3aed",
    accentLight:  "#a78bfa",
    accentBg:     "#1e1b4b",
    accentBg2:    "#13103a",
    success:      "#10b981",
    successBg:    "rgba(16,185,129,0.12)",
    warning:      "#f59e0b",
    warningBg:    "rgba(245,158,11,0.10)",
    danger:       "#ef4444",
    dangerBg:     "rgba(239,68,68,0.12)",
    inputBg:      "#111827",
    tabBg:        "#050914",
    tabBorder:    "#111827",
    statusBar:    "light-content",
    shadow:       "#000000",
  },
  light: {
    isDark: false,
    bg:           "#f0f4ff",
    bg2:          "#e8edf8",
    card:         "#ffffff",
    card2:        "#f8faff",
    border:       "#dde4f0",
    border2:      "#c8d3e8",
    text:         "#0f172a",
    textSub:      "#475569",
    textMuted:    "#64748b",
    textFaint:    "#94a3b8",
    accent:       "#7c3aed",
    accentLight:  "#6d28d9",
    accentBg:     "#ede9fe",
    accentBg2:    "#ddd6fe",
    success:      "#059669",
    successBg:    "rgba(5,150,105,0.10)",
    warning:      "#d97706",
    warningBg:    "rgba(217,119,6,0.10)",
    danger:       "#dc2626",
    dangerBg:     "rgba(220,38,38,0.10)",
    inputBg:      "#eef2ff",
    tabBg:        "#ffffff",
    tabBorder:    "#e2e8f0",
    statusBar:    "dark-content",
    shadow:       "#94a3b8",
  },
};

// ── Context ───────────────────────────────────────────────────────────────────

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true); // default dark

  // Restore saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem("@taskmate_theme").then((saved) => {
      if (saved !== null) setIsDark(saved === "dark");
    }).catch(() => {});
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem("@taskmate_theme", next ? "dark" : "light").catch(() => {});
      return next;
    });
  };

  const theme = isDark ? THEMES.dark : THEMES.light;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
};