import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useUser } from "../context/Usercontext";
import { supabase } from "../../supabaseClient";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ["Overview", "Users", "Jobs", "Gigs", "Applications"];

const STATUS_COLORS = {
  pending:  "#F59E0B",
  accepted: "#10B981",
  approved: "#10B981",
  rejected: "#EF4444",
  active:   "#3B82F6",
  admin:    "#6366F1",
};

const AVATAR_COLORS = [
  "#6366F1","#10B981","#F59E0B","#EF4444","#3B82F6","#EC4899","#8B5CF6","#14B8A6",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function initials(name = "") {
  return (name ?? "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
}

function avatarColor(str = "") {
  return AVATAR_COLORS[(str?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

// ─── UI Primitives ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color, t }) {
  return (
    <View style={[s.statCard, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={[s.iconBox, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[s.statValue, { color: t.text }]}>{value ?? "0"}</Text>
      <Text style={[s.statLabel, { color: t.textFaint }]}>{label}</Text>
    </View>
  );
}

function AvatarBubble({ name, id, size = 36 }) {
  const color = avatarColor(id ?? name ?? "");
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + "33" }]}>
      <Text style={{ color, fontSize: size * 0.38, fontWeight: "700" }}>{initials(name)}</Text>
    </View>
  );
}

function Badge({ status }) {
  const color = STATUS_COLORS[status] ?? "#6B7280";
  return (
    <View style={[s.badge, { backgroundColor: color + "22", borderColor: color }]}>
      <Text style={[s.badgeText, { color }]}>{(status ?? "—").toUpperCase()}</Text>
    </View>
  );
}

function SearchBar({ value, onChangeText, t }) {
  return (
    <View style={[s.searchWrap, { backgroundColor: t.inputBg ?? t.card, borderColor: t.border }]}>
      <Ionicons name="search-outline" size={16} color={t.textFaint} style={{ marginRight: 6 }} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search…"
        placeholderTextColor={t.textFaint}
        style={[s.searchInput, { color: t.text }]}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText("")}>
          <Ionicons name="close-circle" size={16} color={t.textFaint} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyState({ label, t }) {
  return (
    <View style={s.emptyWrap}>
      <Ionicons name="cube-outline" size={36} color={t.textFaint} />
      <Text style={[s.emptyText, { color: t.textFaint }]}>{label}</Text>
    </View>
  );
}

function SectionCount({ n, label, t }) {
  return (
    <Text style={[s.countLabel, { color: t.textFaint }]}>
      {n} {label}{n !== 1 ? "s" : ""}
    </Text>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────
// table = "jobs" | "gigs" | "applications"
// acceptStatus = "approved" for jobs/gigs, "accepted" for applications

function ActionButtons({ table, rowId, currentStatus, onUpdate, t }) {
  const [busy, setBusy] = useState(false);
  const acceptVal = table === "applications" ? "accepted" : "approved";

  const doUpdate = async (newStatus) => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from(table)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", rowId);

      if (error) {
        Alert.alert("Failed", error.message);
      } else {
        onUpdate(rowId, newStatus);
      }
    } catch (e) {
      Alert.alert("Error", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const Btn = ({ target, label, color }) => (
    <TouchableOpacity
      onPress={() => doUpdate(target)}
      disabled={busy}
      style={[s.actionBtn, { backgroundColor: color + "22", borderColor: color }]}
    >
      {busy
        ? <ActivityIndicator size={12} color={color} />
        : <>
            <Ionicons name={target === acceptVal ? "checkmark" : "close"} size={13} color={color} />
            <Text style={[s.actionBtnText, { color }]}>{label}</Text>
          </>
      }
    </TouchableOpacity>
  );

  if (currentStatus === acceptVal) {
    return (
      <View style={s.btnRow}>
        <Btn target="rejected" label="Reject" color="#EF4444" />
      </View>
    );
  }
  if (currentStatus === "rejected") {
    return (
      <View style={s.btnRow}>
        <Btn target={acceptVal} label={table === "applications" ? "Accept" : "Approve"} color="#10B981" />
      </View>
    );
  }
  return (
    <View style={[s.btnRow, { gap: 8 }]}>
      <Btn target={acceptVal} label={table === "applications" ? "Accept" : "Approve"} color="#10B981" />
      <Btn target="rejected" label="Reject" color="#EF4444" />
    </View>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ stats, recentUsers, recentJobs, t }) {
  return (
    <View>
      <View style={s.statsGrid}>
        <StatCard icon="people-outline"        label="Users"        value={stats.users}         color="#6366F1" t={t} />
        <StatCard icon="briefcase-outline"     label="Jobs"         value={stats.jobs}          color="#3B82F6" t={t} />
        <StatCard icon="flash-outline"         label="Gigs"         value={stats.gigs}          color="#10B981" t={t} />
        <StatCard icon="document-text-outline" label="Applications" value={stats.applications}  color="#F59E0B" t={t} />
        <StatCard icon="chatbubbles-outline"   label="Chats"        value={stats.conversations} color="#EC4899" t={t} />
        <StatCard icon="time-outline"          label="Pending"      value={stats.pending}       color="#8B5CF6" t={t} />
      </View>

      <Text style={[s.sectionHeading, { color: t.text }]}>Recent Users</Text>
      {recentUsers.length === 0
        ? <EmptyState label="No users yet" t={t} />
        : recentUsers.slice(0, 5).map((u, i) => (
            <View key={u.id} style={[s.miniRow, { borderBottomColor: t.border }]}>
              <Text style={[s.miniIdx,  { color: t.textFaint }]}>{i + 1}</Text>
              <Text style={[s.miniName, { color: t.text }]}      numberOfLines={1}>{u.name ?? "—"}</Text>
              <Text style={[s.miniSub,  { color: t.textFaint }]}>{u.school ?? "—"}</Text>
              <Text style={[s.miniTime, { color: t.textFaint }]}>{timeAgo(u.created_at)}</Text>
            </View>
          ))
      }

      <Text style={[s.sectionHeading, { color: t.text, marginTop: 20 }]}>Recent Jobs</Text>
      {recentJobs.length === 0
        ? <EmptyState label="No jobs yet" t={t} />
        : recentJobs.slice(0, 5).map((j, i) => (
            <View key={j.id} style={[s.miniRow, { borderBottomColor: t.border }]}>
              <Text style={[s.miniIdx,  { color: t.textFaint }]}>{i + 1}</Text>
              <Text style={[s.miniName, { color: t.text }]}      numberOfLines={1}>{j.title ?? "—"}</Text>
              <Text style={[s.miniSub,  { color: t.textFaint }]}>{j.budget ?? "—"}</Text>
              <Text style={[s.miniTime, { color: t.textFaint }]}>{timeAgo(j.created_at)}</Text>
            </View>
          ))
      }
    </View>
  );
}

// ─── Tab: Users ───────────────────────────────────────────────────────────────

function UsersTab({ users, t }) {
  const [q, setQ] = useState("");
  const list = users.filter(u =>
    (u.name  ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (u.email ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <View>
      <SearchBar value={q} onChangeText={setQ} t={t} />
      <SectionCount n={list.length} label="user" t={t} />
      {list.length === 0
        ? <EmptyState label="No users found" t={t} />
        : list.map(u => (
            <View key={u.id} style={[s.card, { backgroundColor: t.card, borderColor: t.border, flexDirection: "row", alignItems: "center" }]}>
              <AvatarBubble name={u.name} id={u.id} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[s.cardTitle, { color: t.text }]}>{u.name ?? "Unnamed"}</Text>
                <Text style={[s.cardSub,   { color: t.textFaint }]}>{u.email ?? "—"}</Text>
                {u.school ? <Text style={[s.cardSub, { color: t.textFaint }]}>{u.school}</Text> : null}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Badge status={u.is_admin ? "admin" : "active"} />
                <Text style={[s.miniTime, { color: t.textFaint, marginTop: 4 }]}>{timeAgo(u.created_at)}</Text>
              </View>
            </View>
          ))
      }
    </View>
  );
}

// ─── Tab: Jobs ────────────────────────────────────────────────────────────────

function JobsTab({ jobs, onUpdate, t }) {
  const [q, setQ] = useState("");
  const list = jobs.filter(j =>
    (j.title       ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (j.poster_name ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <View>
      <SearchBar value={q} onChangeText={setQ} t={t} />
      <SectionCount n={list.length} label="job" t={t} />
      {list.length === 0
        ? <EmptyState label="No jobs found" t={t} />
        : list.map(j => (
            <View key={j.id} style={[s.card, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={s.rowBetween}>
                <Text style={[s.cardTitle, { color: t.text, flex: 1, marginRight: 8 }]}>{j.title ?? "Untitled"}</Text>
                <Badge status={j.status ?? "pending"} />
              </View>
              <Text style={[s.cardSub, { color: t.textFaint }]}>
                {j.poster_name ?? "Unknown"} • {j.budget ?? "—"} • {timeAgo(j.created_at)}
              </Text>
              {j.category ? <Text style={[s.cardSub, { color: t.textFaint }]}>Category: {j.category}</Text> : null}
              <ActionButtons table="jobs" rowId={j.id} currentStatus={j.status ?? "pending"} onUpdate={onUpdate} t={t} />
            </View>
          ))
      }
    </View>
  );
}

// ─── Tab: Gigs ────────────────────────────────────────────────────────────────

function GigsTab({ gigs, onUpdate, t }) {
  const [q, setQ] = useState("");
  const list = gigs.filter(g =>
    (g.title       ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (g.poster_name ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <View>
      <SearchBar value={q} onChangeText={setQ} t={t} />
      <SectionCount n={list.length} label="gig" t={t} />
      {list.length === 0
        ? <EmptyState label="No gigs found" t={t} />
        : list.map(g => (
            <View key={g.id} style={[s.card, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={s.rowBetween}>
                <Text style={[s.cardTitle, { color: t.text, flex: 1, marginRight: 8 }]}>{g.title ?? "Untitled"}</Text>
                <Badge status={g.status ?? "pending"} />
              </View>
              <Text style={[s.cardSub, { color: t.textFaint }]}>
                {g.poster_name ?? "Unknown"} • ₱{g.price ?? "—"} • {g.delivery ?? "—"}
              </Text>
              {g.category ? <Text style={[s.cardSub, { color: t.textFaint }]}>Category: {g.category}</Text> : null}
              <ActionButtons table="gigs" rowId={g.id} currentStatus={g.status ?? "pending"} onUpdate={onUpdate} t={t} />
            </View>
          ))
      }
    </View>
  );
}

// ─── Tab: Applications ────────────────────────────────────────────────────────

function ApplicationsTab({ applications, onUpdate, t }) {
  const [q, setQ] = useState("");
  const list = applications.filter(a =>
    (a.applicant_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (a.job_title      ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <View>
      <SearchBar value={q} onChangeText={setQ} t={t} />
      <SectionCount n={list.length} label="application" t={t} />
      {list.length === 0
        ? <EmptyState label="No applications found" t={t} />
        : list.map(a => (
            <View key={a.id} style={[s.card, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={s.rowBetween}>
                <Text style={[s.cardTitle, { color: t.text, flex: 1, marginRight: 8 }]}>{a.applicant_name ?? "Unknown"}</Text>
                <Badge status={a.status ?? "pending"} />
              </View>
              {a.job_title ? <Text style={[s.cardSub, { color: t.textFaint }]}>Job: {a.job_title}</Text> : null}
              <Text style={[s.cardSub, { color: t.textFaint }]}>
                Proposed rate: {a.proposed_rate ?? "—"} • {timeAgo(a.created_at)}
              </Text>
              {a.message
                ? <Text style={[s.cardSub, { color: t.textFaint, fontStyle: "italic" }]} numberOfLines={2}>"{a.message}"</Text>
                : null
              }
              <ActionButtons table="applications" rowId={a.id} currentStatus={a.status ?? "pending"} onUpdate={onUpdate} t={t} />
            </View>
          ))
      }
    </View>
  );
}

// ─── Main AdminScreen ─────────────────────────────────────────────────────────

export default function AdminScreen({ navigation }) {
  const { theme: t }    = useTheme();
  const { user, logout } = useUser();

  const [activeTab,  setActiveTab]  = useState("Overview");
  const [refreshing, setRefreshing] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const [users,         setUsers]         = useState([]);
  const [jobs,          setJobs]          = useState([]);
  const [gigs,          setGigs]          = useState([]);
  const [applications,  setApplications]  = useState([]);
  const [conversations, setConversations] = useState([]);

  const isFetching = useRef(false);

  // ── Logout ─────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try { await logout(); }
          catch (e) { Alert.alert("Error", e?.message ?? "Logout failed"); }
        },
      },
    ]);
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    setError(null);

    try {
      // ── Each query is run independently so one failure doesn't kill all ──

      const usersRes = await supabase
        .from("users")
        .select("id, name, email, school, is_admin, created_at")
        .order("created_at", { ascending: false });

      const jobsRes = await supabase
        .from("jobs")
        .select("id, title, budget, category, poster_name, school, status, created_at")
        .order("created_at", { ascending: false });

      const gigsRes = await supabase
        .from("gigs")
        .select("id, title, price, delivery, category, poster_name, school, status, created_at")
        .order("created_at", { ascending: false });

      const appsRes = await supabase
        .from("applications")
        .select("id, applicant_name, proposed_rate, message, status, created_at, job_id")
        .order("created_at", { ascending: false });

      const convsRes = await supabase
        .from("conversations")
        .select("id, updated_at, status, type")
        .order("updated_at", { ascending: false });

      // Log individual errors without crashing
      [
        ["users", usersRes],
        ["jobs",  jobsRes],
        ["gigs",  gigsRes],
        ["apps",  appsRes],
        ["convs", convsRes],
      ].forEach(([name, res]) => {
        if (res.error) console.warn(`[Admin] ${name} error:`, res.error.message);
        else console.log(`[Admin] ${name} loaded:`, res.data?.length ?? 0);
      });

      setUsers        (usersRes.data ?? []);
      setJobs         (jobsRes.data  ?? []);
      setGigs         (gigsRes.data  ?? []);
      setConversations(convsRes.data ?? []);

      // Enrich applications with job titles
      const rawApps  = appsRes.data ?? [];
      const jobTitles = Object.fromEntries(
        (jobsRes.data ?? []).map(j => [j.id, j.title])
      );
      setApplications(
        rawApps.map(a => ({ ...a, job_title: jobTitles[a.job_id] ?? null }))
      );

      // If ALL queries errored, show a top-level error
      const allFailed = [usersRes, jobsRes, gigsRes, appsRes, convsRes]
        .every(r => !!r.error);
      if (allFailed) {
        setError("Could not load data. Check your RLS policies or network.");
      }

    } catch (e) {
      console.error("[Admin] fetchAll crash:", e.message);
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    fetchAll();
    return () => { isFetching.current = false; };
  }, [fetchAll]);

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  // ── Optimistic update handlers ─────────────────────────────────────────────

  const handleJobUpdate = useCallback((id, status) =>
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j)), []);

  const handleGigUpdate = useCallback((id, status) =>
    setGigs(prev => prev.map(g => g.id === id ? { ...g, status } : g)), []);

  const handleAppUpdate = useCallback((id, status) =>
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status } : a)), []);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const pending =
    jobs.filter(j => j.status === "pending").length +
    gigs.filter(g => g.status === "pending").length +
    applications.filter(a => a.status === "pending").length;

  const stats = {
    users:        users.length,
    jobs:         jobs.length,
    gigs:         gigs.length,
    applications: applications.length,
    conversations:conversations.length,
    pending,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const accent = t.accent ?? "#6366F1";

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>

      {/* Header */}
      <View style={[s.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: t.text }]}>Admin Dashboard</Text>
          <Text style={[s.headerSub,   { color: t.textFaint }]}>{user?.email ?? "—"}</Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={[s.iconBtn, { backgroundColor: accent + "18", marginRight: 8 }]}
        >
          <Ionicons name="refresh-outline" size={20} color={accent} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleLogout}
          style={[s.iconBtn, { backgroundColor: "#EF444418" }]}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[s.tabBar, { borderBottomColor: t.border }]}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[s.tabBtn, tab === activeTab && { borderBottomColor: accent, borderBottomWidth: 2.5 }]}
          >
            <Text style={[s.tabText, { color: tab === activeTab ? accent : t.textFaint }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={accent} size="large" />
            <Text style={[s.loadingText, { color: t.textFaint }]}>Loading dashboard…</Text>
          </View>
        ) : error ? (
          <View style={s.center}>
            <Ionicons name="cloud-offline-outline" size={44} color="#EF4444" />
            <Text style={[s.errorText, { color: "#EF4444" }]}>{error}</Text>
            <TouchableOpacity
              onPress={onRefresh}
              style={[s.retryBtn, { backgroundColor: accent + "22", borderColor: accent }]}
            >
              <Text style={{ color: accent, fontWeight: "700" }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {activeTab === "Overview"     && <OverviewTab stats={stats} recentUsers={users} recentJobs={jobs} t={t} />}
            {activeTab === "Users"        && <UsersTab users={users} t={t} />}
            {activeTab === "Jobs"         && <JobsTab  jobs={jobs}  onUpdate={handleJobUpdate} t={t} />}
            {activeTab === "Gigs"         && <GigsTab  gigs={gigs}  onUpdate={handleGigUpdate} t={t} />}
            {activeTab === "Applications" && <ApplicationsTab applications={applications} onUpdate={handleAppUpdate} t={t} />}
          </>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub:   { fontSize: 12, marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  tabBar:  { borderBottomWidth: 1, maxHeight: 48 },
  tabBtn:  { paddingHorizontal: 16, paddingVertical: 12 },
  tabText: { fontSize: 13, fontWeight: "600" },

  content:  { padding: 16 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard:  { width: "47%", borderRadius: 12, borderWidth: 1, padding: 16 },
  statValue: { fontSize: 24, fontWeight: "700", marginTop: 6 },
  statLabel: { fontSize: 12, marginTop: 2 },
  iconBox:   { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  card:      { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardSub:   { fontSize: 12, marginTop: 4 },
  rowBetween:{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },

  badge:     { borderRadius: 12, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "700" },

  searchWrap:  { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 40, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14 },
  countLabel:  { fontSize: 12, marginBottom: 10 },

  sectionHeading: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  miniRow:  { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, alignItems: "center" },
  miniIdx:  { width: 20, fontSize: 12 },
  miniName: { flex: 1, fontSize: 14, fontWeight: "500" },
  miniSub:  { fontSize: 12, marginHorizontal: 8 },
  miniTime: { fontSize: 11 },

  avatar: { alignItems: "center", justifyContent: "center" },

  btnRow:       { flexDirection: "row", marginTop: 10 },
  actionBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  actionBtnText:{ fontSize: 12, fontWeight: "700", marginLeft: 4 },

  center:      { alignItems: "center", marginTop: 60 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText:   { textAlign: "center", marginTop: 10, marginHorizontal: 20, fontSize: 14 },
  retryBtn:    { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },

  emptyWrap: { alignItems: "center", marginTop: 30 },
  emptyText: { marginTop: 8, fontSize: 14 },
});