import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getNotifications as apiGetNotifications,
  markAllNotificationsRead as apiMarkAllRead,
  markNotificationRead as apiMarkRead,
  type NotificationItem as ApiNotification,
} from "@workspace/api-client-react";

import { Touchable } from "@/components/Touchable";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type NotifType = "trade" | "deposit" | "withdraw" | "system" | "alert" | "promo";

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const SEED: Notification[] = [
  {
    id: "1",
    type: "trade",
    title: "Bot closed BTC/USDT trade",
    body: "Profit booked: +₹342.18 · ROI 1.84%",
    time: "2m ago",
    read: false,
  },
  {
    id: "2",
    type: "deposit",
    title: "Deposit successful",
    body: "₹5,000 credited to your wallet via UPI",
    time: "1h ago",
    read: false,
  },
  {
    id: "3",
    type: "alert",
    title: "ETH crossed ₹2,40,000",
    body: "Your price alert for ETH/INR triggered",
    time: "3h ago",
    read: false,
  },
  {
    id: "4",
    type: "system",
    title: "KYC approved",
    body: "Your KYC verification is complete. Trading enabled.",
    time: "Yesterday",
    read: true,
  },
  {
    id: "5",
    type: "promo",
    title: "Refer & earn ₹500",
    body: "Invite friends and earn ₹500 per signup with KYC",
    time: "Yesterday",
    read: true,
  },
  {
    id: "6",
    type: "withdraw",
    title: "Withdrawal processed",
    body: "₹2,500 sent to HDFC Bank ••8421",
    time: "2 days ago",
    read: true,
  },
];

const ICON_FOR: Record<NotifType, React.ComponentProps<typeof Feather>["name"]> = {
  trade: "trending-up",
  deposit: "arrow-down-circle",
  withdraw: "arrow-up-circle",
  system: "shield",
  alert: "bell",
  promo: "gift",
};

function mapApiType(t: string): NotifType {
  const lc = t.toLowerCase();
  if (lc.includes("daily_profit") || lc.includes("trade") || lc.includes("payout")) return "trade";
  if (lc.includes("deposit")) return "deposit";
  if (lc.includes("withdraw")) return "withdraw";
  if (lc.includes("drawdown") || lc.includes("alert")) return "alert";
  if (lc.includes("promo") || lc.includes("referral")) return "promo";
  return "system";
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function adaptApiNotification(n: ApiNotification): Notification {
  return {
    id: String(n.id),
    type: mapApiType(n.type),
    title: n.title,
    body: n.message,
    time: timeAgo(n.createdAt),
    read: n.isRead,
  };
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const isDemo = user?.id === "demo_001";

  const [items, setItems] = useState<Notification[]>(SEED);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || isDemo) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiGetNotifications();
        if (cancelled) return;
        setItems(res.notifications.map(adaptApiNotification));
      } catch {
        /* keep seed */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isDemo]);

  const filtered = filter === "unread" ? items.filter((n) => !n.read) : items;
  const unreadCount = items.filter((n) => !n.read).length;

  const tintFor = (t: NotifType) => {
    switch (t) {
      case "trade":
        return colors.green;
      case "deposit":
        return colors.green;
      case "withdraw":
        return colors.gold;
      case "alert":
        return colors.pink;
      case "promo":
        return colors.gold;
      default:
        return colors.textSecondary;
    }
  };

  const markAllRead = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    if (isAuthenticated && !isDemo) {
      try {
        await apiMarkAllRead();
      } catch {
        /* optimistic; ignore */
      }
    }
  };

  const handlePress = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (isAuthenticated && !isDemo) {
      const numId = Number(id);
      if (Number.isFinite(numId)) {
        try {
          await apiMarkRead(numId);
        } catch {
          /* optimistic; ignore */
        }
      }
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Touchable
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          haptic="light"
          scaleTo={0.92}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Touchable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              {unreadCount} unread
            </Text>
          )}
        </View>
        {unreadCount > 0 ? (
          <Touchable onPress={markAllRead} style={styles.markBtn} haptic="light" flat>
            <Text style={[styles.markBtnText, { color: colors.gold }]}>Mark all</Text>
          </Touchable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(["all", "unread"] as const).map((k) => {
          const active = filter === k;
          return (
            <Touchable
              key={k}
              onPress={() => setFilter(k)}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? "rgba(168,85,247,0.12)" : colors.card,
                  borderColor: active ? colors.gold : colors.border,
                },
              ]}
              haptic="selection"
              scaleTo={0.96}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.gold : colors.textSecondary },
                ]}
              >
                {k === "all" ? "All" : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
              </Text>
            </Touchable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {loading && items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="bell-off" size={28} color={colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>You're all caught up</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              No new notifications right now. We'll ping you when something happens.
            </Text>
          </View>
        ) : (
          filtered.map((n, idx) => {
            const tint = tintFor(n.type);
            return (
              <Animated.View
                key={n.id}
                entering={FadeInDown.duration(280).delay(idx * 40)}
              >
                <Touchable
                  onPress={() => handlePress(n.id)}
                  haptic="selection"
                  scaleTo={0.985}
                  style={[
                    styles.row,
                    {
                      backgroundColor: colors.card,
                      borderColor: n.read ? colors.border : "rgba(168,85,247,0.4)",
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[`${tint}25`, `${tint}10`]}
                    style={styles.rowIconWrap}
                  >
                    <Feather name={ICON_FOR[n.type]} size={16} color={tint} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowTitleLine}>
                      <Text
                        style={[
                          styles.rowTitle,
                          { color: colors.foreground, fontFamily: n.read ? "Inter_500Medium" : "Inter_600SemiBold" },
                        ]}
                        numberOfLines={1}
                      >
                        {n.title}
                      </Text>
                      {!n.read && (
                        <View style={[styles.unreadDot, { backgroundColor: colors.pink }]} />
                      )}
                    </View>
                    <Text
                      style={[styles.rowBody, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {n.body}
                    </Text>
                    <Text style={[styles.rowTime, { color: colors.textMuted }]}>{n.time}</Text>
                  </View>
                </Touchable>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  markBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  markBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  rowTitle: { fontSize: 13.5, flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  rowBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  rowTime: { fontSize: 10.5, fontFamily: "Inter_500Medium", marginTop: 5 },
  emptyWrap: { alignItems: "center", paddingTop: 80, paddingHorizontal: 30 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 6 },
  emptySub: { fontSize: 12.5, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
});
