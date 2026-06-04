import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";

const CATEGORIES = ["Coding", "Design", "Writing", "Tutoring", "Photography", "Video", "Research", "Errands"];
const BUDGET_OPTIONS = ["Under ₱500", "₱500–₱1K", "₱1K–₱2K", "₱2K–₱5K", "₱5K+"];
const URGENCY_OPTIONS = [
  { label: "Today",      value: "Today",      level: "urgent", icon: "flash-outline" },
  { label: "2–3 days",   value: "2–3 days",   level: "medium", icon: "time-outline" },
  { label: "This week",  value: "This week",  level: "medium", icon: "calendar-outline" },
  { label: "This month", value: "This month", level: "low",    icon: "calendar-outline" },
  { label: "Flexible",   value: "Flexible",   level: "low",    icon: "leaf-outline" },
];

const STEP_LABELS = ["Job Details", "Budget & Timeline", "Review & Post"];

// ─── Sub-Components ──────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  return (
    <View style={styles.stepWrap}>
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const done = step > num;
        const active = step === num;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, done && styles.stepDone, active && styles.stepActive]}>
                {done ? (
                  <Ionicons name="checkmark" size={12} color="white" />
                ) : (
                  <Text style={[styles.stepNum, active && { color: "white" }]}>{num}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
            </View>
            {i < STEP_LABELS.length - 1 && (
              <View style={[styles.stepConnector, done && styles.stepConnectorDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function Field({ icon, label, required, children }) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Ionicons name={icon} size={14} color="#7c3aed" />
        <Text style={styles.fieldLabel}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      </View>
      {children}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PostJobScreen({ navigation }) {
  const { user } = useUser();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [posted, setPosted] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [budget, setBudget] = useState("");
  const [customBudget, setCustomBudget] = useState("");
  const [urgencyOption, setUrgencyOption] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Derive poster name from user profile — no manual input needed
const posterName = user?.name || user?.email?.split("@")[0] || "Taskmate User";
const school = user?.school ?? "";

  const effectiveBudget = customBudget ? `₱${parseInt(customBudget).toLocaleString()}` : budget;
  const budgetRaw = customBudget ? parseInt(customBudget) : 0;

  const canStep1 = title.trim().length > 0 && category.length > 0;
  const canStep2 = effectiveBudget.length > 0 && urgencyOption !== null;
  const canPost = canStep1 && canStep2;

  // ── Image Picker ────────────────────────────────────────────────────────────

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library to upload a cover image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const uploadImage = async () => {
    if (!imageUri) return null;
    const fileExt = imageUri.split(".").pop().split("?")[0].toLowerCase();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `job-covers/${fileName}`;
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const { error } = await supabase.storage
      .from("job-images")
      .upload(filePath, blob, { contentType: `image/${fileExt}` });
    if (error) throw error;
    const { data } = supabase.storage.from("job-images").getPublicUrl(filePath);
    return data.publicUrl;
  };

  // ── Post Handler ────────────────────────────────────────────────────────────

const handlePost = async () => {
  if (!canPost) return;
  setLoading(true);

  try {
    let imageUrl = null;
    if (imageUri) {
      try {
        imageUrl = await uploadImage();
      } catch (imgErr) {
        console.warn("Image upload failed:", imgErr.message);
      }
    }

    const tagsArray = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const { error } = await supabase.from("jobs").insert({
      title: title.trim(),
      description: description.trim(),
      category,
      budget: effectiveBudget,
      budget_raw: budgetRaw,
      urgency: urgencyOption.value,
      urgency_level: urgencyOption.level,
      poster_name: posterName,
      school: school,
      avatar: posterName.charAt(0).toUpperCase(),
      poster_avatar_url: user?.image_url ?? null,
      tags: tagsArray,
      image_url: imageUrl,
      user_id: user?.id ?? null,
    });

    if (error) {
      console.error("Insert error:", JSON.stringify(error, null, 2));
      Alert.alert("Post failed", error.message);
      return;
    }

    setPosted(true);
  } catch (err) {
    console.error("Caught error:", JSON.stringify(err, null, 2));
    Alert.alert("Post failed", err.message || "Something went wrong.");
  } finally {
    setLoading(false);
  }
};

  // ── Reset ───────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setPosted(false);
    setStep(1);
    setTitle(""); setCategory(""); setDescription("");
    setTagsInput(""); setBudget(""); setCustomBudget("");
    setUrgencyOption(null); setImageUri(null);
  };

  // ── Success Screen ──────────────────────────────────────────────────────────

  if (posted) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#050914" />
        <View style={styles.successScreen}>
          <View style={styles.successRing}>
            <View style={styles.successCircle}>
              <Ionicons name="megaphone" size={40} color="#7c3aed" />
            </View>
          </View>
          <Text style={styles.successTitle}>Job Posted!</Text>
          <Text style={styles.successSub}>
            Your job is now live. Students can view and apply immediately.
          </Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.successBtnText}>View Job Board</Text>
            <Ionicons name="arrow-forward" size={16} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.successBtnOutline} onPress={resetForm}>
            <Text style={styles.successBtnOutlineText}>Post Another Job</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep(step - 1) : navigation.goBack())}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={20} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a Job</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepIndicator step={step} />

          {/* ── STEP 1: Job Details ── */}
          {step === 1 && (
            <>
              {/* Cover Image */}
              <Field icon="image-outline" label="Cover Image">
                <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
                  {imageUri ? (
                    <>
                      <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                      <View style={styles.imageOverlay}>
                        <Ionicons name="camera-outline" size={22} color="white" />
                        <Text style={styles.imageOverlayText}>Change Photo</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <View style={styles.imagePlaceholderIcon}>
                        <Ionicons name="image-outline" size={30} color="#7c3aed" />
                      </View>
                      <Text style={styles.imagePlaceholderTitle}>Add a Cover Image</Text>
                      <Text style={styles.imagePlaceholderSub}>16:9 ratio · optional</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Field>

              <Field icon="create-outline" label="Job Title" required>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Need someone to design my thesis poster"
                  placeholderTextColor="#374151"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={80}
                />
                <Text style={styles.charCount}>{title.length}/80</Text>
              </Field>

              <Field icon="grid-outline" label="Category" required>
                <View style={styles.chipGrid}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, category === cat && styles.chipActive]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Field>

              <Field icon="document-text-outline" label="Description">
                <TextInput
                  style={[styles.input, styles.textarea]}
                  placeholder="Describe what you need done..."
                  placeholderTextColor="#374151"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                />
              </Field>

              <Field icon="pricetag-outline" label="Tags (comma-separated)">
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Figma, Canva, A4 Poster"
                  placeholderTextColor="#374151"
                  value={tagsInput}
                  onChangeText={setTagsInput}
                />
              </Field>

              <TouchableOpacity
                style={[styles.primaryBtn, !canStep1 && styles.primaryBtnDisabled]}
                onPress={() => canStep1 && setStep(2)}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Next Step</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP 2: Budget & Timeline ── */}
          {step === 2 && (
            <>
              <Field icon="cash-outline" label="Budget Range" required>
                <View style={styles.chipGrid}>
                  {BUDGET_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.chip, budget === opt && styles.chipActive]}
                      onPress={() => { setBudget(opt); setCustomBudget(""); }}
                    >
                      <Text style={[styles.chipText, budget === opt && styles.chipTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or exact amount</Text>
                  <View style={styles.orLine} />
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.pesoSign}>₱</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="0"
                    placeholderTextColor="#374151"
                    value={customBudget}
                    onChangeText={(v) => { setCustomBudget(v); setBudget(""); }}
                    keyboardType="numeric"
                  />
                </View>
              </Field>

              <Field icon="time-outline" label="When do you need it?" required>
                <View style={styles.urgencyGrid}>
                  {URGENCY_OPTIONS.map((opt) => {
                    const isActive = urgencyOption?.value === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.urgencyCard, isActive && styles.urgencyCardActive]}
                        onPress={() => setUrgencyOption(opt)}
                      >
                        <Ionicons name={opt.icon} size={16} color={isActive ? "white" : "#6b7280"} />
                        <Text style={[styles.urgencyCardText, isActive && styles.urgencyCardTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>

              <TouchableOpacity
                style={[styles.primaryBtn, !canStep2 && styles.primaryBtnDisabled]}
                onPress={() => canStep2 && setStep(3)}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Review & Finish</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP 3: Review & Post ── */}
          {step === 3 && (
            <>
              {/* Poster Info (read-only, pulled from profile) */}
              <View style={styles.posterCard}>
                <View style={styles.posterAvatar}>
                  <Text style={styles.posterAvatarText}>{posterName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.posterInfo}>
                  <Text style={styles.posterName}>{posterName}</Text>
                  {school ? <Text style={styles.posterSchool}>{school}</Text> : null}
                </View>
                <View style={styles.posterBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#059669" />
                  <Text style={styles.posterBadgeText}>You</Text>
                </View>
              </View>

              {/* Preview Card */}
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Ionicons name="eye-outline" size={15} color="#7c3aed" />
                  <Text style={styles.previewTitle}>Review Post</Text>
                </View>
                {imageUri && (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
                )}
                <Text style={styles.previewJobTitle}>{title || "—"}</Text>
                <View style={styles.previewMeta}>
                  <View style={styles.previewMetaItem}>
                    <Ionicons name="pricetag-outline" size={12} color="#a78bfa" />
                    <Text style={styles.previewMetaText}>{category || "—"}</Text>
                  </View>
                  <View style={styles.previewMetaItem}>
                    <Ionicons name="cash-outline" size={12} color="#a78bfa" />
                    <Text style={styles.previewMetaText}>{effectiveBudget || "—"}</Text>
                  </View>
                  {urgencyOption && (
                    <View style={styles.previewMetaItem}>
                      <Ionicons name="time-outline" size={12} color="#a78bfa" />
                      <Text style={styles.previewMetaText}>{urgencyOption.label}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.previewDesc} numberOfLines={3}>
                  {description || "No description provided."}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, (!canPost || loading) && styles.primaryBtnDisabled]}
                onPress={handlePost}
                disabled={!canPost || loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="megaphone-outline" size={18} color="white" />
                    <Text style={styles.primaryBtnText}>Publish Job</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: "#0d1527",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: "#0b1120",
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1a2540",
  },
  headerTitle: { color: "white", fontSize: 17, fontWeight: "800" },
  content: { padding: 20, paddingBottom: 60 },

  // Step Indicator
  stepWrap: { flexDirection: "row", alignItems: "center", marginBottom: 30 },
  stepItem: { alignItems: "center", gap: 6 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: "#0b1120",
    borderWidth: 1.5, borderColor: "#1a2540", justifyContent: "center", alignItems: "center",
  },
  stepDone: { backgroundColor: "#059669", borderColor: "#059669" },
  stepActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  stepNum: { color: "#4b5563", fontSize: 12, fontWeight: "700" },
  stepLabel: { color: "#4b5563", fontSize: 10, fontWeight: "600" },
  stepLabelActive: { color: "#a78bfa" },
  stepConnector: { flex: 1, height: 1.5, backgroundColor: "#1a2540", marginBottom: 16, marginHorizontal: 6 },
  stepConnectorDone: { backgroundColor: "#059669" },

  // Fields
  field: { marginBottom: 22 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  fieldLabel: { color: "#9ca3af", fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  required: { color: "#7c3aed" },
  charCount: { color: "#374151", fontSize: 11, textAlign: "right", marginTop: 4 },
  input: {
    backgroundColor: "#0b1120", borderRadius: 14, padding: 14,
    fontSize: 14, color: "white", borderWidth: 1, borderColor: "#1a2540",
  },
  textarea: { minHeight: 110 },

  // Image Picker
  imagePicker: {
    height: 180, borderRadius: 14, overflow: "hidden",
    borderWidth: 1.5, borderColor: "#1a2540", borderStyle: "dashed", backgroundColor: "#0b1120",
  },
  imagePreview: { width: "100%", height: "100%" },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", gap: 6,
  },
  imageOverlayText: { color: "white", fontSize: 14, fontWeight: "600" },
  imagePlaceholder: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  imagePlaceholderIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(124,58,237,0.12)", justifyContent: "center", alignItems: "center",
  },
  imagePlaceholderTitle: { fontSize: 15, fontWeight: "600", color: "#9ca3af" },
  imagePlaceholderSub: { fontSize: 12, color: "#4b5563" },

  // Chips
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "#0b1120",
    borderRadius: 50, borderWidth: 1, borderColor: "#1a2540",
  },
  chipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "white" },

  // Budget
  orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: "#1a2540" },
  orText: { color: "#374151", fontSize: 12 },
  priceRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#0b1120",
    borderRadius: 14, borderWidth: 1, borderColor: "#1a2540", overflow: "hidden",
  },
  pesoSign: { paddingHorizontal: 16, fontSize: 22, color: "#7c3aed", fontWeight: "800" },
  priceInput: { flex: 1, paddingVertical: 14, fontSize: 20, fontWeight: "700", color: "white" },

  // Urgency
  urgencyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  urgencyCard: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: "#0b1120", borderRadius: 12, borderWidth: 1, borderColor: "#1a2540",
  },
  urgencyCardActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  urgencyCardText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  urgencyCardTextActive: { color: "white" },

  // Poster Card (Step 3)
  posterCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0b1120", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#1a2540", marginBottom: 16,
  },
  posterAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(124,58,237,0.2)", justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: "rgba(124,58,237,0.4)",
  },
  posterAvatarText: { color: "#a78bfa", fontSize: 18, fontWeight: "800" },
  posterInfo: { flex: 1 },
  posterName: { color: "white", fontSize: 15, fontWeight: "700" },
  posterSchool: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  posterBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(5,150,105,0.12)", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(5,150,105,0.25)",
  },
  posterBadgeText: { color: "#059669", fontSize: 11, fontWeight: "700" },

  // Preview Card
  previewCard: {
    backgroundColor: "#0b1120", borderRadius: 16, padding: 18, marginBottom: 22,
    borderWidth: 1, borderColor: "#1a2540", borderLeftWidth: 3, borderLeftColor: "#7c3aed",
    overflow: "hidden",
  },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  previewTitle: { color: "#7c3aed", fontWeight: "700", fontSize: 12 },
  previewImage: { width: "100%", height: 120, borderRadius: 10, marginBottom: 12 },
  previewJobTitle: { color: "white", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  previewMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  previewMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  previewMetaText: { color: "#a78bfa", fontSize: 12, fontWeight: "600" },
  previewDesc: { color: "#6b7280", fontSize: 13, lineHeight: 19 },

  // Buttons
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#7c3aed", borderRadius: 16, paddingVertical: 17,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: "white", fontSize: 16, fontWeight: "700" },

  // Success Screen
  successScreen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  successRing: {
    width: 110, height: 110, borderRadius: 55, borderWidth: 2,
    borderColor: "rgba(124,58,237,0.25)", justifyContent: "center", alignItems: "center", marginBottom: 8,
  },
  successCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: "rgba(124,58,237,0.15)", justifyContent: "center", alignItems: "center",
  },
  successTitle: { color: "white", fontSize: 26, fontWeight: "900" },
  successSub: { color: "#6b7280", fontSize: 15, textAlign: "center", lineHeight: 22 },
  successBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#7c3aed",
    paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, width: "100%", justifyContent: "center",
  },
  successBtnText: { color: "white", fontSize: 16, fontWeight: "700" },
  successBtnOutline: {
    paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, width: "100%",
    alignItems: "center", borderWidth: 1.5, borderColor: "#1a2540",
  },
  successBtnOutlineText: { color: "#6b7280", fontSize: 15, fontWeight: "600" },
});