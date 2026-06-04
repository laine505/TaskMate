import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, StatusBar, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";

export default function MessageScreen({ navigation, route }) {
  const { conversation } = route.params;
  const { user } = useUser();

  const [messages,   setMessages]   = useState([]);
  const [message,    setMessage]    = useState("");
  const [loading,    setLoading]    = useState(true);
  const [convStatus, setConvStatus] = useState(conversation.status ?? "accepted");
  const scrollViewRef = useRef();

  // ── Derived state ─────────────────────────────────────────────────────────
  const isPoster  = conversation.poster_id === user?.id;   // fixed typo: was isPoter
  const isPending = convStatus === "pending";

  // ── Fetch messages ────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, sender_name, text, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (!error && data) setMessages(data);
    setLoading(false);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 100);
  }, [conversation.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // ── Realtime: new messages ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${conversation.id}`)
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
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [conversation.id]);

  // ── Realtime: conversation status changes ─────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`conv-status-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "conversations",
          filter: `id=eq.${conversation.id}`,
        },
        (payload) => {
          if (payload.new.status) setConvStatus(payload.new.status);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [conversation.id]);

  // ── Accept ────────────────────────────────────────────────────────────────
  const handleAccept = async () => {
    const { error } = await supabase
      .from("conversations")
      .update({ status: "accepted", unread: false })
      .eq("id", conversation.id);
    if (!error) setConvStatus("accepted");
  };

  // ── Decline ───────────────────────────────────────────────────────────────
  const handleDecline = () => {
    Alert.alert(
      "Decline Request",
      "Decline this message request? The conversation will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            await supabase
              .from("conversations")
              .update({ status: "declined" })
              .eq("id", conversation.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!message.trim()) return;
    const text = message.trim();
    setMessage("");

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id:       user.id,
      sender_name:     user.name || user.user_metadata?.full_name || user.email,
      text,
    });

    if (!error) {
      // updated_at is the correct column (no last_message_at in schema)
      await supabase
        .from("conversations")
        .update({
          last_message: text,
          updated_at:   new Date().toISOString(),
          unread:       true,
        })
        .eq("id", conversation.id);
    } else {
      console.error("Send failed:", error.message);
      setMessage(text); // restore on failure
    }
  };

  const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // ── Pending banner ────────────────────────────────────────────────────────
  const renderPendingBanner = () => {
    if (!isPending) return null;

    if (isPoster) {
      return (
        <View style={styles.pendingBanner}>
          <View style={styles.pendingBannerInfo}>
            <Ionicons name="mail-unread-outline" size={18} color="#a78bfa" />
            <View style={styles.pendingBannerText}>
              <Text style={styles.pendingBannerTitle}>Message Request</Text>
              <Text style={styles.pendingBannerSub}>
                {conversation.name} wants to connect regarding {conversation.title}
              </Text>
            </View>
          </View>
          <View style={styles.pendingBannerActions}>
            <TouchableOpacity style={styles.bannerAcceptBtn} onPress={handleAccept}>
              <Ionicons name="checkmark" size={14} color="white" />
              <Text style={styles.bannerAcceptText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bannerDeclineBtn} onPress={handleDecline}>
              <Ionicons name="close" size={14} color="#ef4444" />
              <Text style={styles.bannerDeclineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Applicant sees a waiting notice
    return (
      <View style={styles.waitingBanner}>
        <Ionicons name="time-outline" size={16} color="#f59e0b" />
        <Text style={styles.waitingBannerText}>
          Waiting for {conversation.name} to accept your request
        </Text>
      </View>
    );
  };

  // ── Input area ────────────────────────────────────────────────────────────
  const renderInput = () => {
    // Poster sees locked bar until they accept
    if (isPending && isPoster) {
      return (
        <View style={styles.lockedInput}>
          <Ionicons name="lock-closed-outline" size={16} color="#4b5563" />
          <Text style={styles.lockedInputText}>
            Accept the request to send messages
          </Text>
        </View>
      );
    }

    // Applicant sees locked bar while waiting
    if (isPending && !isPoster) {
      return (
        <View style={styles.lockedInput}>
          <Ionicons name="time-outline" size={16} color="#4b5563" />
          <Text style={styles.lockedInputText}>
            You can message once your request is accepted
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachBtn}>
          <Ionicons name="add-circle-outline" size={24} color="#7c3aed" />
        </TouchableOpacity>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#6b7280"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, message.trim().length > 0 && styles.sendBtnActive]}
          onPress={handleSend}
          disabled={!message.trim()}
        >
          <Ionicons
            name="send"
            size={20}
            color={message.trim().length > 0 ? "white" : "#6b7280"}
          />
        </TouchableOpacity>
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>
              {conversation.avatar?.[0]?.toUpperCase() ?? "?"}
            </Text>
            {conversation.online && <View style={styles.onlineDotSmall} />}
          </View>
          <View>
            <Text style={styles.headerName}>{conversation.name}</Text>
            <Text style={styles.headerStatus}>
              {isPending
                ? (isPoster ? "Pending request" : "Awaiting response")
                : (conversation.online ? "Active now" : "Offline")}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {!isPending && (
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="call-outline" size={20} color="#a78bfa" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color="#a78bfa" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Pending banner */}
      {renderPendingBanner()}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.chatContainer}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.dateDivider}>
              <View style={styles.dateDividerLine} />
              <Text style={styles.dateDividerText}>Today</Text>
              <View style={styles.dateDividerLine} />
            </View>

            {messages.length === 0 ? (
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubbles-outline" size={40} color="#1e2d4a" />
                <Text style={styles.emptyChatText}>No messages yet — say hello!</Text>
              </View>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <View
                    key={msg.id}
                    style={[styles.messageRow, isMine && styles.messageRowSent]}
                  >
                    <View style={[styles.messageBubble, isMine && styles.messageBubbleSent]}>
                      <Text style={[styles.messageText, isMine && styles.messageTextSent]}>
                        {msg.text}
                      </Text>
                      <Text style={[styles.messageTime, isMine && styles.messageTimeSent]}>
                        {formatTime(msg.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            {isPending && isPoster && messages.length > 0 && (
              <View style={styles.acceptNudge}>
                <Text style={styles.acceptNudgeText}>Accept the request to reply</Text>
              </View>
            )}
          </ScrollView>
        )}

        {renderInput()}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 16,
    backgroundColor: "#050914",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
  },
  backBtn: {
    width: 40, height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  avatarSmall: {
    width: 42, height: 42,
    borderRadius: 21,
    backgroundColor: "#7c3aed",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  avatarSmallText: { color: "white", fontWeight: "800", fontSize: 16 },
  onlineDotSmall: {
    position: "absolute",
    bottom: 0, right: 0,
    width: 12, height: 12,
    borderRadius: 6,
    backgroundColor: "#10b981",
    borderWidth: 2,
    borderColor: "#050914",
  },
  headerName:   { color: "white", fontSize: 16, fontWeight: "700" },
  headerStatus: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  headerRight:  { flexDirection: "row", gap: 8 },
  iconBtn:      { backgroundColor: "#111827", padding: 8, borderRadius: 10 },

  // ── Pending banner (poster) ──
  pendingBanner: {
    backgroundColor: "#13103a",
    borderBottomWidth: 1,
    borderBottomColor: "#2d1f52",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  pendingBannerInfo:    { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  pendingBannerText:    { flex: 1 },
  pendingBannerTitle:   { color: "#a78bfa", fontSize: 13, fontWeight: "800", marginBottom: 2 },
  pendingBannerSub:     { color: "#6b7280", fontSize: 12, lineHeight: 17 },
  pendingBannerActions: { flexDirection: "row", gap: 10 },
  bannerAcceptBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#7c3aed",
    paddingVertical: 10,
    borderRadius: 10,
  },
  bannerAcceptText: { color: "white", fontWeight: "700", fontSize: 13 },
  bannerDeclineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bannerDeclineText: { color: "#ef4444", fontWeight: "700", fontSize: 13 },

  // ── Waiting banner (applicant) ──
  waitingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245,158,11,0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245,158,11,0.15)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  waitingBannerText: { color: "#f59e0b", fontSize: 13, flex: 1, lineHeight: 18 },

  // ── Chat ──
  chatContainer:   { flex: 1 },
  messagesScroll:  { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },

  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  dateDividerLine: { flex: 1, height: 1, backgroundColor: "#1e2d4a" },
  dateDividerText: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },

  emptyChat: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyChatText: { color: "#374151", fontSize: 14 },

  messageRow:     { marginBottom: 12, alignItems: "flex-start" },
  messageRowSent: { alignItems: "flex-end" },

  messageBubble: {
    backgroundColor: "#0f1629",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: "75%",
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  messageBubbleSent: {
    backgroundColor: "#7c3aed",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
    borderColor: "#7c3aed",
  },

  messageText:     { color: "#e5e7eb", fontSize: 14, lineHeight: 20, marginBottom: 4 },
  messageTextSent: { color: "white" },
  messageTime:     { color: "#6b7280", fontSize: 11, alignSelf: "flex-end" },
  messageTimeSent: { color: "rgba(255,255,255,0.7)" },

  acceptNudge: {
    alignSelf: "center",
    backgroundColor: "rgba(124,58,237,0.1)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  acceptNudgeText: { color: "#a78bfa", fontSize: 12, fontWeight: "600" },

  // ── Input bar ──
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#050914",
    borderTopWidth: 1,
    borderTopColor: "#111827",
    gap: 10,
  },
  attachBtn:    { paddingBottom: 8 },
  inputWrapper: {
    flex: 1,
    backgroundColor: "#0f1629",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e2d4a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  input: { color: "white", fontSize: 14, lineHeight: 20 },
  sendBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnActive: { backgroundColor: "#7c3aed" },

  // ── Locked input ──
  lockedInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    backgroundColor: "#050914",
    borderTopWidth: 1,
    borderTopColor: "#111827",
  },
  lockedInputText: { color: "#4b5563", fontSize: 13 },

  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
});