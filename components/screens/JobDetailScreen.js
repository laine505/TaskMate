import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, TextInput, StatusBar, SafeAreaView,
  ActivityIndicator, Alert, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getFallbackImage } from "./GigCard";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// DOT MENU MODAL
// ─────────────────────────────────────────────────────────────────────────────

function DotMenu({ visible, onClose, onEdit, onDelete }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <View style={dotStyles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={dotStyles.sheet}>
          <TouchableOpacity
            style={dotStyles.item} activeOpacity={0.7}
            onPress={() => { onClose(); setTimeout(onEdit, 400); }}
          >
            <View style={[dotStyles.iconWrap, { backgroundColor: "rgba(124,58,237,0.12)" }]}>
              <Ionicons name="create-outline" size={18} color="#a78bfa" />
            </View>
            <Text style={dotStyles.itemText}>Edit post</Text>
            <Ionicons name="chevron-forward" size={15} color="#374151" />
          </TouchableOpacity>
          <View style={dotStyles.divider} />
          <TouchableOpacity
            style={dotStyles.item} activeOpacity={0.7}
            onPress={() => { onClose(); setTimeout(onDelete, 400); }}
          >
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
    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) throw new Error("Not logged in.");
      const { error } = await supabase
        .from("jobs")
        .update({
          title:         title.trim(),
          description:   description.trim(),
          budget:        effectiveBudget,
          urgency:       urgencyOpt.value,
          urgency_level: urgencyOpt.level,
        })
        .eq("id", job.id)
        .eq("user_id", userData.user.id);
      if (error) throw error;
      onSaved({ ...job, title: title.trim(), description: description.trim(), budget: effectiveBudget, urgency: urgencyOpt.value, urgency_level: urgencyOpt.level });
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
// APPLY MODAL
// ─────────────────────────────────────────────────────────────────────────────

function ApplyModal({ visible, job, onClose }) {
  const { user } = useUser();
  const [applicantName, setApplicantName] = useState("");
  const [school,        setSchool]        = useState("");
  const [portfolio,     setPortfolio]     = useState("");
  const [proposedRate,  setProposedRate]  = useState("");
  const [loading,       setLoading]       = useState(false);
  const [success,       setSuccess]       = useState(false);

  useEffect(() => {
    if (job) {
      setApplicantName(user?.name || user?.user_metadata?.full_name || "");
      setSchool(user?.school || "");
      setPortfolio(""); setProposedRate(""); setSuccess(false);
    }
  }, [job]);

  const canSubmit = applicantName.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id || !job) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("applications").insert({
        job_id:         job.id,
        applicant_id:   user.id,
        applicant_name: applicantName.trim(),
        school:         school.trim(),
        portfolio_link: portfolio.trim(),
        proposed_rate:  proposedRate.trim(),
      });
      if (error) throw error;
      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const FIELDS = [
    { label: "Your Name *",                   value: applicantName, setter: setApplicantName, placeholder: "e.g. Juan Dela Cruz" },
    { label: "School / University",           value: school,        setter: setSchool,        placeholder: "e.g. USLS, DLSU, UPV" },
    { label: "Portfolio Link (optional)",     value: portfolio,     setter: setPortfolio,     placeholder: "https://..." },
    { label: "Your Proposed Rate (optional)", value: proposedRate,  setter: setProposedRate,  placeholder: "e.g. ₱800" },
  ];

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={applyStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={applyStyles.sheet}>
        <View style={applyStyles.handle} />
        {success ? (
          <View style={applyStyles.successState}>
            <View style={applyStyles.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#10b981" />
            </View>
            <Text style={applyStyles.successTitle}>Application Sent!</Text>
            <Text style={applyStyles.successSub}>The poster will review your application.</Text>
          </View>
        ) : (
          <>
            <View style={applyStyles.header}>
              <View style={{ flex: 1 }}>
                <Text style={applyStyles.jobSnippet} numberOfLines={2}>{job?.title}</Text>
                <Text style={applyStyles.jobBudget}>{job?.budget} · {job?.poster_name}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={applyStyles.closeBtn}>
                <Ionicons name="close" size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <View style={applyStyles.divider} />
            <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
              {FIELDS.map(({ label, value, setter, placeholder }) => (
                <View key={label} style={applyStyles.field}>
                  <Text style={applyStyles.fieldLabel}>{label}</Text>
                  <TextInput
                    style={applyStyles.input} value={value} onChangeText={setter}
                    placeholder={placeholder} placeholderTextColor="#4b5563"
                  />
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[applyStyles.submitBtn, !canSubmit && applyStyles.submitDisabled]}
              onPress={handleSubmit} disabled={loading || !canSubmit} activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="white" />
                : <><Ionicons name="send-outline" size={16} color="white" /><Text style={applyStyles.submitTxt}>Submit Application</Text></>
              }
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function InfoCard({ icon, label, value }) {
  return (
    <View style={styles.infoCard}>
      <Ionicons name={icon} size={16} color="#7c3aed" style={{ marginBottom: 6 }} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function JobDetailScreen({ route, navigation }) {
  const { job: initialJob } = route.params;
  const { user } = useUser();

  const [job,            setJob]            = useState(initialJob);
  const [applyVisible,   setApplyVisible]   = useState(false);
  const [menuVisible,    setMenuVisible]    = useState(false);
  const [editVisible,    setEditVisible]    = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [applyCount,     setApplyCount]     = useState(initialJob.applicant_count ?? 0);

  const urgency  = URGENCY_CONFIG[job.urgency_level] ?? URGENCY_CONFIG.low;
  const imageUri = job.image_url || getFallbackImage(job.title || "");
  const isOwner  = user?.id && job.user_id && user.id === job.user_id;
  const tags     = Array.isArray(job.tags) ? job.tags : [];

  // Live applicant count
  useEffect(() => {
    const channel = supabase
      .channel(`job-detail-apps-${job.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "applications", filter: `job_id=eq.${job.id}` },
        () => setApplyCount(c => c + 1))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [job.id]);

  // Fetch poster avatar from users table
  useEffect(() => {
    if (!job.user_id || job.poster_avatar_url) return;
    supabase
      .from("users")
      .select("image_url")
      .eq("id", job.user_id)
      .single()
      .then(({ data }) => {
        if (data?.image_url) setJob(j => ({ ...j, poster_avatar_url: data.image_url }));
      })
      .catch(() => {}); // silently ignore — avatar is non-critical
  }, [job.user_id]);

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) throw new Error("Not logged in.");
      const { error: appsErr } = await supabase.from("applications").delete().eq("job_id", job.id);
      if (appsErr) throw new Error(`Apps delete failed: ${appsErr.message}`);
      const { error: jobErr } = await supabase.from("jobs").delete().eq("id", job.id).eq("user_id", userData.user.id);
      if (jobErr) throw new Error(jobErr.message);
      setConfirmVisible(false);
      navigation.goBack();
    } catch (e) {
      setConfirmVisible(false);
      setTimeout(() => Alert.alert("Delete Failed", e.message), 300);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />

      <DotMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onEdit={() => setEditVisible(true)}
        onDelete={() => setConfirmVisible(true)}
      />
      <EditModal
        visible={editVisible}
        job={job}
        onClose={() => setEditVisible(false)}
        onSaved={(updated) => setJob(updated)}
      />
      <ConfirmModal
        visible={confirmVisible}
        title="Delete Post"
        message={`Delete "${job.title}"?\n\nThis cannot be undone.`}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
      <ApplyModal
        visible={applyVisible}
        job={job}
        onClose={() => setApplyVisible(false)}
      />

      {/* Floating Back */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={22} color="white" />
      </TouchableOpacity>

      {/* Floating Menu — owner only */}
      {isOwner && (
        <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)} activeOpacity={0.8}>
          <Ionicons name="ellipsis-vertical" size={20} color="white" />
        </TouchableOpacity>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Hero Image */}
        <View style={styles.heroWrap}>
          <Image source={{ uri: imageUri }} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />

          {/* Urgency pill */}
          <View style={[styles.urgencyPill, { backgroundColor: urgency.bg }]}>
            <View style={[styles.urgencyDot, { backgroundColor: urgency.dot }]} />
            <Text style={[styles.urgencyLabel, { color: urgency.color }]}>{urgency.label}</Text>
          </View>

          {/* Category chip */}
          {job.category ? (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText}>{job.category}</Text>
            </View>
          ) : null}
        </View>

        {/* Body */}
        <View style={styles.body}>

          <View style={styles.titleRow}>
            <Text style={styles.title}>{job.title}</Text>
            <Text style={styles.budget}>{job.budget || "TBD"}</Text>
          </View>

          {/* Applicant count */}
          <View style={styles.applicantsBadge}>
            <Ionicons name="people-outline" size={13} color="#a78bfa" />
            <Text style={styles.applicantsText}>{applyCount} applied</Text>
          </View>

          {/* Poster info */}
          <View style={styles.posterRow}>
            <View style={styles.posterAvatar}>
              {job.poster_avatar_url ? (
                <Image source={{ uri: job.poster_avatar_url }} style={styles.posterAvatarImg} />
              ) : (
                <Text style={styles.posterInitial}>
                  {(job.poster_name || "T")[0].toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.posterName}>{job.poster_name || "Taskmate User"}</Text>
              {job.school ? <Text style={styles.posterSchool}>{job.school}</Text> : null}
            </View>
            {isOwner ? (
              <View style={styles.ownerBadge}>
                <Ionicons name="person-circle-outline" size={12} color="#7c3aed" />
                <Text style={styles.ownerBadgeText}>Your post</Text>
              </View>
            ) : (
              <View style={[styles.urgencyPillSmall, { backgroundColor: urgency.bg }]}>
                <View style={[styles.urgencyDot, { backgroundColor: urgency.dot }]} />
                <Text style={[styles.urgencyLabelSmall, { color: urgency.color }]}>{urgency.label}</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>About this Job</Text>
          <Text style={styles.description}>
            {job.description?.trim()
              ? job.description
              : "No description provided. Contact the poster for more details."}
          </Text>

          <View style={styles.infoGrid}>
            <InfoCard icon="cash-outline"      label="Budget"   value={job.budget || "TBD"}   />
            <InfoCard icon="time-outline"      label="Timeline" value={job.urgency || "Flexible"} />
            <InfoCard icon="folder-outline"    label="Category" value={job.category || "—"}    />
            <InfoCard
              icon="calendar-outline"
              label="Posted"
              value={
                job.created_at
                  ? new Date(job.created_at).toLocaleDateString("en-PH", {
                      month: "short", day: "numeric", year: "numeric",
                    })
                  : "—"
              }
            />
          </View>

          {tags.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Tags</Text>
              <View style={styles.tagsRow}>
                {tags.map(tag => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaBar}>
        <View>
          <Text style={styles.ctaLabel}>Budget</Text>
          <Text style={styles.ctaPrice}>{job.budget || "TBD"}</Text>
        </View>

        {isOwner ? (
          <TouchableOpacity
            style={[styles.ctaBtn, styles.ctaBtnOwner]}
            onPress={() => setMenuVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="white" style={{ marginRight: 6 }} />
            <Text style={styles.ctaBtnText}>Manage Post</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => setApplyVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="send-outline" size={18} color="white" style={{ marginRight: 6 }} />
            <Text style={styles.ctaBtnText}>Apply Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },
  backBtn: {
    position: "absolute", top: 52, left: 16, zIndex: 99,
    backgroundColor: "rgba(5,9,20,0.65)", padding: 8, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  menuBtn: {
    position: "absolute", top: 52, right: 16, zIndex: 99,
    backgroundColor: "rgba(5,9,20,0.65)", padding: 8, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  heroWrap:    { height: 280, position: "relative" },
  heroImage:   { width: "100%", height: "100%" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,9,20,0.45)" },
  urgencyPill: {
    position: "absolute", top: 14, right: 14,
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  urgencyDot:   { width: 6, height: 6, borderRadius: 3 },
  urgencyLabel: { fontSize: 12, fontWeight: "700" },
  categoryChip: {
    position: "absolute", bottom: 14, left: 14,
    backgroundColor: "#7c3aed", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  categoryText: { color: "white", fontSize: 12, fontWeight: "700" },
  body: { paddingHorizontal: 20, paddingTop: 24 },
  titleRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 10, gap: 12,
  },
  title:  { flex: 1, color: "white", fontSize: 20, fontWeight: "800", lineHeight: 28 },
  budget: { color: "#a78bfa", fontSize: 20, fontWeight: "900" },
  applicantsBadge: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    backgroundColor: "rgba(124,58,237,0.1)", borderWidth: 1, borderColor: "rgba(124,58,237,0.25)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginBottom: 16,
  },
  applicantsText: { color: "#a78bfa", fontSize: 12, fontWeight: "700" },
  posterRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0f1629", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#1e2d4a", gap: 12, marginBottom: 20,
  },
  posterAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#7c3aed", justifyContent: "center", alignItems: "center",
  },
  posterAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  posterInitial: { color: "white", fontWeight: "800", fontSize: 16 },
  posterName:    { color: "white", fontWeight: "700", fontSize: 14 },
  posterSchool:  { color: "#6b7280", fontSize: 12, marginTop: 2 },
  ownerBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(124,58,237,0.1)", borderWidth: 1, borderColor: "rgba(124,58,237,0.25)",
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
  },
  ownerBadgeText: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },
  urgencyPillSmall: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
  },
  urgencyLabelSmall: { fontSize: 11, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#1e2d4a", marginBottom: 20 },
  sectionLabel: { color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 10 },
  description:  { color: "#d1d5db", fontSize: 14, lineHeight: 22 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  infoCard: {
    width: "47.5%", backgroundColor: "#0f1629",
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#1e2d4a",
  },
  infoLabel: { color: "#6b7280", fontSize: 11, fontWeight: "600", marginBottom: 4 },
  infoValue: { color: "white", fontSize: 14, fontWeight: "700" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    backgroundColor: "#1e1b4b", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: "#312e81",
  },
  tagText: { color: "#a78bfa", fontSize: 12, fontWeight: "600" },
  ctaBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0f1629", borderTopWidth: 1, borderTopColor: "#1e2d4a",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 28,
  },
  ctaLabel: { color: "#6b7280", fontSize: 11, fontWeight: "600" },
  ctaPrice: { color: "white", fontSize: 18, fontWeight: "900" },
  ctaBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#7c3aed", paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14,
  },
  ctaBtnOwner: { backgroundColor: "#1e2d4a" },
  ctaBtnText: { color: "white", fontWeight: "700", fontSize: 15 },
});

const dotStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 40 },
  sheet: { backgroundColor: "#0f1629", borderRadius: 18, borderWidth: 1, borderColor: "#1e2d4a", width: "100%", overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  itemText: { flex: 1, color: "white", fontSize: 15, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#1e2d4a", marginHorizontal: 16 },
});

const editStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0f1629", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 44, borderTopWidth: 1, borderColor: "#1e2d4a", maxHeight: "88%",
  },
  handle:   { width: 40, height: 4, backgroundColor: "#1e2d4a", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  header:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title:    { color: "white", fontSize: 18, fontWeight: "800" },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#111827", justifyContent: "center", alignItems: "center" },
  field:    { marginBottom: 16 },
  label:    { color: "#6b7280", fontSize: 11, fontWeight: "700", marginBottom: 8, letterSpacing: 0.5 },
  input:    { backgroundColor: "#050914", borderRadius: 12, padding: 13, fontSize: 14, color: "white", borderWidth: 1, borderColor: "#1a2540" },
  textarea: { minHeight: 90 },
  chipRow:  { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip:     { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#050914", borderRadius: 50, borderWidth: 1, borderColor: "#1a2540" },
  chipOn:   { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipTxt:  { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  chipTxtOn:{ color: "white" },
  priceRow:   { flexDirection: "row", alignItems: "center", backgroundColor: "#050914", borderRadius: 12, borderWidth: 1, borderColor: "#1a2540", overflow: "hidden" },
  pesoSign:   { paddingHorizontal: 14, fontSize: 18, color: "#7c3aed", fontWeight: "800" },
  priceInput: { flex: 1, paddingVertical: 12, fontSize: 15, fontWeight: "700", color: "white" },
  saveBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 15, marginTop: 8 },
  saveTxt:    { color: "white", fontWeight: "700", fontSize: 15 },
});

const applyStyles = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0b1120", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: "#1a2540", maxHeight: "90%",
  },
  handle:     { width: 40, height: 4, backgroundColor: "#1e2d4a", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  header:     { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 16 },
  jobSnippet: { color: "white", fontSize: 15, fontWeight: "700", lineHeight: 22 },
  jobBudget:  { color: "#6b7280", fontSize: 13, marginTop: 4 },
  closeBtn:   { width: 30, height: 30, borderRadius: 15, backgroundColor: "#111827", justifyContent: "center", alignItems: "center" },
  divider:    { height: 1, backgroundColor: "#1a2540", marginBottom: 18 },
  field:      { marginBottom: 16 },
  fieldLabel: { color: "#6b7280", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  input:      { backgroundColor: "#050914", borderRadius: 12, padding: 13, fontSize: 14, color: "white", borderWidth: 1, borderColor: "#1a2540" },
  textarea:   { minHeight: 90 },
  submitBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 16, marginTop: 8 },
  submitDisabled: { opacity: 0.45 },
  submitTxt:  { color: "white", fontWeight: "700", fontSize: 15 },
  successState: { alignItems: "center", paddingVertical: 30, gap: 12 },
  successIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(16,185,129,0.1)", justifyContent: "center", alignItems: "center" },
  successTitle: { color: "white", fontSize: 20, fontWeight: "800" },
  successSub:   { color: "#6b7280", fontSize: 14, textAlign: "center" },
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