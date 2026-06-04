import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Fallback images keyed by keyword in the gig title
const CATEGORY_IMAGES = {
  "react native":  "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&q=80",
  "mobile app":    "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&q=80",
  "coding":        "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80",
  "web":           "https://images.unsplash.com/photo-1547658719-da2b51169166?w=600&q=80",
  "ui/ux":         "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&q=80",
  "design":        "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&q=80",
  "logo":          "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&q=80",
  "video":         "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&q=80",
  "photo":         "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&q=80",
  "writing":       "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&q=80",
  "research":      "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&q=80",
  "tutor":         "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&q=80",
  "math":          "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&q=80",
  "python":        "https://images.unsplash.com/photo-1526379879527-8559ecfcaec0?w=600&q=80",
  "presentation":  "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&q=80",
  "errands":       "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&q=80",
  "default":       "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80",
};

export function getFallbackImage(title = "") {
  const lower = title.toLowerCase();
  for (const [keyword, url] of Object.entries(CATEGORY_IMAGES)) {
    if (keyword !== "default" && lower.includes(keyword)) return url;
  }
  return CATEGORY_IMAGES["default"];
}

// Alias kept for JobsScreen compatibility
export const getImageForTitle = getFallbackImage;

/**
 * GigCard
 * @prop {string}   title      – gig title
 * @prop {string}   author     – display name + school
 * @prop {string}   rating     – e.g. "4.8 (18)" or "New"
 * @prop {string}   delivery   – e.g. "3d delivery"
 * @prop {string}   price      – e.g. "₱1,500"
 * @prop {string}   [imageUrl] – Supabase public URL; falls back to keyword image
 * @prop {function} onPress
 */
export default function GigCard({ title, author, rating, delivery, price, imageUrl, onPress }) {
  const resolvedUri = imageUrl || getFallbackImage(title);
  const isNew = rating === "New";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: resolvedUri }} style={styles.image} resizeMode="cover" />
        <View style={styles.imageOverlay} />
        <View style={styles.deliveryBadge}>
          <Ionicons name="time-outline" size={11} color="white" />
          <Text style={styles.deliveryText}>{delivery}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.author}>{author}</Text>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>

        <View style={styles.footer}>
          <View style={styles.ratingRow}>
            <Ionicons name={isNew ? "sparkles-outline" : "star"} size={13} color={isNew ? "#a78bfa" : "#f59e0b"} />
            <Text style={[styles.rating, isNew && styles.ratingNew]}>{rating}</Text>
          </View>
          <Text style={styles.price}>{price}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0f1629",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  imageWrap:   { height: 160, position: "relative" },
  image:       { width: "100%", height: "100%" },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,9,20,0.35)",
  },
  deliveryBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  deliveryText: { color: "white", fontSize: 11, fontWeight: "600" },

  content:  { padding: 14 },
  author:   { color: "#6b7280", fontSize: 12, marginBottom: 4 },
  title:    { color: "white", fontSize: 16, fontWeight: "700", marginBottom: 10, lineHeight: 22 },

  footer:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ratingRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  rating:     { color: "#9ca3af", fontSize: 13 },
  ratingNew:  { color: "#a78bfa" },
  price:      { color: "#a78bfa", fontWeight: "800", fontSize: 15 },
});