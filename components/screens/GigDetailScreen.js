// ─────────────────────────────────────────────────────────────────────────────
// GigDetailScreen.js
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getFallbackImage } from "./GigCard";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES       = ["Coding", "Design", "Writing", "Tutoring", "Video", "Research"];
const DELIVERY_OPTIONS = ["1 day", "2–3 days", "1 week", "2 weeks", "1 month"];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(raw) {
  const num = Number(String(raw).replace(/[^0-9.]/g, ""));
  return isNaN(num) ? raw : `₱${num.toLocaleString()}`;
}

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
            style={dotStyles.item}
            activeOpacity={0.7}
            onPress={() => { onClose(); setTimeout(onEdit, 400); }}
          >
            <View style={[dotStyles.iconWrap, { backgroundColor: "rgba(124,58,237,0.12)" }]}>
              <Ionicons name="create-outline" size={18} color="#a78bfa" />
            </View>
            <Text style={dotStyles.itemText}>Edit gig</Text>
            <Ionicons name="chevron-forward" size={15} color="#374151" />
          </TouchableOpacity>

          <View style={dotStyles.divider} />

          <TouchableOpacity
            style={dotStyles.item}
            activeOpacity={0.7}
            onPress={() => { onClose(); setTimeout(onDelete, 400); }}
          >
            <View style={[dotStyles.iconWrap, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
              <Ionicons name="trash-outline" size={18} color="#f87171" />
            </View>
            <Text style={[dotStyles.itemText, { color: "#f87171" }]}>Delete gig</Text>
            <Ionicons name="chevron-forward" size={15} color="#374151" />
          </TouchableOpacity>
        </View>
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
// EDIT MODAL
// ─────────────────────────────────────────────────────────────────────────────

function EditModal({ visible, gig, onClose, onSaved }) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [price,       setPrice]       = useState("");
  const [delivery,    setDelivery]    = useState("");
  const [category,    setCategory]    = useState("");
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (!gig) return;
    setTitle(gig.title ?? "");
    setDescription(gig.description ?? "");
    setPrice(gig.price ? String(gig.price) : "");
    setDelivery(gig.delivery ?? "");
    setCategory(gig.category ?? "");
  }, [gig]);

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert("Validation", "Title cannot be empty."); return; }
    if (!gig?.id)      { Alert.alert("Error", "No gig selected."); return; }

    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) throw new Error("Not logged in.");

      const { error } = await supabase
        .from("gigs")
        .update({
          title:       title.trim(),
          description: description.trim(),
          price:       price ? parseFloat(price) : null,
          delivery:    delivery,
          category:    category,
        })
        .eq("id", gig.id)
        .eq("user_id", userData.user.id);

      if (error) throw error;

      onSaved({ ...gig, title: title.trim(), description: description.trim(), price: parseFloat(price), delivery, category });
      onClose();
      Alert.alert("Saved ✓", "Your gig has been updated.");
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
          <Text style={editStyles.title}>Edit Gig</Text>
          <TouchableOpacity onPress={onClose} style={editStyles.closeBtn}>
            <Ionicons name="close" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <View style={editStyles.field}>
            <Text style={editStyles.label}>GIG TITLE *</Text>
            <TextInput
              style={editStyles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. I will design your thesis poster"
              placeholderTextColor="#4b5563"
            />
          </View>

          <View style={editStyles.field}>
            <Text style={editStyles.label}>PRICE (₱)</Text>
            <View style={editStyles.priceRow}>
              <Text style={editStyles.pesoSign}>₱</Text>
              <TextInput
                style={editStyles.priceInput}
                value={price}
                onChangeText={setPrice}
                placeholder="e.g. 1500"
                placeholderTextColor="#4b5563"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={editStyles.field}>
            <Text style={editStyles.label}>DELIVERY TIME</Text>
            <View style={editStyles.chipRow}>
              {DELIVERY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[editStyles.chip, delivery === opt && editStyles.chipOn]}
                  onPress={() => setDelivery(opt)}
                >
                  <Text style={[editStyles.chipTxt, delivery === opt && editStyles.chipTxtOn]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={editStyles.field}>
            <Text style={editStyles.label}>CATEGORY</Text>
            <View style={editStyles.chipRow}>
              {CATEGORIES.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[editStyles.chip, category === opt && editStyles.chipOn]}
                  onPress={() => setCategory(opt)}
                >
                  <Text style={[editStyles.chipTxt, category === opt && editStyles.chipTxtOn]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={editStyles.field}>
            <Text style={editStyles.label}>DESCRIPTION</Text>
            <TextInput
              style={[editStyles.input, editStyles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what you offer..."
              placeholderTextColor="#4b5563"
              multiline
              textAlignVertical="top"
            />
          </View>

        </ScrollView>

        <TouchableOpacity
          style={[editStyles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color="white" />
            : <>
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                <Text style={editStyles.saveTxt}>Save Changes</Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY MODAL
// ─────────────────────────────────────────────────────────────────────────────

function ApplyModal({ visible, gig, onClose }) {
  const { user } = useUser();

  const [applicantName, setApplicantName] = useState("");
  const [school,        setSchool]        = useState("");
  const [portfolio,     setPortfolio]     = useState("");
  const [proposedRate,  setProposedRate]  = useState("");
  const [loading,       setLoading]       = useState(false);
  const [success,       setSuccess]       = useState(false);

  useEffect(() => {
    if (gig) {
      setApplicantName(user?.name || user?.user_metadata?.full_name || "");
      setSchool(user?.school || "");
      setPortfolio(""); setProposedRate(""); setSuccess(false);
    }
  }, [gig]);

  const canSubmit = applicantName.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id || !gig) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("applications").insert({
        gig_id:         gig.id,
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
            <Text style={applyStyles.successSub}>The seller will review your inquiry.</Text>
          </View>
        ) : (
          <>
            <View style={applyStyles.header}>
              <View style={{ flex: 1 }}>
                <Text style={applyStyles.gigSnippet} numberOfLines={2}>{gig?.title}</Text>
                <Text style={applyStyles.gigMeta}>{formatPrice(gig?.price)} · {gig?.poster_name}</Text>
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
                    style={applyStyles.input}
                    value={value}
                    onChangeText={setter}
                    placeholder={placeholder}
                    placeholderTextColor="#4b5563"
                  />
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[applyStyles.submitBtn, !canSubmit && applyStyles.submitDisabled]}
              onPress={handleSubmit}
              disabled={loading || !canSubmit}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="white" />
                : <>
                    <Ionicons name="send-outline" size={16} color="white" />
                    <Text style={applyStyles.submitTxt}>Send Application</Text>
                  </>
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

export default function GigDetailScreen({ route, navigation }) {
  const { gig: initialGig } = route.params;
  const { user } = useUser();

  const [gig,            setGig]            = useState(initialGig);
  const [applyVisible,   setApplyVisible]   = useState(false);
  const [menuVisible,    setMenuVisible]    = useState(false);
  const [editVisible,    setEditVisible]    = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [applyCount,     setApplyCount]     = useState(initialGig.applicant_count ?? 0);

  const imageUri   = gig.image_url || getFallbackImage(gig.title || "");
  const priceLabel = formatPrice(gig.price);
  const isOwner    = user?.id && gig.user_id && user.id === gig.user_id;

  // Live applicant count
  useEffect(() => {
    const channel = supabase
      .channel(`gig-apps-${gig.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "applications", filter: `gig_id=eq.${gig.id}` },
        () => setApplyCount(c => c + 1)
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [gig.id]);

  // Fetch poster avatar from users table
  useEffect(() => {
    if (!gig.user_id || gig.poster_avatar_url) return;
    supabase
      .from("users")
      .select("image_url")
      .eq("id", gig.user_id)
      .single()
      .then(({ data }) => {
        if (data?.image_url) setGig(g => ({ ...g, poster_avatar_url: data.image_url }));
      })
      .catch(() => {}); // silently ignore — avatar is non-critical
  }, [gig.user_id]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) throw new Error("Not logged in.");

      // Delete child applications first (FK constraint)
      const { error: appsErr } = await supabase
        .from("applications")
        .delete()
        .eq("gig_id", gig.id);

      if (appsErr) throw new Error(`Apps delete failed: ${appsErr.message}`);

      const { error: gigErr } = await supabase
        .from("gigs")
        .delete()
        .eq("id", gig.id)
        .eq("user_id", userData.user.id);

      if (gigErr) throw new Error(gigErr.message);

      setConfirmVisible(false);
      navigation.goBack();
    } catch (e) {
      setConfirmVisible(false);
      setTimeout(() => Alert.alert("Delete Failed", e.message), 300);
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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
        gig={gig}
        onClose={() => setEditVisible(false)}
        onSaved={(updated) => setGig(updated)}
      />
      <ConfirmModal
        visible={confirmVisible}
        title="Delete Gig"
        message={`Delete "${gig.title}"?\n\nThis cannot be undone.`}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
      <ApplyModal
        visible={applyVisible}
        gig={gig}
        onClose={() => setApplyVisible(false)}
      />

      {/* Floating Back Button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={22} color="white" />
      </TouchableOpacity>

      {/* Floating Dot Menu — owner only */}
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
          {gig.delivery ? (
            <View style={styles.deliveryBadge}>
              <Ionicons name="time-outline" size={12} color="white" />
              <Text style={styles.deliveryText}>{gig.delivery}</Text>
            </View>
          ) : null}
          {gig.category ? (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText}>{gig.category}</Text>
            </View>
          ) : null}
        </View>

        {/* Body */}
        <View style={styles.body}>

          <View style={styles.titleRow}>
            <Text style={styles.title}>{gig.title}</Text>
            <Text style={styles.price}>{priceLabel}</Text>
          </View>

          {/* Applicant count */}
          <View style={styles.applicantsBadge}>
            <Ionicons name="people-outline" size={13} color="#a78bfa" />
            <Text style={styles.applicantsText}>{applyCount} applied</Text>
          </View>

          {/* Poster info */}
          <View style={styles.posterRow}>
            <View style={styles.posterAvatar}>
              {gig.poster_avatar_url ? (
                <Image source={{ uri: gig.poster_avatar_url }} style={styles.posterAvatarImg} />
              ) : (
                <Text style={styles.posterInitial}>
                  {(gig.poster_name || "T")[0].toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.posterName}>{gig.poster_name || "Taskmate User"}</Text>
              {gig.school ? <Text style={styles.posterSchool}>{gig.school}</Text> : null}
            </View>
            {isOwner ? (
              <View style={styles.ownerBadge}>
                <Ionicons name="person-circle-outline" size={12} color="#7c3aed" />
                <Text style={styles.ownerBadgeText}>Your gig</Text>
              </View>
            ) : (
              <View style={styles.ratingBadge}>
                <Ionicons name="sparkles-outline" size={12} color="#a78bfa" />
                <Text style={styles.ratingText}>New</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>About this Gig</Text>
          <Text style={styles.description}>
            {gig.description?.trim()
              ? gig.description
              : "No description provided. Contact the seller for more details."}
          </Text>

          <View style={styles.infoGrid}>
            <InfoCard icon="cash-outline"   label="Price"    value={priceLabel}              />
            <InfoCard icon="time-outline"   label="Delivery" value={gig.delivery || "TBD"}   />
            <InfoCard icon="folder-outline" label="Category" value={gig.category || "—"}     />
            <InfoCard
              icon="calendar-outline"
              label="Posted"
              value={
                gig.created_at
                  ? new Date(gig.created_at).toLocaleDateString("en-PH", {
                      month: "short", day: "numeric", year: "numeric",
                    })
                  : "—"
              }
            />
          </View>

          {Array.isArray(gig.tags) && gig.tags.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Tags</Text>
              <View style={styles.tagsRow}>
                {gig.tags.map((tag) => (
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
          <Text style={styles.ctaLabel}>Starting at</Text>
          <Text style={styles.ctaPrice}>{priceLabel}</Text>
        </View>

        {isOwner ? (
          <TouchableOpacity
            style={[styles.ctaBtn, styles.ctaBtnOwner]}
            onPress={() => setMenuVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="white" style={{ marginRight: 6 }} />
            <Text style={styles.ctaBtnText}>Manage Gig</Text>
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
// SUB-COMPONENT
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

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },

  backBtn: {
    position: "absolute", top: 52, left: 16, zIndex: 99,
    backgroundColor: "rgba(5,9,20,0.65)",
    padding: 8, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  menuBtn: {
    position: "absolute", top: 52, right: 16, zIndex: 99,
    backgroundColor: "rgba(5,9,20,0.65)",
    padding: 8, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },

  heroWrap:    { height: 280, position: "relative" },
  heroImage:   { width: "100%", height: "100%" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,9,20,0.4)" },
  deliveryBadge: {
    position: "absolute", bottom: 14, right: 14,
    backgroundColor: "rgba(0,0,0,0.65)",
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  deliveryText: { color: "white", fontSize: 12, fontWeight: "600" },
  categoryChip: {
    position: "absolute", bottom: 14, left: 14,
    backgroundColor: "#7c3aed",
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  categoryText: { color: "white", fontSize: 12, fontWeight: "700" },

  body: { paddingHorizontal: 20, paddingTop: 24 },

  titleRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 10, gap: 12,
  },
  title: { flex: 1, color: "white", fontSize: 20, fontWeight: "800", lineHeight: 28 },
  price: { color: "#a78bfa", fontSize: 20, fontWeight: "900" },

  applicantsBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "rgba(124,58,237,0.1)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.25)",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, marginBottom: 16,
  },
  applicantsText: { color: "#a78bfa", fontSize: 12, fontWeight: "700" },

  posterRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0f1629", borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: "#1e2d4a",
    gap: 12, marginBottom: 20,
  },
  posterAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#7c3aed",
    justifyContent: "center", alignItems: "center",
  },
  posterAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  posterInitial: { color: "white", fontWeight: "800", fontSize: 16 },
  posterName:    { color: "white", fontWeight: "700", fontSize: 14 },
  posterSchool:  { color: "#6b7280", fontSize: 12, marginTop: 2 },
  ownerBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(124,58,237,0.1)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.25)",
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
  },
  ownerBadgeText: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },
  ratingBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#1e1b4b",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  ratingText: { color: "#a78bfa", fontSize: 12, fontWeight: "600" },

  divider: { height: 1, backgroundColor: "#1e2d4a", marginBottom: 20 },

  sectionLabel: { color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 10 },
  description:  { color: "#d1d5db", fontSize: 14, lineHeight: 22 },

  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  infoCard: {
    width: "47.5%", backgroundColor: "#0f1629",
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#1e2d4a",
  },
  infoLabel: { color: "#6b7280", fontSize: 11, fontWeight: "600", marginBottom: 4 },
  infoValue: { color: "white", fontSize: 14, fontWeight: "700" },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    backgroundColor: "#1e1b4b", paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: "#312e81",
  },
  tagText: { color: "#a78bfa", fontSize: 12, fontWeight: "600" },

  ctaBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0f1629",
    borderTopWidth: 1, borderTopColor: "#1e2d4a",
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 28,
  },
  ctaLabel: { color: "#6b7280", fontSize: 11, fontWeight: "600" },
  ctaPrice: { color: "white", fontSize: 18, fontWeight: "900" },
  ctaBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#7c3aed",
    paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14,
  },
  ctaBtnOwner: { backgroundColor: "#1e2d4a" },
  ctaBtnText: { color: "white", fontWeight: "700", fontSize: 15 },
});

const dotStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 40,
  },
  sheet: {
    backgroundColor: "#0f1629", borderRadius: 18,
    borderWidth: 1, borderColor: "#1e2d4a",
    width: "100%", overflow: "hidden",
  },
  item:    { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  itemText:{ flex: 1, color: "white", fontSize: 15, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#1e2d4a", marginHorizontal: 16 },
});

const editStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0f1629",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 44,
    borderTopWidth: 1, borderColor: "#1e2d4a", maxHeight: "88%",
  },
  handle:  { width: 40, height: 4, backgroundColor: "#1e2d4a", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  header:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title:   { color: "white", fontSize: 18, fontWeight: "800" },
  closeBtn:{ width: 30, height: 30, borderRadius: 15, backgroundColor: "#111827", justifyContent: "center", alignItems: "center" },
  field:   { marginBottom: 16 },
  label:   { color: "#6b7280", fontSize: 11, fontWeight: "700", marginBottom: 8, letterSpacing: 0.5 },
  input:   { backgroundColor: "#050914", borderRadius: 12, padding: 13, fontSize: 14, color: "white", borderWidth: 1, borderColor: "#1a2540" },
  textarea:{ minHeight: 90 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip:    { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#050914", borderRadius: 50, borderWidth: 1, borderColor: "#1a2540" },
  chipOn:  { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipTxt: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  chipTxtOn: { color: "white" },
  priceRow:  { flexDirection: "row", alignItems: "center", backgroundColor: "#050914", borderRadius: 12, borderWidth: 1, borderColor: "#1a2540", overflow: "hidden" },
  pesoSign:  { paddingHorizontal: 14, fontSize: 18, color: "#7c3aed", fontWeight: "800" },
  priceInput:{ flex: 1, paddingVertical: 12, fontSize: 15, fontWeight: "700", color: "white" },
  saveBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 15, marginTop: 8 },
  saveTxt:   { color: "white", fontWeight: "700", fontSize: 15 },
});

const applyStyles = StyleSheet.create({
  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0b1120",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
    borderTopWidth: 1, borderColor: "#1a2540", maxHeight: "90%",
  },
  handle:     { width: 40, height: 4, backgroundColor: "#1e2d4a", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  header:     { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 16 },
  gigSnippet: { color: "white", fontSize: 15, fontWeight: "700", lineHeight: 22 },
  gigMeta:    { color: "#6b7280", fontSize: 13, marginTop: 4 },
  closeBtn:   { width: 30, height: 30, borderRadius: 15, backgroundColor: "#111827", justifyContent: "center", alignItems: "center" },
  divider:    { height: 1, backgroundColor: "#1a2540", marginBottom: 18 },
  field:      { marginBottom: 16 },
  fieldLabel: { color: "#6b7280", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  input:      { backgroundColor: "#050914", borderRadius: 12, padding: 13, fontSize: 14, color: "white", borderWidth: 1, borderColor: "#1a2540" },
  textarea:   { minHeight: 90 },
  submitBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 16, marginTop: 8 },
  submitDisabled: { opacity: 0.45 },
  submitTxt:  { color: "white", fontWeight: "700", fontSize: 15 },
  successState:{ alignItems: "center", paddingVertical: 30, gap: 12 },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(16,185,129,0.1)", justifyContent: "center", alignItems: "center" },
  successTitle:{ color: "white", fontSize: 20, fontWeight: "800" },
  successSub:  { color: "#6b7280", fontSize: 14, textAlign: "center" },
});

const confirmStyles = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 32 },
  box:      { backgroundColor: "#0f1629", borderRadius: 24, borderWidth: 1, borderColor: "#1e2d4a", padding: 28, width: "100%", alignItems: "center", gap: 12 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(239,68,68,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  title:    { color: "white", fontSize: 18, fontWeight: "800" },
  message:  { color: "#6b7280", fontSize: 14, textAlign: "center", lineHeight: 20 },
  btnRow:   { flexDirection: "row", gap: 12, marginTop: 8, width: "100%" },
  cancelBtn:{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#111827", borderWidth: 1, borderColor: "#1e2d4a", alignItems: "center" },
  cancelTxt:{ color: "#9ca3af", fontWeight: "700", fontSize: 14 },
  deleteBtn:{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#dc2626", alignItems: "center" },
  deleteTxt:{ color: "white", fontWeight: "700", fontSize: 14 },
});