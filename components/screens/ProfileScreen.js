//new code
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, ScrollView, SafeAreaView, ActivityIndicator,
  Modal, Image, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";

const ALL_SKILLS = [
  "React Native", "UI/UX Design", "Web Development", "Backend",
  "Graphic Design", "Mobile Dev", "Data Science", "DevOps",
];

const STAT_KEYS = [
  { key: "completed", label: "Completed", format: (v) => v ?? 0 },
  { key: "rating",    label: "Rating",    format: (v) => v ? Number(v).toFixed(1) : "0.0" },
  { key: "earned",    label: "Earned",    format: (v) => `₱${v ?? 0}` },
];

function getInitials(name) {
  if (!name) return "U";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().substring(0, 2);
}

export default function ProfileScreen({ navigation }) {
  const { user, saveUser, logout } = useUser();

  const [loading,            setLoading]            = useState(true);
  const [updating,           setUpdating]           = useState(false);
  const [editing,            setEditing]            = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const [name,     setName]     = useState("");
  const [school,   setSchool]   = useState("");
  const [skills,   setSkills]   = useState([]);
  const [overview, setOverview] = useState("");
  const [imageUrl, setImageUrl] = useState(null);

  // Seed local state from context immediately so UI isn't blank on mount
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setSchool(user.school || "");
      setSkills(Array.isArray(user.skills) ? user.skills : []);
      setOverview(user.overview || "");
      setImageUrl(user.image_url || null);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", fetchProfile);
    return unsubscribe;
  }, [navigation]);

  // ── Helper: get current auth user ID reliably ────────────────────────────
  const getAuthUserId = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData?.session?.user?.id ?? null;
  };

  const fetchProfile = async () => {
    try {
      const userId = await getAuthUserId();

      if (!userId) {
        setLoading(false);
        // NavigationGate in App.js handles the redirect — do NOT call navigation.replace here
        return;
      }

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
      }
    } catch (e) {
      Alert.alert("Error", "Failed to load profile: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    if (!editing) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "We need access to your photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets?.length > 0) {
      // FIX: use result.assets[0].uri, not a separate localUri variable
      const uri = result.assets[0].uri;
      setImageUrl(uri);
      await handleImageUpload(uri);
    }
  };

  const handleImageUpload = async (uri) => {
    // FIX: get uid fresh from session — never rely on a state variable
    const uid = await getAuthUserId();
    if (!uid) { Alert.alert("Error", "Session not found. Please re-login."); return; }

    setUpdating(true);
    try {
      // FIX: was referencing undefined `localUri` — now correctly uses `uri` param
      const response = await fetch(uri);
      const blob     = await response.blob();
      const fileName = `${uid}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
      if (!urlData?.publicUrl) throw new Error("Could not get public URL");

      const bustUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("users")
        .update({ image_url: bustUrl })
        .eq("id", uid);
      if (updateError) throw updateError;

      setImageUrl(bustUrl);
      saveUser({ ...user, image_url: bustUrl });
      Alert.alert("Success", "Profile picture updated!");
    } catch (err) {
      Alert.alert("Upload Error", err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveAll = async () => {
    // FIX: get uid fresh from session every time — never rely on state
    const uid = await getAuthUserId();
    if (!uid)         { Alert.alert("Error", "Session not found. Please re-login."); return; }
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
      Alert.alert("Success", "Profile updated!");
    } catch (err) {
      Alert.alert("Save Error", err.message);
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
    setEditing(false);
  };

  const toggleSkill = (skill) =>
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );

const handleLogout = async () => {
  try {
    setLogoutModalVisible(false);
    await logout();
    navigation.replace("Auth"); // add this back
  } catch (e) {
    Alert.alert("Logout Error", e.message);
  }
};
  const isAdmin = user?.is_admin === true || user?.user_metadata?.is_admin === true;

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#050914" />
        <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="settings-outline" size={22} color="#a78bfa" />
            </TouchableOpacity>
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
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl, cache: "reload" }}
                    style={styles.avatarImage}
                    onError={() => setImageUrl(null)}
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
          {STAT_KEYS.map((sk) => (
            <View key={sk.label} style={styles.box}>
              <Text style={styles.number}>{sk.format(user?.[sk.key])}</Text>
              <Text style={styles.label}>{sk.label}</Text>
            </View>
          ))}
        </View>

        {/* Overview & Edit */}
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
                { label: "School / University", value: school, setter: setSchool, placeholder: "Your school"    },
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
                  {updating
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text style={styles.saveText}>Save Changes</Text>
                  }
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
                  {skills.map((sk) => (
                    <View key={sk} style={styles.skillChipActive}>
                      <Text style={styles.skillTextActive}>{sk}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Admin Panel — visible only to admins */}
        {isAdmin && (
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
            <TouchableOpacity
              style={styles.adminBtn}
              onPress={() => navigation.navigate("AdminView")}
            >
              <View style={styles.adminIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#a78bfa" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.adminLabel}>Admin Panel</Text>
                <Text style={styles.adminSub}>Manage jobs, gigs & users</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* Menu */}
        <View style={styles.menuSection}>
          {[
            { icon: "briefcase-outline",  label: "My Gigs"    },
            { icon: "heart-outline",      label: "Saved Gigs" },
            { icon: "chatbubble-outline", label: "Messages", badge: 3 },
            { icon: "wallet-outline",     label: "Payments"   },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.menuItem} activeOpacity={0.7}>
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon} size={20} color="#a78bfa" />
              </View>
              <Text style={styles.menuText}>{item.label}</Text>
              {item.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>
          ))}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },

  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20, paddingTop: 20, marginBottom: 20,
  },
  headerTitle: { color: "white", fontSize: 24, fontWeight: "800" },
  headerIcons: { flexDirection: "row", gap: 12 },
  iconBtn: {
    backgroundColor: "#0f1629", padding: 10,
    borderRadius: 12, borderWidth: 1, borderColor: "#1e2d4a",
  },
  iconBtnRed: { borderColor: "#ef444440" },

  profileSection: { alignItems: "center", paddingHorizontal: 20, marginBottom: 24 },
  avatarWrapper:  { width: 100, height: 100, marginBottom: 12, position: "relative" },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "#7c3aed", justifyContent: "center", alignItems: "center",
    borderWidth: 3, borderColor: "#1e2d4a", overflow: "hidden",
  },
  avatarImage:   { width: "100%", height: "100%" },
  avatarText:    { color: "white", fontSize: 36, fontWeight: "bold" },
  avatarOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 50,
    justifyContent: "center", alignItems: "center",
  },
  cameraBadge: {
    position: "absolute", bottom: 0, right: 0,
    backgroundColor: "#7c3aed", padding: 6, borderRadius: 20,
    borderWidth: 2, borderColor: "#050914", zIndex: 10,
  },
  changePhotoHint: { color: "#7c3aed", fontSize: 12, marginBottom: 6, marginTop: -4 },
  name:   { color: "white", fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  school: { color: "#9ca3af", fontSize: 14, marginBottom: 12 },
  editButton: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0f1629", paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: "#7c3aed", gap: 6,
  },
  editButtonText: { color: "#a78bfa", fontSize: 14, fontWeight: "600" },

  stats: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 24 },
  box: {
    flex: 1, backgroundColor: "#0f1629", padding: 16,
    borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "#1e2d4a",
  },
  number: { color: "#8b5cf6", fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  label:  { color: "#9ca3af", fontSize: 12 },

  overviewSection: {
    marginHorizontal: 20, marginBottom: 24,
    backgroundColor: "#0f1629", padding: 16,
    borderRadius: 16, borderWidth: 1, borderColor: "#1e2d4a",
  },
  overviewHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },
  overviewTitle: { color: "white", fontSize: 16, fontWeight: "700" },
  inputLabel:    { color: "#7c3aed", fontSize: 12, fontWeight: "600", marginTop: 10, marginBottom: 4 },
  textInput: {
    backgroundColor: "#050914", color: "white",
    padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#1e2d4a", fontSize: 14,
  },
  overviewInput: {
    backgroundColor: "#050914", color: "white", fontSize: 14,
    minHeight: 80, textAlignVertical: "top", marginBottom: 10,
    padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#1e2d4a",
  },
  overviewText: { color: "#9ca3af", fontSize: 14, marginBottom: 15, lineHeight: 20 },

  skillsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12, marginTop: 4 },
  skillChip: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, borderColor: "#7c3aed",
  },
  skillChipActive: {
    backgroundColor: "#7c3aed", paddingVertical: 6,
    paddingHorizontal: 12, borderRadius: 12,
  },
  skillText:       { color: "#cbd5e1", fontSize: 13 },
  skillTextActive: { color: "white", fontWeight: "600", fontSize: 13 },

  actionButtons: { flexDirection: "row", gap: 10, marginTop: 10 },
  cancelBtn: {
    flex: 1, backgroundColor: "#1e2d4a",
    paddingVertical: 12, borderRadius: 10, alignItems: "center",
  },
  cancelText: { color: "#9ca3af", fontWeight: "600" },
  saveBtn: {
    flex: 2, backgroundColor: "#7c3aed",
    paddingVertical: 12, borderRadius: 10, alignItems: "center",
  },
  saveText: { color: "white", fontWeight: "600" },

  adminBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0f1629", padding: 16,
    borderRadius: 16, borderWidth: 1, borderColor: "#7c3aed44",
  },
  adminIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#1e1344", justifyContent: "center", alignItems: "center",
  },
  adminLabel: { color: "white", fontSize: 15, fontWeight: "700" },
  adminSub:   { color: "#9ca3af", fontSize: 12, marginTop: 1 },

  menuSection: { paddingHorizontal: 20, gap: 8 },
  menuItem: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0f1629", padding: 16,
    borderRadius: 16, borderWidth: 1, borderColor: "#1e2d4a",
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#1e1344", justifyContent: "center",
    alignItems: "center", marginRight: 12,
  },
  menuText:  { flex: 1, color: "white", fontSize: 16, fontWeight: "500" },
  badge: {
    backgroundColor: "#7c3aed", borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2, marginRight: 8,
  },
  badgeText: { color: "white", fontSize: 12, fontWeight: "700" },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center", alignItems: "center", paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#0f1629", borderRadius: 24, padding: 24,
    width: "100%", maxWidth: 340, alignItems: "center",
    borderWidth: 1, borderColor: "#1e2d4a",
  },
  modalIcon: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: "#1e1344", justifyContent: "center",
    alignItems: "center", marginBottom: 16,
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