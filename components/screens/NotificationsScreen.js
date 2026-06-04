import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  UIManager,
  Platform,
  Alert,
  Linking,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME  (dark-only, matches rest of the app)
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  bg:        "#050914",
  bg2:       "#0b1120",
  card:      "#0b1120",
  border:    "#1a2540",
  accent:    "#7c3aed",
  accentBg:  "rgba(124,58,237,0.12)",
  text:      "#ffffff",
  textSub:   "#d1d5db",
  textMuted: "#6b7280",
  textFaint: "#4b5563",
  danger:    "#ef4444",
  dangerBg:  "rgba(239,68,68,0.08)",
  statusBar: "light-content",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((new Date() - new Date(dateStr)) / 60000);
  if (diff < 1)  return "just now";
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24)    return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const AVATAR_COLORS = ["#7c3aed","#0891b2","#059669","#dc2626","#d97706","#be185d","#2563eb"];

function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h += name.charCodeAt(i);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name = "") {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

// ─────────────────────────────────────────────────────────────────────────────
// INFO ROW
// ─────────────────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, highlight, isLink }) {
  if (!value) return null;
  return (
    <TouchableOpacity
      style={s.infoRow}
      disabled={!isLink}
      onPress={isLink ? () => Linking.openURL(value).catch(() => {}) : undefined}
      activeOpacity={isLink ? 0.7 : 1}
    >
      <View style={s.infoIcon}>
        <Ionicons name={icon} size={14} color={T.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text
          style={[s.infoValue, highlight && { color: T.accent }, isLink && { color: T.accent }]}
          numberOfLines={isLink ? 1 : 0}
        >
          {value}
        </Text>
      </View>
      {isLink && <Ionicons name="open-outline" size={13} color={T.accent} />}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIVED CARD  (applications to poster's jobs)
// ─────────────────────────────────────────────────────────────────────────────

function ReceivedCard({ item, onUpdateStatus, accepting }) {
  const [open, setOpen] = useState(false);
  const isPending   = item.status === "pending";
  const color       = avatarColor(item.applicant_name);
  const inits       = initials(item.applicant_name);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  const statusColor =
    item.status === "accepted" ? "#10b981" :
    item.status === "rejected" ? "#ef4444" : "#f59e0b";

  return (
    <TouchableOpacity
      style={[s.card, { borderColor: isPending ? T.accent + "55" : T.border }]}
      onPress={toggle}
      activeOpacity={0.85}
    >
      {/* ── Card Header ── */}
      <View style={s.cardTop}>
        <View style={[s.avatar, { backgroundColor: color }]}>
          {item.applicant_avatar_url ? (
            <Image source={{ uri: item.applicant_avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
          ) : (
            <Text style={s.avatarText}>{inits}</Text>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={s.nameText} numberOfLines={1}>{item.applicant_name}</Text>
            {isPending && <View style={s.newDot} />}
          </View>
          <Text style={s.schoolText} numberOfLines={1}>
            {item.school || "No school listed"}
          </Text>
          <Text style={s.jobAppliedText} numberOfLines={1}>
            Applied for:{" "}
            <Text style={{ color: T.accent, fontWeight: "600" }}>{item.job_title}</Text>
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={s.timeText}>{timeAgo(item.created_at)}</Text>
          <View style={[s.statusBadge, { backgroundColor: statusColor + "22" }]}>
            <Text style={[s.statusBadgeText, { color: statusColor }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Expanded Body ── */}
      {open && (
        <View style={[s.expand, { borderTopColor: T.border }]}>

          {/* Applicant details */}
          <Text style={s.expandLabel}>Applicant Details</Text>
          <InfoRow icon="person-outline"   label="Full Name"     value={item.applicant_name} />
          <InfoRow icon="school-outline"   label="School"        value={item.school} />
          <InfoRow icon="cash-outline"     label="Proposed Rate" value={item.proposed_rate} highlight />
          <InfoRow icon="link-outline"     label="Portfolio"     value={item.portfolio_link} isLink />
          <InfoRow icon="calendar-outline" label="Applied"       value={timeAgo(item.created_at)} />
          {item.applicant_rating ? (
            <InfoRow icon="star-outline" label="Applicant Rating" value={`${Number(item.applicant_rating).toFixed(1)} ★`} highlight />
          ) : null}

          {/* Job details */}
          <Text style={[s.expandLabel, { marginTop: 16 }]}>Job Posted</Text>
          <InfoRow icon="briefcase-outline" label="Job Title" value={item.job_title} />
          <InfoRow icon="cash-outline"      label="Budget"    value={item.budget} highlight />
          <InfoRow icon="pricetag-outline"  label="Category"  value={item.category} />

          {/* Action buttons */}
          {isPending ? (
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.actionBtn, s.declineBtn]}
                onPress={() => onUpdateStatus(item, "rejected")}
                disabled={accepting}
              >
                <Ionicons name="close-circle-outline" size={16} color={T.danger} />
                <Text style={s.declineText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.actionBtn, s.acceptBtn, accepting && { opacity: 0.6 }]}
                onPress={() => onUpdateStatus(item, "accepted")}
                disabled={accepting}
              >
                {accepting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                    <Text style={s.acceptText}>Accept & Chat</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[s.resolvedRow, { borderTopColor: T.border }]}>
              <Ionicons
                name={item.status === "accepted" ? "checkmark-done-circle" : "close-circle"}
                size={16}
                color={statusColor}
              />
              <Text style={s.resolvedText}>
                Application{" "}
                <Text style={{ color: statusColor, fontWeight: "700" }}>{item.status}</Text>
              </Text>
              {item.status === "accepted" && (
                <View style={s.chatBadge}>
                  <Ionicons name="chatbubbles-outline" size={11} color={T.accent} />
                  <Text style={s.chatBadgeText}>Chat opened</Text>
                </View>
              )}
            </View>
          )}


        </View>
      )}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SENT CARD  (applications the current user sent)
// ─────────────────────────────────────────────────────────────────────────────

function SentCard({ item, onWithdraw }) {
  const [open, setOpen] = useState(false);

  const statusColor =
    item.status === "accepted" ? "#10b981" :
    item.status === "rejected" ? "#ef4444" : "#f59e0b";
  const statusIcon =
    item.status === "accepted" ? "checkmark-circle" :
    item.status === "rejected" ? "close-circle"     : "time";

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <TouchableOpacity
      style={[s.card, { borderColor: T.border }]}
      onPress={toggle}
      activeOpacity={0.85}
    >
      {/* ── Card Header ── */}
      <View style={s.cardTop}>
        <View style={[s.sentIcon, { backgroundColor: statusColor + "22" }]}>
          <Ionicons name={statusIcon} size={22} color={statusColor} />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.nameText} numberOfLines={1}>{item.job_title || "Job"}</Text>
          <Text style={s.schoolText} numberOfLines={1}>
            {item.poster_name ? `Posted by ${item.poster_name}` : ""}
          </Text>
          <Text style={[s.timeText, { marginTop: 2 }]}>{timeAgo(item.created_at)}</Text>
        </View>

        <View style={[s.statusBadge, { backgroundColor: statusColor + "22" }]}>
          <Text style={[s.statusBadgeText, { color: statusColor }]}>
            {item.status === "rejected" ? "DECLINED" : item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ── Expanded Body ── */}
      {open && (
        <View style={[s.expand, { borderTopColor: T.border }]}>

          <Text style={s.expandLabel}>Your Application</Text>
          <InfoRow icon="person-outline" label="Your Name"     value={item.applicant_name} />
          <InfoRow icon="school-outline" label="Your School"   value={item.school} />
          <InfoRow icon="cash-outline"   label="Proposed Rate" value={item.proposed_rate} highlight />
          <InfoRow icon="link-outline"   label="Portfolio"     value={item.portfolio_link} isLink />

          <Text style={[s.expandLabel, { marginTop: 14 }]}>Job Details</Text>
          <InfoRow icon="briefcase-outline" label="Job Title" value={item.job_title} />
          <InfoRow icon="cash-outline"      label="Budget"    value={item.budget} highlight />
          <InfoRow icon="pricetag-outline"  label="Category"  value={item.category} />

          {/* Status banners */}
          {item.status === "accepted" && (
            <View style={[s.noticeBanner, { backgroundColor: "rgba(16,185,129,0.1)", borderColor: "#10b98144" }]}>
              <Ionicons name="chatbubbles-outline" size={15} color="#10b981" />
              <Text style={[s.noticeText, { color: "#10b981" }]}>
                Accepted! Check your Inbox to start chatting.
              </Text>
            </View>
          )}
          {item.status === "rejected" && (
            <View style={[s.noticeBanner, { backgroundColor: T.dangerBg, borderColor: T.danger + "44" }]}>
              <Ionicons name="information-circle-outline" size={15} color={T.danger} />
              <Text style={[s.noticeText, { color: T.danger }]}>
                This application was declined. Keep going — more opportunities await!
              </Text>
            </View>
          )}
          {item.status === "pending" && (
            <>
              <View style={[s.noticeBanner, { backgroundColor: "rgba(245,158,11,0.08)", borderColor: "#f59e0b44" }]}>
                <Ionicons name="time-outline" size={15} color="#f59e0b" />
                <Text style={[s.noticeText, { color: "#f59e0b" }]}>
                  Awaiting review. You'll be notified when accepted.
                </Text>
              </View>
              <TouchableOpacity
                style={s.withdrawBtn}
                onPress={() => onWithdraw(item)}
              >
                <Ionicons name="close-circle-outline" size={15} color={T.danger} />
                <Text style={s.withdrawText}>Withdraw Application</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ icon, title, sub }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={40} color={T.textFaint} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySub}>{sub}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function NotificationsScreen({ navigation }) {
  const { user } = useUser();

  const [activeTab,  setActiveTab]  = useState("received");
  const [received,   setReceived]   = useState([]);
  const [sent,       setSent]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting,  setAccepting]  = useState(false);

  // ── Fetch all data ──────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }

    try {
      // ── RECEIVED: applications to jobs I posted ──
      const { data: myJobs } = await supabase
        .from("jobs")
        .select("id, title, budget, category, poster_name, avatar")
        .eq("user_id", user.id);

      if (myJobs?.length) {
        const jobIds = myJobs.map((j) => j.id);
        const jobMap = Object.fromEntries(
          myJobs.map((j) => [j.id, {
            title:       j.title,
            budget:      j.budget,
            category:    j.category,
            poster_name: j.poster_name,
            avatar:      j.avatar,
          }])
        );

        const { data: recvData } = await supabase
          .from("applications")
          .select("id, applicant_name, school, message, proposed_rate, portfolio_link, status, created_at, job_id, applicant_id")
          .in("job_id", jobIds)
          .order("created_at", { ascending: false });

        // Fetch applicant avatars and ratings
        const applicantIds = [...new Set((recvData || []).map(a => a.applicant_id).filter(Boolean))];
        let applicantAvatarMap = {};
        if (applicantIds.length > 0) {
          const { data: applicantUsers } = await supabase
            .from("users")
            .select("id, image_url, rating")
            .in("id", applicantIds);
          if (applicantUsers) {
            applicantUsers.forEach(u => {
              applicantAvatarMap[u.id] = u.image_url;
              applicantAvatarMap[`rating_${u.id}`] = u.rating || null;
            });
          }
        }

        setReceived(
          (recvData || []).map((a) => ({
            ...a,
            job_title:            jobMap[a.job_id]?.title       || "Job",
            budget:               jobMap[a.job_id]?.budget       || null,
            category:             jobMap[a.job_id]?.category     || null,
            poster_name:          jobMap[a.job_id]?.poster_name  || null,
            applicant_avatar_url: applicantAvatarMap[a.applicant_id] ?? null,
            applicant_rating:     applicantAvatarMap[`rating_${a.applicant_id}`] ?? null,
          }))
        );
      } else {
        setReceived([]);
      }

      // ── SENT: applications I submitted ──
      const { data: sentData } = await supabase
        .from("applications")
        .select("id, applicant_name, school, message, proposed_rate, portfolio_link, status, created_at, job_id")
        .eq("applicant_id", user.id)
        .order("created_at", { ascending: false });

      if (sentData?.length) {
        const sentJobIds = [...new Set(sentData.map((a) => a.job_id).filter(Boolean))];
        const { data: sentJobs } = await supabase
          .from("jobs")
          .select("id, title, budget, category, poster_name")
          .in("id", sentJobIds);

        const sentJobMap = Object.fromEntries((sentJobs || []).map((j) => [j.id, j]));

        setSent(
          sentData.map((a) => ({
            ...a,
            job_title:   sentJobMap[a.job_id]?.title       || "Job",
            budget:      sentJobMap[a.job_id]?.budget       || null,
            category:    sentJobMap[a.job_id]?.category     || null,
            poster_name: sentJobMap[a.job_id]?.poster_name  || null,
          }))
        );
      } else {
        setSent([]);
      }
    } catch (err) {
      console.error("NotificationsScreen fetchAll error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Live updates
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("notifs-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id, fetchAll]);

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  // ── Accept / Decline ────────────────────────────────────────────────────────

  const handleUpdateStatus = async (application, newStatus) => {
    if (accepting) return;

    // ── Decline (fast path) ──
    if (newStatus === "rejected") {
      const { error } = await supabase
        .from("applications")
        .update({ status: "rejected" })
        .eq("id", application.id);

      if (error) {
        Alert.alert("Error", "Could not decline application. Please try again.");
        return;
      }
      setReceived((p) =>
        p.map((a) => (a.id === application.id ? { ...a, status: "rejected" } : a))
      );
      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
      return;
    }

    // ── Accept ──
    setAccepting(true);
    try {
      // 1. Mark application as accepted
      const { error: updateErr } = await supabase
        .from("applications")
        .update({ status: "accepted" })
        .eq("id", application.id);
      if (updateErr) throw updateErr;

      // 2. Resolve poster name
      const posterName =
        application.poster_name ||
        user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] ||
        "Poster";

      // 3. Check for existing conversation
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("job_id",      application.job_id)
        .eq("applicant_id", application.applicant_id)
        .eq("poster_id",   user.id)
        .maybeSingle();

      let convId = existingConv?.id ?? null;

      if (!convId) {
        // 4. Create conversation
        //    conversations.status CHECK: 'pending' | 'accepted' | 'declined'
        const initMsg = `Hi ${application.applicant_name}! I've reviewed your application for "${application.job_title}" and I'd like to move forward. Let's chat!`;

        const { data: conv, error: convErr } = await supabase
          .from("conversations")
          .insert({
            type:             "job",
            job_id:           application.job_id,
            job_title:        application.job_title,
            user_a:           user.id,
            user_b:           application.applicant_id,
            applicant_id:     application.applicant_id,
            applicant_name:   application.applicant_name,
            applicant_avatar: application.applicant_name?.[0]?.toUpperCase() ?? "A",
            poster_id:        user.id,
            poster_name:      posterName,
            poster_avatar:    posterName[0]?.toUpperCase() ?? "P",
            last_message:     initMsg,
            last_message_at:  new Date().toISOString(),
            updated_at:       new Date().toISOString(),
            unread:           true,
            status:           "accepted",   // ← matches CHECK constraint
          })
          .select("id")
          .single();

        if (convErr) throw convErr;
        convId = conv.id;

        // 5. Insert opening message
        const { error: msgErr } = await supabase.from("messages").insert({
          conversation_id: convId,
          sender_id:       user.id,
          sender_name:     posterName,
          text:            initMsg,
          created_at:      new Date().toISOString(),
        });
        if (msgErr) console.warn("Opening message insert failed (non-fatal):", msgErr.message);
      }

      // 6. Optimistic UI update
      setReceived((p) =>
        p.map((a) => (a.id === application.id ? { ...a, status: "accepted" } : a))
      );
      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);

      // 7. Navigate to chat
      if (convId) {
        navigation.navigate("MessageThread", {
          conversation: {
            id:             convId,
            name:           application.applicant_name,
            avatar:         application.applicant_name?.[0]?.toUpperCase() ?? "A",
            otherAvatarUrl: application.applicant_avatar_url ?? null,
            online:         false,
            title:          application.job_title,
            type:           "job",
            poster_id:      user.id,
            status:         "accepted",
          },
        });
      }
    } catch (err) {
      console.error("Accept error:", err.message);
      Alert.alert("Error", err.message ?? "Could not accept application. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  // ── Withdraw ────────────────────────────────────────────────────────────────

  const handleWithdraw = (app) => {
    Alert.alert(
      "Withdraw Application",
      `Withdraw your application for "${app.job_title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("applications")
              .delete()
              .eq("id", app.id);

            if (error) {
              Alert.alert("Error", "Could not withdraw application.");
              return;
            }
            setSent((p) => p.filter((a) => a.id !== app.id));
            LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
          },
        },
      ]
    );
  };

  // ── Derived counts ──────────────────────────────────────────────────────────

  const pendingReceived = received.filter((a) => a.status === "pending").length;
  const pendingSent     = sent.filter((a)     => a.status === "pending").length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={T.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.headerTitle}>Notifications</Text>
          <Text style={s.headerSub}>
            {loading ? "Loading…" : `${pendingReceived + pendingSent} pending`}
          </Text>
        </View>
        <TouchableOpacity onPress={fetchAll} hitSlop={10}>
          <Ionicons name="refresh-outline" size={22} color={T.accent} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {[
          { id: "received", label: "Received", count: pendingReceived, icon: "arrow-down-circle-outline" },
          { id: "sent",     label: "Sent",     count: pendingSent,     icon: "arrow-up-circle-outline"   },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[s.tab, active && s.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons name={tab.icon} size={15} color={active ? T.accent : T.textFaint} />
              <Text style={[s.tabText, active && { color: T.accent }]}>{tab.label}</Text>
              {tab.count > 0 && (
                <View style={s.tabBadge}>
                  <Text style={s.tabBadgeText}>{tab.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : activeTab === "received" ? (
        <FlatList
          data={received}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />
          }
          renderItem={({ item }) => (
            <ReceivedCard
              item={item}
              onUpdateStatus={handleUpdateStatus}
              accepting={accepting}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="mail-unread-outline"
              title="No applications yet"
              sub="When students apply to your jobs, they'll appear here."
            />
          }
        />
      ) : (
        <FlatList
          data={sent}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />
          }
          renderItem={({ item }) => (
            <SentCard item={item} onWithdraw={handleWithdraw} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="send-outline"
              title="No applications sent"
              sub="Apply to a job from the Jobs tab to see your submissions here."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: T.bg2,
    borderWidth: 1,
    borderColor: T.border,
  },
  headerTitle: { color: T.text,      fontSize: 20, fontWeight: "900" },
  headerSub:   { color: T.textMuted, fontSize: 12, marginTop: 1 },

  // Tabs
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: T.border },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive:     { borderBottomColor: T.accent },
  tabText:       { fontSize: 14, fontWeight: "700", color: T.textMuted },
  tabBadge:      { backgroundColor: T.accent, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  tabBadgeText:  { color: "white", fontSize: 11, fontWeight: "800" },

  listContent: { padding: 16, paddingBottom: 40 },

  // Card
  card: {
    backgroundColor: T.card,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", padding: 14 },

  avatar:     { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "white", fontWeight: "800", fontSize: 18 },
  sentIcon:   { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },

  newDot:         { width: 7, height: 7, borderRadius: 4, backgroundColor: T.accent },
  nameText:       { fontSize: 15, fontWeight: "700", color: T.text, marginBottom: 2 },
  schoolText:     { fontSize: 12, color: T.textMuted, marginBottom: 2 },
  jobAppliedText: { fontSize: 12, color: T.textFaint },
  timeText:       { fontSize: 11, color: T.textFaint },

  statusBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusBadgeText: { fontSize: 10, fontWeight: "900" },

  // Expanded section
  expand: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 4,
  },
  expandLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: T.accent,
    marginBottom: 8,
  },

  // Info row
  infoRow:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  infoIcon:  {
    width: 30, height: 30, borderRadius: 8,
    justifyContent: "center", alignItems: "center",
    backgroundColor: T.accentBg,
  },
  infoLabel: {
    fontSize: 10, fontWeight: "600", textTransform: "uppercase",
    letterSpacing: 0.3, marginBottom: 1, color: T.textFaint,
  },
  infoValue: { fontSize: 13, color: T.textSub },

  // Cover message
  msgBlock: { marginTop: 4, marginBottom: 4 },
  msgLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6, color: T.textFaint },
  msgBox:   { padding: 12, borderRadius: 10, borderWidth: 1, backgroundColor: T.bg, borderColor: T.border },
  msgText:  { fontSize: 13, lineHeight: 19, color: T.textSub },
  noMsg:    { fontSize: 12, fontStyle: "italic", color: T.textFaint },

  // Action buttons (received)
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", paddingVertical: 12,
    borderRadius: 12, gap: 6, borderWidth: 1,
  },
  acceptBtn:  { backgroundColor: T.accent, borderColor: T.accent },
  declineBtn: { borderColor: T.danger + "44", backgroundColor: T.dangerBg },
  acceptText: { color: "white",  fontWeight: "700", fontSize: 13 },
  declineText:{ color: T.danger, fontWeight: "700", fontSize: 13 },

  // Resolved row
  resolvedRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, flexWrap: "wrap",
  },
  resolvedText: { fontSize: 12, fontStyle: "italic", color: T.textMuted },
  chatBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
    backgroundColor: T.accentBg, borderColor: T.accent + "44",
  },
  chatBadgeText: { fontSize: 10, fontWeight: "700", color: T.accent },

  // Notice banner (sent)
  noticeBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 12,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },

  // Withdraw button
  withdrawBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginTop: 10,
    borderColor: T.danger + "44", backgroundColor: T.dangerBg,
  },
  withdrawText: { fontSize: 13, fontWeight: "700", color: T.danger },

  // Empty state
  empty: { alignItems: "center", paddingTop: 70, gap: 12, paddingHorizontal: 30 },
  emptyIcon: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, backgroundColor: T.bg2, borderColor: T.border,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: T.textSub },
  emptySub:   { fontSize: 13, textAlign: "center", lineHeight: 20, color: T.textFaint },
});