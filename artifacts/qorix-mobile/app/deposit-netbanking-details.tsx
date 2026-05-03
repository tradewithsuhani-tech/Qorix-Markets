import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
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
import { BANKS } from "@/constants/banks";
import { useColors } from "@/hooks/useColors";

type CopyKey = "holder" | "account" | "ifsc" | "branch" | "ref";

function generateRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `AT-${out}`;
}

export default function DepositNetBankingDetailsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ bankId?: string; amount?: string }>();

  const bank = useMemo(
    () => BANKS.find((b) => b.id === params.bankId) ?? BANKS[0],
    [params.bankId],
  );
  const numAmount = parseFloat(params.amount ?? "0") || 0;
  const refCode = useMemo(() => generateRef(), []);
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  const [copied, setCopied] = useState<CopyKey | null>(null);
  const [navigating, setNavigating] = useState(false);

  const copy = async (text: string, key: CopyKey) => {
    // Strip whitespace only for machine-readable fields (account number, IFSC, ref).
    // Preserve original formatting for human-readable fields (holder, branch).
    const stripSpaces = key === "account" || key === "ifsc" || key === "ref";
    await Clipboard.setStringAsync(stripSpaces ? text.replace(/\s/g, "") : text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  const handleProceedToVerify = () => {
    if (numAmount <= 0 || navigating) return;
    setNavigating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/deposit-netbanking-verify",
      params: { bankId: bank.id, amount: String(numAmount) },
    });
    setTimeout(() => setNavigating(false), 600);
  };

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
              BANK TRANSFER · NEFT/IMPS
            </Text>
            <Text style={[styles.payTitle, { color: colors.foreground }]}>
              Pay ₹{numAmount.toLocaleString("en-IN")}
            </Text>
          </View>
          <View style={styles.backBtnSpacer} />
        </View>

        {/* Bank header card */}
        <View
          style={[
            styles.bankCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.bankLogo,
              {
                backgroundColor: `${bank.color}22`,
                borderColor: `${bank.color}66`,
              },
            ]}
          >
            <Text style={[styles.bankInitial, { color: bank.color }]}>
              {bank.initial}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.bankName, { color: colors.foreground }]}>
              {bank.name}
            </Text>
            <Text style={[styles.bankSub, { color: colors.textSecondary }]}>
              Transfer ₹{numAmount.toLocaleString("en-IN")} to the account below
            </Text>
          </View>
          <View
            style={[
              styles.liveBadge,
              {
                backgroundColor: "rgba(46,204,113,0.12)",
                borderColor: "rgba(46,204,113,0.4)",
              },
            ]}
          >
            <View style={[styles.liveDot, { backgroundColor: colors.green }]} />
            <Text style={[styles.liveText, { color: colors.green }]}>LIVE</Text>
          </View>
        </View>

        {/* Account info */}
        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.detailsHeader, { color: colors.textSecondary }]}>
            BENEFICIARY ACCOUNT DETAILS
          </Text>

          <DetailRow
            label="Account Holder"
            value={bank.account.accountHolder}
            copyKey="holder"
            copied={copied}
            onCopy={copy}
            icon="user"
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <DetailRow
            label="Account Number"
            value={bank.account.accountNumber}
            copyKey="account"
            copied={copied}
            onCopy={copy}
            icon="hash"
            mono
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <DetailRow
            label="IFSC Code"
            value={bank.account.ifsc}
            copyKey="ifsc"
            copied={copied}
            onCopy={copy}
            icon="key"
            mono
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <DetailRow
            label="Branch"
            value={bank.account.branch}
            copyKey="branch"
            copied={copied}
            onCopy={copy}
            icon="map-pin"
          />
        </View>

        {/* Reference code */}
        <View
          style={[
            styles.refCard,
            {
              backgroundColor: "rgba(168,85,247,0.10)",
              borderColor: "rgba(168,85,247,0.40)",
            },
          ]}
        >
          <View style={styles.refRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.refLabel, { color: colors.purple }]}>
                TRANSFER NOTE / REFERENCE
              </Text>
              <Text style={[styles.refValue, { color: colors.foreground }]}>
                {refCode}
              </Text>
            </View>
            <Pressable
              onPress={() => copy(refCode, "ref")}
              hitSlop={8}
              style={({ pressed }) => [
                styles.refCopyBtn,
                {
                  borderColor:
                    copied === "ref" ? colors.green : "rgba(168,85,247,0.6)",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name={copied === "ref" ? "check" : "copy"}
                size={14}
                color={copied === "ref" ? colors.green : colors.purple}
              />
              <Text
                style={[
                  styles.refCopyText,
                  {
                    color: copied === "ref" ? colors.green : colors.purple,
                  },
                ]}
              >
                {copied === "ref" ? "Copied" : "Copy"}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.refHint, { color: colors.textSecondary }]}>
            Add this in the transfer remarks/note so we can match your payment instantly.
          </Text>
        </View>

        {/* Warning */}
        <View
          style={[
            styles.warnBox,
            {
              backgroundColor: "rgba(239,68,68,0.08)",
              borderColor: "rgba(239,68,68,0.25)",
            },
          ]}
        >
          <Feather name="alert-triangle" size={14} color={colors.red} />
          <Text style={[styles.warnText, { color: colors.textSecondary }]}>
            Transfer the{" "}
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>
              exact amount of ₹{numAmount.toLocaleString("en-IN")}
            </Text>
            . Different amount or wrong account may delay/reject crediting.
          </Text>
        </View>

        {/* Steps */}
        <View
          style={[
            styles.stepsCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Step
            n={1}
            text={`Open your bank app and add ${bank.shortName} account as beneficiary (or use Quick Transfer).`}
          />
          <Step
            n={2}
            text={`Send exactly ₹${numAmount.toLocaleString("en-IN")} via NEFT / IMPS / RTGS with the reference code above.`}
          />
          <Step
            n={3}
            text="Tap 'I've Paid' below — funds usually credited within 2 minutes."
          />
        </View>

        {/* Bottom CTA */}
        <Pressable
          onPress={handleProceedToVerify}
          disabled={navigating || numAmount <= 0}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: numAmount > 0 ? colors.purple : colors.secondary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={styles.btnRow}>
            <Text
              style={[
                styles.btnText,
                { color: numAmount > 0 ? "#fff" : colors.textMuted },
              ]}
            >
              I've Paid ₹{numAmount.toLocaleString("en-IN")}
            </Text>
            {numAmount > 0 && (
              <Feather name="arrow-right" size={18} color="#fff" />
            )}
          </View>
        </Pressable>
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
  bankCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  bankLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  bankInitial: { fontSize: 16, fontFamily: "Inter_700Bold" },
  bankName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  bankSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3 },
  liveText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  detailsCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  detailsHeader: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  detailValue: { fontSize: 13 },
  copyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  copyChipText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  divider: { height: 1, opacity: 0.5 },
  refCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  refLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  refValue: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  refCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  refCopyText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  refHint: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  warnBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  warnText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  stepsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepN: { fontSize: 11, fontFamily: "Inter_700Bold" },
  stepText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },
  btn: {
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
});
