import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";
import { getImageForTitle } from "./GigCard";


const CATEGORIES = ["All", "Coding", "Design", "Writing", "Tutoring", "Video", "Research"];

const SORT_OPTIONS = ["Newest", "Budget: High", "Budget: Low", "Most Applied"];

const URGENCY_CONFIG = {
  urgent: { label: "Urgent",   color: "#f87171", bg: "rgba(239,68,68,0.12)",   dot: "#ef4444" },
  medium: { label: "Soon",     color: "#fbbf24", bg: "rgba(245,158,11,0.12)",  dot: "#f59e0b" },
  low:    { label: "Flexible", color: "#34d399", bg: "rgba(16,185,129,0.12)",  dot: "#10b981" },
};

const AVATAR_COLORS = [
  "#7c3aed", "#0891b2", "#059669", "#dc2626",
  "#d97706", "#be185d", "#2563eb", "#7c3aed",
];


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getAvatarColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function timeAgo(dateStr) {
  const diffMins = Math.floor((new Date() - new Date(dateStr)) / 60000);
  if (diffMins < 1)  return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}


// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── Job Card ──────────────────────────────────────────────────────────────────
function JobCard({ job, index, onApply }) {
  const [saved, setSaved] = useState(false);
  const [appCount, setAppCount] = useState(job.applicant_count ?? 0);

  const urgency     = URGENCY_CONFIG[job.urgency_level] ?? URGENCY_CONFIG.low;
  const imageUri    = getImageForTitle(job.title);
  const avatarColor = job.avatar_color ?? getAvatarColor(index);
  const tags        = Array.isArray(job.tags) ? job.tags : [];

  useEffect(() => {
    const channel = supabase
      .channel(`job-apps-${job.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "applications", filter: `job_id=eq.${job.id}` },
        () => setAppCount((c) => c + 1)
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [job.id]);

  return (
    <View style={styles.card}>
      <View style={styles.cardImage}>
        <Image source={{ uri: imageUri }} style={styles.coverImg} resizeMode="cover" />
        <View style={styles.coverOverlay} />

        <View style={styles.cardTopRow}>
          <View style={[styles.urgencyPill, { backgroundColor: urgency.bg }]}>
            <View style={[styles.urgencyDot, { backgroundColor: urgency.dot }]} />
            <Text style={[styles.urgencyLabel, { color: urgency.color }]}>{urgency.label}</Text>
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={() => setSaved(!saved)}>
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={15}
              color={saved ? "#a78bfa" : "rgba(255,255,255,0.85)"}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.cardBottomRow}>
          <View style={styles.catLabel}>
            <Text style={styles.catLabelText}>{job.category}</Text>
          </View>
          <View style={styles.applicantsBadge}>
            <Ionicons name="people-outline" size={11} color="#a78bfa" />
            <Text style={styles.applicantsCount}>{appCount} applied</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.posterRow}>
          <View style={[styles.posterAvatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.posterAvatarText}>{job.avatar ?? job.poster_name?.[0] ?? "?"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.posterName}>{job.poster_name}</Text>
            <Text style={styles.posterSchool}>{job.school}</Text>
          </View>
          <Text style={styles.timeAgo}>{timeAgo(job.created_at)}</Text>
        </View>

        <Text style={styles.jobTitle}>{job.title}</Text>
        <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>

        {tags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            <Ionicons name="time-outline" size={13} color="#6b7280" />
            <Text style={styles.footerMeta}>{job.urgency ?? "Flexible"}</Text>
          </View>
          <View style={styles.footerRight}>
            <Text style={styles.budget}>{job.budget}</Text>
            <TouchableOpacity style={styles.applyBtn} onPress={() => onApply(job)}>
              <Text style={styles.applyBtnText}>Apply</Text>
              <Ionicons name="arrow-forward" size={13} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}


// ── Apply Modal ───────────────────────────────────────────────────────────────
function ApplyModal({ job, onClose }) {
  const { user } = useUser();

  const [applicantName, setApplicantName] = useState(
    user?.name || user?.user_metadata?.full_name || ""
  );
  const [school,       setSchool]       = useState(user?.school || "");
  const [message,      setMessage]      = useState("");
  const [portfolio,    setPortfolio]    = useState("");
  const [proposedRate, setProposedRate] = useState("");
  const [loading,      setLoading]      = useState(false);
  const [success,      setSuccess]      = useState(false);

  if (!job) return null;

  const canSubmit = applicantName.trim().length > 0 && message.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id) return;
    setLoading(true);

    try {
      // Insert the application — no conversation created here.
      // The poster will accept/decline from Notifications; chat opens on acceptance.
      const { error: appError } = await supabase.from("applications").insert({
        job_id:         job.id,
        applicant_name: applicantName.trim(),
        school:         school.trim(),
        message:        message.trim(),
        portfolio_link: portfolio.trim(),
        proposed_rate:  proposedRate.trim(),
        applicant_id:   user.id,
      });
      if (appError) throw appError;

      setSuccess(true);

      // Auto-close after showing success state
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (e) {
      console.error("Apply error:", e.message);
      alert("Failed to submit application. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const FIELDS = [
    { label: "Your Name *",                   value: applicantName, setter: setApplicantName, placeholder: "e.g. Juan Dela Cruz"  },
    { label: "School / University",           value: school,        setter: setSchool,        placeholder: "e.g. USLS, DLSU, UPV" },
    { label: "Portfolio Link (optional)",     value: portfolio,     setter: setPortfolio,     placeholder: "https://..."          },
    { label: "Your Proposed Rate (optional)", value: proposedRate,  setter: setProposedRate,  placeholder: "e.g. ₱800"            },
  ];

  return (
    <View style={modal.overlay}>
      <TouchableOpacity style={modal.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={modal.sheet}>
        <View style={modal.handle} />

        {success ? (
          <View style={modal.successState}>
            <View style={modal.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#10b981" />
            </View>
            <Text style={modal.successTitle}>Application Sent!</Text>
            <Text style={modal.successSub}>
              The poster will review your application. You'll be notified if accepted!
            </Text>
            <View style={modal.successHint}>
              <Ionicons name="time-outline" size={16} color="#7c3aed" />
              <Text style={modal.successHintText}>Awaiting Review</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={modal.header}>
              <View style={modal.headerInfo}>
                <View style={modal.jobTypePill}>
                  <Ionicons name="briefcase-outline" size={11} color="#a78bfa" />
                  <Text style={modal.jobTypePillText}>Job Application</Text>
                </View>
                <Text style={modal.jobSnippet} numberOfLines={2}>{job.title}</Text>
                <View style={modal.jobMeta}>
                  <Text style={modal.jobMetaBudget}>{job.budget}</Text>
                  <Text style={modal.dot}>·</Text>
                  <Text style={modal.jobMetaSchool}>{job.poster_name}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
                <Ionicons name="close" size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Review notice */}
            <View style={modal.messagingNotice}>
              <Ionicons name="information-circle-outline" size={14} color="#7c3aed" />
              <Text style={modal.messagingNoticeText}>
                Once the poster accepts your application, a chat thread will open automatically.
              </Text>
            </View>

            <View style={modal.divider} />

            <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
              {FIELDS.map(({ label, value, setter, placeholder }) => (
                <View key={label} style={modal.field}>
                  <Text style={modal.fieldLabel}>{label}</Text>
                  <TextInput
                    style={modal.input}
                    value={value}
                    onChangeText={setter}
                    placeholder={placeholder}
                    placeholderTextColor="#4b5563"
                  />
                </View>
              ))}
              <View style={modal.field}>
                <Text style={modal.fieldLabel}>Cover Message *</Text>
                <TextInput
                  style={[modal.input, modal.textarea]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Tell the poster why you're the right person for this job..."
                  placeholderTextColor="#4b5563"
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[modal.submitBtn, !canSubmit && modal.submitDisabled]}
              onPress={handleSubmit}
              disabled={loading || !canSubmit}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={16} color="white" />
                  <Text style={modal.submitText}>Submit Application</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function JobsScreen({ navigation }) {
  const [jobs,           setJobs]           = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search,         setSearch]         = useState("");
  const [sortBy,         setSortBy]         = useState("Newest");
  const [showSort,       setShowSort]       = useState(false);
  const [applyJob,       setApplyJob]       = useState(null);

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    const { data, error } = await supabase
      .from("jobs")
      .select("*, applications(count)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const enriched = data.map((j) => ({
        ...j,
        applicant_count: j.applications?.[0]?.count ?? 0,
      }));
      setJobs(enriched);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchJobs();
    const channel = supabase
      .channel("jobs-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "jobs" }, fetchJobs)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchJobs]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  // ── Filtering & Sorting ────────────────────────────────────────────────────

  const filtered = jobs
    .filter((j) => {
      const matchCat    = activeCategory === "All" || j.category === activeCategory;
      const matchSearch = !search
        || j.title.toLowerCase().includes(search.toLowerCase())
        || (j.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === "Budget: High")  return (b.budget_raw ?? 0) - (a.budget_raw ?? 0);
      if (sortBy === "Budget: Low")   return (a.budget_raw ?? 0) - (b.budget_raw ?? 0);
      if (sortBy === "Most Applied")  return (b.applicant_count ?? 0) - (a.applicant_count ?? 0);
      return 0;
    });

  const urgentCount     = jobs.filter((j) => j.urgency_level === "urgent").length;
  const totalApplicants = jobs.reduce((a, j) => a + (j.applicant_count ?? 0), 0);

  const STATS = [
    { icon: "briefcase-outline", val: String(jobs.length),     label: "Jobs"    },
    { icon: "flash-outline",     val: String(urgentCount),     label: "Urgent"  },
    { icon: "people-outline",    val: String(totalApplicants), label: "Applied" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />

      {applyJob && (
        <ApplyModal
          job={applyJob}
          onClose={() => setApplyJob(null)}
        />
      )}

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Job Board</Text>
          <Text style={styles.headerSub}>
            {loading ? "Loading..." : `${filtered.length} open position${filtered.length !== 1 ? "s" : ""}`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.postJobBtn}
          onPress={() => navigation.navigate("PostJob")}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={16} color="white" />
          <Text style={styles.postJobBtnText}>Post Job</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />}
      >
        {/* Search + Sort */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color="#4b5563" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search jobs or skills..."
              placeholderTextColor="#4b5563"
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color="#6b7280" />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.sortBtn, showSort && styles.sortBtnActive]}
            onPress={() => setShowSort(!showSort)}
          >
            <Ionicons name="funnel-outline" size={16} color={showSort ? "white" : "#a78bfa"} />
          </TouchableOpacity>
        </View>

        {showSort && (
          <View style={styles.sortDropdown}>
            {SORT_OPTIONS.map((opt, i) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.sortOption,
                  sortBy === opt && styles.sortOptionActive,
                  i === SORT_OPTIONS.length - 1 && { borderBottomWidth: 0 },
                ]}
                onPress={() => { setSortBy(opt); setShowSort(false); }}
              >
                <Text style={[styles.sortOptionText, sortBy === opt && styles.sortOptionTextActive]}>
                  {opt}
                </Text>
                {sortBy === opt && <Ionicons name="checkmark" size={14} color="#7c3aed" />}
              </TouchableOpacity>
            ))}
          </View>
        )}

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

        <View style={styles.statsBar}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Ionicons name={s.icon} size={14} color="#7c3aed" />
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={styles.loadingText}>Fetching jobs…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={36} color="#374151" />
            </View>
            <Text style={styles.emptyTitle}>No jobs found</Text>
            <Text style={styles.emptySub}>Try a different filter or search term</Text>
          </View>
        ) : (
          filtered.map((job, i) => (
            <JobCard key={job.id} job={job} index={i} onApply={setApplyJob} />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#0d1527",
  },
  headerTitle: { color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  headerSub:   { color: "#4b5563", fontSize: 12, marginTop: 2 },
  postJobBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#7c3aed",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  postJobBtnText: { color: "white", fontWeight: "700", fontSize: 13 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },

  searchRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#0b1120",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#1a2540",
  },
  searchInput:   { flex: 1, color: "white", fontSize: 14 },
  sortBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#0b1120",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1a2540",
  },
  sortBtnActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  sortDropdown: {
    backgroundColor: "#0b1120",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1a2540",
    marginBottom: 14,
    overflow: "hidden",
  },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#0d1527",
  },
  sortOptionActive:     { backgroundColor: "#13103a" },
  sortOptionText:       { color: "#6b7280", fontSize: 14 },
  sortOptionTextActive: { color: "#a78bfa", fontWeight: "700" },

  catRow:        { gap: 8, paddingBottom: 2, marginBottom: 16 },
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: "#0b1120",
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#1a2540",
  },
  catChipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  catText:       { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  catTextActive: { color: "white" },

  statsBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#0b1120",
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#1a2540",
  },
  statItem:  { alignItems: "center", gap: 4 },
  statVal:   { color: "white", fontWeight: "800", fontSize: 16 },
  statLabel: { color: "#4b5563", fontSize: 11 },

  loadingWrap: { alignItems: "center", paddingTop: 60, gap: 12 },
  loadingText: { color: "#4b5563", fontSize: 14 },
  emptyState:  { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#0b1120",
    borderWidth: 1,
    borderColor: "#1a2540",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: { color: "#374151", fontSize: 16, fontWeight: "700" },
  emptySub:   { color: "#1f2937", fontSize: 13 },

  card: {
    backgroundColor: "#0b1120",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#1a2540",
  },
  cardImage:    { height: 165, position: "relative" },
  coverImg:     { width: "100%", height: "100%" },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,9,20,0.5)" },
  cardTopRow: {
    position: "absolute",
    top: 12, left: 12, right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  urgencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  urgencyDot:   { width: 6, height: 6, borderRadius: 3 },
  urgencyLabel: { fontSize: 11, fontWeight: "700" },
  saveBtn: {
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cardBottomRow: {
    position: "absolute",
    bottom: 12, left: 12, right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  catLabel: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  catLabelText: { color: "white", fontSize: 11, fontWeight: "700" },
  applicantsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(20,10,50,0.75)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
  },
  applicantsCount: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },

  cardBody:  { padding: 16 },
  posterRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  posterAvatar: {
    width: 32, height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  posterAvatarText: { color: "white", fontSize: 12, fontWeight: "800" },
  posterName:       { color: "#e5e7eb", fontWeight: "700", fontSize: 13 },
  posterSchool:     { color: "#4b5563", fontSize: 11, marginTop: 1 },
  timeAgo:          { color: "#374151", fontSize: 11, marginLeft: "auto" },
  jobTitle:         { color: "white", fontSize: 16, fontWeight: "800", marginBottom: 6, lineHeight: 22 },
  jobDesc:          { color: "#6b7280", fontSize: 13, lineHeight: 19, marginBottom: 12 },

  tagScroll: { marginBottom: 14 },
  tag: {
    backgroundColor: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  tagText: { color: "#6b7280", fontSize: 11, fontWeight: "600" },

  cardFooter:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerLeft:  { flexDirection: "row", alignItems: "center", gap: 5 },
  footerMeta:  { color: "#4b5563", fontSize: 12 },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  budget:      { color: "#a78bfa", fontWeight: "800", fontSize: 16 },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#7c3aed",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  applyBtnText: { color: "white", fontWeight: "700", fontSize: 13 },
});


// ─────────────────────────────────────────────────────────────────────────────
// MODAL STYLES
// ─────────────────────────────────────────────────────────────────────────────

const modal = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, zIndex: 999, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)" },
  sheet: {
    backgroundColor: "#0b1120",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: "#1a2540",
    maxHeight: "90%",
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: "#1e2d4a",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },

  header:     { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 },
  headerInfo: { flex: 1 },

  jobTypePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1e1b4b",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  jobTypePillText: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },

  jobSnippet:    { color: "white", fontSize: 15, fontWeight: "700", lineHeight: 22 },
  jobMeta:       { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  jobMetaBudget: { color: "#a78bfa", fontWeight: "800", fontSize: 13 },
  dot:           { color: "#4b5563" },
  jobMetaSchool: { color: "#6b7280", fontSize: 13 },
  closeBtn: {
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },

  messagingNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(124,58,237,0.1)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.25)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  messagingNoticeText: { color: "#a78bfa", fontSize: 12, flex: 1, lineHeight: 17 },

  divider: { height: 1, backgroundColor: "#1a2540", marginBottom: 18 },

  field:      { marginBottom: 16 },
  fieldLabel: { color: "#6b7280", fontSize: 12, fontWeight: "700", marginBottom: 8, letterSpacing: 0.3 },
  input: {
    backgroundColor: "#050914",
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    color: "white",
    borderWidth: 1,
    borderColor: "#1a2540",
  },
  textarea: { minHeight: 90 },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  submitDisabled: { opacity: 0.45 },
  submitText:     { color: "white", fontWeight: "700", fontSize: 15 },

  successState: { alignItems: "center", paddingVertical: 30, gap: 12 },
  successIcon: {
    width: 80, height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(16,185,129,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  successTitle: { color: "white", fontSize: 20, fontWeight: "800" },
  successSub:   { color: "#6b7280", fontSize: 14, textAlign: "center" },
  successHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(124,58,237,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
  },
  successHintText: { color: "#a78bfa", fontWeight: "700", fontSize: 13 },
});