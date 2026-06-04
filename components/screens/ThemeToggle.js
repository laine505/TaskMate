// ─────────────────────────────────────────────────────────────────────────────
// ThemeToggle.js
//
// Drop-in toggle component — place anywhere (Profile, Settings, Header, etc.)
//
// Usage:
//   import ThemeToggle from "./ThemeToggle";
//   <ThemeToggle />        ← renders a full row with label
//   <ThemeToggle compact />← renders icon-only button
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ compact = false }) {
  const { isDark, toggleTheme, theme: t } = useTheme();

  if (compact) {
    return (
      <TouchableOpacity
        style={[cs.iconBtn, { backgroundColor: t.card, borderColor: t.border }]}
        onPress={toggleTheme}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isDark ? "sunny-outline" : "moon-outline"}
          size={18}
          color={t.accent}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[cs.row, { backgroundColor: t.card, borderColor: t.border }]}>
      {/* Left icon */}
      <View style={[cs.iconWrap, { backgroundColor: t.accentBg }]}>
        <Ionicons
          name={isDark ? "moon-outline" : "sunny-outline"}
          size={18}
          color={t.accent}
        />
      </View>

      {/* Label */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[cs.label, { color: t.text }]}>
          {isDark ? "Dark Mode" : "Light Mode"}
        </Text>
        <Text style={[cs.sub, { color: t.textMuted }]}>
          {isDark ? "Switch to light theme" : "Switch to dark theme"}
        </Text>
      </View>

      {/* Toggle */}
      <Switch
        value={isDark}
        onValueChange={toggleTheme}
        trackColor={{ false: "#e2e8f0", true: t.accent }}
        thumbColor={isDark ? "#fff" : "#fff"}
        ios_backgroundColor="#e2e8f0"
      />
    </View>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// HOW TO ADD ThemeToggle TO YOUR ProfileScreen
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. Import at top of ProfileScreen.js:
//      import ThemeToggle from "./ThemeToggle";
//      import { useTheme } from "../context/ThemeContext";
//
// 2. Inside the component, get theme:
//      const { theme: t } = useTheme();
//
// 3. Replace backgroundColor: "#050914" with t.bg in root style.
//
// 4. Add the toggle row in your settings section:
//
//    <View style={{ marginVertical: 16, paddingHorizontal: 20 }}>
//      <Text style={{ color: t.textMuted, fontSize: 11, fontWeight: "700",
//                     letterSpacing: 1, marginBottom: 10 }}>
//        APPEARANCE
//      </Text>
//      <ThemeToggle />
//    </View>
//
// 5. To navigate to Admin (if user.is_admin):
//    {user?.is_admin && (
//      <TouchableOpacity onPress={() => navigation.navigate("Admin")}>
//        <Text>Admin Panel</Text>
//      </TouchableOpacity>
//    )}
// ─────────────────────────────────────────────────────────────────────────────


const cs = StyleSheet.create({
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: "center", alignItems: "center", borderWidth: 1,
  },
  row: {
    flexDirection: "row", alignItems: "center",
    padding: 16, borderRadius: 16, borderWidth: 1,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  label: { fontSize: 15, fontWeight: "700" },
  sub:   { fontSize: 12, marginTop: 1 },
});