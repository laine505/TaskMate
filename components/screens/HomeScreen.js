import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  StatusBar, SafeAreaView, ActivityIndicator, RefreshControl, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../context/Usercontext";
import { supabase } from "../../supabaseClient";
import { getImageForTitle } from "./GigCard";

const CATEGORIES = ["All", "Coding", "Design", "Writing", "Tutoring", "Video", "Research"];

const CATEGORY_MAP = {
  All: null, Coding: "Coding", Design: "Design", Writing: "Writing",
  Tutoring: "Tutoring", Video: "Video", Research: "Research",
};

const URGENCY_CONFIG = {
  urgent: { label: "Urgent",   color: "#f87171", bg: "rgba(239,68,68,0.12)",  dot: "#ef4444" },
  medium: { label: "Soon",     color: "#fbbf24", bg: "rgba(245,158,11,0.12)", dot: "#f59e0b" },
  low:    { label: "Flexible", color: "#34d399", bg: "rgba(16,185,129,0.12)", dot: "#10b981" },
};

const STATUS_CONFIG = {
  approved: { label: "Approved", color: "#34d399", bg: "rgba(16,185,129,0.12)", icon: "checkmark-circle-outline" },
  pending:  { label: "Pending",  color: "#fbbf24", bg: "rgba(245,158,11,0.12)", icon: "time-outline"            },
  rejected: { label: "Rejected", color: "#f87171", bg: "rgba(239,68,68,0.12)",  icon: "close-circle-outline"   },
};

const AVATAR_COLORS = [
  "#7c3aed","#0891b2","#059669","#dc2626",
  "#d97706","#be185d","#2563eb","#9333ea",
];

const STATS_PLACEHOLDER = [
  { value: "—", label: "Open Jobs",    icon: "briefcase-outline"     },
  { value: "—", label: "Students",     icon: "people-outline"        },
  { value: "—", label: "Applications", icon: "document-text-outline" },
];

function getInitials(user) {
  const name = user?.name || user?.user_metadata?.full_name || user?.email || "U";
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

function fmtCount(n) {
  if (n == null || isNaN(n)) return "0";
  return n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n);
}

function timeAgo(dateStr) {
  const diffMins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diffMins < 1)  return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

function getAvatarColor(i) {
  return AVATAR_COLORS[i % AVATAR_COLORS.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB CARD
// ─────────────────────────────────────────────────────────────────────────────

function JobCard({ job, index, onPress, currentUserId }) {
  const [appCount, setAppCount] = useState(job.applicant_count ?? 0);
  const urgency     = URGENCY_CONFIG[job.urgency_level] ?? URGENCY_CONFIG.low;
  const imageUri    = job.image_url || getImageForTitle(job.title);
  const avatarColor = getAvatarColor(index);
  const isOwner     = job.user_id === currentUserId;
  const statusCfg   = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;

  useEffect(() => {
    const channel = supabase
      .channel(`home-job-apps-${job.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "applications", filter: `job_id=eq.${job.id}` },
        () => setAppCount((c) => c + 1))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [job.id]);

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={cardStyles.imageWrap}>
        <Image source={{ uri: imageUri }} style={cardStyles.coverImg} resizeMode="cover" />
        <View style={cardStyles.coverOverlay} />

        {/* Featured badge on image */}
        {job.is_featured && (
          <View style={cardStyles.featuredBadge}>
            <Ionicons name="star" size={10} color="#f59e0b" />
            <Text style={cardStyles.featuredBadgeText}>Featured</Text>
          </View>
        )}

        <View style={cardStyles.topRow}>
          <View style={[cardStyles.urgencyPill, { backgroundColor: urgency.bg }]}>
            <View style={[cardStyles.urgencyDot, { backgroundColor: urgency.dot }]} />
            <Text style={[cardStyles.urgencyLabel, { color: urgency.color }]}>{urgency.label}</Text>
          </View>
        </View>
        <View style={cardStyles.bottomRow}>
          <View style={cardStyles.catLabel}>
            <Text style={cardStyles.catLabelText}>{job.category || "General"}</Text>
          </View>
          <View style={cardStyles.appsBadge}>
            <Ionicons name="people-outline" size={11} color="#a78bfa" />
            <Text style={cardStyles.appsCount}>{appCount} applied</Text>
          </View>
        </View>
      </View>

      <View style={cardStyles.body}>
        <View style={cardStyles.posterRow}>
          {job.poster_avatar_url ? (
            <Image
              source={{ uri: job.poster_avatar_url }}
              style={[cardStyles.avatar, { backgroundColor: avatarColor }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[cardStyles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={cardStyles.avatarText}>{(job.poster_name || "T")[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={cardStyles.posterName}>{job.poster_name || "Taskmate User"}</Text>
            <Text style={cardStyles.posterSchool}>{job.school || ""}</Text>
          </View>
          <Text style={cardStyles.timeAgo}>{timeAgo(job.created_at)}</Text>
        </View>

        {/* Status badge — only visible to the post owner */}
        {isOwner && (
          <View style={[cardStyles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Ionicons name={statusCfg.icon} size={12} color={statusCfg.color} />
            <Text style={[cardStyles.statusBadgeText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>
        )}

        <Text style={cardStyles.title}>{job.title}</Text>
        {job.description ? (
          <Text style={cardStyles.desc} numberOfLines={2}>{job.description}</Text>
        ) : null}

        <View style={cardStyles.footer}>
          <View style={cardStyles.footerLeft}>
            <Ionicons name="time-outline" size={13} color="#6b7280" />
            <Text style={cardStyles.footerMeta}>{job.urgency || "Flexible"}</Text>
          </View>
          <Text style={cardStyles.budget}>{job.budget || "TBD"}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { user } = useUser();

  const [activeCategory, setActiveCategory] = useState("All");
  const [jobs,           setJobs]           = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [hasNewApps,     setHasNewApps]     = useState(false);
  const [fetchError,     setFetchError]     = useState(null);
  const [mySchoolOnly,   setMySchoolOnly]   = useState(false);
  const [liveStats,      setLiveStats]      = useState(STATS_PLACEHOLDER);

  const firstName = getFirstName(user);
  const initials  = getInitials(user);
  const avatarUrl = user?.image_url || null;

  // ── Live Stats ─────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const [
        { count: jobCount,  error: e1 },
        { count: userCount, error: e2 },
        { count: appCount,  error: e3 },
      ] = await Promise.all([
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("applications").select("id", { count: "exact", head: true }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;

      setLiveStats([
        { value: fmtCount(jobCount  ?? 0) + "+", label: "Open Jobs",    icon: "briefcase-outline"     },
        { value: fmtCount(userCount ?? 0) + "+", label: "Students",     icon: "people-outline"        },
        { value: fmtCount(appCount  ?? 0) + "+", label: "Applications", icon: "document-text-outline" },
      ]);
    } catch (err) {
      console.error("fetchStats error:", err.message);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Unread Applications Dot ────────────────────────────────────────────────
  const checkUnreadApps = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: myJobs, error: jobsError } = await supabase
        .from("jobs").select("id").eq("user_id", user.id);
      if (jobsError) throw jobsError;
      if (!myJobs?.length) { setHasNewApps(false); return; }
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
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "applications" },
        () => checkUnreadApps())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id, checkUnreadApps]);

  // ── Fetch Jobs ─────────────────────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    setFetchError(null);
    try {
      let query = supabase
        .from("jobs")
        .select("*, applications(count)")
        .eq("is_featured", true)
        .order("created_at", { ascending: false });

      const cat = CATEGORY_MAP[activeCategory];
      if (cat)                          query = query.eq("category", cat);
      if (searchQuery.trim())           query = query.ilike("title", `%${searchQuery.trim()}%`);
      if (mySchoolOnly && user?.school) query = query.eq("school", user.school);

      const { data, error } = await query.limit(20);
      if (error) throw error;

      const rows = data || [];
      const userIds = [...new Set(rows.map((j) => j.user_id).filter(Boolean))];
      let avatarMap = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("users").select("id, image_url").in("id", userIds);
        if (users) users.forEach((u) => { avatarMap[u.id] = u.image_url; });
      }
      setJobs(rows.map((j) => ({
        ...j,
        applicant_count:   j.applications?.[0]?.count ?? 0,
        poster_avatar_url: avatarMap[j.user_id] ?? j.poster_avatar_url ?? null,
      })));
    } catch (err) {
      console.error("Failed to fetch jobs:", err.message);
      setFetchError("Could not load jobs. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCategory, searchQuery, mySchoolOnly, user?.school]);

  useEffect(() => { setLoading(true); fetchJobs(); }, [fetchJobs]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("home-jobs-live")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "jobs" },
        () => { fetchJobs(); fetchStats(); })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs" },
        () => fetchJobs())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchJobs, fetchStats]);

  const onRefresh = () => { setRefreshing(true); fetchJobs(); fetchStats(); };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" colors={["#7c3aed"]} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}><Text style={styles.logoAccent}>Task</Text>mate.</Text>
            <Text style={styles.subtitle}>Find your next campus hustle</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => { setHasNewApps(false); navigation.navigate("Notifications"); }}
            >
              <Ionicons name="notifications-outline" size={20} color="#a78bfa" />
              {hasNewApps && <View style={styles.notifDot} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate("Profile")}>
              {avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                : <Text style={styles.avatarText}>{initials}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Greeting Banner ── */}
        <View style={styles.banner}>
          <View style={styles.bannerGlow} />
          <Text style={styles.bannerLabel}>WELCOME BACK</Text>
          <Text style={styles.bannerName}>Good day, {firstName}!</Text>
          <Text style={styles.bannerSub}>Ready to earn or hire today?</Text>
        </View>

        {/* ── Live Stats ── */}
        <View style={styles.statsRow}>
          {liveStats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon} size={16} color="#7c3aed" style={{ marginBottom: 6 }} />
              <Text style={styles.statNumber}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Search ── */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#6b7280" />
          <TextInput
            placeholder="Search jobs, skills, students..."
            placeholderTextColor="#666"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.offerButton} onPress={() => navigation.navigate("PostJob")} activeOpacity={0.85}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="megaphone-outline" size={20} color="white" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Post a Job</Text>
              <Text style={styles.actionSub}>Hire a fellow student</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.postButton} onPress={() => navigation.navigate("Jobs")} activeOpacity={0.85}>
            <View style={styles.actionIconWrapOutline}>
              <Ionicons name="briefcase-outline" size={20} color="#a78bfa" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitleOutline}>Browse Jobs</Text>
              <Text style={styles.actionSubOutline}>Find work that fits you</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#7c3aed" />
          </TouchableOpacity>
        </View>

        {/* ── Divider ── */}
        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>EXPLORE</Text>
          <View style={styles.divider} />
        </View>

        {/* ── Categories ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.catText, activeCategory === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Section Header ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {searchQuery ? `Results for "${searchQuery}"` : "Trending Jobs"}
          </Text>
          {user?.school ? (
            <TouchableOpacity
              style={[styles.schoolFilterBtn, mySchoolOnly && styles.schoolFilterBtnActive]}
              onPress={() => setMySchoolOnly((v) => !v)}
            >
              <Ionicons name="school-outline" size={12} color={mySchoolOnly ? "white" : "#a78bfa"} />
              <Text style={[styles.schoolFilterText, mySchoolOnly && { color: "white" }]}>My School</Text>
            </TouchableOpacity>
          ) : (
            !searchQuery && <Text style={styles.sectionBadge}>HOT</Text>
          )}
        </View>

        {/* ── Error Banner ── */}
        {fetchError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="wifi-outline" size={16} color="#f87171" />
            <Text style={styles.errorText}>{fetchError}</Text>
            <TouchableOpacity onPress={() => { setLoading(true); fetchJobs(); }}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Job List ── */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={styles.loadingText}>Loading jobs...</Text>
          </View>
        ) : jobs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="briefcase-outline" size={40} color="#4b5563" />
            <Text style={styles.emptyTitle}>No featured jobs yet</Text>
            <Text style={styles.emptyText}>
              {mySchoolOnly ? "No featured jobs from your school yet."
                : searchQuery ? "Try a different search term."
                : "Check back soon — the admin will feature jobs here!"}
            </Text>
          </View>
        ) : (
          jobs.map((job, i) => (
            <JobCard
              key={job.id}
              job={job}
              index={i}
              currentUserId={user?.id}
              onPress={() => navigation.navigate("JobDetail", { job })}
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
  container: { flex: 1, paddingTop: 12, paddingHorizontal: 10 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  logo:        { fontSize: 22, color: "white", fontWeight: "900", letterSpacing: -0.5 },
  logoAccent:  { color: "#7c3aed" },
  subtitle:    { color: "#6b7280", fontSize: 12, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center" },
  iconBtn: { position: "relative", backgroundColor: "#111827", padding: 10, borderRadius: 12, marginRight: 10 },
  notifDot: { position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: "#7c3aed" },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#7c3aed", justifyContent: "center", alignItems: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  avatarText:  { color: "white", fontWeight: "800", fontSize: 16 },

  banner: { backgroundColor: "#0f1629", borderRadius: 20, padding: 22, marginBottom: 20, borderWidth: 1, borderColor: "#1e2d4a", position: "relative", overflow: "hidden" },
  bannerGlow: { position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: "#7c3aed", opacity: 0.12 },
  bannerLabel: { color: "#7c3aed", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 6 },
  bannerName:  { color: "white", fontSize: 22, fontWeight: "800", marginBottom: 4 },
  bannerSub:   { color: "#6b7280", fontSize: 13 },

  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: "#0f1629", borderRadius: 14, padding: 14, alignItems: "center", marginHorizontal: 4, borderWidth: 1, borderColor: "#1e2d4a" },
  statNumber: { color: "white", fontSize: 15, fontWeight: "800", marginBottom: 2 },
  statLabel:  { color: "#6b7280", fontSize: 10, fontWeight: "500", textAlign: "center" },

  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#111827", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, borderWidth: 1, borderColor: "#1e2d4a", gap: 10 },
  searchInput: { flex: 1, color: "white", fontSize: 14 },

  actions:     { marginBottom: 24 },
  offerButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#7c3aed", borderRadius: 14, padding: 16, marginBottom: 10 },
  postButton:  { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: "#7c3aed" },
  actionIconWrap:        { backgroundColor: "rgba(255,255,255,0.15)", padding: 8, borderRadius: 10 },
  actionIconWrapOutline: { backgroundColor: "#1e1b4b", padding: 8, borderRadius: 10 },
  actionTitle:        { color: "white", fontWeight: "700", fontSize: 15 },
  actionSub:          { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 },
  actionTitleOutline: { color: "white", fontWeight: "700", fontSize: 15 },
  actionSubOutline:   { color: "#6b7280", fontSize: 12, marginTop: 2 },

  dividerRow:  { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  divider:     { flex: 1, height: 1, backgroundColor: "#1e2d4a" },
  dividerText: { color: "#4b5563", fontSize: 10, fontWeight: "700", letterSpacing: 2, marginHorizontal: 10 },

  catRow:        { paddingBottom: 16, paddingRight: 20 },
  catChip:       { backgroundColor: "#111827", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: "#1e2d4a" },
  catChipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  catText:       { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  catTextActive: { color: "white" },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle:  { color: "white", fontSize: 17, fontWeight: "800" },
  sectionBadge:  { color: "#f59e0b", fontSize: 11, fontWeight: "700", backgroundColor: "#1c1408", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, overflow: "hidden" },
  schoolFilterBtn:       { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#0f1629", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "#7c3aed" },
  schoolFilterBtnActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  schoolFilterText:      { color: "#a78bfa", fontSize: 11, fontWeight: "700" },

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(239,68,68,0.1)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  errorText:   { flex: 1, color: "#f87171", fontSize: 12 },
  retryText:   { color: "#a78bfa", fontSize: 12, fontWeight: "700" },

  loadingWrap: { alignItems: "center", paddingVertical: 40, gap: 12 },
  loadingText: { color: "#6b7280", fontSize: 14 },
  emptyWrap:   { alignItems: "center", paddingVertical: 50, gap: 10 },
  emptyTitle:  { color: "white", fontSize: 16, fontWeight: "700" },
  emptyText:   { color: "#6b7280", fontSize: 13, textAlign: "center" },
});

const cardStyles = StyleSheet.create({
  card: { backgroundColor: "#0b1120", borderRadius: 20, overflow: "hidden", marginBottom: 18, borderWidth: 1, borderColor: "#1a2540" },

  imageWrap:    { height: 165, position: "relative" },
  coverImg:     { width: "100%", height: "100%" },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,9,20,0.5)" },

  featuredBadge: {
    position: "absolute", top: 12, right: 12, zIndex: 5,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(245,158,11,0.2)", borderWidth: 1, borderColor: "#f59e0b55",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  featuredBadgeText: { color: "#f59e0b", fontSize: 10, fontWeight: "800" },

  topRow:      { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  urgencyPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  urgencyDot:  { width: 6, height: 6, borderRadius: 3 },
  urgencyLabel:{ fontSize: 11, fontWeight: "700" },

  bottomRow:   { position: "absolute", bottom: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catLabel:    { backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  catLabelText:{ color: "white", fontSize: 11, fontWeight: "700" },
  appsBadge:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(20,10,50,0.75)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "rgba(124,58,237,0.3)" },
  appsCount:   { color: "#a78bfa", fontSize: 11, fontWeight: "700" },

  body:      { padding: 16 },
  posterRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  avatar:    { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  avatarText:   { color: "white", fontSize: 12, fontWeight: "800" },
  posterName:   { color: "#e5e7eb", fontWeight: "700", fontSize: 13 },
  posterSchool: { color: "#4b5563", fontSize: 11, marginTop: 1 },
  timeAgo:      { color: "#374151", fontSize: 11, marginLeft: "auto" },

  statusBadge:     { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },

  title:  { color: "white", fontSize: 16, fontWeight: "800", marginBottom: 6, lineHeight: 22 },
  desc:   { color: "#6b7280", fontSize: 13, lineHeight: 19, marginBottom: 12 },

  footer:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 5 },
  footerMeta: { color: "#4b5563", fontSize: 12 },
  budget:     { color: "#a78bfa", fontWeight: "800", fontSize: 16 },
});