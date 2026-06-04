import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Image, StatusBar, SafeAreaView,
  ActivityIndicator, RefreshControl, Modal, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";
import { getImageForTitle } from "./GigCard";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES   = ["All", "Coding", "Design", "Writing", "Tutoring", "Video", "Research"];
const SORT_OPTIONS = ["Newest", "Budget: High", "Budget: Low", "Most Applied"];

const URGENCY_CONFIG = {
  urgent: { label: "Urgent",   color: "#f87171", bg: "rgba(239,68,68,0.12)",  dot: "#ef4444" },
  medium: { label: "Soon",     color: "#fbbf24", bg: "rgba(245,158,11,0.12)", dot: "#f59e0b" },
  low:    { label: "Flexible", color: "#34d399", bg: "rgba(16,185,129,0.12)", dot: "#10b981" },
};

const EDIT_URGENCY_OPTIONS = [
  { label: "Today",      value: "Today",      level: "urgent" },
  { label: "2–3 days",   value: "2–3 days",   level: "medium" },
  { label: "This week",  value: "This week",  level: "medium" },
  { label: "This month", value: "This month", level: "low"    },
  { label: "Flexible",   value: "Flexible",   level: "low"    },
];

const EDIT_BUDGET_OPTIONS = ["Under ₱500", "₱500–₱1K", "₱1K–₱2K", "₱2K–₱5K", "₱5K+"];

const AVATAR_COLORS = [
  "#7c3aed","#0891b2","#059669","#dc2626",
  "#d97706","#be185d","#2563eb","#7c3aed",
];

function getAvatarColor(i) { return AVATAR_COLORS[i % AVATAR_COLORS.length]; }

function timeAgo(dateStr) {
  const diffMins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diffMins < 1)  return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

function parseBudget(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[₱,\s]/g, "").toLowerCase();

  const underMatch = cleaned.match(/^under([\d.]+)(k?)$/);
  if (underMatch)
    return parseFloat(underMatch[1]) * (underMatch[2] === "k" ? 1000 : 1);

  const rangeMatch = cleaned.match(/^([\d.]+)(k?)[\u2013\u2014\-]([\d.]+)(k?)$/);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]) * (rangeMatch[2] === "k" ? 1000 : 1);
    const hi = parseFloat(rangeMatch[3]) * (rangeMatch[4] === "k" ? 1000 : 1);
    return (lo + hi) / 2;
  }

  const plusMatch = cleaned.match(/^([\d.]+)(k?)\+$/);
  if (plusMatch)
    return parseFloat(plusMatch[1]) * (plusMatch[2] === "k" ? 1000 : 1);

  const plainMatch = cleaned.match(/^([\d.]+)(k?)$/);
  if (plainMatch)
    return parseFloat(plainMatch[1]) * (plainMatch[2] === "k" ? 1000 : 1);

  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmModal({ visible, title, message, onCancel, onConfirm, loading }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel} statusBarTranslucent>
      <View style={confirmStyles.overlay}>
        <View style={confirmStyles.box}>
          <View style={confirmStyles.iconWrap}>
            <Ionicons name="trash-outline" size={28} color="#f87171" />
          </View>
          <Text style={confirmStyles.title}>{title}</Text>
          <Text style={confirmStyles.message}>{message}</Text>
          <View style={confirmStyles.btnRow}>
            <TouchableOpacity style={confirmStyles.cancelBtn} onPress={onCancel} disabled={loading}>
              <Text style={confirmStyles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={confirmStyles.deleteBtn} onPress={onConfirm} disabled={loading}>
              {loading
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={confirmStyles.deleteTxt}>Delete</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOT MENU MODAL
// ─────────────────────────────────────────────────────────────────────────────

function DotMenu({ visible, job, onClose, onEdit, onDelete }) {
  const handleEdit = () => {
    const captured = job;
    onClose();
    setTimeout(() => onEdit(captured), 400);
  };
  const handleDelete = () => { if (job) onDelete(job); };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <View style={dotStyles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={dotStyles.sheet}>
          <TouchableOpacity style={dotStyles.item} activeOpacity={0.7} onPress={handleEdit}>
            <View style={[dotStyles.iconWrap, { backgroundColor: "rgba(124,58,237,0.12)" }]}>
              <Ionicons name="create-outline" size={18} color="#a78bfa" />
            </View>
            <Text style={dotStyles.itemText}>Edit post</Text>
            <Ionicons name="chevron-forward" size={15} color="#374151" />
          </TouchableOpacity>
          <View style={dotStyles.divider} />
          <TouchableOpacity style={dotStyles.item} activeOpacity={0.7} onPress={handleDelete}>
            <View style={[dotStyles.iconWrap, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
              <Ionicons name="trash-outline" size={18} color="#f87171" />
            </View>
            <Text style={[dotStyles.itemText, { color: "#f87171" }]}>Delete post</Text>
            <Ionicons name="chevron-forward" size={15} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT MODAL
// ─────────────────────────────────────────────────────────────────────────────

function EditModal({ visible, job, onClose, onSaved }) {
  const [title,        setTitle]        = useState("");
  const [description,  setDescription]  = useState("");
  const [budget,       setBudget]       = useState("");
  const [customBudget, setCustomBudget] = useState("");
  const [urgencyOpt,   setUrgencyOpt]   = useState(null);
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    if (!job) return;
    setTitle(job.title ?? "");
    setDescription(job.description ?? "");
    if (EDIT_BUDGET_OPTIONS.includes(job.budget)) {
      setBudget(job.budget); setCustomBudget("");
    } else {
      setBudget(""); setCustomBudget(job.budget ? job.budget.replace(/[₱,]/g, "") : "");
    }
    const match = EDIT_URGENCY_OPTIONS.find(o => o.value === job.urgency);
    setUrgencyOpt(match ?? EDIT_URGENCY_OPTIONS[4]);
  }, [job]);

  const effectiveBudget = customBudget
    ? `₱${parseInt(customBudget).toLocaleString()}`
    : budget;

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert("Validation", "Title cannot be empty."); return; }
    if (!urgencyOpt)   { Alert.alert("Validation", "Please select a timeline."); return; }
    if (!job?.id)      { Alert.alert("Error", "No job selected."); return; }
    setSaving(true);
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data?.user) throw new Error("Not logged in.");
      const { error: updateError } = await supabase
        .from("jobs")
        .update({
          title: title.trim(), description: description.trim(),
          budget: effectiveBudget, urgency: urgencyOpt.value, urgency_level: urgencyOpt.level,
        })
        .eq("id", job.id)
        .eq("user_id", data.user.id);
      if (updateError) throw updateError;
      onSaved();
      onClose();
      Alert.alert("Saved ✓", "Your job post has been updated.");
    } catch (e) {
      Alert.alert("Save Failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={editStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={editStyles.sheet}>
        <View style={editStyles.handle} />
        <View style={editStyles.header}>
          <Text style={editStyles.title}>Edit Job Post</Text>
          <TouchableOpacity onPress={onClose} style={editStyles.closeBtn}>
            <Ionicons name="close" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={editStyles.field}>
            <Text style={editStyles.label}>JOB TITLE *</Text>
            <TextInput
              style={editStyles.input} value={title} onChangeText={setTitle}
              placeholder="e.g. Need someone to design my thesis poster"
              placeholderTextColor="#4b5563"
            />
          </View>
          <View style={editStyles.field}>
            <Text style={editStyles.label}>BUDGET</Text>
            <View style={editStyles.chipRow}>
              {EDIT_BUDGET_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[editStyles.chip, budget === opt && editStyles.chipOn]}
                  onPress={() => { setBudget(opt); setCustomBudget(""); }}
                >
                  <Text style={[editStyles.chipTxt, budget === opt && editStyles.chipTxtOn]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={editStyles.priceRow}>
              <Text style={editStyles.pesoSign}>₱</Text>
              <TextInput
                style={editStyles.priceInput} placeholder="or exact amount"
                placeholderTextColor="#4b5563" value={customBudget}
                onChangeText={v => { setCustomBudget(v); setBudget(""); }}
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={editStyles.field}>
            <Text style={editStyles.label}>TIMELINE</Text>
            <View style={editStyles.chipRow}>
              {EDIT_URGENCY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[editStyles.chip, urgencyOpt?.value === opt.value && editStyles.chipOn]}
                  onPress={() => setUrgencyOpt(opt)}
                >
                  <Text style={[editStyles.chipTxt, urgencyOpt?.value === opt.value && editStyles.chipTxtOn]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={editStyles.field}>
            <Text style={editStyles.label}>DESCRIPTION</Text>
            <TextInput
              style={[editStyles.input, editStyles.textarea]} value={description}
              onChangeText={setDescription} placeholder="Describe what you need..."
              placeholderTextColor="#4b5563" multiline textAlignVertical="top"
            />
          </View>
        </ScrollView>
        <TouchableOpacity
          style={[editStyles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave} disabled={saving} activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color="white" />
            : <><Ionicons name="checkmark-circle-outline" size={18} color="white" /><Text style={editStyles.saveTxt}>Save Changes</Text></>
          }
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB CARD
// ─────────────────────────────────────────────────────────────────────────────

function JobCard({ job, index, onPress, onMenuOpen, currentUserId }) {
  const [appCount, setAppCount] = useState(job.applicant_count ?? 0);

  const isOwner     = job.user_id === currentUserId;
  const urgency     = URGENCY_CONFIG[job.urgency_level] ?? URGENCY_CONFIG.low;
  const imageUri    = job.image_url || getImageForTitle(job.title);
  const avatarColor = job.avatar_color ?? getAvatarColor(index);
  const tags        = Array.isArray(job.tags) ? job.tags : [];

  useEffect(() => {
    const channel = supabase
      .channel(`job-apps-${job.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "applications", filter: `job_id=eq.${job.id}` },
        () => setAppCount(c => c + 1))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [job.id]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.cardImage}>
        <Image
          source={{ uri: imageUri }}
          style={styles.coverImg}
          resizeMode="cover"
          onError={() => {}}
        />
        <View style={styles.coverOverlay} />

        <View style={styles.cardTopRow}>
          <View style={[styles.urgencyPill, { backgroundColor: urgency.bg }]}>
            <View style={[styles.urgencyDot, { backgroundColor: urgency.dot }]} />
            <Text style={[styles.urgencyLabel, { color: urgency.color }]}>{urgency.label}</Text>
          </View>
          {/* Dot menu — owner only */}
          {isOwner && (
            <TouchableOpacity
              style={styles.dotsBtn}
              onPress={(e) => { e.stopPropagation(); onMenuOpen(job); }}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="ellipsis-vertical" size={16} color="white" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.cardBottomRow}>
          <View style={styles.catLabel}>
            <Text style={styles.catLabelText}>{job.category}</Text>
          </View>
          {/* ✅ Applicant count visible to everyone */}
          <View style={styles.applicantsBadge}>
            <Ionicons name="people-outline" size={11} color="#a78bfa" />
            <Text style={styles.applicantsCount}>{appCount} applied</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.posterRow}>
          {job.poster_avatar_url ? (
            <Image
              source={{ uri: job.poster_avatar_url }}
              style={[styles.posterAvatar, { backgroundColor: avatarColor }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.posterAvatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.posterAvatarText}>{job.avatar ?? job.poster_name?.[0] ?? "?"}</Text>
            </View>
          )}
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
            {tags.map(tag => (
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
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function JobsScreen({ navigation }) {
  const { user } = useUser();

  const [jobs,           setJobs]           = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search,         setSearch]         = useState("");
  const [sortBy,         setSortBy]         = useState("Newest");
  const [showSort,       setShowSort]       = useState(false);
  const [mySchoolOnly,   setMySchoolOnly]   = useState(false);

  const [editJob,      setEditJob]      = useState(null);
  const [editVisible,  setEditVisible]  = useState(false);
  const [menuJob,      setMenuJob]      = useState(null);
  const [menuVisible,  setMenuVisible]  = useState(false);

  const [confirmJob,     setConfirmJob]     = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting,       setDeleting]       = useState(false);

  const openMenu   = useCallback((job) => { setMenuJob(job);  setMenuVisible(true);  }, []);
  const closeMenu  = useCallback(() => { setMenuVisible(false); setTimeout(() => setMenuJob(null), 800); }, []);
  const openEdit   = useCallback((job) => { setEditJob(job);  setEditVisible(true);  }, []);
  const closeEdit  = useCallback(() => { setEditVisible(false); setTimeout(() => setEditJob(null), 400); }, []);

  const fetchAllMyJobs = useCallback(async () => {
    try {
      const { data: approvedData, error: approvedErr } = await supabase
        .from("jobs")
        .select("*, applications(count)")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (approvedErr) throw approvedErr;

      const unique = approvedData ?? [];

      const userIds = [...new Set(unique.map(j => j.user_id).filter(Boolean))];
      let avatarMap = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("users").select("id, image_url").in("id", userIds);
        if (users) users.forEach(u => { avatarMap[u.id] = u.image_url; });
      }

      setJobs(unique.map(j => ({
        ...j,
        applicant_count:   j.applications?.[0]?.count ?? 0,
        poster_avatar_url: avatarMap[j.user_id] ?? j.poster_avatar_url ?? null,
        _budgetNum:        parseBudget(j.budget),
      })));
    } catch (err) {
      console.error("fetchAllMyJobs error:", err.message);
      Alert.alert("Error", "Failed to load jobs. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllMyJobs();
    const channel = supabase
      .channel("jobs-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, fetchAllMyJobs)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchAllMyJobs]);

  const onRefresh = () => { setRefreshing(true); fetchAllMyJobs(); };

  const handleDelete = useCallback((job) => {
    if (!job) return;
    setConfirmJob(job);
    setMenuVisible(false);
    setTimeout(() => { setMenuJob(null); setConfirmVisible(true); }, 300);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmJob) return;
    setDeleting(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) throw new Error("Not logged in.");
      const { error: appsErr } = await supabase.from("applications").delete().eq("job_id", confirmJob.id);
      if (appsErr) throw new Error(`Apps delete failed: ${appsErr.message}`);
      const { error: jobErr } = await supabase
        .from("jobs").delete()
        .eq("id", confirmJob.id)
        .eq("user_id", userData.user.id);
      if (jobErr) throw new Error(jobErr.message);
      setJobs(prev => prev.filter(j => j.id !== confirmJob.id));
      setConfirmVisible(false);
      setConfirmJob(null);
    } catch (e) {
      setConfirmVisible(false);
      setConfirmJob(null);
      setTimeout(() => Alert.alert("Delete Failed", String(e.message)), 300);
    } finally {
      setDeleting(false);
    }
  }, [confirmJob]);

  const handleCancelDelete = useCallback(() => {
    setConfirmVisible(false);
    setTimeout(() => setConfirmJob(null), 300);
  }, []);

  // ── Filtering & Sorting ────────────────────────────────────────────────────
  const filtered = jobs
    .filter(j => {
      const matchCat    = activeCategory === "All" || j.category === activeCategory;
      const searchLower = search.toLowerCase().trim();
      const matchSearch = !searchLower
        || (j.title       ?? "").toLowerCase().includes(searchLower)
        || (j.description ?? "").toLowerCase().includes(searchLower)
        || (Array.isArray(j.tags) ? j.tags : []).some(t => t.toLowerCase().includes(searchLower));
      const matchSchool = !mySchoolOnly || !user?.school || j.school === user.school;
      return matchCat && matchSearch && matchSchool;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "Budget: High":  return (b._budgetNum ?? 0) - (a._budgetNum ?? 0);
        case "Budget: Low":   return (a._budgetNum ?? 0) - (b._budgetNum ?? 0);
        case "Most Applied":  return (b.applicant_count ?? 0) - (a.applicant_count ?? 0);
        case "Newest":
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

  // ── Stats (all visible to everyone) ───────────────────────────────────────
  const urgentCount     = jobs.filter(j => j.urgency_level === "urgent").length;
  const totalApplicants = jobs.reduce((a, j) => a + (j.applicant_count ?? 0), 0);

  const STATS = [
    { icon: "briefcase-outline", val: String(jobs.length),    label: "Jobs"    },
    { icon: "flash-outline",     val: String(urgentCount),     label: "Urgent"  },
    { icon: "people-outline",    val: String(totalApplicants), label: "Applied" },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />

      <DotMenu
        visible={menuVisible} job={menuJob}
        onClose={closeMenu} onEdit={openEdit} onDelete={handleDelete}
      />
      <EditModal
        visible={editVisible} job={editJob}
        onClose={closeEdit} onSaved={fetchAllMyJobs}
      />
      <ConfirmModal
        visible={confirmVisible}
        title="Delete Post"
        message={`Delete "${confirmJob?.title}"?\n\nThis cannot be undone.`}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />

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
            onPress={() => setShowSort(v => !v)}
          >
            <Ionicons name="funnel-outline" size={16} color={showSort ? "white" : "#a78bfa"} />
          </TouchableOpacity>
        </View>

        {/* Sort active indicator */}
        {sortBy !== "Newest" && !showSort && (
          <View style={styles.activeFilterRow}>
            <Ionicons name="checkmark-circle" size={13} color="#7c3aed" />
            <Text style={styles.activeFilterText}>Sorted by: {sortBy}</Text>
            <TouchableOpacity onPress={() => setSortBy("Newest")} hitSlop={8}>
              <Ionicons name="close-circle" size={14} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}

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

        {/* Category chips + My School toggle */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.catText, activeCategory === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}

          {user?.school ? (
            <TouchableOpacity
              style={[styles.catChip, styles.schoolChip, mySchoolOnly && styles.catChipActive]}
              onPress={() => setMySchoolOnly(v => !v)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="school-outline" size={13} color={mySchoolOnly ? "white" : "#a78bfa"} />
                <Text style={[styles.catText, mySchoolOnly && styles.catTextActive]}>My School</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        {/* Stats bar — visible to everyone */}
        <View style={styles.statsBar}>
          {STATS.map(s => (
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
            {(activeCategory !== "All" || search || mySchoolOnly || sortBy !== "Newest") && (
              <TouchableOpacity
                style={styles.clearFiltersBtn}
                onPress={() => {
                  setActiveCategory("All");
                  setSearch("");
                  setMySchoolOnly(false);
                  setSortBy("Newest");
                }}
              >
                <Text style={styles.clearFiltersTxt}>Clear all filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtered.map((job, i) => (
            <JobCard
              key={job.id}
              job={job}
              index={i}
              currentUserId={user?.id}
              onMenuOpen={openMenu}
              onPress={() => navigation.navigate("JobDetail", { job })}
            />
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
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "#0d1527",
  },
  headerTitle:    { color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  headerSub:      { color: "#4b5563", fontSize: 12, marginTop: 2 },
  postJobBtn:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#7c3aed", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  postJobBtnText: { color: "white", fontWeight: "700", fontSize: 13 },
  scrollContent:  { paddingHorizontal: 20, paddingTop: 16 },

  searchRow:     { flexDirection: "row", gap: 10, marginBottom: 10 },
  searchBox:     { flex: 1, flexDirection: "row", backgroundColor: "#0b1120", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#1a2540" },
  searchInput:   { flex: 1, color: "white", fontSize: 14 },
  sortBtn:       { width: 46, height: 46, borderRadius: 14, backgroundColor: "#0b1120", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1a2540" },
  sortBtnActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },

  activeFilterRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10, paddingHorizontal: 4 },
  activeFilterText: { flex: 1, color: "#a78bfa", fontSize: 12, fontWeight: "600" },

  sortDropdown:        { backgroundColor: "#0b1120", borderRadius: 14, borderWidth: 1, borderColor: "#1a2540", marginBottom: 14, overflow: "hidden" },
  sortOption:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#0d1527" },
  sortOptionActive:    { backgroundColor: "#13103a" },
  sortOptionText:      { color: "#6b7280", fontSize: 14 },
  sortOptionTextActive:{ color: "#a78bfa", fontWeight: "700" },

  catRow:        { gap: 8, paddingBottom: 2, marginBottom: 16 },
  catChip:       { paddingHorizontal: 16, paddingVertical: 9, backgroundColor: "#0b1120", borderRadius: 50, borderWidth: 1, borderColor: "#1a2540" },
  catChipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  schoolChip:    { borderColor: "#7c3aed44" },
  catText:       { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  catTextActive: { color: "white" },

  statsBar:  { flexDirection: "row", justifyContent: "space-around", backgroundColor: "#0b1120", borderRadius: 16, paddingVertical: 14, marginBottom: 20, borderWidth: 1, borderColor: "#1a2540" },
  statItem:  { alignItems: "center", gap: 4 },
  statVal:   { color: "white", fontWeight: "800", fontSize: 16 },
  statLabel: { color: "#4b5563", fontSize: 11 },

  loadingWrap: { alignItems: "center", paddingTop: 60, gap: 12 },
  loadingText: { color: "#4b5563", fontSize: 14 },
  emptyState:  { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon:   { width: 72, height: 72, borderRadius: 36, backgroundColor: "#0b1120", borderWidth: 1, borderColor: "#1a2540", justifyContent: "center", alignItems: "center" },
  emptyTitle:  { color: "#374151", fontSize: 16, fontWeight: "700" },
  emptySub:    { color: "#1f2937", fontSize: 13 },
  clearFiltersBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#7c3aed44", backgroundColor: "#7c3aed18" },
  clearFiltersTxt: { color: "#a78bfa", fontSize: 13, fontWeight: "700" },

  card:         { backgroundColor: "#0b1120", borderRadius: 20, overflow: "hidden", marginBottom: 18, borderWidth: 1, borderColor: "#1a2540" },
  cardImage:    { height: 165, position: "relative" },
  coverImg:     { width: "100%", height: "100%" },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,9,20,0.5)" },
  cardTopRow:   { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  urgencyPill:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  urgencyDot:   { width: 6, height: 6, borderRadius: 3 },
  urgencyLabel: { fontSize: 11, fontWeight: "700" },
  dotsBtn:      { backgroundColor: "rgba(0,0,0,0.5)", padding: 8, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  cardBottomRow:   { position: "absolute", bottom: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catLabel:        { backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  catLabelText:    { color: "white", fontSize: 11, fontWeight: "700" },
  applicantsBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(20,10,50,0.75)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "rgba(124,58,237,0.3)" },
  applicantsCount: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },

  cardBody:      { padding: 16 },
  posterRow:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  posterAvatar:  { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  posterAvatarText: { color: "white", fontSize: 12, fontWeight: "800" },
  posterName:    { color: "#e5e7eb", fontWeight: "700", fontSize: 13 },
  posterSchool:  { color: "#4b5563", fontSize: 11, marginTop: 1 },
  timeAgo:       { color: "#374151", fontSize: 11, marginLeft: "auto" },
  jobTitle:      { color: "white", fontSize: 16, fontWeight: "800", marginBottom: 6, lineHeight: 22 },
  jobDesc:       { color: "#6b7280", fontSize: 13, lineHeight: 19, marginBottom: 12 },
  tagScroll:     { marginBottom: 14 },
  tag:           { backgroundColor: "#111827", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginRight: 6, borderWidth: 1, borderColor: "#1e2d4a" },
  tagText:       { color: "#6b7280", fontSize: 11, fontWeight: "600" },
  cardFooter:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerLeft:    { flexDirection: "row", alignItems: "center", gap: 5 },
  footerMeta:    { color: "#4b5563", fontSize: 12 },
  footerRight:   { flexDirection: "row", alignItems: "center", gap: 10 },
  budget:        { color: "#a78bfa", fontWeight: "800", fontSize: 16 },
});

const dotStyles = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 40 },
  sheet:    { backgroundColor: "#0f1629", borderRadius: 18, borderWidth: 1, borderColor: "#1e2d4a", width: "100%", overflow: "hidden" },
  item:     { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  itemText: { flex: 1, color: "white", fontSize: 15, fontWeight: "600" },
  divider:  { height: 1, backgroundColor: "#1e2d4a", marginHorizontal: 16 },
});

const editStyles = StyleSheet.create({
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  sheet:      { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#0f1629", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44, borderTopWidth: 1, borderColor: "#1e2d4a", maxHeight: "88%" },
  handle:     { width: 40, height: 4, backgroundColor: "#1e2d4a", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  header:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title:      { color: "white", fontSize: 18, fontWeight: "800" },
  closeBtn:   { width: 30, height: 30, borderRadius: 15, backgroundColor: "#111827", justifyContent: "center", alignItems: "center" },
  field:      { marginBottom: 16 },
  label:      { color: "#6b7280", fontSize: 11, fontWeight: "700", marginBottom: 8, letterSpacing: 0.5 },
  input:      { backgroundColor: "#050914", borderRadius: 12, padding: 13, fontSize: 14, color: "white", borderWidth: 1, borderColor: "#1a2540" },
  textarea:   { minHeight: 90 },
  chipRow:    { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip:       { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#050914", borderRadius: 50, borderWidth: 1, borderColor: "#1a2540" },
  chipOn:     { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipTxt:    { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  chipTxtOn:  { color: "white" },
  priceRow:   { flexDirection: "row", alignItems: "center", backgroundColor: "#050914", borderRadius: 12, borderWidth: 1, borderColor: "#1a2540", overflow: "hidden" },
  pesoSign:   { paddingHorizontal: 14, fontSize: 18, color: "#7c3aed", fontWeight: "800" },
  priceInput: { flex: 1, paddingVertical: 12, fontSize: 15, fontWeight: "700", color: "white" },
  saveBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 15, marginTop: 8 },
  saveTxt:    { color: "white", fontWeight: "700", fontSize: 15 },
});

const confirmStyles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 32 },
  box:       { backgroundColor: "#0f1629", borderRadius: 24, borderWidth: 1, borderColor: "#1e2d4a", padding: 28, width: "100%", alignItems: "center", gap: 12 },
  iconWrap:  { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(239,68,68,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  title:     { color: "white", fontSize: 18, fontWeight: "800" },
  message:   { color: "#6b7280", fontSize: 14, textAlign: "center", lineHeight: 20 },
  btnRow:    { flexDirection: "row", gap: 12, marginTop: 8, width: "100%" },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#111827", borderWidth: 1, borderColor: "#1e2d4a", alignItems: "center" },
  cancelTxt: { color: "#9ca3af", fontWeight: "700", fontSize: 14 },
  deleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#dc2626", alignItems: "center" },
  deleteTxt: { color: "white", fontWeight: "700", fontSize: 14 },
});