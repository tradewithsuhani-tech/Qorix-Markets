import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { P2P_AGENTS } from "@/constants/p2pAgents";
import { useColors } from "@/hooks/useColors";

type CopyKey = "upi" | "amount" | "ref";

const generateRef = (agentId: string, amount: number) => {
  // Per-transaction reference: agent + amount + timestamp + random nonce
  const agentSeed = agentId
    .split("")
    .reduce((s, c) => s + c.charCodeAt(0), 0);
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 36 ** 3);
  const mix = (agentSeed * 7919 + ts + rand) >>> 0;
  const code = mix.toString(36).toUpperCase().slice(-6).padStart(6, "X");
  return `AT-${code}`;
};

export default function DepositUpiPayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ agentId?: string; amount?: string }>();

  const agent = useMemo(
    () => P2P_AGENTS.find((a) => a.id === params.agentId) ?? null,
    [params.agentId],
  );
  const numAmount = parseFloat(params.amount ?? "0") || 0;
  const refCode = useMemo(
    () => (agent ? generateRef(agent.id, numAmount) : ""),
    [agent, numAmount],
  );
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  const [copied, setCopied] = useState<CopyKey | null>(null);

  // Standard UPI deep-link URI consumed by Indian UPI apps (PhonePe, GPay, Paytm, BHIM)
  const upiUri = useMemo(() => {
    if (!agent) return "";
    const pn = encodeURIComponent(agent.name);
    const tn = encodeURIComponent(`AutoTrade ${refCode}`);
    return `upi://pay?pa=${agent.upiId}&pn=${pn}&am=${numAmount}&cu=INR&tn=${tn}`;
  }, [agent, numAmount, refCode]);

  const copy = async (text: string, key: CopyKey) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  const handlePaid = () => {
    if (!agent) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/deposit-netbanking-verify",
      params: { agentId: agent.id, amount: String(numAmount) },
    });
  };

  if (!agent) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.errorWrap, { paddingTop: topPadding + 80 }]}>
          <View
            style={[
              styles.errorIcon,
              {
                backgroundColor: "rgba(239,68,68,0.12)",
                borderColor: "rgba(239,68,68,0.4)",
              },
            ]}
          >
            <Feather name="alert-circle" size={28} color={colors.red} />
          </View>
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            Invalid payment session
          </Text>
          <Text style={[styles.errorSub, { color: colors.textSecondary }]}>
            We couldn&apos;t find this agent. Please go back and pick an agent
            again.
          </Text>
          <Pressable
            onPress={() => router.replace("/deposit")}
            accessibilityRole="button"
            accessibilityLabel="Go back to deposit"
            style={({ pressed }) => [
              styles.errorBtn,
              { backgroundColor: colors.purple, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.btnText}>Back to Deposit</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPadding, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.eyebrow, { color: colors.purple }]}>
              UPI PAYMENT
            </Text>
            <Text style={[styles.payTitle, { color: colors.foreground }]}>
              Pay ₹{numAmount.toLocaleString("en-IN")}
            </Text>
          </View>
          <View style={styles.backBtnSpacer} />
        </View>

        {/* Agent header card */}
        <View
          style={[
            styles.agentCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.avatarWrap}>
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: agent.avatarColor + "33",
                  borderColor: agent.avatarColor + "66",
                },
              ]}
            >
              <Text style={[styles.avatarInitial, { color: agent.avatarColor }]}>
                {agent.initial}
              </Text>
            </View>
            {agent.online && (
              <View
                style={[
                  styles.onlineDot,
                  { backgroundColor: colors.green, borderColor: colors.card },
                ]}
              />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={[styles.agentName, { color: colors.foreground }]}
            >
              {agent.name}
            </Text>
            <View style={styles.statsRow}>
              <Feather name="star" size={11} color={colors.purple} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {agent.rating.toFixed(2)}
              </Text>
              <Text style={[styles.statDot, { color: colors.textMuted }]}>·</Text>
              <Feather name="clock" size={11} color={colors.textMuted} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {agent.responseTime}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.escrowChip,
              {
                backgroundColor: "rgba(34,197,94,0.12)",
                borderColor: "rgba(34,197,94,0.4)",
              },
            ]}
          >
            <Feather name="shield" size={10} color={colors.green} />
            <Text style={[styles.escrowChipText, { color: colors.green }]}>
              ESCROW
            </Text>
          </View>
        </View>

        {/* QR Card */}
        <LinearGradient
          colors={["rgba(168,85,247,0.18)", "rgba(236,72,153,0.10)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.qrCard, { borderColor: "rgba(168,85,247,0.32)" }]}
        >
          <Text style={[styles.qrEyebrow, { color: colors.purpleLight }]}>
            SCAN TO PAY
          </Text>
          <View style={styles.qrFrame}>
            <View style={[styles.qrCorner, styles.qrCornerTL, { borderColor: colors.purpleLight }]} />
            <View style={[styles.qrCorner, styles.qrCornerTR, { borderColor: colors.purpleLight }]} />
            <View style={[styles.qrCorner, styles.qrCornerBL, { borderColor: colors.purpleLight }]} />
            <View style={[styles.qrCorner, styles.qrCornerBR, { borderColor: colors.purpleLight }]} />
            <View style={styles.qrInner}>
              <QRCode
                value={upiUri}
                size={188}
                color="#0F172A"
                backgroundColor="#FFFFFF"
              />
            </View>
          </View>
          <View style={styles.upiAppsRow}>
            <View style={[styles.appBadge, { borderColor: "rgba(94,53,177,0.5)", backgroundColor: "rgba(94,53,177,0.18)" }]}>
              <Text style={[styles.appBadgeText, { color: "#A78BFA" }]}>PhonePe</Text>
            </View>
            <View style={[styles.appBadge, { borderColor: "rgba(66,133,244,0.5)", backgroundColor: "rgba(66,133,244,0.18)" }]}>
              <Text style={[styles.appBadgeText, { color: "#60A5FA" }]}>GPay</Text>
            </View>
            <View style={[styles.appBadge, { borderColor: "rgba(0,186,242,0.5)", backgroundColor: "rgba(0,186,242,0.18)" }]}>
              <Text style={[styles.appBadgeText, { color: "#38BDF8" }]}>Paytm</Text>
            </View>
            <View style={[styles.appBadge, { borderColor: "rgba(245,158,11,0.5)", backgroundColor: "rgba(245,158,11,0.18)" }]}>
              <Text style={[styles.appBadgeText, { color: "#FBBF24" }]}>BHIM</Text>
            </View>
          </View>
        </LinearGradient>

        {/* OR divider */}
        <View style={styles.orRow}>
          <View style={[styles.orLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.orText, { color: colors.textMuted }]}>
            OR PAY USING UPI ID
          </Text>
          <View style={[styles.orLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Detail rows */}
        <View
          style={[
            styles.detailsCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <DetailRow
            label="UPI ID"
            value={agent.upiId}
            copyKey="upi"
            copied={copied}
            onCopy={copy}
            icon="at-sign"
            mono
          />
          <View style={styles.divider} />
          <DetailRow
            label="Amount"
            value={`₹${numAmount.toLocaleString("en-IN")}`}
            copyKey="amount"
            copied={copied}
            onCopy={(_, k) => copy(String(numAmount), k)}
            icon="dollar-sign"
            mono
          />
          <View style={styles.divider} />
          <DetailRow
            label="Reference"
            value={refCode}
            copyKey="ref"
            copied={copied}
            onCopy={copy}
            icon="hash"
            mono
          />
        </View>

        {/* Exact-amount warning */}
        <View
          style={[
            styles.warning,
            {
              backgroundColor: "rgba(245,158,11,0.10)",
              borderColor: "rgba(245,158,11,0.35)",
            },
          ]}
        >
          <Feather name="alert-triangle" size={14} color="#F59E0B" />
          <Text style={[styles.warningText, { color: colors.foreground }]}>
            Pay <Text style={{ fontFamily: "Inter_700Bold" }}>exactly ₹{numAmount.toLocaleString("en-IN")}</Text>
            {"  ·  "}
            <Text style={{ color: colors.textSecondary }}>
              Add {refCode} in payment note for instant credit
            </Text>
          </Text>
        </View>

        {/* Steps */}
        <View
          style={[
            styles.steps,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.stepsLabel, { color: colors.textSecondary }]}>
            HOW IT WORKS
          </Text>
          <Step n={1} text="Scan QR or paste UPI ID in any UPI app" />
          <Step n={2} text="Pay the exact amount with reference code" />
          <Step n={3} text="Submit UTR + screenshot · funds credited in 2 mins" />
        </View>

        {/* Confirm CTA */}
        <Pressable
          onPress={handlePaid}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.purple, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="check-circle" size={16} color="#fff" />
          <Text style={styles.btnText}>
            I&apos;ve Paid ₹{numAmount.toLocaleString("en-IN")}
          </Text>
          <Feather name="arrow-right" size={16} color="#fff" />
        </Pressable>

        {/* Footer note */}
        <View style={styles.footerNote}>
          <Feather name="info" size={11} color={colors.textMuted} />
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Funds held in escrow · Released only after agent confirms · 0% fees
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  label,
  value,
  copyKey,
  copied,
  onCopy,
  icon,
  mono,
}: {
  label: string;
  value: string;
  copyKey: CopyKey;
  copied: CopyKey | null;
  onCopy: (text: string, key: CopyKey) => void;
  icon: React.ComponentProps<typeof Feather>["name"];
  mono?: boolean;
}) {
  const colors = useColors();
  const isCopied = copied === copyKey;
  return (
    <View style={styles.detailRow}>
      <View
        style={[
          styles.detailIcon,
          { backgroundColor: colors.input, borderColor: colors.border },
        ]}
      >
        <Feather name={icon} size={13} color={colors.purple} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.detailValue,
            {
              color: colors.foreground,
              fontFamily: mono ? "Inter_700Bold" : "Inter_600SemiBold",
              letterSpacing: mono ? 0.6 : 0,
            },
          ]}
        >
          {value}
        </Text>
      </View>
      <Pressable
        onPress={() => onCopy(value, copyKey)}
        hitSlop={8}
        style={({ pressed }) => [
          styles.copyChip,
          {
            borderColor: isCopied ? colors.green : "rgba(168,85,247,0.45)",
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather
          name={isCopied ? "check" : "copy"}
          size={12}
          color={isCopied ? colors.green : colors.purple}
        />
        <Text
          style={[
            styles.copyChipText,
            { color: isCopied ? colors.green : colors.purple },
          ]}
        >
          {isCopied ? "Copied" : "Copy"}
        </Text>
      </Pressable>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  const colors = useColors();
  return (
    <View style={styles.stepRow}>
      <View
        style={[
          styles.stepBadge,
          {
            backgroundColor: "rgba(168,85,247,0.15)",
            borderColor: "rgba(168,85,247,0.4)",
          },
        ]}
      >
        <Text style={[styles.stepN, { color: colors.purple }]}>{n}</Text>
      </View>
      <Text style={[styles.stepText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  scroll: { paddingHorizontal: 16, gap: 14 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnSpacer: { width: 40 },
  headerCenter: { flex: 1, alignItems: "center", minWidth: 0 },
  eyebrow: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  payTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  agentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatarWrap: { width: 44, height: 44, position: "relative" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 18, fontFamily: "Inter_700Bold" },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  agentName: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 3 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  statDot: { fontSize: 11, fontFamily: "Inter_500Medium", marginHorizontal: 2 },
  escrowChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  escrowChipText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  qrCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 14,
  },
  qrEyebrow: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.6,
  },
  qrFrame: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  qrInner: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
  },
  qrCorner: {
    position: "absolute",
    width: 22,
    height: 22,
    borderWidth: 2,
  },
  qrCornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  qrCornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  qrCornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  qrCornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  upiAppsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  appBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  appBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2 },
  detailsCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1, marginBottom: 3 },
  detailValue: { fontSize: 14 },
  copyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  copyChipText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  divider: { height: 1, backgroundColor: "rgba(148,163,184,0.08)" },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  warningText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", minWidth: 0, lineHeight: 18 },
  steps: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  stepsLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepN: { fontSize: 11, fontFamily: "Inter_700Bold" },
  stepText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", minWidth: 0 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 12,
    marginTop: 4,
  },
  btnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.3,
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  footerText: { flex: 1, fontSize: 10, fontFamily: "Inter_400Regular", minWidth: 0 },
  errorWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  errorTitle: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  errorSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  errorBtn: {
    marginTop: 12,
    height: 48,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
