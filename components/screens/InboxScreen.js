import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl,
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

  const fetchConversations = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setFetchError(null);

    try {
      // 1. Fetch Conversations
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .or(`applicant_id.eq.${user.id},poster_id.eq.${user.id}`)
        .order("updated_at", { ascending: false });

      if (convError) throw convError;

      // 2. Fetch Application Statuses for these conversations
      // We map the IDs to get the related application statuses
      const jobIds = convData.map(c => c.job_id).filter(Boolean);
      const gigIds = convData.map(c => c.gig_id).filter(Boolean);

      const { data: appData, error: appError } = await supabase
        .from("applications")
        .select("job_id, gig_id, status")
        .or(`job_id.in.(${jobIds.join(",")}),gig_id.in.(${gigIds.join(",")})`)
        .eq("applicant_id", user.id); 
        // Note: Logic assumes current user is the applicant to see status. 
        // If you are the poster, you'd remove the .eq('applicant_id') filter.

      // 3. Merge status into conversations
      const enriched = convData.map(conv => {
        const matchingApp = appData?.find(app => 
          (conv.job_id && app.job_id === conv.job_id) || 
          (conv.gig_id && app.gig_id === conv.gig_id)
        );
        return { ...conv, appStatus: matchingApp?.status || null };
      });

      setConversations(enriched);
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

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`inbox-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchConversations())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "applications" }, () => fetchConversations())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchConversations, user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const getOtherParty = (conv) => {
    const isApplicant = conv.applicant_id === user?.id;
    return {
      name:   isApplicant ? conv.poster_name   : conv.applicant_name,
      avatar: isApplicant ? conv.poster_avatar : conv.applicant_avatar,
    };
  };

  const getConvTitle = (conv) => conv.job_title || conv.gig_title || "Conversation";

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

  const renderCard = (conv) => {
    const other    = getOtherParty(conv);
    const title    = getConvTitle(conv);
    const initials = (other.name?.[0] || "?").toUpperCase();
    const status   = conv.appStatus;

    return (
      <TouchableOpacity
        key={conv.id}
        style={[styles.messageCard, conv.unread && styles.messageCardUnread]}
        onPress={() => navigation.navigate("MessageThread", { 
          conversation: { ...conv, name: other.name, title } 
        })}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, conv.unread && styles.avatarUnread]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>

        <View style={styles.messageContent}>
          <View style={styles.messageHeader}>
            <Text style={styles.messageName} numberOfLines={1}>{other.name}</Text>
            {status && (
              <View style={[styles.statusBadge, status === 'accepted' ? styles.statusAccepted : styles.statusPending]}>
                <Text style={styles.statusBadgeText}>{status.toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.messageTime}>{timeAgo(conv.updated_at)}</Text>
          </View>
          <Text style={styles.contextLabel}>{title}</Text>
          <Text style={styles.messagePreview} numberOfLines={1}>
            {conv.last_message || "No messages yet"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Inbox</Text>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#6b7280" />
          <TextInput
            placeholder="Search..."
            placeholderTextColor="#6b7280"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTER_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.filterTab, activeTab === tab.id && styles.filterTabActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.filterText, activeTab === tab.id && styles.filterTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 50 }} />
        ) : (
          <ScrollView 
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />}
          >
            {filtered.map(renderCard)}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },
  container: { flex: 1, paddingTop: 60 },
  header: { paddingHorizontal: 20, marginBottom: 20 },
  title: { fontSize: 28, color: "#fff", fontWeight: "900" },
  searchBox: {
    flexDirection: "row",
    backgroundColor: "#0f1629",
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  searchInput: { flex: 1, color: "#fff", marginLeft: 10 },
  filterSection: { marginBottom: 20 },
  filterScroll: { paddingLeft: 20 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#0f1629", marginRight: 10 },
  filterTabActive: { backgroundColor: "#7c3aed" },
  filterText: { color: "#6b7280", fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  messageCard: {
    flexDirection: "row",
    backgroundColor: "#0f1629",
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  messageCardUnread: { borderWidth: 1, borderColor: "#7c3aed" },
  avatarContainer: { marginRight: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#1e2d4a", justifyContent: "center", alignItems: "center" },
  avatarUnread: { backgroundColor: "#7c3aed" },
  avatarText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  messageContent: { flex: 1 },
  messageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  messageName: { color: "#fff", fontWeight: "bold", fontSize: 16, flex: 1 },
  messageTime: { color: "#6b7280", fontSize: 12 },
  contextLabel: { color: "#7c3aed", fontSize: 12, fontWeight: "bold", marginVertical: 2 },
  messagePreview: { color: "#9ca3af", fontSize: 14 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  statusPending: { backgroundColor: "rgba(245, 158, 11, 0.2)" },
  statusAccepted: { backgroundColor: "rgba(16, 185, 129, 0.2)" },
  statusBadgeText: { fontSize: 10, color: "#fff", fontWeight: "bold" },
});