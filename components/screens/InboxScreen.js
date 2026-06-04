import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";

const FILTER_TABS = [
  { id: "all",    label: "All Messages" },
  { id: "unread", label: "Unread"       },
  { id: "jobs",   label: "Jobs"         },
  { id: "gigs",   label: "Gigs"         },
];

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diffMins = Math.floor((new Date() - new Date(dateStr)) / 60000);
  if (diffMins < 1)   return "just now";
  if (diffMins < 60)  return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)   return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

export default function InboxScreen({ navigation }) {
  const { user } = useUser();

  const [conversations, setConversations] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [activeTab,     setActiveTab]     = useState("all");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [fetchError,    setFetchError]    = useState(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setFetchError(null);

    try {
      const [asApplicant, asPoster] = await Promise.all([
        supabase
          .from("conversations")
          .select(`
            id, updated_at, last_message, unread, type, status,
            job_id, gig_id, applicant_id, applicant_name, applicant_avatar,
            poster_id, poster_name, poster_avatar, job_title, gig_title
          `)
          .eq("applicant_id", user.id)
          .order("updated_at", { ascending: false }),

        supabase
          .from("conversations")
          .select(`
            id, updated_at, last_message, unread, type, status,
            job_id, gig_id, applicant_id, applicant_name, applicant_avatar,
            poster_id, poster_name, poster_avatar, job_title, gig_title
          `)
          .eq("poster_id", user.id)
          .order("updated_at", { ascending: false }),
      ]);

      if (asApplicant.error) throw asApplicant.error;
      if (asPoster.error)    throw asPoster.error;

      const merged = [
        ...(asApplicant.data ?? []),
        ...(asPoster.data   ?? []),
      ];

      const seen   = new Set();
      const deduped = merged.filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      deduped.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

      // Fetch real avatars for all conversation participants
      const allUserIds = [...new Set([
        ...deduped.map(c => c.applicant_id),
        ...deduped.map(c => c.poster_id),
      ].filter(Boolean))];

      let avatarMap = {};
      if (allUserIds.length > 0) {
        const { data: avatarUsers } = await supabase
          .from("users")
          .select("id, image_url")
          .in("id", allUserIds);
        if (avatarUsers) {
          avatarUsers.forEach(u => { avatarMap[u.id] = u.image_url; });
        }
      }

      setConversations(deduped.map(c => ({
        ...c,
        applicant_avatar_url: avatarMap[c.applicant_id] ?? null,
        poster_avatar_url:    avatarMap[c.poster_id]    ?? null,
      })));
    } catch (err) {
      console.error("InboxScreen fetch error:", err.message);
      setFetchError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    fetchConversations();
  }, [fetchConversations]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`inbox-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => fetchConversations()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchConversations, user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getOtherParty = (conv) => {
    const isApplicant = conv.applicant_id === user?.id;
    return {
      name:      isApplicant ? conv.poster_name      : conv.applicant_name,
      avatar:    isApplicant ? conv.poster_avatar     : conv.applicant_avatar,
      avatarUrl: isApplicant ? conv.poster_avatar_url : conv.applicant_avatar_url,
    };
  };

  const getConvTitle = (conv) => conv.job_title || conv.gig_title || "Conversation";

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = conversations.filter((c) => {
    const other = getOtherParty(c);
    if (activeTab === "unread" && !c.unread)        return false;
    if (activeTab === "jobs"   && c.type !== "job") return false;
    if (activeTab === "gigs"   && c.type !== "gig") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        other.name?.toLowerCase().includes(q) ||
        getConvTitle(c).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unreadCount = conversations.filter((c) => c.unread).length;

  const getEmptyMessage = () => {
    if (searchQuery)            return "No results found. Try a different search term.";
    if (activeTab === "unread") return "You're all caught up! No unread messages.";
    if (activeTab === "jobs")   return "No job conversations yet.";
    if (activeTab === "gigs")   return "No gig conversations yet.";
    return "Apply to a job or gig to start a conversation!";
  };

  // ── Open conversation ─────────────────────────────────────────────────────

const openConversation = (conv) => {
  const other    = getOtherParty(conv);
  const title    = getConvTitle(conv);
  const initials = (other.name?.[0] || "?").toUpperCase();

  // Navigate first — nothing blocks this
  navigation.navigate("MessageThread", {
    conversation: {
      id:             conv.id,
      name:           other.name,
      avatar:         initials,
      otherAvatarUrl: other.avatarUrl ?? null,
      online:         false,
      title,
      type:           conv.type,
      poster_id:      conv.poster_id,
      status:         conv.status,
    },
  });

  // Mark as read after (fire-and-forget)
  if (conv.unread) {
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread: false } : c))
    );
    supabase
      .from("conversations")
      .update({ unread: false })
      .eq("id", conv.id)
      .then(({ error }) => {
        if (error) console.warn("Mark-read error:", error.message);
      });
  }
};

  // ── Render card ───────────────────────────────────────────────────────────

  const renderCard = (conv) => {
    const other    = getOtherParty(conv);
    const title    = getConvTitle(conv);
    const initials = (other.name?.[0] || "?").toUpperCase();

    return (
      <TouchableOpacity
        key={conv.id}
        style={[styles.messageCard, conv.unread && styles.messageCardUnread]}
        activeOpacity={0.7}
        onPress={() => openConversation(conv)}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, conv.unread && styles.avatarUnread]}>
            {other.avatarUrl ? (
              <Image source={{ uri: other.avatarUrl }} style={{ width: 52, height: 52, borderRadius: 26 }} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <View style={[
            styles.typeBadge,
            conv.type === "job" ? styles.typeBadgeJob : styles.typeBadgeGig,
          ]}>
            <Ionicons
              name={conv.type === "job" ? "briefcase" : "storefront"}
              size={8}
              color="white"
            />
          </View>
        </View>

        {/* Content */}
        <View style={styles.messageContent}>
          <View style={styles.messageHeader}>
            <Text
              style={[styles.messageName, conv.unread && styles.messageNameUnread]}
              numberOfLines={1}
            >
              {other.name}
            </Text>
            <Text style={styles.messageTime}>{timeAgo(conv.updated_at)}</Text>
          </View>

          <View style={styles.contextRow}>
            <Ionicons
              name={conv.type === "job" ? "briefcase-outline" : "storefront-outline"}
              size={11}
              color="#7c3aed"
            />
            <Text style={styles.contextLabel} numberOfLines={1}>{title}</Text>
          </View>

          <Text
            style={[styles.messagePreview, conv.unread && styles.messagePreviewUnread]}
            numberOfLines={2}
          >
            {conv.last_message || "No messages yet — say hello!"}
          </Text>
        </View>

        {/* Unread dot */}
        {conv.unread && (
          <View style={styles.unreadIndicator}>
            <View style={styles.unreadDot} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Inbox</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => fetchConversations()}
          >
            <Ionicons name="refresh-outline" size={20} color="#a78bfa" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#6b7280" />
          <TextInput
            placeholder="Search conversations..."
            placeholderTextColor="#6b7280"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.6}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
            bounces={false}
          >
            {FILTER_TABS.map((tab, index) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.filterTab,
                  activeTab === tab.id && styles.filterTabActive,
                  index === FILTER_TABS.length - 1 && styles.filterTabLast,
                ]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.7}
              >
                {tab.id === "jobs" && (
                  <Ionicons
                    name="briefcase-outline"
                    size={12}
                    color={activeTab === tab.id ? "#fff" : "#6b7280"}
                    style={{ marginRight: 5 }}
                  />
                )}
                {tab.id === "gigs" && (
                  <Ionicons
                    name="storefront-outline"
                    size={12}
                    color={activeTab === tab.id ? "#fff" : "#6b7280"}
                    style={{ marginRight: 5 }}
                  />
                )}
                <Text style={[styles.filterText, activeTab === tab.id && styles.filterTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Error banner */}
        {fetchError && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color="#f87171" />
            <Text style={styles.errorText} numberOfLines={2}>{fetchError}</Text>
            <TouchableOpacity onPress={fetchConversations}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Conversations list */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={styles.loadingText}>Loading conversations…</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messagesList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#7c3aed"
                colors={["#7c3aed"]}
              />
            }
          >
            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrapper}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#374151" />
                </View>
                <Text style={styles.emptyTitle}>No conversations</Text>
                <Text style={styles.emptySub}>{getEmptyMessage()}</Text>
                <TouchableOpacity
                  style={styles.browseBtn}
                  onPress={() => navigation.navigate("Jobs")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="briefcase-outline" size={15} color="white" />
                  <Text style={styles.browseBtnText}>Browse Jobs</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filtered.map(renderCard)
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: "#050914" },
  container: { flex: 1, paddingTop: 56 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  title: {
    fontSize: 32,
    color: "#ffffff",
    fontWeight: "900",
    letterSpacing: -1,
    marginRight: 12,
  },
  unreadBadge: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    minWidth: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  iconBtn: {
    backgroundColor: "#111827",
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },

  searchBox: {
    flexDirection: "row",
    backgroundColor: "#0f1629",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
    marginLeft: 12,
  },

  filterSection: { marginBottom: 24 },
  filterScroll:  { paddingLeft: 20, paddingRight: 20 },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f1629",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#1e2d4a",
    marginRight: 10,
  },
  filterTabLast:    { marginRight: 0 },
  filterTabActive:  { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  filterText:       { color: "#6b7280", fontSize: 14, fontWeight: "600" },
  filterTextActive: { color: "#ffffff", fontWeight: "700" },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  errorText: { flex: 1, color: "#f87171", fontSize: 12 },
  retryText: { color: "#a78bfa", fontSize: 12, fontWeight: "700" },

  loadingWrap: { alignItems: "center", paddingTop: 60, gap: 12 },
  loadingText: { color: "#6b7280", fontSize: 14 },

  messagesList: { paddingBottom: 24 },

  messageCard: {
    flexDirection: "row",
    backgroundColor: "#0f1629",
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1e2d4a",
    alignItems: "flex-start",
  },
  messageCardUnread: { backgroundColor: "#111827", borderColor: "#2d1f52" },

  avatarContainer: { position: "relative", marginRight: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1e1344",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#1e2d4a",
  },
  avatarUnread: { backgroundColor: "#7c3aed", borderColor: "#9333ea" },
  avatarText:   { color: "#ffffff", fontWeight: "800", fontSize: 20 },

  typeBadge: {
    position: "absolute",
    bottom: -2, right: -2,
    width: 18, height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#050914",
  },
  typeBadgeJob: { backgroundColor: "#2563eb" },
  typeBadgeGig: { backgroundColor: "#059669" },

  messageContent: { flex: 1, paddingTop: 2 },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  messageName: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  messageNameUnread: { color: "#ffffff", fontWeight: "700" },
  messageTime:       { color: "#6b7280", fontSize: 12, fontWeight: "500" },

  contextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  contextLabel: { color: "#7c3aed", fontSize: 11, fontWeight: "600", flex: 1 },

  messagePreview:       { color: "#6b7280", fontSize: 14, lineHeight: 20 },
  messagePreviewUnread: { color: "#9ca3af", fontWeight: "500" },

  unreadIndicator: { paddingTop: 4, paddingLeft: 12 },
  unreadDot: {
    width: 10, height: 10,
    borderRadius: 5,
    backgroundColor: "#7c3aed",
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconWrapper: {
    width: 96, height: 96,
    borderRadius: 48,
    backgroundColor: "#0f1629",
    borderWidth: 1,
    borderColor: "#1e2d4a",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: { color: "#e5e7eb", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptySub:   { color: "#6b7280", fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#7c3aed",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
  },
  browseBtnText: { color: "white", fontWeight: "700", fontSize: 14 },
});