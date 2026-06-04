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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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



const AVATAR_COLORS = ["#7c3aed", "#0891b2", "#059669", "#dc2626", "#d97706", "#be185d", "#2563eb"];

const STEP_LABELS = ["Job Details", "Budget & Timeline", "Review & Post"];



// ─── Sub-Components ─────────────────────────────────────────────────────────



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



// ─── Main Screen ─────────────────────────────────────────────────────────────



export default function PostJobScreen({ navigation }) {

  const { user } = useUser(); // ← FIX: get logged-in user

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

  const [posterName, setPosterName] = useState("");

  const [school, setSchool] = useState("");



  const effectiveBudget = customBudget ? `₱${parseInt(customBudget).toLocaleString()}` : budget;

  const budgetRaw = customBudget ? parseInt(customBudget) : 0;



  const canStep1 = title.trim().length > 0 && category.length > 0;

  const canStep2 = effectiveBudget.length > 0 && urgencyOption !== null;

  const canPost = canStep1 && canStep2 && posterName.trim().length > 0;



  const handlePost = async () => {

    if (!canPost) return;

    setLoading(true);



    const tagsArray = tagsInput

      .split(",")

      .map((t) => t.trim())

      .filter(Boolean);



    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];



    const { error } = await supabase.from("jobs").insert({

      title: title.trim(),

      description: description.trim(),

      category,

      budget: effectiveBudget,

      budget_raw: budgetRaw,

      urgency: urgencyOption.value,

      urgency_level: urgencyOption.level,

      poster_name: posterName.trim(),

      school: school.trim(),

      avatar: posterName.trim().charAt(0).toUpperCase(),

      tags: tagsArray,

      user_id: user?.id ?? null, // ← FIX: save the poster's auth user id

    });



    setLoading(false);



    if (error) {

      console.error("Supabase Error Details:", error);

      alert(`Post failed: ${error.message}`);

      return;

    }



    setPosted(true);

  };



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

          <TouchableOpacity

            style={styles.successBtn}

            onPress={() => navigation.goBack()}

          >

            <Text style={styles.successBtnText}>View Job Board</Text>

            <Ionicons name="arrow-forward" size={16} color="white" />

          </TouchableOpacity>

          <TouchableOpacity

            style={styles.successBtnOutline}

            onPress={() => {

              setPosted(false);

              setStep(1);

              setTitle(""); setCategory(""); setDescription("");

              setTagsInput(""); setBudget(""); setCustomBudget("");

              setUrgencyOption(null); setPosterName(""); setSchool("");

            }}

          >

            <Text style={styles.successBtnOutlineText}>Post Another Job</Text>

          </TouchableOpacity>

        </View>

      </SafeAreaView>

    );

  }



  return (

    <SafeAreaView style={styles.root}>

      <StatusBar barStyle="light-content" backgroundColor="#050914" />



      <View style={styles.header}>

        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()} style={styles.backBtn}>

          <Ionicons name="chevron-back" size={20} color="white" />

        </TouchableOpacity>

        <Text style={styles.headerTitle}>Post a Job</Text>

        <View style={{ width: 36 }} />

      </View>



      <KeyboardAvoidingView

        behavior={Platform.OS === "ios" ? "padding" : "height"}

        style={{ flex: 1 }}

      >

        <ScrollView

          contentContainerStyle={styles.content}

          keyboardShouldPersistTaps="handled"

          showsVerticalScrollIndicator={false}

        >

          <StepIndicator step={step} />



          {/* ── STEP 1: Job Details ── */}

          {step === 1 && (

            <>

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

                        <Ionicons

                          name={opt.icon}

                          size={16}

                          color={isActive ? "white" : "#6b7280"}

                        />

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

              <Field icon="person-outline" label="Your Name" required>

                <TextInput

                  style={styles.input}

                  placeholder="e.g. Maria Santos"

                  placeholderTextColor="#374151"

                  value={posterName}

                  onChangeText={setPosterName}

                />

              </Field>



              <Field icon="school-outline" label="School / University">

                <TextInput

                  style={styles.input}

                  placeholder="e.g. USLS, DLSU, UPV"

                  placeholderTextColor="#374151"

                  value={school}

                  onChangeText={setSchool}

                />

              </Field>



              <View style={styles.previewCard}>

                <View style={styles.previewHeader}>

                  <Ionicons name="eye-outline" size={15} color="#7c3aed" />

                  <Text style={styles.previewTitle}>Review Post</Text>

                </View>

                <Text style={styles.previewJobTitle}>{title || "—"}</Text>

                <Text style={styles.previewDesc} numberOfLines={3}>{description || "No description."}</Text>

              </View>



              <TouchableOpacity

                style={[styles.primaryBtn, (!canPost || loading) && styles.primaryBtnDisabled]}

                onPress={handlePost}

                disabled={!canPost || loading}

              >

                {loading ? <ActivityIndicator color="white" /> : (

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

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#0d1527" },

  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#0b1120", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1a2540" },

  headerTitle: { color: "white", fontSize: 17, fontWeight: "800" },

  content: { padding: 20, paddingBottom: 60 },

  stepWrap: { flexDirection: "row", alignItems: "center", marginBottom: 30 },

  stepItem: { alignItems: "center", gap: 6 },

  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#0b1120", borderWidth: 1.5, borderColor: "#1a2540", justifyContent: "center", alignItems: "center" },

  stepDone: { backgroundColor: "#059669", borderColor: "#059669" },

  stepActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },

  stepNum: { color: "#4b5563", fontSize: 12, fontWeight: "700" },

  stepLabel: { color: "#4b5563", fontSize: 10, fontWeight: "600" },

  stepLabelActive: { color: "#a78bfa" },

  stepConnector: { flex: 1, height: 1.5, backgroundColor: "#1a2540", marginBottom: 16, marginHorizontal: 6 },

  stepConnectorDone: { backgroundColor: "#059669" },

  field: { marginBottom: 22 },

  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },

  fieldLabel: { color: "#9ca3af", fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },

  required: { color: "#7c3aed" },

  charCount: { color: "#374151", fontSize: 11, textAlign: "right", marginTop: 4 },

  input: { backgroundColor: "#0b1120", borderRadius: 14, padding: 14, fontSize: 14, color: "white", borderWidth: 1, borderColor: "#1a2540" },

  textarea: { minHeight: 110 },

  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  chip: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "#0b1120", borderRadius: 50, borderWidth: 1, borderColor: "#1a2540" },

  chipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },

  chipText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },

  chipTextActive: { color: "white" },

  orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },

  orLine: { flex: 1, height: 1, backgroundColor: "#1a2540" },

  orText: { color: "#374151", fontSize: 12 },

  priceRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#0b1120", borderRadius: 14, borderWidth: 1, borderColor: "#1a2540", overflow: "hidden" },

  pesoSign: { paddingHorizontal: 16, fontSize: 22, color: "#7c3aed", fontWeight: "800" },

  priceInput: { flex: 1, paddingVertical: 14, fontSize: 20, fontWeight: "700", color: "white" },

  urgencyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  urgencyCard: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#0b1120", borderRadius: 12, borderWidth: 1, borderColor: "#1a2540" },

  urgencyCardActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },

  urgencyCardText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },

  urgencyCardTextActive: { color: "white" },

  previewCard: { backgroundColor: "#0b1120", borderRadius: 16, padding: 18, marginBottom: 22, borderWidth: 1, borderColor: "#1a2540", borderLeftWidth: 3, borderLeftColor: "#7c3aed" },

  previewHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },

  previewTitle: { color: "#7c3aed", fontWeight: "700", fontSize: 12 },

  previewJobTitle: { color: "white", fontSize: 16, fontWeight: "700", marginBottom: 6 },

  previewDesc: { color: "#6b7280", fontSize: 13, lineHeight: 19, marginBottom: 12 },

  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#7c3aed", borderRadius: 16, paddingVertical: 17 },

  primaryBtnDisabled: { opacity: 0.4 },

  primaryBtnText: { color: "white", fontSize: 16, fontWeight: "700" },

  successScreen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },

  successRing: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: "rgba(124,58,237,0.25)", justifyContent: "center", alignItems: "center", marginBottom: 8 },

  successCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(124,58,237,0.15)", justifyContent: "center", alignItems: "center" },

  successTitle: { color: "white", fontSize: 26, fontWeight: "900" },

  successSub: { color: "#6b7280", fontSize: 15, textAlign: "center", lineHeight: 22 },

  successBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#7c3aed", paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, width: "100%", justifyContent: "center" },

  successBtnText: { color: "white", fontSize: 16, fontWeight: "700" },

  successBtnOutline: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, width: "100%", alignItems: "center", borderWidth: 1.5, borderColor: "#1a2540" },

  successBtnOutlineText: { color: "#6b7280", fontSize: 15, fontWeight: "600" },

});