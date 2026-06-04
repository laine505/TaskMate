import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, ActivityIndicator, RefreshControl,
  Modal, TextInput, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTERS = ["All", "Active", "Completed", "Disputed"];

const STATUS_CONFIG = {
  active:    { label: "Active",    color: "#60a5fa", bg: "#0a1628", border: "#3b82f6" },
  completed: { label: "Completed", color: "#34d399", bg: "#052e1c", border: "#10b981" },
  disputed:  { label: "Disputed",  color: "#f87171", bg: "#2d0a0a", border: "#ef4444" },
};

const FILTER_MAP = {
  "All":       null,
  "Active":    "active",
  "Completed": "completed",
  "Disputed":  "disputed",
};

const RATING_LABELS = { 0: "Tap to rate", 1: "Poor", 2: "Fair", 3: "Good", 4: "Great", 5: "Excellent!" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diffDays = Math.floor((Date.now() - new Date(dateStr)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stars({ rating = 0, size = 12 }) {
  const full = Math.round(rating);
  return (
    <View style={{ flexDirection: "row", gap: 3, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= full ? "star" : "star-outline"}
          size={size}
          color={i <= full ? "#fbbf24" : "#374151"}
        />
      ))}
      <Text style={{ color: "#6b7280", fontSize: 11, marginLeft: 3 }}>
        {rating ? Number(rating).toFixed(1) : "—"}
      </Text>
    </View>
  );
}

function ProgressBar({ progress = 0, color = "#7c3aed" }) {
  return (
    <View style={s.progressTrack}>
      <View style={[s.progressFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ visible, title, message, confirmLabel, confirmColor = "#10b981", onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.confirmSheet}>
          <Text style={s.confirmTitle}>{title}</Text>
          <Text style={s.confirmMessage}>{message}</Text>
          <View style={s.confirmRow}>
            <TouchableOpacity style={s.confirmCancel} onPress={onCancel}>
              <Text style={s.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.confirmBtn, { backgroundColor: confirmColor }]} onPress={onConfirm}>
              <Text style={s.confirmBtnText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrdersScreen({ navigation }) {
  const { user, saveUser, setOrderNotifCount, clearOrderNotifs } = useUser();

  const [viewMode,     setViewMode]     = useState("worker");
  const [orders,       setOrders]       = useState([]);
  const [clientOrders, setClientOrders] = useState([]);
  const [stats,        setStats]        = useState({ completed: 0, rating: 0 });
  const [clientStats,  setClientStats]  = useState({ given: 0, active: 0 });
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [filter,       setFilter]       = useState("All");
  const [selected,     setSelected]     = useState(null);
  const [actionLoad,   setActionLoad]   = useState(false);
  const [confirm,      setConfirm]      = useState(null);

  // Rating modal
  const [ratingTarget,  setRatingTarget]  = useState(null);
  const [selectedStars, setSelectedStars] = useState(0);
  const [reviewText,    setReviewText]    = useState("");

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, status, title, description, created_at, updated_at,
          due_date, milestone_total, milestone_current,
          client_id, client_name,
          rating, review, type, job_id, gig_id, worker_id
        `)
        .eq("worker_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      const rows = data || [];
      setOrders(rows);

      const done      = rows.filter((o) => o.status === "completed");
      const ratingArr = done.filter((o) => o.rating).map((o) => o.rating);
      const avg       = ratingArr.length
        ? ratingArr.reduce((a, b) => a + b, 0) / ratingArr.length : 0;

      const newStats = { completed: done.length, rating: Math.round(avg * 10) / 10 };
      setStats(newStats);
      await supabase.from("users").update(newStats).eq("id", user.id);
      saveUser((prev) => ({ ...prev, ...newStats }));
    } catch (err) {
      console.error("fetchOrders:", err.message);
    }
  }, [user?.id]);

  const fetchClientOrders = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, status, title, description, created_at, updated_at,
          due_date, milestone_total, milestone_current,
          worker_id, worker_name,
          rating, review, type, job_id, gig_id
        `)
        .eq("client_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      const rows = data || [];
      setClientOrders(rows);

      const active = rows.filter((o) => o.status === "active").length;
      setClientStats({ given: rows.length, active });
    } catch (err) {
      console.error("fetchClientOrders:", err.message);
    }
  }, [user?.id]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      clearOrderNotifs();
      await Promise.all([fetchOrders(), fetchClientOrders()]);
      setLoading(false);
    };
    run();
  }, [fetchOrders, fetchClientOrders]);

  useEffect(() => {
    if (!user?.id) return;
    const chW = supabase.channel(`orders-w-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `worker_id=eq.${user.id}` }, fetchOrders)
      .subscribe();
    const chC = supabase.channel(`orders-c-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `client_id=eq.${user.id}` }, fetchClientOrders)
      .subscribe();
    return () => { supabase.removeChannel(chW); supabase.removeChannel(chC); };
  }, [fetchOrders, fetchClientOrders, user?.id]);

  // ── Order notifications ────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`order-notifs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new;
          const prev    = payload.old;

          // Worker marked as done → notify client
          if (
            updated.client_id === user.id &&
            prev.status !== "completed" &&
            updated.status === "completed"
          ) {
            setOrderNotifCount((c) => c + 1);
            Alert.alert(
              "✅ Task Completed",
              `"${updated.title || "Your order"}" has been marked as done by the worker. Go to Orders to leave a rating.`,
              [{ text: "View Orders", onPress: () => navigation.navigate("Orders") }, { text: "Later" }]
            );
          }

          // Client left a rating → notify worker
          if (
            updated.worker_id === user.id &&
            !prev.rating &&
            updated.rating
          ) {
            setOrderNotifCount((c) => c + 1);
            Alert.alert(
              "⭐ You Got Rated!",
              `You received a ${updated.rating}-star rating on "${updated.title || "your order"}".${updated.review ? `\n\n"${updated.review}"` : ""}`,
              [{ text: "View Orders", onPress: () => navigation.navigate("Orders") }, { text: "OK" }]
            );
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    clearOrderNotifs();
    await Promise.all([fetchOrders(), fetchClientOrders()]);
    setRefreshing(false);
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const markDone = (orderId) => {
    setConfirm({
      title:        "Mark as Done?",
      message:      "This will complete the order. The client will be able to leave you a rating.",
      confirmLabel: "Mark Done ✓",
      confirmColor: "#10b981",
      onConfirm:    async () => {
        setConfirm(null);
        setActionLoad(true);
        try {
          const { error } = await supabase
            .from("orders")
            .update({ status: "completed", updated_at: new Date().toISOString() })
            .eq("id", orderId)
            .eq("worker_id", user.id);

          if (error) {
            Alert.alert("Error", `Could not mark as done.\n\n${error.message}`);
            return;
          }

          setSelected(null);
          await Promise.all([fetchOrders(), fetchClientOrders()]);
        } catch (err) {
          Alert.alert("Error", err.message);
        } finally {
          setActionLoad(false);
        }
      },
    });
  };

  const disputeOrder = (orderId) => {
    setConfirm({
      title:        "Raise a Dispute?",
      message:      "Use this if something went wrong with this order. An admin will review it.",
      confirmLabel: "Raise Dispute",
      confirmColor: "#ef4444",
      onConfirm:    async () => {
        setConfirm(null);
        setActionLoad(true);
        try {
          const { data: updated, error } = await supabase
            .from("orders")
            .update({ status: "disputed", updated_at: new Date().toISOString() })
            .eq("id", orderId)
            .eq("client_id", user.id)
            .select("id, status")
            .single();

          if (error) {
            Alert.alert("Error", `Could not raise dispute.\n\n${error.message}`);
            return;
          }

          if (!updated) {
            Alert.alert("Error", "Update blocked — check RLS policies in Supabase dashboard.");
            return;
          }

          setSelected(null);
          await Promise.all([fetchOrders(), fetchClientOrders()]);
        } catch (err) {
          Alert.alert("Error", err.message);
        } finally {
          setActionLoad(false);
        }
      },
    });
  };

  const openRatingModal = (order) => {
    setRatingTarget(order);
    setSelected(null);
    setSelectedStars(order.rating || 0);
    setReviewText(order.review || "");
  };

  const submitRating = async () => {
    if (!selectedStars) { Alert.alert("Pick a rating", "Please tap a star first."); return; }
    setActionLoad(true);
    try {
      const { error: orderErr } = await supabase
        .from("orders")
        .update({ rating: selectedStars, review: reviewText.trim() || null })
        .eq("id", ratingTarget.id);
      if (orderErr) throw orderErr;

      const workerId = ratingTarget.worker_id;
      if (workerId) {
        const { data: workerOrders, error: fetchErr } = await supabase
          .from("orders")
          .select("rating")
          .eq("worker_id", workerId)
          .eq("status", "completed")
          .not("rating", "is", null);
        if (fetchErr) throw fetchErr;

        const ratings = workerOrders.map((o) => o.rating);
        const avg = ratings.length
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;

        await supabase.from("users").update({ rating: avg }).eq("id", workerId);
      }

      setRatingTarget(null);
      setSelectedStars(0);
      setReviewText("");
      await fetchClientOrders();
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setActionLoad(false);
    }
  };

  // ── Filter ─────────────────────────────────────────────────────────────────

  const pool      = viewMode === "worker" ? orders : clientOrders;
  const statusKey = FILTER_MAP[filter];
  const filtered  = statusKey ? pool.filter((o) => o.status === statusKey) : pool;

  const counts = {};
  FILTERS.forEach((f) => {
    const k = FILTER_MAP[f];
    counts[f] = k ? pool.filter((o) => o.status === k).length : pool.length;
  });

  const activeList    = filtered.filter((o) => o.status !== "completed");
  const completedList = filtered.filter((o) => o.status === "completed");

  // ── Card ───────────────────────────────────────────────────────────────────

  const renderCard = (order) => {
    const cfg   = STATUS_CONFIG[order.status] || STATUS_CONFIG.active;
    const isWk  = viewMode === "worker";
    const party = isWk ? (order.client_name || "Client") : (order.worker_name || "Worker");
    const canRate = !isWk && order.status === "completed" && !order.rating;

    const progress = order.status === "completed" ? 100
      : order.status === "active" ? 50 : 0;

    return (
      <TouchableOpacity
        key={order.id}
        style={[
          s.card,
          canRate && { borderColor: "#7c3aed", shadowColor: "#7c3aed", shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
        ]}
        activeOpacity={0.82}
        onPress={() => setSelected({ ...order, _isWorker: isWk })}
      >
        <View style={s.cardTop}>
          <Text style={s.cardTitle} numberOfLines={1}>{order.title || "Untitled Order"}</Text>
          <View style={[s.pill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <Text style={[s.pillText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={s.cardMeta}>
          <View style={s.metaItem}>
            <Ionicons name="person-outline" size={11} color="#6b7280" />
            <Text style={s.metaText}>{party}</Text>
          </View>
          {order.due_date && order.status !== "completed" && (
            <View style={s.metaItem}>
              <Ionicons name="calendar-outline" size={11} color="#6b7280" />
              <Text style={s.metaText}>Due {formatDate(order.due_date)}</Text>
            </View>
          )}
          {order.status === "completed" && (
            <View style={s.metaItem}>
              <Ionicons name="checkmark-circle-outline" size={11} color="#34d399" />
              <Text style={[s.metaText, { color: "#34d399" }]}>{timeAgo(order.updated_at)}</Text>
            </View>
          )}
        </View>

        <ProgressBar progress={progress} color={cfg.color} />

        <View style={s.cardBottom}>
          <View style={{ alignItems: "flex-start", gap: 4 }}>
            {order.status === "active" && (
              <Text style={[s.metaText, { color: "#60a5fa" }]}>
                {isWk ? "In progress" : "Worker is working"}
              </Text>
            )}
            {order.status === "completed" && (
              <>
                <Text style={[s.statusText, { color: isWk ? "#34d399" : "#60a5fa" }]}>
                  {isWk ? "Completed ✓" : "Done"}
                </Text>
                {order.rating
                  ? <Stars rating={order.rating} />
                  : canRate
                    ? <Text style={s.tapToRate}>★ Rate this worker</Text>
                    : null
                }
              </>
            )}
          </View>
        </View>

        {isWk && order.status === "active" && (
          <View style={[s.banner, { backgroundColor: "#0a1628", borderColor: "#3b82f620" }]}>
            <Ionicons name="hammer-outline" size={13} color="#60a5fa" />
            <Text style={[s.bannerText, { color: "#60a5fa" }]}>Tap to mark as done when finished</Text>
          </View>
        )}
        {canRate && (
          <View style={[s.banner, { backgroundColor: "#1e1344", borderColor: "#7c3aed40" }]}>
            <Ionicons name="star-outline" size={13} color="#a78bfa" />
            <Text style={[s.bannerText, { color: "#a78bfa" }]}>Tap to leave a rating</Text>
          </View>
        )}
        {isWk && order.status === "completed" && order.rating && (
          <View style={[s.banner, { backgroundColor: "#1a2600", borderColor: "#34d39940" }]}>
            <Ionicons name="star" size={13} color="#fbbf24" />
            <Text style={[s.bannerText, { color: "#34d399" }]}>
              Rated {Number(order.rating).toFixed(1)} ★ by client
              {order.review ? ` — "${order.review}"` : ""}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── Detail modal ───────────────────────────────────────────────────────────

  const renderDetailModal = () => {
    if (!selected) return null;
    const cfg     = STATUS_CONFIG[selected.status] || STATUS_CONFIG.active;
    const isWk    = selected._isWorker;
    const canRate = !isWk && selected.status === "completed" && !selected.rating;
    const partyLabel = isWk ? "Client" : "Worker";
    const partyName  = isWk ? (selected.client_name || "Client") : (selected.worker_name || "Worker");

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSelected(null)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={() => {}}>
            <View style={s.handle} />

            <View style={s.modalTopRow}>
              <View style={[s.modalIconBox, { backgroundColor: cfg.bg }]}>
                <Ionicons name="briefcase-outline" size={22} color={cfg.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle} numberOfLines={2}>{selected.title}</Text>
                <View style={[s.pill, { backgroundColor: cfg.bg, borderColor: cfg.border, alignSelf: "flex-start", marginTop: 4 }]}>
                  <Text style={[s.pillText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
            </View>

            <View style={s.sectionDivider} />

            {[
              { icon: "person-outline",       label: partyLabel,    value: partyName },
              { icon: "calendar-outline",      label: "Due date",    value: formatDate(selected.due_date) || "No deadline" },
              { icon: "document-text-outline", label: "Description", value: selected.description || "No description provided." },
            ].map((row) => (
              <View key={row.label} style={s.modalRow}>
                <View style={s.modalRowIcon}>
                  <Ionicons name={row.icon} size={15} color="#7c3aed" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalLabel}>{row.label}</Text>
                  <Text style={s.modalValue}>{row.value}</Text>
                </View>
              </View>
            ))}

            {selected.status === "completed" && selected.rating && (
              <View style={s.modalRow}>
                <View style={s.modalRowIcon}>
                  <Ionicons name="star" size={15} color="#fbbf24" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalLabel}>{isWk ? "Rating from client" : "Your rating"}</Text>
                  <Stars rating={selected.rating} size={16} />
                  {selected.review ? (
                    <Text style={[s.modalValue, { marginTop: 6, color: "#9ca3af", fontStyle: "italic" }]}>
                      "{selected.review}"
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            <View style={s.sectionDivider} />

            {/* Worker: Mark as Done */}
            {isWk && selected.status === "active" && (
              <TouchableOpacity
                style={[s.doneBtn, actionLoad && { opacity: 0.6 }]}
                onPress={() => markDone(selected.id)}
                disabled={actionLoad}
              >
                {actionLoad
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={s.doneBtnText}>Mark as Done</Text>
                    </>
                }
              </TouchableOpacity>
            )}

            {/* Worker: disputed */}
            {isWk && selected.status === "disputed" && (
              <View style={[s.infoBanner, { backgroundColor: "#2d0a0a", borderColor: "#ef444440" }]}>
                <Ionicons name="alert-circle-outline" size={16} color="#f87171" />
                <Text style={[s.infoBannerText, { color: "#f87171" }]}>This order is disputed — contact your client via chat</Text>
              </View>
            )}

            {/* Client: rate */}
            {canRate && (
              <TouchableOpacity style={s.rateBtn} onPress={() => openRatingModal(selected)}>
                <Ionicons name="star-outline" size={18} color="#fbbf24" />
                <Text style={s.rateBtnText}>Leave a Rating</Text>
              </TouchableOpacity>
            )}

            {/* Client: dispute */}
            {!isWk && selected.status === "active" && (
              <TouchableOpacity
                style={[s.disputeBtn, actionLoad && { opacity: 0.6 }]}
                onPress={() => disputeOrder(selected.id)}
                disabled={actionLoad}
              >
                <Ionicons name="alert-circle-outline" size={16} color="#f87171" />
                <Text style={s.disputeBtnText}>Raise a Dispute</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.closeBtn} onPress={() => setSelected(null)}>
              <Text style={s.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ── Rating modal ───────────────────────────────────────────────────────────

  const renderRatingModal = () => {
    if (!ratingTarget) return null;
    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setRatingTarget(null)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { paddingBottom: 44 }]}>
            <View style={s.handle} />

            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View style={s.ratingIconWrap}>
                <Ionicons name="star" size={30} color="#fbbf24" />
              </View>
            </View>

            <Text style={[s.modalTitle, { textAlign: "center" }]}>Rate the Work</Text>
            <Text style={[s.modalLabel, { color: "#9ca3af", marginTop: 6, marginBottom: 24, textAlign: "center", lineHeight: 20 }]}>
              How was{" "}
              <Text style={{ color: "#e5e7eb", fontWeight: "700" }}>
                {ratingTarget.worker_name || "the worker"}
              </Text>
              {"\n"}on "{ratingTarget.title}"?
            </Text>

            <View style={s.starRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <TouchableOpacity key={i} onPress={() => setSelectedStars(i)} activeOpacity={0.6}>
                  <Ionicons
                    name={i <= selectedStars ? "star" : "star-outline"}
                    size={46}
                    color={i <= selectedStars ? "#fbbf24" : "#1e2d4a"}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.ratingWordLabel}>{RATING_LABELS[selectedStars]}</Text>

            <Text style={[s.modalLabel, { marginTop: 24, marginBottom: 8 }]}>Review (optional)</Text>
            <TextInput
              style={s.reviewInput}
              multiline
              numberOfLines={3}
              placeholder="What went well? What could improve?"
              placeholderTextColor="#374151"
              value={reviewText}
              onChangeText={setReviewText}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                style={[s.closeBtn, { flex: 1, backgroundColor: "#1e2d4a" }]}
                onPress={() => { setRatingTarget(null); setSelectedStars(0); setReviewText(""); }}
              >
                <Text style={[s.closeBtnText, { color: "#9ca3af" }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.closeBtn, { flex: 2, opacity: selectedStars ? 1 : 0.4 }]}
                onPress={submitRating}
                disabled={!selectedStars || actionLoad}
              >
                {actionLoad
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.closeBtnText}>Submit Rating</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />

      <View style={s.header}>
        <Text style={s.headerTitle}>Orders</Text>
        <TouchableOpacity style={s.iconBtn} onPress={onRefresh} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={19} color="#a78bfa" />
        </TouchableOpacity>
      </View>

      <View style={s.modeToggle}>
        {[
          { key: "worker", label: "My Work",    icon: "briefcase-outline" },
          { key: "client", label: "Given Tasks", icon: "people-outline"   },
        ].map(({ key, label, icon }) => (
          <TouchableOpacity
            key={key}
            style={[s.modeBtn, viewMode === key && s.modeBtnActive]}
            onPress={() => { setViewMode(key); setFilter("All"); }}
            activeOpacity={0.75}
          >
            <Ionicons name={icon} size={15} color={viewMode === key ? "#fff" : "#6b7280"} />
            <Text style={[s.modeBtnText, viewMode === key && s.modeBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={s.loadingText}>Loading orders…</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" colors={["#7c3aed"]} />
          }
        >
          {/* Stats Card */}
          <View style={s.earningsCard}>
            <Text style={s.earningsSectionLabel}>
              {viewMode === "worker" ? "Work overview" : "Tasks overview"}
            </Text>
            <View style={s.earningsRow}>
              {viewMode === "worker" ? (
                <>
                  <View style={s.earningsBox}>
                    <Text style={s.earningsNum}>{orders.length}</Text>
                    <Text style={s.earningsSub}>Total orders</Text>
                  </View>
                  <View style={[s.earningsBox, s.earningsBoxMid]}>
                    <Text style={s.earningsNum}>{stats.completed}</Text>
                    <Text style={s.earningsSub}>Completed</Text>
                  </View>
                  <View style={s.earningsBox}>
                    <Text style={[s.earningsNum, { color: "#fbbf24" }]}>
                      {stats.rating ? stats.rating.toFixed(1) : "—"} ★
                    </Text>
                    <Text style={s.earningsSub}>Avg rating</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.earningsBox}>
                    <Text style={s.earningsNum}>{clientStats.given}</Text>
                    <Text style={s.earningsSub}>Tasks given</Text>
                  </View>
                  <View style={[s.earningsBox, s.earningsBoxMid]}>
                    <Text style={[s.earningsNum, { color: "#60a5fa" }]}>{clientStats.active}</Text>
                    <Text style={s.earningsSub}>In progress</Text>
                  </View>
                  <View style={s.earningsBox}>
                    <Text style={[s.earningsNum, { color: "#34d399" }]}>
                      {clientOrders.filter(o => o.status === "completed").length}
                    </Text>
                    <Text style={s.earningsSub}>Completed</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterRow}
            bounces={false}
            style={{ flexGrow: 0 }}
          >
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[s.filterChip, filter === f && s.filterChipActive]}
                onPress={() => setFilter(f)}
                activeOpacity={0.7}
              >
                <Text style={[s.filterChipText, filter === f && s.filterChipTextActive]}>{f}</Text>
                {counts[f] > 0 && (
                  <View style={[s.filterCount, filter === f && s.filterCountActive]}>
                    <Text style={[s.filterCountText, filter === f && s.filterCountTextActive]}>{counts[f]}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filtered.length === 0 && (
            <View style={s.emptyState}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="clipboard-outline" size={44} color="#374151" />
              </View>
              <Text style={s.emptyTitle}>No orders here</Text>
              <Text style={s.emptySub}>
                {filter === "All"
                  ? viewMode === "worker"
                    ? "Win a job or gig to see your orders."
                    : "Post a job and hire someone to see tasks here."
                  : `No ${filter.toLowerCase()} orders yet.`}
              </Text>
            </View>
          )}

          {activeList.length > 0 && (
            <>
              <Text style={s.sectionLabel}>
                {filter === "All" ? `Active (${activeList.length})` : `${filter} (${activeList.length})`}
              </Text>
              {activeList.map(renderCard)}
            </>
          )}

          {completedList.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { marginTop: activeList.length > 0 ? 20 : 0 }]}>
                Completed ({completedList.length})
              </Text>
              {completedList.map(renderCard)}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {renderDetailModal()}
      {renderRatingModal()}

      {confirm && (
        <ConfirmModal
          visible={true}
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          confirmColor={confirm.confirmColor}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: "#050914" },
  center:        { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:   { color: "#6b7280", fontSize: 14 },
  scrollContent: { paddingBottom: 32 },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
  },
  headerTitle: { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  iconBtn: {
    backgroundColor: "#0f1629", padding: 10, borderRadius: 12,
    borderWidth: 1, borderColor: "#1e2d4a",
  },

  modeToggle: {
    flexDirection: "row", marginHorizontal: 20, marginBottom: 18,
    backgroundColor: "#0f1629", borderRadius: 14, borderWidth: 1,
    borderColor: "#1e2d4a", padding: 4,
  },
  modeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, paddingVertical: 10, borderRadius: 11,
  },
  modeBtnActive:     { backgroundColor: "#7c3aed" },
  modeBtnText:       { color: "#6b7280", fontSize: 14, fontWeight: "600" },
  modeBtnTextActive: { color: "#fff" },

  earningsCard: {
    backgroundColor: "#0f1629", borderRadius: 18, borderWidth: 1,
    borderColor: "#1e2d4a", marginHorizontal: 20, marginBottom: 18, padding: 16,
  },
  earningsSectionLabel: {
    color: "#6b7280", fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
  },
  earningsRow:    { flexDirection: "row", borderRadius: 12, borderWidth: 1, borderColor: "#1e2d4a", overflow: "hidden" },
  earningsBox:    { flex: 1, padding: 14, alignItems: "center" },
  earningsBoxMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#1e2d4a" },
  earningsNum:    { color: "#a78bfa", fontSize: 20, fontWeight: "800", marginBottom: 3 },
  earningsSub:    { color: "#6b7280", fontSize: 11 },

  filterRow: { paddingHorizontal: 20, gap: 8, marginBottom: 18 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 50,
    backgroundColor: "#0f1629", borderWidth: 1, borderColor: "#1e2d4a",
  },
  filterChipActive:      { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  filterChipText:        { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  filterChipTextActive:  { color: "#fff" },
  filterCount:           { backgroundColor: "#1e2d4a", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: "center" },
  filterCountActive:     { backgroundColor: "rgba(255,255,255,0.22)" },
  filterCountText:       { color: "#6b7280", fontSize: 11, fontWeight: "700" },
  filterCountTextActive: { color: "#fff" },

  sectionLabel: {
    color: "#6b7280", fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginHorizontal: 20, marginBottom: 10,
  },
  sectionDivider: { height: 1, backgroundColor: "#1e2d4a", marginBottom: 16, marginTop: 4 },

  card: {
    backgroundColor: "#0f1629", borderWidth: 1, borderColor: "#1e2d4a",
    borderRadius: 18, padding: 16, marginHorizontal: 20, marginBottom: 10,
  },
  cardTop:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700", flex: 1, marginRight: 10 },
  pill:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  pillText:  { fontSize: 11, fontWeight: "700" },
  cardMeta:  { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  metaItem:  { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText:  { color: "#6b7280", fontSize: 12 },
  progressTrack: { height: 4, backgroundColor: "#1e2d4a", borderRadius: 2, overflow: "hidden", marginBottom: 12 },
  progressFill:  { height: "100%", borderRadius: 2 },
  cardBottom:{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  statusText:{ fontSize: 12, fontWeight: "700" },
  tapToRate: { color: "#a78bfa", fontSize: 11, fontWeight: "600" },

  banner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 12, paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1,
  },
  bannerText: { fontSize: 12, fontWeight: "500", flex: 1 },

  emptyState:    { alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: "#0f1629",
    borderWidth: 1, borderColor: "#1e2d4a", justifyContent: "center",
    alignItems: "center", marginBottom: 18,
  },
  emptyTitle: { color: "#e5e7eb", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySub:   { color: "#6b7280", fontSize: 14, textAlign: "center", lineHeight: 22 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0f1629", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 44, borderWidth: 1, borderColor: "#1e2d4a",
    maxHeight: "90%",
  },
  handle:       { width: 40, height: 4, backgroundColor: "#1e2d4a", borderRadius: 2, alignSelf: "center", marginBottom: 22 },
  modalTopRow:  { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 18 },
  modalIconBox: { width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  modalTitle:   { color: "#fff", fontSize: 17, fontWeight: "800", flex: 1 },
  modalRow:     { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  modalRowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#1e1344", justifyContent: "center", alignItems: "center", marginTop: 2 },
  modalLabel:   { color: "#6b7280", fontSize: 11, fontWeight: "600", marginBottom: 2, letterSpacing: 0.4 },
  modalValue:   { color: "#fff", fontSize: 14, lineHeight: 20 },

  infoBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 10,
  },
  infoBannerText: { fontSize: 13, fontWeight: "500", flex: 1 },

  doneBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 13, marginBottom: 10,
    backgroundColor: "#10b981",
  },
  doneBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  rateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 13, borderRadius: 13, marginBottom: 10,
    backgroundColor: "#2d1f00", borderWidth: 1, borderColor: "#f59e0b40",
  },
  rateBtnText: { color: "#fbbf24", fontSize: 14, fontWeight: "700" },

  disputeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 11, borderRadius: 13, marginBottom: 10,
    borderWidth: 1, borderColor: "#ef444430", backgroundColor: "#2d0a0a",
  },
  disputeBtnText: { color: "#f87171", fontSize: 13, fontWeight: "700" },

  closeBtn:     { backgroundColor: "#7c3aed", paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 4 },
  closeBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  ratingIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#2d1f00",
    borderWidth: 1, borderColor: "#f59e0b40", justifyContent: "center",
    alignItems: "center", marginBottom: 4,
  },
  starRow:         { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 8 },
  ratingWordLabel: { color: "#fbbf24", fontSize: 17, fontWeight: "700", textAlign: "center" },
  reviewInput: {
    backgroundColor: "#050914", color: "#fff", fontSize: 14,
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#1e2d4a",
    minHeight: 80, textAlignVertical: "top",
  },

  confirmSheet: {
    backgroundColor: "#0f1629", borderRadius: 20, padding: 24,
    marginHorizontal: 32, borderWidth: 1, borderColor: "#1e2d4a",
  },
  confirmTitle:      { color: "#fff", fontSize: 17, fontWeight: "800", marginBottom: 10, textAlign: "center" },
  confirmMessage:    { color: "#9ca3af", fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 24 },
  confirmRow:        { flexDirection: "row", gap: 10 },
  confirmCancel:     { flex: 1, paddingVertical: 13, borderRadius: 13, alignItems: "center", backgroundColor: "#1e2d4a" },
  confirmCancelText: { color: "#9ca3af", fontWeight: "700", fontSize: 14 },
  confirmBtn:        { flex: 2, paddingVertical: 13, borderRadius: 13, alignItems: "center" },
  confirmBtnText:    { color: "#fff", fontWeight: "800", fontSize: 14 },
});