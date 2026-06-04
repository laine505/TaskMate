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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diffMins = Math.floor((new Date() - new Date(dateStr)) / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

const AVATAR_COLORS = ["#7c3aed", "#0891b2", "#059669", "#dc2626", "#d97706", "#be185d", "#2563eb"];

function getAvatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name = "") {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

// ── Application Card Component ──────────────────────────────────────────

function ApplicationCard({ item, onUpdateStatus, accepting }) {
  const [expanded, setExpanded] = useState(false);
  const avatarColor = getAvatarColor(item.applicant_name);
  const initials = getInitials(item.applicant_name);
  const isPending = item.status === "pending";

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <TouchableOpacity
      style={[styles.card, isPending && styles.cardNew]}
      onPress={toggle}
      activeOpacity={0.85}
    >
      <View style={styles.cardTop}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* Mid Content */}
        <View style={styles.cardMid}>
          <View style={styles.nameRow}>
            <Text style={styles.applicantName} numberOfLines={1}>{item.applicant_name}</Text>
            {isPending && <View style={styles.newDot} />}
          </View>
          <Text style={styles.school} numberOfLines={1}>{item.school || "No school listed"}</Text>
          <Text style={styles.jobTitle} numberOfLines={1}>
            Applied for: <Text style={styles.jobTitleBold}>{item.job_title}</Text>
          </Text>
        </View>

        {/* Right Content / Status */}
        <View style={styles.cardRight}>
          <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
          <View style={[
            styles.statusBadge,
            item.status === "accepted" ? styles.statusAccepted :
            item.status === "rejected" ? styles.statusRejected : null,
          ]}>
            <Text style={styles.statusBadgeText}>{item.status}</Text>
          </View>
        </View>
      </View>

      {expanded && (
        <View style={styles.expandBody}>
          <View style={styles.divider} />

          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Cover Message</Text>
            <Text style={styles.detailValue}>{item.message || "No message provided."}</Text>
          </View>

          {item.proposed_rate ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Proposed Rate</Text>
              <Text style={styles.detailValue}>{item.proposed_rate}</Text>
            </View>
          ) : null}

          {item.portfolio_link ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Portfolio / Link</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{item.portfolio_link}</Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          {isPending ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.declineBtn]}
                onPress={() => onUpdateStatus(item, "rejected")}
                disabled={accepting}
              >
                <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn, accepting && { opacity: 0.6 }]}
                onPress={() => onUpdateStatus(item, "accepted")}
                disabled={accepting}
              >
                {accepting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                    <Text style={styles.acceptText}>Accept & Chat</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.decisionRow}>
              <Ionicons
                name={item.status === "accepted" ? "checkmark-done" : "close-circle"}
                size={16}
                color="#4b5563"
              />
              <Text style={styles.decisionText}>
                Application has been <Text style={{ fontWeight: "700" }}>{item.status}</Text>
              </Text>
              {item.status === "accepted" && (
                <View style={styles.chatOpenedBadge}>
                  <Ionicons name="chatbubbles-outline" size={11} color="#a78bfa" />
                  <Text style={styles.chatOpenedText}>Chat opened</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────

export default function NotificationsScreen({ navigation }) {
  const { user } = useUser();
  const [applications, setApplications] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [accepting,    setAccepting]    = useState(false); // prevents double-tap

  const fetchApplications = useCallback(async () => {
    if (!user?.id) return;

    try {
      // 1. Get poster's jobs
      const { data: myJobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id, title, user_id, poster_name, avatar")
        .eq("user_id", user.id);

      if (jobsError) throw jobsError;

      if (!myJobs || myJobs.length === 0) {
        setApplications([]);
        return;
      }

      const jobMap = Object.fromEntries(
        myJobs.map((j) => [j.id, { title: j.title, user_id: j.user_id, poster_name: j.poster_name, avatar: j.avatar }])
      );
      const jobIds = myJobs.map((j) => j.id);

      // 2. Get applications for those jobs
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched = (data || []).map((app) => ({
        ...app,
        job_title:   jobMap[app.job_id]?.title       ?? "Job Post",
        job_user_id: jobMap[app.job_id]?.user_id     ?? null,
        poster_name: jobMap[app.job_id]?.poster_name ?? null,
        poster_avatar: jobMap[app.job_id]?.avatar    ?? null,
      }));

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setApplications(enriched);
    } catch (err) {
      console.error("Fetch Error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // ── Accept / Decline ─────────────────────────────────────────────────────

  const handleUpdateStatus = async (application, newStatus) => {
    if (accepting) return;

    if (newStatus === "rejected") {
      // Simple decline — just update status
      try {
        const { error } = await supabase
          .from("applications")
          .update({ status: "rejected" })
          .eq("id", application.id);
        if (error) throw error;

        setApplications((prev) =>
          prev.map((a) => (a.id === application.id ? { ...a, status: "rejected" } : a))
        );
        LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
      } catch (err) {
        Alert.alert("Error", "Could not decline application.");
        console.error(err);
      }
      return;
    }

    setAccepting(true);
    try {
      // 1. Update application status
      const { error: updateError } = await supabase
        .from("applications")
        .update({ status: "accepted" })
        .eq("id", application.id);
      if (updateError) throw updateError;

      // 2. Check if a conversation already exists for this pair + job
      let convId = null;

      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("job_id", application.job_id)
        .eq("applicant_id", application.applicant_id)
        .eq("poster_id", user.id)
        .maybeSingle();

      if (existing) {
        convId = existing.id;
      } else {
        // 3. Create the conversation
        const posterAvatar =
          application.poster_avatar ??
          application.poster_name?.[0]?.toUpperCase() ??
          user?.user_metadata?.full_name?.[0]?.toUpperCase() ??
          "P";

        const applicantAvatar =
          application.applicant_name?.[0]?.toUpperCase() ?? "A";

        const initMsg = `Hi ${application.applicant_name}! I've reviewed your application for "${application.job_title}" and I'd like to move forward. Let's chat!`;

        const { data: conv, error: convError } = await supabase
          .from("conversations")
          .insert({
            type:             "job",
            job_id:           application.job_id,
            job_title:        application.job_title,
            user_a:           user.id,
            user_b:           application.applicant_id ?? user.id,
            applicant_id:     application.applicant_id,
            applicant_name:   application.applicant_name,
            applicant_avatar: applicantAvatar,
            poster_id:        user.id,
            poster_name:      application.poster_name ?? user?.user_metadata?.full_name ?? "Poster",
            poster_avatar:    posterAvatar,
            last_message:     initMsg,
            last_message_at:  new Date().toISOString(),
            unread:           true,
          })
          .select("id")
          .single();

        if (convError) throw convError;
        convId = conv.id;

        // 4. Insert the opening message
        await supabase.from("messages").insert({
          conversation_id: convId,
          sender_id:       user.id,
          sender_name:     application.poster_name ?? user?.user_metadata?.full_name ?? "Poster",
          text:            initMsg,
        });
      }

      // 5. Optimistic UI update
      setApplications((prev) =>
        prev.map((a) => (a.id === application.id ? { ...a, status: "accepted" } : a))
      );
      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);

      // 6. Navigate to the chat thread
      navigation.navigate("MessageThread", {
        conversation: {
          id:        convId,
          name:      application.applicant_name,
          avatar:    application.applicant_name?.[0]?.toUpperCase() ?? "A",
          online:    false,
          title:     application.job_title,
          type:      "job",
          poster_id: user.id,
        },
      });
    } catch (err) {
      Alert.alert("Error", "Could not accept application. Please try again.");
      console.error("Accept error:", err.message);
    } finally {
      setAccepting(false);
    }
  };

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("apps-live")
      .on("postgres_changes", { event: "*", table: "applications" }, fetchApplications)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id, fetchApplications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchApplications();
  };

  const pendingCount = applications.filter((a) => a.status === "pending").length;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Applications</Text>
          <Text style={styles.headerSub}>
            {loading
              ? "Updating..."
              : `${applications.length} total${pendingCount > 0 ? ` · ${pendingCount} pending` : ""}`}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ApplicationCard
              item={item}
              onUpdateStatus={handleUpdateStatus}
              accepting={accepting}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="mail-unread-outline" size={48} color="#1a2540" />
              <Text style={styles.emptyTitle}>No applications yet</Text>
              <Text style={styles.emptySub}>You haven't received any applicants yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#0d1527",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#0b1120", borderWidth: 1, borderColor: "#1a2540",
    justifyContent: "center", alignItems: "center",
  },
  headerCenter: { alignItems: "center" },
  headerTitle:  { color: "white", fontSize: 18, fontWeight: "800" },
  headerSub:    { color: "#4b5563", fontSize: 12 },

  listContent: { padding: 20, paddingBottom: 40 },

  card: {
    backgroundColor: "#0b1120", borderRadius: 16, padding: 15,
    marginBottom: 12, borderWidth: 1, borderColor: "#1a2540",
  },
  cardNew: { borderColor: "rgba(124,58,237,0.4)" },
  cardTop: { flexDirection: "row", gap: 12 },

  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "white", fontWeight: "bold", fontSize: 16 },

  cardMid: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  applicantName: { color: "white", fontWeight: "700", fontSize: 15 },
  newDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#7c3aed" },
  school:       { color: "#6b7280", fontSize: 12, marginVertical: 2 },
  jobTitle:     { color: "#9ca3af", fontSize: 12 },
  jobTitleBold: { color: "#a78bfa", fontWeight: "600" },

  cardRight:   { alignItems: "flex-end" },
  timeAgo:     { color: "#374151", fontSize: 10, marginBottom: 4 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "#1f2937" },
  statusAccepted:    { backgroundColor: "#065f46" },
  statusRejected:    { backgroundColor: "#7f1d1d" },
  statusBadgeText:   { color: "white", fontSize: 9, fontWeight: "900", textTransform: "uppercase" },

  expandBody: { marginTop: 15 },
  divider:    { height: 1, backgroundColor: "#1a2540", marginBottom: 15 },
  detailBlock:  { marginBottom: 12 },
  detailLabel:  { color: "#4b5563", fontSize: 11, fontWeight: "bold", marginBottom: 4 },
  detailValue:  { color: "#d1d5db", fontSize: 13, lineHeight: 18 },

  actionRow: { flexDirection: "row", gap: 12, marginTop: 10 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12, borderRadius: 12, gap: 8, borderWidth: 1,
  },
  acceptBtn:   { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  declineBtn:  { backgroundColor: "transparent", borderColor: "#374151" },
  acceptText:  { color: "white", fontWeight: "700", fontSize: 14 },
  declineText: { color: "#ef4444", fontWeight: "700", fontSize: 14 },

  decisionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" },
  decisionText: { color: "#4b5563", fontSize: 12, fontStyle: "italic" },
  chatOpenedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(124,58,237,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.25)",
  },
  chatOpenedText: { color: "#a78bfa", fontSize: 10, fontWeight: "700" },

  center:     { flex: 1, justifyContent: "center", alignItems: "center" },
  empty:      { flex: 1, alignItems: "center", marginTop: 100 },
  emptyTitle: { color: "#4b5563", fontSize: 16, fontWeight: "bold", marginTop: 10 },
  emptySub:   { color: "#1a2540", textAlign: "center", marginTop: 5, maxWidth: 200 },
});