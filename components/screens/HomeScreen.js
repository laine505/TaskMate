// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen.js
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GigCard from "./GigCard";
import { useUser } from "../context/Usercontext";
import { supabase } from "../../supabaseClient";


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Coding", "Design", "Tutoring", "Writing", "Photography"];

const CATEGORY_MAP = {
  "All":         null,
  "Coding":      "Coding",
  "Design":      "Design",
  "Tutoring":    "Tutoring",
  "Writing":     "Writing",
  "Photography": "Photography",
};

const STATS = [
  { value: "2.4K+", label: "Active Gigs", icon: "briefcase-outline" },
  { value: "8.1K+", label: "Students",    icon: "people-outline"    },
  { value: "₱1.2K", label: "Avg Payout",  icon: "cash-outline"      },
];


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(user) {
  const name = user?.name || user?.user_metadata?.full_name || user?.email || "User";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);
}

function getFirstName(user) {
  return (
    user?.name?.split(" ")[0] ||
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "User"
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { user } = useUser();

  const [activeCategory, setActiveCategory] = useState("All");
  const [gigs,           setGigs]           = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [hasNewApps,     setHasNewApps]     = useState(false);

  const firstName = getFirstName(user);
  const initials  = getInitials(user);
  const avatarUrl = user?.image_url || null;

  // ── Live Unread Applications Dot ───────────────────────────────────────────
  // FIX: jobs table uses user_id (not poster_id) for the job owner

  const checkUnreadApps = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: myJobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id")
        .eq("user_id", user.id); // ← FIXED: was poster_id

      if (jobsError) throw jobsError;

      if (!myJobs?.length) {
        setHasNewApps(false);
        return;
      }

      const { count, error: countError } = await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .in("job_id", myJobs.map((j) => j.id))
        .eq("status", "pending");

      if (countError) throw countError;

      setHasNewApps(count > 0);
    } catch (err) {
      console.error("checkUnreadApps error:", err.message);
    }
  }, [user?.id]);

  useEffect(() => {
    checkUnreadApps();

    if (!user?.id) return;

    const channel = supabase
      .channel("home-unread-apps")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "applications" },
        () => checkUnreadApps()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id, checkUnreadApps]);

  // ── Fetch Gigs ─────────────────────────────────────────────────────────────

  const fetchGigs = useCallback(async () => {
    try {
      let query = supabase
        .from("gigs")
        .select("id, title, category, price, delivery, image_url, created_at, poster_name, school")
        .order("created_at", { ascending: false });

      const categoryFilter = CATEGORY_MAP[activeCategory];
      if (categoryFilter)     query = query.eq("category", categoryFilter);
      if (searchQuery.trim()) query = query.ilike("title", `%${searchQuery.trim()}%`);

      const { data, error } = await query.limit(20);
      if (error) throw error;
      setGigs(data || []);
    } catch (err) {
      console.error("Failed to fetch gigs:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    setLoading(true);
    fetchGigs();
  }, [fetchGigs]);

  useEffect(() => {
    const channel = supabase
      .channel("home-gigs-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gigs" }, fetchGigs)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchGigs]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGigs();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7c3aed"
            colors={["#7c3aed"]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>
              <Text style={styles.logoAccent}>Task</Text>mate.
            </Text>
            <Text style={styles.subtitle}>Find your next campus hustle</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                setHasNewApps(false); // optimistically clear dot on tap
                navigation.navigate("Notifications");
              }}
            >
              <Ionicons name="notifications-outline" size={20} color="#a78bfa" />
              {hasNewApps && <View style={styles.notifDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => navigation.navigate("Profile")}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerGlow} />
          <Text style={styles.bannerLabel}>WELCOME BACK</Text>
          <Text style={styles.bannerName}>Good day, {firstName}!</Text>
          <Text style={styles.bannerSub}>Ready to earn or hire today?</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon} size={16} color="#7c3aed" style={{ marginBottom: 6 }} />
              <Text style={styles.statNumber}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#6b7280" />
          <TextInput
            placeholder="Search gigs, skills, students..."
            placeholderTextColor="#666"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.filterBtn}>
            <Ionicons name="options-outline" size={16} color="#a78bfa" />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.offerButton}
            onPress={() => navigation.navigate("PostGig")}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name="add-circle-outline" size={20} color="white" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Offer a Service</Text>
              <Text style={styles.actionSub}>List your skill &amp; earn</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.postButton}
            onPress={() => navigation.navigate("PostJob")}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconWrapOutline}>
              <Ionicons name="megaphone-outline" size={20} color="#a78bfa" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitleOutline}>Post a Job</Text>
              <Text style={styles.actionSubOutline}>Hire a fellow student</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#7c3aed" />
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>EXPLORE</Text>
          <View style={styles.divider} />
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.catText, activeCategory === cat && styles.catTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {searchQuery ? `Results for "${searchQuery}"` : "Trending Gigs"}
          </Text>
          {!searchQuery && <Text style={styles.sectionBadge}>HOT</Text>}
        </View>

        {/* Gig List */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={styles.loadingText}>Loading gigs...</Text>
          </View>
        ) : gigs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="search-outline" size={40} color="#4b5563" />
            <Text style={styles.emptyTitle}>No gigs found</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? "Try a different search term." : "Be the first to post in this category!"}
            </Text>
          </View>
        ) : (
          gigs.map((gig) => (
            <GigCard
              key={gig.id}
              title={gig.title}
              author={
                gig.poster_name
                  ? `${gig.poster_name}${gig.school ? " · " + gig.school : ""}`
                  : "Taskmate User"
              }
              rating="New"
              delivery={gig.delivery || "TBD"}
              price={`₱${Number(gig.price || 0).toLocaleString()}`}
              imageUrl={gig.image_url}
              onPress={() => navigation.navigate("GigDetail", { gig })}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: "#050914" },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  logo:        { fontSize: 22, color: "white", fontWeight: "900", letterSpacing: -0.5 },
  logoAccent:  { color: "#7c3aed" },
  subtitle:    { color: "#6b7280", fontSize: 12, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center" },
  iconBtn: {
    position: "relative",
    backgroundColor: "#111827",
    padding: 10,
    borderRadius: 12,
    marginRight: 10,
  },
  notifDot: {
    position: "absolute",
    top: 8, right: 8,
    width: 7, height: 7,
    borderRadius: 4,
    backgroundColor: "#7c3aed",
  },
  avatarBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: "#7c3aed",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText:  { color: "white", fontWeight: "800", fontSize: 16 },

  banner: {
    backgroundColor: "#0f1629",
    borderRadius: 20,
    padding: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#1e2d4a",
    position: "relative",
    overflow: "hidden",
  },
  bannerGlow: {
    position: "absolute",
    top: -30, right: -30,
    width: 120, height: 120,
    borderRadius: 60,
    backgroundColor: "#7c3aed",
    opacity: 0.12,
  },
  bannerLabel: { color: "#7c3aed", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 6 },
  bannerName:  { color: "white", fontSize: 22, fontWeight: "800", marginBottom: 4 },
  bannerSub:   { color: "#6b7280", fontSize: 13 },

  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: "#0f1629",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  statNumber: { color: "white", fontSize: 15, fontWeight: "800", marginBottom: 2 },
  statLabel:  { color: "#6b7280", fontSize: 10, fontWeight: "500", textAlign: "center" },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  searchInput: { flex: 1, color: "white", fontSize: 14, marginLeft: 10, marginRight: 8 },
  filterBtn:   { backgroundColor: "#1e1b4b", padding: 6, borderRadius: 8 },

  actions:     { marginBottom: 24 },
  offerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  postButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#7c3aed",
  },
  actionIconWrap:        { backgroundColor: "rgba(255,255,255,0.15)", padding: 8, borderRadius: 10 },
  actionIconWrapOutline: { backgroundColor: "#1e1b4b", padding: 8, borderRadius: 10 },
  actionTitle:           { color: "white", fontWeight: "700", fontSize: 15 },
  actionSub:             { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 },
  actionTitleOutline:    { color: "white", fontWeight: "700", fontSize: 15 },
  actionSubOutline:      { color: "#6b7280", fontSize: 12, marginTop: 2 },

  dividerRow:  { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  divider:     { flex: 1, height: 1, backgroundColor: "#1e2d4a" },
  dividerText: { color: "#4b5563", fontSize: 10, fontWeight: "700", letterSpacing: 2, marginHorizontal: 10 },

  catRow:        { paddingBottom: 16, paddingRight: 20 },
  catChip: {
    backgroundColor: "#111827",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  catChipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  catText:       { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  catTextActive: { color: "white" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { color: "white", fontSize: 17, fontWeight: "800" },
  sectionBadge: {
    color: "#f59e0b",
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: "#1c1408",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    overflow: "hidden",
  },

  loadingWrap: { alignItems: "center", paddingVertical: 40, gap: 12 },
  loadingText: { color: "#6b7280", fontSize: 14 },
  emptyWrap:   { alignItems: "center", paddingVertical: 50, gap: 10 },
  emptyTitle:  { color: "white", fontSize: 16, fontWeight: "700" },
  emptyText:   { color: "#6b7280", fontSize: 13, textAlign: "center" },
});