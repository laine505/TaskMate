import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const tasks = [
  {
    id: 1,
    name: "Research Paper Editing",
    status: "Accepted",
    reward: "₱500",
    postedBy: "@kurtyful",
    description: "Edit and proofread a 10 page research paper.",
    icon: "document-text-outline",
  },
  {
    id: 2,
    name: "Capstone Research",
    status: "Accepted",
    reward: "₱1,200",
    postedBy: "@anonimus",
    description: "Help with literature review and research structure.",
    icon: "school-outline",
  },
  {
    id: 3,
    name: "Website UI Design",
    status: "In Progress",
    reward: "₱900",
    postedBy: "@acez",
    description: "Design a modern mobile app UI for a student platform.",
    icon: "color-palette-outline",
  },
  {
    id: 4,
    name: "Logo Design",
    status: "Completed",
    reward: "₱400",
    postedBy: "@Tlaine",
    description: "Create a logo for a student startup.",
    icon: "brush-outline",
  },
  {
    id: 5,
    name: "Coding",
    status: "Completed",
    reward: "₱1,500",
    postedBy: "@paotang",
    description: "Fix bugs in a React Native school project.",
    icon: "code-slash-outline",
  },
];

const FILTERS = ["All", "Accepted", "In Progress", "Completed"];

const STATUS_CONFIG = {
  Accepted:    { color: "#f59e0b", bg: "#2d1f00", icon: "checkmark-circle-outline" },
  "In Progress":{ color: "#3b82f6", bg: "#0a1628", icon: "time-outline" },
  Completed:   { color: "#10b981", bg: "#052e1c", icon: "trophy-outline" },
};

export default function OrdersScreen() {
  const [filter, setFilter] = useState("All");
  const [selectedTask, setSelectedTask] = useState(null);

  const filteredTasks =
    filter === "All" ? tasks : tasks.filter((t) => t.status === filter);

  const counts = {
    All: tasks.length,
    Accepted: tasks.filter((t) => t.status === "Accepted").length,
    "In Progress": tasks.filter((t) => t.status === "In Progress").length,
    Completed: tasks.filter((t) => t.status === "Completed").length,
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Tasks</Text>
          <Text style={styles.subtitle}>{filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""} found</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{tasks.length}</Text>
        </View>
      </View>

      {/* FILTER CHIPS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {FILTERS.map((f) => {
          const isActive = filter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {f}
              </Text>
              <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
                <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
                  {counts[f]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* TASK LIST */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={48} color="#1e2d4a" />
            <Text style={styles.emptyText}>No tasks found</Text>
            <Text style={styles.emptySub}>Try a different filter</Text>
          </View>
        ) : (
          filteredTasks.map((task) => {
            const cfg = STATUS_CONFIG[task.status];
            return (
              <TouchableOpacity
                key={task.id}
                style={styles.card}
                onPress={() => setSelectedTask(task)}
                activeOpacity={0.85}
              >
                {/* Left icon */}
                <View style={[styles.cardIcon, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={task.icon} size={20} color={cfg.color} />
                </View>

                {/* Middle content */}
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={1}>{task.name}</Text>
                  <View style={styles.cardMeta}>
                    <Ionicons name="person-outline" size={11} color="#6b7280" />
                    <Text style={styles.cardPoster}>{task.postedBy}</Text>
                  </View>
                </View>

                {/* Right side */}
                <View style={styles.cardRight}>
                  <Text style={styles.cardReward}>{task.reward}</Text>
                  <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.color + "40" }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>{task.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* MODAL */}
      <Modal visible={selectedTask !== null} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedTask(null)}
        >
          <TouchableOpacity
            style={styles.modalCard}
            activeOpacity={1}
            onPress={() => {}}
          >
            {selectedTask && (() => {
              const cfg = STATUS_CONFIG[selectedTask.status];
              return (
                <>
                  {/* Modal handle */}
                  <View style={styles.modalHandle} />

                  {/* Icon + title */}
                  <View style={styles.modalTopRow}>
                    <View style={[styles.modalIcon, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={selectedTask.icon} size={24} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>{selectedTask.name}</Text>
                      <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.color + "40", alignSelf: "flex-start", marginTop: 4 }]}>
                        <Text style={[styles.statusText, { color: cfg.color }]}>{selectedTask.status}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.modalDivider} />

                  {/* Info rows */}
                  {[
                    { icon: "person-outline",   label: "Posted by",   value: selectedTask.postedBy },
                    { icon: "cash-outline",      label: "Reward",      value: selectedTask.reward, highlight: true },
                    { icon: "document-text-outline", label: "Description", value: selectedTask.description },
                  ].map((row) => (
                    <View key={row.label} style={styles.modalRow}>
                      <View style={styles.modalRowIcon}>
                        <Ionicons name={row.icon} size={16} color="#7c3aed" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalLabel}>{row.label}</Text>
                        <Text style={[styles.modalValue, row.highlight && { color: "#10b981", fontWeight: "800" }]}>
                          {row.value}
                        </Text>
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedTask(null)}>
                    <Text style={styles.closeText}>Close</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { color: "white", fontSize: 24, fontWeight: "900" },
  subtitle: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  headerBadge: {
    backgroundColor: "#7c3aed",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerBadgeText: { color: "white", fontWeight: "800", fontSize: 15 },

  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },

  // Filter
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 14,
    alignItems: "center",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: "#0f1629",
    borderWidth: 1,
    borderColor: "#1e2d4a",
    alignSelf: "flex-start",
  },
  filterChipActive: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  filterChipText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  filterChipTextActive: { color: "white" },
  filterCount: {
    backgroundColor: "#1e2d4a",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  filterCountActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  filterCountText: { color: "#6b7280", fontSize: 11, fontWeight: "700" },
  filterCountTextActive: { color: "white" },

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 4 },

  // Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f1629",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1e2d4a",
    gap: 12,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBody: { flex: 1 },
  cardName: { color: "white", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardPoster: { color: "#6b7280", fontSize: 12 },
  cardRight: { alignItems: "flex-end", gap: 6 },
  cardReward: { color: "#a78bfa", fontWeight: "800", fontSize: 14 },

  // Status pill
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: "700" },

  // Empty
  emptyState: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyText: { color: "#374151", fontSize: 16, fontWeight: "700" },
  emptySub: { color: "#1f2937", fontSize: 13 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#0f1629",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#1e2d4a",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 16,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: { color: "white", fontSize: 18, fontWeight: "800" },
  modalDivider: { height: 1, backgroundColor: "#1e2d4a", marginBottom: 16 },
  modalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  modalRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#1e1344",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  modalLabel: { color: "#6b7280", fontSize: 11, fontWeight: "600", marginBottom: 2, letterSpacing: 0.5 },
  modalValue: { color: "white", fontSize: 14, lineHeight: 20 },

  closeBtn: {
    marginTop: 20,
    backgroundColor: "#7c3aed",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  closeText: { color: "white", fontWeight: "700", fontSize: 15 },
});