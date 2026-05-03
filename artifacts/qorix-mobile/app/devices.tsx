import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ApiDevice, listDevices } from "@/lib/apiClient";
import { useColors } from "@/hooks/useColors";

const BRAND_PURPLE = "#A855F7";
const BRAND_PINK = "#EC4899";
const BRAND_BLUE = "#60A5FA";

function hexToRgba(hex: string, alpha: number) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

interface Device {
  id: string;
  name: string;
  os: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
  icon: keyof typeof Feather.glyphMap;
  accent: string;
}

const ACCENTS = [BRAND_PURPLE, BRAND_BLUE, BRAND_PINK];

function pickIcon(label: string): keyof typeof Feather.glyphMap {
  const l = label.toLowerCase();
  if (/iphone|android|ios|mobile|safari mobile|chrome mobile/.test(l)) return "smartphone";
  if (/mac|windows|linux|laptop|desktop/.test(l)) return "monitor";
  return "globe";
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Active now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function mapApiDevice(d: ApiDevice, idx: number): Device {
  const browser = d.browser || "Unknown browser";
  const os = d.os || "Unknown OS";
  const loc = [d.city, d.country].filter(Boolean).join(", ") || "Unknown location";
  return {
    id: d.id,
    name: browser,
    os,
    location: loc,
    ip: "•••",
    lastActive: d.isCurrent ? "Active now" : timeAgo(d.lastSeenAt),
    current: d.isCurrent,
    icon: pickIcon(`${browser} ${os}`),
    accent: ACCENTS[idx % ACCENTS.length]!,
  };
}

export default function DevicesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const res = await listDevices();
      setDevices(res.devices.map(mapApiDevice));
    } catch (err) {
      const anyErr = err as { message?: string };
      setError(anyErr?.message ?? "Could not load devices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRevoke = (d: Device) => {
    // Server-side per-device sign-out is not yet available (B8 is read-only;
    // B8.1 will add session-bound revocation). Until then we tell the user
    // to change password as the supported lockout path.
    Alert.alert(
      `Sign out ${d.name}?`,
      "Per-device sign-out is coming soon. To force all other sessions to sign out today, change your password — that invalidates other tokens.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change password",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/change-password");
          },
        },
      ]
    );
  };

  const handleRevokeAll = () => {
    Alert.alert(
      "Sign out all other devices?",
      "Per-device sign-out is coming soon. Changing your password is the supported way to invalidate every other session today.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change password",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/change-password");
          },
        },
      ]
    );
  };

  const otherCount = devices.filter((d) => !d.current).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.iconBtn,
            { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
          ]}
          hitSlop={8}
        >
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          My Devices
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        {error ? (
          <View
            style={[
              styles.errBanner,
              { borderColor: hexToRgba(colors.red, 0.4), backgroundColor: hexToRgba(colors.red, 0.08) },
            ]}
          >
            <Feather name="alert-circle" size={14} color={colors.red} />
            <Text style={[styles.errText, { color: colors.red }]}>{error}</Text>
            <Pressable onPress={load} hitSlop={8}>
              <Feather name="refresh-cw" size={14} color={colors.red} />
            </Pressable>
          </View>
        ) : null}
        {/* Hero summary */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View
            style={[
              styles.heroCard,
              { backgroundColor: "#11161E", borderColor: hexToRgba(BRAND_BLUE, 0.3) },
            ]}
          >
            <LinearGradient
              colors={[hexToRgba(BRAND_BLUE, 0.16), "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View pointerEvents="none" style={[styles.glow, { backgroundColor: BRAND_PURPLE }]} />
            <View style={[styles.heroIcon, { backgroundColor: hexToRgba(BRAND_BLUE, 0.18), zIndex: 1 }]}>
              <Feather name="shield" size={20} color={BRAND_BLUE} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground, zIndex: 1 }]}>
              {devices.length} active session{devices.length === 1 ? "" : "s"}
            </Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary, zIndex: 1 }]}>
              Don't recognize a device? Sign it out immediately and change your password.
            </Text>
          </View>
        </Animated.View>

        {/* Device list */}
        <Text style={[styles.groupLbl, { color: colors.textMuted }]}>SESSIONS</Text>

        <View style={{ gap: 10 }}>
          {devices.map((d, i) => (
            <Animated.View
              key={d.id}
              entering={FadeInDown.duration(360).delay(60 + i * 50)}
            >
              <View
                style={[
                  styles.deviceCard,
                  {
                    backgroundColor: "#11161E",
                    borderColor: d.current
                      ? hexToRgba(colors.green, 0.35)
                      : "rgba(255,255,255,0.06)",
                  },
                ]}
              >
                <View style={styles.deviceTop}>
                  <LinearGradient
                    colors={[hexToRgba(d.accent, 0.32), hexToRgba(d.accent, 0.1)]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={[styles.deviceIcon, { borderColor: hexToRgba(d.accent, 0.4) }]}
                  >
                    <Feather name={d.icon} size={18} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.deviceName, { color: colors.foreground }]}>
                        {d.name}
                      </Text>
                      {d.current && (
                        <View
                          style={[
                            styles.currentPill,
                            {
                              backgroundColor: hexToRgba(colors.green, 0.16),
                              borderColor: hexToRgba(colors.green, 0.4),
                            },
                          ]}
                        >
                          <View
                            style={[styles.pulseDot, { backgroundColor: colors.green }]}
                          />
                          <Text style={[styles.currentPillText, { color: colors.green }]}>
                            THIS DEVICE
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.deviceOs, { color: colors.textMuted }]}>
                      {d.os}
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.05)" }]} />

                <View style={styles.deviceMeta}>
                  <View style={styles.metaItem}>
                    <Feather name="map-pin" size={11} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {d.location}
                    </Text>
                  </View>
                  <View style={[styles.metaSep, { backgroundColor: "rgba(255,255,255,0.08)" }]} />
                  <View style={styles.metaItem}>
                    <Feather name="wifi" size={11} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {d.ip}
                    </Text>
                  </View>
                  <View style={[styles.metaSep, { backgroundColor: "rgba(255,255,255,0.08)" }]} />
                  <View style={styles.metaItem}>
                    <Feather name="clock" size={11} color={colors.textMuted} />
                    <Text
                      style={[
                        styles.metaText,
                        {
                          color: d.current ? colors.green : colors.textSecondary,
                          fontFamily: d.current ? "Inter_600SemiBold" : "Inter_500Medium",
                        },
                      ]}
                    >
                      {d.lastActive}
                    </Text>
                  </View>
                </View>

                {!d.current && (
                  <Pressable
                    onPress={() => handleRevoke(d)}
                    style={({ pressed }) => [
                      styles.revokeBtn,
                      {
                        opacity: pressed ? 0.85 : 1,
                        borderColor: hexToRgba(colors.red, 0.35),
                        backgroundColor: hexToRgba(colors.red, 0.06),
                      },
                    ]}
                  >
                    <Feather name="log-out" size={13} color={colors.red} />
                    <Text style={[styles.revokeText, { color: colors.red }]}>
                      Sign out this device
                    </Text>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          ))}
        </View>

        {otherCount > 0 && (
          <Pressable
            onPress={handleRevokeAll}
            style={({ pressed }) => [
              styles.revokeAllBtn,
              {
                opacity: pressed ? 0.85 : 1,
                borderColor: hexToRgba(colors.red, 0.4),
              },
            ]}
          >
            <Feather name="alert-octagon" size={14} color={colors.red} />
            <Text style={[styles.revokeAllText, { color: colors.red }]}>
              Sign out all other devices ({otherCount})
            </Text>
          </Pressable>
        )}

        <View
          style={[
            styles.helpCard,
            { borderColor: hexToRgba(BRAND_BLUE, 0.25), backgroundColor: hexToRgba(BRAND_BLUE, 0.06) },
          ]}
        >
          <Feather name="info" size={13} color={BRAND_BLUE} />
          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            We log every sign-in for 90 days. If you spot suspicious activity, sign out and change your password.
          </Text>
        </View>
      </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  content: { paddingHorizontal: 16, gap: 14 },

  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
    position: "relative",
    gap: 8,
  },
  glow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -110,
    right: -60,
    opacity: 0.08,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  heroSub: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },

  groupLbl: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginLeft: 4,
  },

  deviceCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  deviceTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  deviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  errBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  deviceName: { fontSize: 14.5, fontFamily: "Inter_700Bold", letterSpacing: -0.1 },
  deviceOs: { fontSize: 11.5, fontFamily: "Inter_500Medium" },
  currentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  pulseDot: { width: 5, height: 5, borderRadius: 2.5 },
  currentPillText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  divider: { height: 1 },

  deviceMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  metaSep: { width: 3, height: 3, borderRadius: 1.5 },

  revokeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
  },
  revokeText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold" },

  revokeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  revokeAllText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  helpCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  helpText: { flex: 1, fontSize: 11, fontFamily: "Inter_500Medium", lineHeight: 16 },
});
