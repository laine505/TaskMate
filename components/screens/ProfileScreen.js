import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";
import { getImageForTitle } from "./GigCard";


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ALL_SKILLS = [
  "React Native", "UI/UX Design", "Web Development", "Backend",
  "Graphic Design", "Mobile Dev", "Data Science", "DevOps",
];

const STAT_KEYS = [
  { key: "completed", label: "Completed", format: (v) => v ?? 0 },
  { key: "rating",    label: "Rating",    format: (v) => v ? Number(v).toFixed(1) : "0.0" },
];

const STATUS_CONFIG = {
  approved: { label: "Approved", color: "#34d399", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)", icon: "checkmark-circle" },
  pending:  { label: "Pending",  color: "#fbbf24", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.25)",  icon: "time"              },
  rejected: { label: "Rejected", color: "#f87171", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)",   icon: "close-circle"      },
};

const EDIT_URGENCY_OPTIONS = [
  { label: "Today",      value: "Today",      level: "urgent" },
  { label: "2–3 days",   value: "2–3 days",   level: "medium" },
  { label: "This week",  value: "This week",  level: "medium" },
  { label: "This month", value: "This month", level: "low"    },
  { label: "Flexible",   value: "Flexible",   level: "low"    },
];

const EDIT_BUDGET_OPTIONS = ["Under ₱500", "₱500–₱1K", "₱1K–₱2K", "₱2K–₱5K", "₱5K+"];


function getInitials(name) {
  if (!name) return "U";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().substring(0, 2);
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diffMins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diffMins < 1)  return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
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
// CONFIRM DELETE MODAL
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
// MY POST CARD  (with thumbnail)
// ─────────────────────────────────────────────────────────────────────────────

function MyPostCard({ job, onEdit, onDelete }) {
  const statusCfg  = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
  const isRejected = job.status === "rejected";
  const imageUri = job.image_url || getImageForTitle(job.title);

  return (
    <View style={[postCardStyles.card, isRejected && postCardStyles.cardRejected]}>

      {/* Thumbnail */}
      <View style={postCardStyles.thumb}>
        <Image
          source={{ uri: imageUri }}
          style={postCardStyles.thumbImg}
          resizeMode="cover"
        />
        {/* Status-colored strip along the bottom of the thumbnail */}
        <View style={[postCardStyles.thumbStrip, { backgroundColor: statusCfg.color }]} />
      </View>

      {/* Content */}
      <View style={postCardStyles.body}>

        {/* Top row: title + action buttons */}
        <View style={postCardStyles.topRow}>
          <Text style={postCardStyles.title} numberOfLines={1}>{job.title}</Text>
          <View style={postCardStyles.actions}>
            <TouchableOpacity
              style={postCardStyles.actionBtn}
              onPress={() => onEdit(job)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={16} color="#a78bfa" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[postCardStyles.actionBtn, postCardStyles.actionBtnDelete]}
              onPress={() => onDelete(job)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color="#f87171" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Meta row: status badge + budget + time */}
        <View style={postCardStyles.metaRow}>
          <View style={[postCardStyles.statusBadge, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
            <Ionicons name={statusCfg.icon} size={11} color={statusCfg.color} />
            <Text style={[postCardStyles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
          <View style={postCardStyles.metaDot} />
          <Text style={postCardStyles.budget}>{job.budget}</Text>
          <View style={postCardStyles.metaDot} />
          <Text style={postCardStyles.timeAgo}>{timeAgo(job.created_at)}</Text>
        </View>

        {/* Rejection hint */}
        {isRejected && (
          <View style={postCardStyles.rejectedHint}>
            <Ionicons name="information-circle-outline" size={13} color="#f87171" />
            <Text style={postCardStyles.rejectedHintText}>Sorry. Try to post again for review</Text>
          </View>
        )}

        {/* Pending hint */}
        {job.status === "pending" && (
          <View style={postCardStyles.pendingHint}>
            <Ionicons name="hourglass-outline" size={13} color="#fbbf24" />
            <Text style={postCardStyles.pendingHintText}>Under review — usually approved within 24h</Text>
          </View>
        )}
      </View>
    </View>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// PROFILE SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }) {
  const { user, saveUser, logout } = useUser();

  const [loading,            setLoading]            = useState(true);
  const [updating,           setUpdating]           = useState(false);
  const [editing,            setEditing]            = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const [authUserId, setAuthUserId] = useState(null);

  const [name,        setName]        = useState("");
  const [school,      setSchool]      = useState("");
  const [skills,      setSkills]      = useState([]);
  const [overview,    setOverview]    = useState("");
  const [imageUrl,    setImageUrl]    = useState(null);
  const [displayUrl,  setDisplayUrl]  = useState(null);

  // ── My Posts state ────────────────────────────────────────────────────────
  const [myPosts,        setMyPosts]        = useState([]);
  const [postsLoading,   setPostsLoading]   = useState(false);
  const [editJob,        setEditJob]        = useState(null);
  const [editVisible,    setEditVisible]    = useState(false);
  const [confirmJob,     setConfirmJob]     = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting,       setDeleting]       = useState(false);


  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      setLoading(true);
      fetchProfile();
    });
    return unsubscribe;
  }, [navigation]);


  const fetchProfile = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        Alert.alert("Session Error", "No active session. Please login again.");
        navigation.getParent()?.reset({ index: 0, routes: [{ name: "Auth" }] });
        return;
      }
      setAuthUserId(userId);

      const { data: profile, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) throw error;

      if (profile) {
        saveUser(profile);
        setName(profile.name || "");
        setSchool(profile.school || "");
        setSkills(Array.isArray(profile.skills) ? profile.skills : []);
        setOverview(profile.overview || "");
        setImageUrl(profile.image_url || null);
        setDisplayUrl(profile.image_url ? `${profile.image_url}?t=${Date.now()}` : null);
      }

      fetchMyPosts(userId);
    } catch (e) {
      console.error("fetchProfile error:", e.message);
      Alert.alert("Error", "Failed to load profile: " + e.message);
    } finally {
      setLoading(false);
    }
  };


  // ── Fetch My Posts ────────────────────────────────────────────────────────

  const fetchMyPosts = useCallback(async (uid) => {
    const userId = uid ?? authUserId;
    if (!userId) return;
    setPostsLoading(true);
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMyPosts(data ?? []);
    } catch (e) {
      console.error("fetchMyPosts error:", e.message);
    } finally {
      setPostsLoading(false);
    }
  }, [authUserId]);


  // ── Edit / Delete handlers ────────────────────────────────────────────────

  const openEdit  = useCallback((job) => { setEditJob(job);   setEditVisible(true);    }, []);
  const closeEdit = useCallback(() => { setEditVisible(false); setTimeout(() => setEditJob(null), 400); }, []);

  const openDelete  = useCallback((job) => { setConfirmJob(job);  setConfirmVisible(true);  }, []);
  const closeDelete = useCallback(() => { setConfirmVisible(false); setTimeout(() => setConfirmJob(null), 300); }, []);

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
      setMyPosts(prev => prev.filter(j => j.id !== confirmJob.id));
      closeDelete();
    } catch (e) {
      closeDelete();
      setTimeout(() => Alert.alert("Delete Failed", String(e.message)), 300);
    } finally {
      setDeleting(false);
    }
  }, [confirmJob, closeDelete]);


  // ── Image Pick & Upload ───────────────────────────────────────────────────

  const pickImage = async () => {
    if (!editing) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library to change your profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setDisplayUrl(uri);
      await handleImageUpload(uri);
    }
  };

  const handleImageUpload = async (uri) => {
    if (!authUserId) {
      Alert.alert("Error", "User session not found. Please re-login.");
      return;
    }
    setUpdating(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const mimeType = blob.type || "image/jpeg";
      const ext = mimeType.split("/")[1] || "jpg";
      const fileName = `${authUserId}-${Date.now()}.${ext}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, { contentType: mimeType });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from("users")
        .update({ image_url: publicUrl })
        .eq("id", authUserId);
      if (updateError) throw updateError;

      setImageUrl(publicUrl);
      setDisplayUrl(`${publicUrl}?t=${Date.now()}`);
      saveUser({ ...user, image_url: publicUrl });
      Alert.alert("Success", "Profile picture updated!");
    } catch (err) {
      console.error("Image upload error:", err.message);
      Alert.alert("Upload Error", err.message || "Something went wrong.");
      setDisplayUrl(imageUrl ? `${imageUrl}?t=${Date.now()}` : null);
    } finally {
      setUpdating(false);
    }
  };


  // ── Save Profile ──────────────────────────────────────────────────────────

  const handleSaveAll = async () => {
    const uid = authUserId;
    if (!uid)         { Alert.alert("Error", "User session not found."); return; }
    if (!name.trim()) { Alert.alert("Validation", "Name cannot be empty."); return; }

    setUpdating(true);
    try {
      const updatedData = {
        name:      name.trim(),
        school:    school.trim(),
        overview:  overview.trim(),
        skills:    skills ?? [],
        image_url: imageUrl,
      };

      const { error } = await supabase.from("users").update(updatedData).eq("id", uid);
      if (error) throw error;

      saveUser({ ...user, ...updatedData });
      setEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      Alert.alert("Save Error", error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setName(user?.name || "");
    setSchool(user?.school || "");
    setSkills(Array.isArray(user?.skills) ? user.skills : []);
    setOverview(user?.overview || "");
    setImageUrl(user?.image_url || null);
    setDisplayUrl(user?.image_url ? `${user.image_url}?t=${Date.now()}` : null);
    setEditing(false);
  };

  const toggleSkill = (skill) =>
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );

  const handleLogout = async () => {
    try {
      await logout();
      setImageUrl(null);
      setDisplayUrl(null);
      setName("");
      setLogoutModalVisible(false);
      navigation.replace("Auth");
    } catch (e) {
      Alert.alert("Logout Error", e.message);
    }
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#050914" />
        <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }


  // ── Derived post counts for header badges ─────────────────────────────────
  const pendingCount  = myPosts.filter(j => j.status === "pending").length;
  const rejectedCount = myPosts.filter(j => j.status === "rejected").length;


  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />

      {/* Modals */}
      <EditModal
        visible={editVisible} job={editJob}
        onClose={closeEdit}
        onSaved={() => fetchMyPosts()}
      />
      <ConfirmModal
        visible={confirmVisible}
        title="Delete Post"
        message={`Delete "${confirmJob?.title}"?\n\nThis cannot be undone.`}
        onCancel={closeDelete}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={[styles.iconBtn, styles.iconBtnRed]}
              onPress={() => setLogoutModalVisible(true)}
            >
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Avatar */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            onPress={pickImage}
            disabled={updating || !editing}
            activeOpacity={editing ? 0.7 : 1}
          >
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                {displayUrl ? (
                  <Image
                    key={displayUrl}
                    source={{ uri: displayUrl }}
                    style={styles.avatarImage}
                    onError={() => setDisplayUrl(null)}
                  />
                ) : (
                  <Text style={styles.avatarText}>{getInitials(name)}</Text>
                )}
              </View>
              {editing && !updating && (
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={14} color="white" />
                </View>
              )}
              {updating && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator size="small" color="white" />
                </View>
              )}
            </View>
          </TouchableOpacity>

          {editing && <Text style={styles.changePhotoHint}>Tap to change photo</Text>}

          <Text style={styles.name}>{name || "User"}</Text>
          <Text style={styles.school}>{school || "Unknown School"}</Text>

          {!editing && (
            <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={16} color="#a78bfa" />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          {STAT_KEYS.map((s) => (
            <View key={s.label} style={styles.box}>
              <Text style={styles.number}>{s.format(user?.[s.key])}</Text>
              <Text style={styles.label}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Overview & Edit Section */}
        <View style={styles.overviewSection}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>Overview & Details</Text>
            {editing && (
              <TouchableOpacity onPress={handleCancelEdit}>
                <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <>
              {[
                { label: "Full Name",           value: name,   setter: setName,   placeholder: "Your full name" },
                { label: "School / University", value: school, setter: setSchool, placeholder: "Your school" },
              ].map(({ label, value, setter, placeholder }) => (
                <View key={label}>
                  <Text style={styles.inputLabel}>{label}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={value}
                    onChangeText={setter}
                    placeholder={placeholder}
                    placeholderTextColor="#6b7280"
                  />
                </View>
              ))}

              <Text style={styles.inputLabel}>About</Text>
              <TextInput
                style={styles.overviewInput}
                multiline
                placeholder="Write something about yourself..."
                value={overview}
                onChangeText={setOverview}
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.inputLabel}>Skills</Text>
              <View style={styles.skillsContainer}>
                {ALL_SKILLS.map((skill) => (
                  <TouchableOpacity
                    key={skill}
                    style={[styles.skillChip, skills.includes(skill) && styles.skillChipActive]}
                    onPress={() => toggleSkill(skill)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.skillText, skills.includes(skill) && styles.skillTextActive]}>
                      {skill}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelEdit} disabled={updating}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, updating && { opacity: 0.6 }]}
                  onPress={handleSaveAll}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.saveText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.overviewText}>
                {overview || "Share details about yourself and what services you offer."}
              </Text>
              {skills.length > 0 && (
                <View style={styles.skillsContainer}>
                  {skills.map((s) => (
                    <View key={s} style={styles.skillChipActive}>
                      <Text style={styles.skillTextActive}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* ── My Posts Section ───────────────────────────────────────────── */}
        <View style={styles.myPostsSection}>
          {/* Section header */}
          <View style={styles.myPostsHeader}>
            <View style={styles.myPostsHeaderLeft}>
              <Ionicons name="newspaper-outline" size={18} color="#a78bfa" />
              <Text style={styles.myPostsTitle}>My Posts</Text>
              {myPosts.length > 0 && (
                <View style={styles.postCountBadge}>
                  <Text style={styles.postCountText}>{myPosts.length}</Text>
                </View>
              )}
            </View>
            {/* Alert badges for pending/rejected */}
            <View style={styles.myPostsHeaderRight}>
              {pendingCount > 0 && (
                <View style={[styles.alertBadge, { backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.25)" }]}>
                  <Ionicons name="time" size={11} color="#fbbf24" />
                  <Text style={[styles.alertBadgeText, { color: "#fbbf24" }]}>{pendingCount} pending</Text>
                </View>
              )}
              {rejectedCount > 0 && (
                <View style={[styles.alertBadge, { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.25)" }]}>
                  <Ionicons name="close-circle" size={11} color="#f87171" />
                  <Text style={[styles.alertBadgeText, { color: "#f87171" }]}>{rejectedCount} rejected</Text>
                </View>
              )}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.myPostsDivider} />

          {/* Content */}
          {postsLoading ? (
            <ActivityIndicator color="#7c3aed" style={{ marginVertical: 20 }} />
          ) : myPosts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <View style={styles.emptyPostsIcon}>
                <Ionicons name="add-circle-outline" size={28} color="#374151" />
              </View>
              <Text style={styles.emptyPostsText}>No posts yet</Text>
              <Text style={styles.emptyPostsSub}>Head to the Job Board to post your first gig</Text>
            </View>
          ) : (
            <View style={styles.postsList}>
              {myPosts.map((job) => (
                <MyPostCard
                  key={job.id}
                  job={job}
                  onEdit={openEdit}
                  onDelete={openDelete}
                />
              ))}
            </View>
          )}
        </View>

        {/* Logout Modal */}
        <Modal
          animationType="fade"
          transparent
          visible={logoutModalVisible}
          onRequestClose={() => setLogoutModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIcon}>
                <Ionicons name="log-out-outline" size={40} color="#ef4444" />
              </View>
              <Text style={styles.modalTitle}>Sign Out</Text>
              <Text style={styles.modalText}>Are you sure you want to sign out?</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setLogoutModalVisible(false)}
                >
                  <Text style={styles.modalBtnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnLogout]}
                  onPress={handleLogout}
                >
                  <Text style={styles.modalBtnLogoutText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    paddingTop: 20,
    marginBottom: 20,
  },
  headerTitle: { color: "white", fontSize: 24, fontWeight: "800" },
  headerIcons: { flexDirection: "row", gap: 12 },
  iconBtn: {
    backgroundColor: "#0f1629",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  iconBtnRed: { borderColor: "#ef444440" },

  profileSection: { alignItems: "center", paddingHorizontal: 20, marginBottom: 24 },
  avatarWrapper:  { width: 100, height: 100, marginBottom: 12, position: "relative" },
  avatar: {
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: "#7c3aed",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#1e2d4a",
    overflow: "hidden",
  },
  avatarImage:   { width: "100%", height: "100%" },
  avatarText:    { color: "white", fontSize: 36, fontWeight: "bold" },
  avatarOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0, right: 0,
    backgroundColor: "#7c3aed",
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#050914",
    zIndex: 10,
  },
  changePhotoHint: { color: "#7c3aed", fontSize: 12, marginBottom: 6, marginTop: -4 },
  name:   { color: "white", fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  school: { color: "#9ca3af", fontSize: 14, marginBottom: 12 },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f1629",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#7c3aed",
    gap: 6,
  },
  editButtonText: { color: "#a78bfa", fontSize: 14, fontWeight: "600" },

  stats: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 24 },
  box: {
    flex: 1,
    backgroundColor: "#0f1629",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  number: { color: "#8b5cf6", fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  label:  { color: "#9ca3af", fontSize: 12 },

  overviewSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: "#0f1629",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  overviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  overviewTitle: { color: "white", fontSize: 16, fontWeight: "700" },
  inputLabel: {
    color: "#7c3aed",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: "#050914",
    color: "white",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e2d4a",
    fontSize: 14,
  },
  overviewInput: {
    backgroundColor: "#050914",
    color: "white",
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  overviewText: { color: "#9ca3af", fontSize: 14, marginBottom: 15, lineHeight: 20 },

  skillsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12, marginTop: 4 },
  skillChip: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#7c3aed",
  },
  skillChipActive: {
    backgroundColor: "#7c3aed",
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 12,
  },
  skillText:       { color: "#cbd5e1", fontSize: 13 },
  skillTextActive: { color: "white", fontWeight: "600", fontSize: 13 },

  actionButtons: { flexDirection: "row", gap: 10, marginTop: 10 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#1e2d4a",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelText: { color: "#9ca3af", fontWeight: "600" },
  saveBtn: {
    flex: 2,
    backgroundColor: "#7c3aed",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  saveText: { color: "white", fontWeight: "600" },

  // ── My Posts Section ──────────────────────────────────────────────────────
  myPostsSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: "#0f1629",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e2d4a",
    overflow: "hidden",
  },
  myPostsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  myPostsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  myPostsTitle: { color: "white", fontSize: 16, fontWeight: "700" },
  postCountBadge: {
    backgroundColor: "#7c3aed",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  postCountText: { color: "white", fontSize: 11, fontWeight: "800" },
  myPostsHeaderRight: { flexDirection: "row", gap: 6, alignItems: "center" },
  alertBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  alertBadgeText: { fontSize: 11, fontWeight: "700" },
  myPostsDivider: { height: 1, backgroundColor: "#1e2d4a", marginHorizontal: 0 },

  emptyPosts: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyPostsIcon: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: "#0b1120",
    borderWidth: 1,
    borderColor: "#1e2d4a",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyPostsText: { color: "#374151", fontSize: 15, fontWeight: "700" },
  emptyPostsSub:  { color: "#1f2937", fontSize: 12, textAlign: "center", paddingHorizontal: 20 },

  postsList: { paddingTop: 4, paddingBottom: 4 },

  // ── Logout Modal ──────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#0f1629",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  modalIcon: {
    width: 70, height: 70,
    borderRadius: 35,
    backgroundColor: "#1e1344",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle:          { color: "white", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  modalText:           { color: "#9ca3af", fontSize: 14, textAlign: "center", marginBottom: 24 },
  modalButtons:        { flexDirection: "row", gap: 12, width: "100%" },
  modalBtn:            { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  modalBtnCancel:      { backgroundColor: "#1e2d4a" },
  modalBtnCancelText:  { color: "white", fontWeight: "600" },
  modalBtnLogout:      { backgroundColor: "#ef4444" },
  modalBtnLogoutText:  { color: "white", fontWeight: "600" },
});


// ─────────────────────────────────────────────────────────────────────────────
// MY POST CARD STYLES
// ─────────────────────────────────────────────────────────────────────────────

const postCardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1a2540",
    backgroundColor: "transparent",
    paddingVertical: 10,
    paddingRight: 12,
  },
  cardRejected: {
    backgroundColor: "rgba(239,68,68,0.03)",
  },

  // ── Thumbnail ──────────────────────────────────────────────────────────
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 10,
    overflow: "hidden",
    marginLeft: 12,
    flexShrink: 0,
    position: "relative",
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  // Thin colored strip at the bottom of the thumbnail — reflects status color
  thumbStrip: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },

  // ── Body ───────────────────────────────────────────────────────────────
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8,
  },
  title: {
    flex: 1,
    color: "white",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 6,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(124,58,237,0.1)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnDelete: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderColor: "rgba(239,68,68,0.2)",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: "700" },
  metaDot: {
    width: 3, height: 3,
    borderRadius: 1.5,
    backgroundColor: "#374151",
  },
  budget:  { color: "#a78bfa", fontSize: 12, fontWeight: "700" },
  timeAgo: { color: "#374151", fontSize: 11 },

  rejectedHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 7,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.15)",
  },
  rejectedHintText: { color: "#f87171", fontSize: 10, flex: 1 },

  pendingHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 7,
    backgroundColor: "rgba(245,158,11,0.08)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.15)",
  },
  pendingHintText: { color: "#fbbf24", fontSize: 10, flex: 1 },
});


// ─────────────────────────────────────────────────────────────────────────────
// EDIT / CONFIRM MODAL STYLES
// ─────────────────────────────────────────────────────────────────────────────

const editStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0f1629",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 44,
    borderTopWidth: 1, borderColor: "#1e2d4a",
    maxHeight: "88%",
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