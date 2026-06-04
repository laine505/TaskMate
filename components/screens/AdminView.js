import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, SafeAreaView, StatusBar,
  ScrollView, ActivityIndicator, Modal, RefreshControl,
  Platform, Dimensions, Image, Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const isWeb = Platform.OS === "web";

const TABS = ["Overview", "Jobs", "Featured"];
const STAT_COLOR = ["#7c3aed", "#10b981", "#f59e0b", "#ef4444"];

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function statusColor(status) {
  if (status === "approved") return { bg: "#10b98122", text: "#10b981", border: "#10b98155" };
  if (status === "rejected") return { bg: "#ef444422", text: "#ef4444", border: "#ef444455" };
  return { bg: "#f59e0b22", text: "#f59e0b", border: "#f59e0b55" };
}

function getImages(item) {
  return item.images ?? item.image_urls ?? (item.image_url ? [item.image_url] : []);
}

function toArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim()) return [val];
  return [];
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function AppDialog({ visible, title, message, buttons, onDismiss }) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={dl.overlay} onPress={onDismiss}>
        <Pressable style={dl.box} onPress={() => {}}>
          <Text style={dl.title}>{title}</Text>
          {!!message && <Text style={dl.message}>{message}</Text>}
          <View style={dl.row}>
            {buttons.map((btn) => (
              <Pressable
                key={btn.text}
                style={[dl.btn, btn.danger && dl.btnDanger, btn.primary && dl.btnPrimary, btn.warning && dl.btnWarning]}
                onPress={() => { onDismiss(); btn.onPress?.(); }}
              >
                <Text style={[dl.btnText, btn.danger && dl.btnTextDanger, btn.primary && dl.btnTextPrimary, btn.warning && dl.btnTextWarning]}>
                  {btn.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const dl = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" },
  box: { backgroundColor: "#0f1629", borderRadius: 20, padding: 24, width: Math.min(320, SCREEN_W - 48), borderWidth: 1, borderColor: "#1e2d4a" },
  title: { color: "white", fontSize: 17, fontWeight: "700", marginBottom: 8 },
  message: { color: "#9ca3af", fontSize: 14, lineHeight: 20, marginBottom: 20 },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#1e2d4a", backgroundColor: "#1a2540" },
  btnDanger:  { borderColor: "#ef444455", backgroundColor: "#ef444411" },
  btnPrimary: { borderColor: "#7c3aed",   backgroundColor: "#7c3aed"   },
  btnWarning: { borderColor: "#f59e0b55", backgroundColor: "#f59e0b11" },
  btnText:        { color: "#9ca3af", fontWeight: "600", fontSize: 14 },
  btnTextDanger:  { color: "#ef4444" },
  btnTextPrimary: { color: "white"   },
  btnTextWarning: { color: "#f59e0b" },
});

// ── Image Lightbox ────────────────────────────────────────────────────────────
function ImageLightbox({ images, startIndex, visible, onClose }) {
  const [current, setCurrent] = useState(startIndex);
  useEffect(() => { setCurrent(startIndex); }, [startIndex, visible]);
  if (!visible || !images?.length) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <View style={lb.overlay}>
        <Pressable style={lb.close} onPress={onClose}>
          <Ionicons name="close" size={24} color="white" />
        </Pressable>
        <Text style={lb.counter}>{current + 1} / {images.length}</Text>
        <Image source={{ uri: images[current] }} style={lb.image} resizeMode="contain" />
        {images.length > 1 && (
          <View style={lb.nav}>
            <Pressable style={[lb.navBtn, current === 0 && lb.navBtnDisabled]} onPress={() => setCurrent((p) => Math.max(0, p - 1))} disabled={current === 0}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </Pressable>
            <View style={lb.dots}>
              {images.map((_, i) => (
                <Pressable key={i} onPress={() => setCurrent(i)}>
                  <View style={[lb.dot, i === current && lb.dotActive]} />
                </Pressable>
              ))}
            </View>
            <Pressable style={[lb.navBtn, current === images.length - 1 && lb.navBtnDisabled]} onPress={() => setCurrent((p) => Math.min(images.length - 1, p + 1))} disabled={current === images.length - 1}>
              <Ionicons name="chevron-forward" size={22} color="white" />
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}
const lb = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  close: { position: "absolute", top: 50, right: 20, zIndex: 10, backgroundColor: "#ffffff22", padding: 10, borderRadius: 20 },
  counter: { position: "absolute", top: 56, alignSelf: "center", color: "#9ca3af", fontSize: 13, fontWeight: "600" },
  image: { width: SCREEN_W, height: SCREEN_H * 0.72 },
  nav: { position: "absolute", bottom: 60, flexDirection: "row", alignItems: "center", gap: 20 },
  navBtn: { backgroundColor: "#ffffff22", padding: 12, borderRadius: 20 },
  navBtnDisabled: { opacity: 0.3 },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ffffff44" },
  dotActive: { backgroundColor: "white", width: 18 },
});

// ── Post Detail Modal ─────────────────────────────────────────────────────────
function PostDetailModal({ item, table, visible, onClose, onActionDone, showDialog }) {
  const [actioningStatus, setActioningStatus] = useState(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex,   setLightboxIndex]   = useState(0);

  if (!item) return null;
  const images = getImages(item);
  const sc = statusColor(item.status ?? "pending");

  const doAction = async (status) => {
    setActioningStatus(status);
    try {
      const { error } = await supabase.from(table).update({ status }).eq("id", item.id);
      if (error) throw error;
      onActionDone(status);
      onClose();
    } catch (e) {
      showDialog("Update Failed", e.message, [{ text: "OK" }]);
    } finally {
      setActioningStatus(null);
    }
  };

  const handleReject = () => {
    showDialog("Reject Post", `Are you sure you want to reject "${item.title ?? "this post"}"?`, [
      { text: "Cancel" },
      { text: "Reject", danger: true, onPress: () => doAction("rejected") },
    ]);
  };

  const handleResetToPending = () => {
    showDialog("Reset to Pending", `Move "${item.title ?? "this post"}" back to pending review?`, [
      { text: "Cancel" },
      { text: "Reset", warning: true, onPress: () => doAction("pending") },
    ]);
  };

  const detailRows = [
    { icon: "person-outline",   label: "Posted by", value: item.poster_name },
    { icon: "wallet-outline",   label: "Budget",    value: item.budget != null ? `₱${item.budget}` : null },
    { icon: "pricetag-outline", label: "Category",  value: item.category },
    { icon: "location-outline", label: "Location",  value: item.location },
    { icon: "calendar-outline", label: "Posted",    value: formatDate(item.created_at) },
    { icon: "time-outline",     label: "Duration",  value: item.duration },
    { icon: "briefcase-outline",label: "Type",      value: item.job_type },
    { icon: "people-outline",   label: "Slots",     value: item.slots != null ? String(item.slots) : null },
  ].filter((r) => r.value);

  const tags = toArray(item.skills ?? item.tags);

  return (
    <>
      <ImageLightbox images={images} startIndex={lightboxIndex} visible={lightboxVisible} onClose={() => setLightboxVisible(false)} />
      <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose} statusBarTranslucent>
        <View style={pd.overlay}>
          <View style={pd.sheet}>
            <View style={pd.header}>
              <Text style={pd.headerTitle} numberOfLines={2}>{item.title ?? "Untitled"}</Text>
              <Pressable style={pd.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color="#9ca3af" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pd.scrollContent}>
              <View style={[pd.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
                <View style={[pd.statusDot, { backgroundColor: sc.text }]} />
                <Text style={[pd.statusLabel, { color: sc.text }]}>{(item.status ?? "pending").toUpperCase()}</Text>
              </View>
              {images.length > 0 && (
                <View style={pd.section}>
                  <Text style={pd.sectionLabel}>Photos · {images.length} {images.length === 1 ? "image" : "images"}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={pd.imgRow}>
                    {images.map((uri, i) => (
                      <Pressable key={i} style={pd.thumbWrap} onPress={() => { setLightboxIndex(i); setLightboxVisible(true); }}>
                        <Image source={{ uri }} style={pd.thumb} resizeMode="cover" />
                        <View style={pd.thumbOverlay}><Ionicons name="expand-outline" size={14} color="white" /></View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              {item.description ? (
                <View style={pd.section}>
                  <Text style={pd.sectionLabel}>Description</Text>
                  <Text style={pd.descText}>{item.description}</Text>
                </View>
              ) : null}
              {detailRows.length > 0 && (
                <View style={pd.section}>
                  <Text style={pd.sectionLabel}>Details</Text>
                  <View style={pd.detailGrid}>
                    {detailRows.map((row) => (
                      <View key={row.label} style={pd.detailRow}>
                        <View style={pd.detailIcon}><Ionicons name={row.icon} size={14} color="#a78bfa" /></View>
                        <View>
                          <Text style={pd.detailKey}>{row.label}</Text>
                          <Text style={pd.detailVal}>{row.value}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {tags.length > 0 && (
                <View style={pd.section}>
                  <Text style={pd.sectionLabel}>Skills / Tags</Text>
                  <View style={pd.tagRow}>
                    {tags.map((t, i) => (
                      <View key={`${t}-${i}`} style={pd.tag}><Text style={pd.tagText}>{t}</Text></View>
                    ))}
                  </View>
                </View>
              )}
              <View style={{ height: 8 }} />
            </ScrollView>
            {item.status === "pending" && (
              <View style={pd.actionBar}>
                {actioningStatus ? (
                  <ActivityIndicator color="#7c3aed" style={{ flex: 1, paddingVertical: 14 }} />
                ) : (
                  <>
                    <Pressable style={pd.rejectBtn} onPress={handleReject}>
                      <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                      <Text style={pd.rejectBtnText}>Reject</Text>
                    </Pressable>
                    <Pressable style={pd.approveBtn} onPress={() => doAction("approved")}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                      <Text style={pd.approveBtnText}>Approve</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}
            {item.status === "approved" && (
              <View style={pd.bannerRow}>
                <View style={[pd.banner, { backgroundColor: "#10b98118", borderColor: "#10b98144", flex: 1 }]}>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                  <Text style={[pd.bannerText, { color: "#10b981" }]}>This post is approved and live.</Text>
                </View>
                <Pressable style={pd.resetBtn} onPress={handleResetToPending}>
                  <Ionicons name="refresh-outline" size={15} color="#f59e0b" />
                  <Text style={pd.resetBtnText}>Reset</Text>
                </Pressable>
              </View>
            )}
            {item.status === "rejected" && (
              <View style={pd.bannerRow}>
                <View style={[pd.banner, { backgroundColor: "#ef444418", borderColor: "#ef444444", flex: 1 }]}>
                  <Ionicons name="close-circle" size={18} color="#ef4444" />
                  <Text style={[pd.bannerText, { color: "#ef4444" }]}>This post has been rejected.</Text>
                </View>
                <Pressable style={pd.resetBtn} onPress={handleResetToPending}>
                  <Ionicons name="refresh-outline" size={15} color="#f59e0b" />
                  <Text style={pd.resetBtnText}>Reset</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
const pd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#080d1a", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: SCREEN_H * 0.92, borderTopWidth: 1, borderColor: "#1e2d4a", overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderColor: "#1e2d4a", gap: 10 },
  headerTitle: { color: "white", fontSize: 17, fontWeight: "700", flex: 1 },
  closeBtn: { backgroundColor: "#1e2d4a", padding: 8, borderRadius: 10, marginTop: 2 },
  scrollContent: { paddingHorizontal: 20 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginTop: 16 },
  statusDot:   { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  section:      { marginTop: 20 },
  sectionLabel: { color: "#6b7280", fontSize: 12, fontWeight: "700", marginBottom: 10, letterSpacing: 0.4, textTransform: "uppercase" },
  imgRow:       { marginLeft: -2 },
  thumbWrap:    { marginRight: 10, borderRadius: 12, overflow: "hidden", position: "relative" },
  thumb:        { width: 150, height: 108, borderRadius: 12 },
  thumbOverlay: { position: "absolute", bottom: 6, right: 6, backgroundColor: "rgba(0,0,0,0.55)", padding: 4, borderRadius: 6 },
  descText: { color: "#d1d5db", fontSize: 14, lineHeight: 22 },
  detailGrid: { gap: 8 },
  detailRow:  { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#0f1629", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#1e2d4a" },
  detailIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#7c3aed22", alignItems: "center", justifyContent: "center" },
  detailKey:  { color: "#6b7280", fontSize: 11, marginBottom: 2 },
  detailVal:  { color: "white", fontSize: 14, fontWeight: "600" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag:    { backgroundColor: "#7c3aed22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#7c3aed44" },
  tagText:{ color: "#a78bfa", fontSize: 12, fontWeight: "600" },
  actionBar:      { flexDirection: "row", gap: 12, padding: 16, borderTopWidth: 1, borderColor: "#1e2d4a" },
  rejectBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: "#ef444455", backgroundColor: "#ef444411" },
  rejectBtnText:  { color: "#ef4444", fontWeight: "700", fontSize: 15 },
  approveBtn:     { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: "#7c3aed" },
  approveBtnText: { color: "white", fontWeight: "700", fontSize: 15 },
  bannerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 16, marginTop: 8 },
  banner:    { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  bannerText:{ fontWeight: "600", fontSize: 13, flex: 1 },
  resetBtn:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: "#f59e0b55", backgroundColor: "#f59e0b11" },
  resetBtnText: { color: "#f59e0b", fontWeight: "700", fontSize: 13 },
});

// ── Filter Bar ────────────────────────────────────────────────────────────────
function FilterBar({ active, onChange, counts }) {
  const filters = [
    { key: "pending",  label: "Pending",  color: "#f59e0b" },
    { key: "approved", label: "Approved", color: "#10b981" },
    { key: "rejected", label: "Rejected", color: "#ef4444" },
    { key: "all",      label: "All",      color: "#7c3aed" },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterContent}>
      {filters.map((f) => {
        const isActive = active === f.key;
        return (
          <Pressable
            key={f.key}
            style={[s.filterChip, isActive && { backgroundColor: f.color + "22", borderColor: f.color + "66" }]}
            onPress={() => onChange(f.key)}
          >
            <Text style={[s.filterText, isActive && { color: f.color, fontWeight: "700" }]}>{f.label}</Text>
            <View style={[s.filterBadge, isActive && { backgroundColor: f.color }]}>
              <Text style={[s.filterBadgeText, isActive && { color: "white" }]}>{counts[f.key] ?? 0}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────────
function PostCard({ item, onPress, onQuickApprove, onQuickReject, actioning }) {
  const images    = getImages(item);
  const sc        = statusColor(item.status ?? "pending");
  const isPending = item.status === "pending";
  return (
    <Pressable style={({ pressed }) => [s.card, pressed && s.cardPressed]} onPress={onPress}>
      {images.length > 0 && (
        <View style={s.cardImgWrap}>
          <Image source={{ uri: images[0] }} style={s.cardImg} resizeMode="cover" />
          {images.length > 1 && (
            <View style={s.cardImgBadge}>
              <Ionicons name="images" size={12} color="white" />
              <Text style={s.cardImgBadgeText}>+{images.length - 1} more</Text>
            </View>
          )}
          <View style={[s.cardStatusOverlay, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <View style={[s.cardStatusDot, { backgroundColor: sc.text }]} />
            <Text style={[s.cardStatusText, { color: sc.text }]}>
              {(item.status ?? "pending").charAt(0).toUpperCase() + (item.status ?? "pending").slice(1)}
            </Text>
          </View>
        </View>
      )}
      <View style={s.cardBody}>
        <View style={s.cardHeaderRow}>
          <Text style={s.cardTitle} numberOfLines={2}>{item.title ?? "Untitled"}</Text>
          {images.length === 0 && (
            <View style={[s.statusPill, { backgroundColor: sc.bg, borderColor: sc.border }]}>
              <Text style={[s.statusPillText, { color: sc.text }]}>
                {(item.status ?? "pending").charAt(0).toUpperCase() + (item.status ?? "pending").slice(1)}
              </Text>
            </View>
          )}
        </View>
        {item.description ? <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
        <View style={s.cardMeta}>
          {item.budget   != null && <View style={s.metaChip}><Ionicons name="wallet-outline"   size={11} color="#9ca3af" /><Text style={s.metaText}>₱{item.budget}</Text></View>}
          {item.category  ? <View style={s.metaChip}><Ionicons name="pricetag-outline" size={11} color="#9ca3af" /><Text style={s.metaText}>{item.category}</Text></View>  : null}
          {item.poster_name ? <View style={s.metaChip}><Ionicons name="person-outline"  size={11} color="#9ca3af" /><Text style={s.metaText}>{item.poster_name}</Text></View> : null}
        </View>
        <View style={s.cardFooter}>
          <Text style={s.cardDate}>{formatDate(item.created_at)}</Text>
          {isPending && (
            <View style={s.quickActions}>
              {actioning ? (
                <ActivityIndicator size="small" color="#7c3aed" />
              ) : (
                <>
                  <Pressable style={s.quickReject} onPress={onQuickReject} hitSlop={8}>
                    <Ionicons name="close" size={14} color="#ef4444" />
                    <Text style={s.quickRejectText}>Reject</Text>
                  </Pressable>
                  <Pressable style={s.quickApprove} onPress={onQuickApprove} hitSlop={8}>
                    <Ionicons name="checkmark" size={14} color="white" />
                    <Text style={s.quickApproveText}>Approve</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
        <View style={s.tapHint}>
          <Text style={s.tapHintText}>Tap to view full details & photos</Text>
          <Ionicons name="chevron-forward" size={12} color="#374151" />
        </View>
      </View>
    </Pressable>
  );
}

// ── Featured Job Card ─────────────────────────────────────────────────────────
function FeaturedJobCard({ job, onToggle, toggling }) {
  const isFeatured = !!job.is_featured;
  const imageUri   = job.image_url || null;
  return (
    <View style={[fs.card, isFeatured && fs.cardFeatured]}>
      {imageUri && <Image source={{ uri: imageUri }} style={fs.cardImg} resizeMode="cover" />}
      <View style={fs.cardBody}>
        <View style={fs.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={fs.cardTitle} numberOfLines={2}>{job.title}</Text>
            <View style={fs.metaRow}>
              {job.category    ? <View style={fs.metaChip}><Ionicons name="pricetag-outline" size={10} color="#9ca3af" /><Text style={fs.metaText}>{job.category}</Text></View>    : null}
              {job.budget      ? <View style={fs.metaChip}><Ionicons name="cash-outline"     size={10} color="#9ca3af" /><Text style={fs.metaText}>{job.budget}</Text></View>      : null}
              {job.poster_name ? <View style={fs.metaChip}><Ionicons name="person-outline"   size={10} color="#9ca3af" /><Text style={fs.metaText}>{job.poster_name}</Text></View> : null}
            </View>
          </View>
          <View style={fs.toggleWrap}>
            {toggling ? (
              <ActivityIndicator size="small" color="#7c3aed" />
            ) : (
              <>
                <Text style={[fs.toggleLabel, isFeatured && { color: "#f59e0b" }]}>
                  {isFeatured ? "Featured" : "Feature"}
                </Text>
                <Switch
                  value={isFeatured}
                  onValueChange={onToggle}
                  trackColor={{ false: "#1e2d4a", true: "#f59e0b55" }}
                  thumbColor={isFeatured ? "#f59e0b" : "#4b5563"}
                  ios_backgroundColor="#1e2d4a"
                />
              </>
            )}
          </View>
        </View>
        {isFeatured && (
          <View style={fs.featuredBadge}>
            <Ionicons name="star" size={11} color="#f59e0b" />
            <Text style={fs.featuredBadgeText}>Showing on Home Screen (pinned to top)</Text>
          </View>
        )}
      </View>
    </View>
  );
}
const fs = StyleSheet.create({
  card:         { backgroundColor: "#0f1629", borderRadius: 16, borderWidth: 1, borderColor: "#1e2d4a", marginBottom: 12, overflow: "hidden" },
  cardFeatured: { borderColor: "#f59e0b55" },
  cardImg:      { width: "100%", height: 110 },
  cardBody:     { padding: 14 },
  cardTop:      { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle:    { color: "white", fontSize: 14, fontWeight: "700", marginBottom: 6 },
  metaRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#1e2d4a", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  metaText:     { color: "#9ca3af", fontSize: 10 },
  toggleWrap:   { alignItems: "center", justifyContent: "center", alignSelf: "center", gap: 4, minWidth: 70 },
  toggleLabel:  { color: "#6b7280", fontSize: 10, fontWeight: "700" },
  featuredBadge:     { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: "flex-start", backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "#f59e0b44" },
  featuredBadgeText: { color: "#f59e0b", fontSize: 11, fontWeight: "700" },
});

// ── StatusBreakdown ───────────────────────────────────────────────────────────
function StatusBreakdown({ approved, pending, rejected }) {
  const total = approved + pending + rejected || 1;
  return (
    <View style={s.breakdown}>
      {[
        { label: "Approved", value: approved, color: "#10b981" },
        { label: "Pending",  value: pending,  color: "#f59e0b" },
        { label: "Rejected", value: rejected, color: "#ef4444" },
      ].map((item) => (
        <View key={item.label} style={s.breakdownItem}>
          <View style={s.breakdownMeta}>
            <Text style={[s.breakdownLabel, { color: item.color }]}>{item.label}</Text>
            <Text style={s.breakdownValue}>{item.value} ({Math.round((item.value / total) * 100)}%)</Text>
          </View>
          <View style={s.breakdownBar}>
            <View style={[s.breakdownFill, { width: `${Math.round((item.value / total) * 100)}%`, backgroundColor: item.color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ status }) {
  const cfg = {
    pending:  { icon: "checkmark-circle-outline",      color: "#10b981", msg: "No pending posts — all caught up!" },
    approved: { icon: "checkmark-done-circle-outline", color: "#7c3aed", msg: "No approved posts yet."           },
    rejected: { icon: "close-circle-outline",          color: "#6b7280", msg: "No rejected posts."               },
    all:      { icon: "folder-open-outline",           color: "#6b7280", msg: "No posts found."                  },
  };
  const { icon, color, msg } = cfg[status] ?? cfg.all;
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={52} color={color} />
      <Text style={s.emptyText}>{msg}</Text>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminView({ navigation }) {
  const { saveUser } = useUser();
  const [activeTab,   setActiveTab]   = useState("Overview");
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [actioningId, setActioningId] = useState(null);
  const [togglingId,  setTogglingId]  = useState(null);

  const [jobFilter, setJobFilter] = useState("pending");

  const [selectedPost,  setSelectedPost]  = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const [analytics, setAnalytics] = useState({
    totalUsers: 0, totalJobs: 0, totalApplications: 0,
    pendingJobs: 0, approvedJobs: 0, rejectedJobs: 0,
  });

  const [jobs, setJobs] = useState([]);

  const [dialog, setDialog] = useState({ visible: false, title: "", message: "", buttons: [] });
  const closeDialog = () => setDialog((p) => ({ ...p, visible: false }));
  const showDialog  = (title, message, buttons) => setDialog({ visible: true, title, message, buttons });

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const { data: statsData, error: statsError } = await supabase.rpc("get_admin_stats");
      if (statsError) throw statsError;

      const { data: jobsData } = await supabase
        .from("jobs").select("*").order("created_at", { ascending: false });

      setAnalytics({
        totalUsers:        statsData.totalUsers        ?? 0,
        totalJobs:         statsData.totalJobs         ?? 0,
        totalApplications: statsData.totalApplications ?? 0,
        pendingJobs:       statsData.pendingJobs       ?? 0,
        approvedJobs:      statsData.approvedJobs      ?? 0,
        rejectedJobs:      statsData.rejectedJobs      ?? 0,
      });

      setJobs(jobsData ?? []);
    } catch (e) {
      showDialog("Fetch Error", e.message, [{ text: "OK" }]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  // ── Toggle Featured ────────────────────────────────────────────────────────
  const handleToggleFeatured = async (job) => {
    const newVal = !job.is_featured;
    setTogglingId(job.id);
    try {
      const { error } = await supabase.from("jobs").update({ is_featured: newVal }).eq("id", job.id);
      if (error) throw error;
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, is_featured: newVal } : j)));
    } catch (e) {
      showDialog("Update Failed", e.message, [{ text: "OK" }]);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    showDialog("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel" },
      { text: "Sign Out", danger: true, onPress: async () => { await supabase.auth.signOut(); saveUser(null); } },
    ]);
  };

  // ── Quick approve / reject ─────────────────────────────────────────────────
  const quickApprove = async (id) => {
    setActioningId(id);
    try {
      const { error } = await supabase.from("jobs").update({ status: "approved" }).eq("id", id);
      if (error) throw error;
      setJobs((p) => p.map((j) => j.id === id ? { ...j, status: "approved" } : j));
      await fetchAll();
    } catch (e) {
      showDialog("Update Failed", e.message, [{ text: "OK" }]);
    } finally {
      setActioningId(null);
    }
  };

  const quickReject = (id, title) => {
    showDialog("Reject Post", `Are you sure you want to reject "${title ?? "this post"}"?`, [
      { text: "Cancel" },
      {
        text: "Reject", danger: true,
        onPress: async () => {
          setActioningId(id);
          try {
            const { error } = await supabase.from("jobs").update({ status: "rejected" }).eq("id", id);
            if (error) throw error;
            setJobs((p) => p.map((j) => j.id === id ? { ...j, status: "rejected" } : j));
            await fetchAll();
          } catch (e) {
            showDialog("Update Failed", e.message, [{ text: "OK" }]);
          } finally {
            setActioningId(null);
          }
        },
      },
    ]);
  };

  const openDetail = (item) => {
    setSelectedPost(item);
    setSelectedTable("jobs");
    setDetailVisible(true);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredJobs  = jobFilter === "all" ? jobs : jobs.filter((j) => j.status === jobFilter);
  const approvedJobs  = jobs.filter((j) => j.status === "approved");
  const featuredCount = approvedJobs.filter((j) => j.is_featured).length;

  const jobCounts = {
    pending:  jobs.filter((j) => j.status === "pending").length,
    approved: jobs.filter((j) => j.status === "approved").length,
    rejected: jobs.filter((j) => j.status === "rejected").length,
    all:      jobs.length,
  };

  if (loading) {
    return (
      <View style={s.rootFill}>
        <SafeAreaView style={s.safeArea}>
          <StatusBar barStyle="light-content" backgroundColor="#050914" />
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={{ color: "#4b5563", fontSize: 14 }}>Loading admin data…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={s.rootFill}>
      <AppDialog visible={dialog.visible} title={dialog.title} message={dialog.message} buttons={dialog.buttons} onDismiss={closeDialog} />
      <PostDetailModal
        item={selectedPost}
        table={selectedTable}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        showDialog={showDialog}
        onActionDone={(status) => {
          setJobs((p) => p.map((j) => j.id === selectedPost?.id ? { ...j, status } : j));
          setSelectedPost((prev) => prev ? { ...prev, status } : prev);
          fetchAll();
        }}
      />

      <SafeAreaView style={s.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#050914" />

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Admin Panel</Text>
            <Text style={s.headerSub}>
              {analytics.pendingJobs} pending review{analytics.pendingJobs !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={s.headerRight}>
            <Pressable style={({ pressed }) => [s.iconBtn, pressed && s.pressed]} onPress={onRefresh} hitSlop={12}>
              <Ionicons name="refresh-outline" size={22} color="#a78bfa" />
            </Pressable>
            <Pressable style={({ pressed }) => [s.iconBtn, s.logoutBtn, pressed && s.pressed]} onPress={handleLogout} hitSlop={12}>
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
            </Pressable>
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabBarWrap}>
          <View style={s.tabBarContent}>
            {TABS.map((tab) => (
              <Pressable key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
                <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                  {tab}
                  {tab === "Jobs"     && analytics.pendingJobs > 0 && <Text style={s.tabBadge}> {analytics.pendingJobs}</Text>}
                  {tab === "Featured" && featuredCount > 0          && <Text style={[s.tabBadge, { color: "#f59e0b" }]}> {featuredCount}</Text>}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Main scroll */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          refreshControl={
            !isWeb
              ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" colors={["#7c3aed"]} />
              : undefined
          }
        >
          {/* ── OVERVIEW ── */}
          {activeTab === "Overview" && (
            <>
              <Text style={s.sectionTitle}>Platform Stats</Text>
              <View style={s.statsGrid}>
                {[
                  { label: "Total Users",    value: analytics.totalUsers,        icon: "people-outline"        },
                  { label: "Total Jobs",     value: analytics.totalJobs,         icon: "briefcase-outline"     },
                  { label: "Pending Review", value: analytics.pendingJobs,       icon: "time-outline"          },
                  { label: "Applications",   value: analytics.totalApplications, icon: "document-text-outline" },
                  { label: "Featured Jobs",  value: featuredCount,               icon: "star-outline"          },
                ].map((item, i) => (
                  <View key={item.label} style={[s.statCard, { borderColor: STAT_COLOR[i % 4] + "55" }]}>
                    <View style={[s.statIcon, { backgroundColor: STAT_COLOR[i % 4] + "22" }]}>
                      <Ionicons name={item.icon} size={20} color={STAT_COLOR[i % 4]} />
                    </View>
                    <Text style={[s.statNum, { color: STAT_COLOR[i % 4] }]}>{item.value}</Text>
                    <Text style={s.statLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.sectionTitle}>Jobs Breakdown</Text>
              <StatusBreakdown approved={analytics.approvedJobs} pending={analytics.pendingJobs} rejected={analytics.rejectedJobs} />
            </>
          )}

          {/* ── JOBS ── */}
          {activeTab === "Jobs" && (
            <>
              <FilterBar active={jobFilter} onChange={setJobFilter} counts={jobCounts} />
              <Text style={s.sectionTitle}>
                {jobFilter.charAt(0).toUpperCase() + jobFilter.slice(1)} Jobs ({filteredJobs.length})
              </Text>
              {filteredJobs.length === 0
                ? <EmptyState status={jobFilter} />
                : filteredJobs.map((job) => (
                    <PostCard
                      key={job.id} item={job} actioning={actioningId === job.id}
                      onPress={() => openDetail(job)}
                      onQuickApprove={() => quickApprove(job.id)}
                      onQuickReject={() => quickReject(job.id, job.title)}
                    />
                  ))
              }
            </>
          )}

          {/* ── FEATURED ── */}
          {activeTab === "Featured" && (
            <>
              <View style={s.featuredInfoBanner}>
                <Ionicons name="star" size={16} color="#f59e0b" />
                <Text style={s.featuredInfoText}>
                  Toggle the switch to pin a job to the top of the Home Screen's Trending Jobs feed.{" "}
                  <Text style={{ color: "#f59e0b", fontWeight: "800" }}>{featuredCount}</Text> job{featuredCount !== 1 ? "s" : ""} currently featured.
                </Text>
              </View>
              <Text style={s.sectionTitle}>Approved Jobs ({approvedJobs.length})</Text>
              {approvedJobs.length === 0
                ? <EmptyState status="approved" />
                : approvedJobs.map((job) => (
                    <FeaturedJobCard
                      key={job.id}
                      job={job}
                      toggling={togglingId === job.id}
                      onToggle={() => handleToggleFeatured(job)}
                    />
                  ))
              }
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  rootFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#050914" },
  safeArea: { flex: 1, backgroundColor: "#050914" },
  scroll:   { flex: 1 },
  scrollContent: { paddingBottom: 48, paddingHorizontal: 16 },

  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  headerTitle: { color: "white", fontSize: 22, fontWeight: "800" },
  headerSub:   { color: "#6b7280", fontSize: 13, marginTop: 2 },
  headerRight: { flexDirection: "row", gap: 8 },
  iconBtn:     { backgroundColor: "#0f1629", padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#1e2d4a" },
  logoutBtn:   { borderColor: "#ef444433", backgroundColor: "#ef444411" },
  pressed:     { opacity: 0.6 },

  tabBarWrap:     { marginHorizontal: 16, marginBottom: 16 },
  tabBarContent:  { backgroundColor: "#0f1629", borderRadius: 14, padding: 4, flexDirection: "row", justifyContent: "center" },
  tab:            { flex: 1, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", borderRadius: 10 },
  tabActive:      { backgroundColor: "#7c3aed" },
  tabText:        { color: "#9ca3af", fontWeight: "600", fontSize: 14 },
  tabTextActive:  { color: "white" },
  tabBadge:       { color: "#fbbf24", fontWeight: "800" },

  filterScroll:   { marginBottom: 14 },
  filterContent:  { paddingRight: 8, gap: 8, flexDirection: "row" },
  filterChip:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#1e2d4a", backgroundColor: "#0f1629" },
  filterText:     { color: "#9ca3af", fontSize: 13, fontWeight: "600" },
  filterBadge:    { backgroundColor: "#1e2d4a", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, minWidth: 22, alignItems: "center" },
  filterBadgeText:{ color: "#9ca3af", fontSize: 11, fontWeight: "700" },

  sectionTitle: { color: "white", fontSize: 16, fontWeight: "700", marginBottom: 12, marginTop: 4 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  statCard:  { width: "47%", backgroundColor: "#0f1629", borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1 },
  statIcon:  { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  statNum:   { fontSize: 24, fontWeight: "800", marginBottom: 2 },
  statLabel: { color: "#9ca3af", fontSize: 12, textAlign: "center" },

  breakdown:      { backgroundColor: "#0f1629", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#1e2d4a", marginBottom: 20, gap: 14 },
  breakdownItem:  { gap: 6 },
  breakdownMeta:  { flexDirection: "row", justifyContent: "space-between" },
  breakdownBar:   { height: 7, backgroundColor: "#1e2d4a", borderRadius: 10, overflow: "hidden" },
  breakdownFill:  { height: "100%", borderRadius: 10, minWidth: 4 },
  breakdownLabel: { fontSize: 13, fontWeight: "700" },
  breakdownValue: { color: "#9ca3af", fontSize: 12 },

  card:            { backgroundColor: "#0f1629", borderRadius: 18, borderWidth: 1, borderColor: "#1e2d4a", marginBottom: 14, overflow: "hidden" },
  cardPressed:     { opacity: 0.82 },
  cardImgWrap:     { position: "relative" },
  cardImg:         { width: "100%", height: 170 },
  cardImgBadge:    { position: "absolute", bottom: 8, left: 10, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cardImgBadgeText:{ color: "white", fontSize: 11, fontWeight: "700" },
  cardStatusOverlay: { position: "absolute", top: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  cardStatusDot:   { width: 6, height: 6, borderRadius: 3 },
  cardStatusText:  { fontSize: 11, fontWeight: "700" },
  cardBody:        { padding: 14 },
  cardHeaderRow:   { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6, gap: 8 },
  cardTitle:       { color: "white", fontSize: 15, fontWeight: "700", flex: 1 },
  statusPill:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusPillText:  { fontSize: 11, fontWeight: "700" },
  cardDesc:        { color: "#9ca3af", fontSize: 13, lineHeight: 19, marginBottom: 10 },
  cardMeta:        { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  metaChip:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#1e2d4a", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  metaText:        { color: "#9ca3af", fontSize: 11 },
  cardFooter:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  cardDate:        { color: "#374151", fontSize: 12 },
  quickActions:    { flexDirection: "row", gap: 8 },
  quickReject:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "#ef444455", backgroundColor: "#ef444411" },
  quickRejectText: { color: "#ef4444", fontWeight: "700", fontSize: 12 },
  quickApprove:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: "#7c3aed" },
  quickApproveText:{ color: "white", fontWeight: "700", fontSize: 12 },
  tapHint:         { flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 8, borderTopWidth: 1, borderColor: "#111827" },
  tapHintText:     { color: "#374151", fontSize: 11 },

  empty:     { alignItems: "center", paddingVertical: 56, gap: 14 },
  emptyText: { color: "#6b7280", fontSize: 14, textAlign: "center", lineHeight: 22 },

  featuredInfoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "rgba(245,158,11,0.08)", borderWidth: 1, borderColor: "#f59e0b33", borderRadius: 14, padding: 14, marginBottom: 16 },
  featuredInfoText:   { flex: 1, color: "#d1d5db", fontSize: 13, lineHeight: 19 },
});