import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";

export default function MessageScreen({ navigation, route }) {
  const { conversation } = route.params;
  const { user } = useUser();

  const [messages,  setMessages]  = useState([]);
  const [text,      setText]      = useState("");
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const flatListRef = useRef(null);

  const senderName =
    user?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Me";

  // ── Fetch messages ─────────────────────────────────────────────────────────

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, sender_name, text, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("fetchMessages error:", error.message);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  }, [conversation.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ── Real-time new messages ─────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel(`messages-live-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [conversation.id]);

  // Scroll to bottom when messages first load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [loading]);

  // ── Send message ───────────────────────────────────────────────────────────

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setText("");
    setSending(true);

    try {
      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id:       user.id,
        sender_name:     senderName,
        text:            trimmed,
        created_at:      new Date().toISOString(),
      });

      if (msgErr) throw msgErr;

      // Update conversation preview
      await supabase
        .from("conversations")
        .update({
          last_message: trimmed,
          updated_at:   new Date().toISOString(),
          unread:       true,
        })
        .eq("id", conversation.id);

    } catch (err) {
      console.error("Send error:", err.message);
      setText(trimmed); // restore on failure
    } finally {
      setSending(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatDate = (dateStr) => {
    const d    = new Date(dateStr);
    const now  = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Group messages by date
  const groupedMessages = () => {
    const groups = [];
    let lastDate  = null;

    messages.forEach((msg) => {
      const date = new Date(msg.created_at).toDateString();
      if (date !== lastDate) {
        groups.push({ type: "divider", id: `divider-${date}`, label: formatDate(msg.created_at) });
        lastDate = date;
      }
      groups.push({ type: "message", ...msg });
    });

    return groups;
  };

  // ── Render item ────────────────────────────────────────────────────────────

  const renderItem = ({ item }) => {
    if (item.type === "divider") {
      return (
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerLabel}>{item.label}</Text>
          <View style={s.dividerLine} />
        </View>
      );
    }

    const isMine = item.sender_id === user?.id;

    return (
      <View style={[s.msgRow, isMine ? s.msgRowRight : s.msgRowLeft]}>
        {!isMine && (
          <View style={s.msgAvatar}>
            {conversation.otherAvatarUrl ? (
              <Image source={{ uri: conversation.otherAvatarUrl }} style={{ width: 28, height: 28, borderRadius: 14 }} />
            ) : (
              <Text style={s.msgAvatarText}>
                {(item.sender_name?.[0] || "?").toUpperCase()}
              </Text>
            )}
          </View>
        )}
        <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
          {!isMine && (
            <Text style={s.senderName}>{item.sender_name}</Text>
          )}
          <Text style={[s.bubbleText, isMine && s.bubbleTextMine]}>
            {item.text}
          </Text>
          <Text style={[s.bubbleTime, isMine && s.bubbleTimeMine]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>

        <View style={s.headerAvatar}>
          {conversation.otherAvatarUrl ? (
            <Image source={{ uri: conversation.otherAvatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
          ) : (
            <Text style={s.headerAvatarText}>
              {(conversation.name?.[0] || "?").toUpperCase()}
            </Text>
          )}
        </View>

        <View style={s.headerInfo}>
          <Text style={s.headerName} numberOfLines={1}>{conversation.name}</Text>
          <Text style={s.headerSub} numberOfLines={1}>{conversation.title}</Text>
        </View>
      </View>

      {/* Messages + Input */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={s.loadingText}>Loading messages…</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={groupedMessages()}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <View style={s.emptyChat}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color="#1e2d4a" />
                <Text style={s.emptyChatTitle}>No messages yet</Text>
                <Text style={s.emptyChatSub}>Say hello to get the conversation started!</Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View style={s.inputBar}>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="Type a message…"
              placeholderTextColor="#4b5563"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
            />
          </View>
          <TouchableOpacity
            style={[s.sendBtn, text.trim().length > 0 && s.sendBtnActive]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={text.trim().length > 0 ? "white" : "#4b5563"}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    gap: 12,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 12,
    backgroundColor: "#0b1120",
    borderWidth: 1,
    borderColor: "#1a2540",
    justifyContent: "center",
    alignItems: "center",
  },
  headerAvatar: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: "#7c3aed",
    justifyContent: "center",
    alignItems: "center",
  },
  headerAvatarText: { color: "white", fontWeight: "800", fontSize: 16 },
  headerInfo:       { flex: 1 },
  headerName:       { color: "white", fontSize: 16, fontWeight: "700" },
  headerSub:        { color: "#6b7280", fontSize: 12, marginTop: 1 },

  // Loading / Empty
  center:       { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:  { color: "#6b7280", fontSize: 14 },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 10,
  },
  emptyChatTitle: { color: "#374151", fontSize: 16, fontWeight: "700" },
  emptyChatSub:   { color: "#1f2937", fontSize: 13, textAlign: "center" },

  // List
  listContent: { padding: 16, paddingBottom: 8, flexGrow: 1 },

  // Date divider
  dividerRow:  { flexDirection: "row", alignItems: "center", marginVertical: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#1a2540" },
  dividerLabel:{ color: "#4b5563", fontSize: 11, fontWeight: "600", textTransform: "uppercase" },

  // Message rows
  msgRow:      { marginBottom: 10, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  msgRowLeft:  { justifyContent: "flex-start" },
  msgRowRight: { justifyContent: "flex-end" },

  msgAvatar: {
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: "#1e2d4a",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  msgAvatarText: { color: "#a78bfa", fontSize: 11, fontWeight: "800" },

  // Bubbles
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleTheirs: {
    backgroundColor: "#0f1629",
    borderWidth: 1,
    borderColor: "#1a2540",
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    backgroundColor: "#7c3aed",
    borderBottomRightRadius: 4,
  },
  senderName: {
    color: "#a78bfa",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 3,
  },
  bubbleText:     { color: "#d1d5db", fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: "white" },
  bubbleTime:     { color: "#4b5563", fontSize: 10, marginTop: 4, alignSelf: "flex-end" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.55)" },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#111827",
    backgroundColor: "#050914",
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: "#0b1120",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1a2540",
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
  },
  input: {
    color: "white",
    fontSize: 15,
    lineHeight: 20,
  },
  sendBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: "#0b1120",
    borderWidth: 1,
    borderColor: "#1a2540",
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnActive: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
});