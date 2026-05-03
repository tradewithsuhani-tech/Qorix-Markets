import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BANKS } from "@/constants/banks";
import { P2P_AGENTS } from "@/constants/p2pAgents";
import { usePortfolio } from "@/context/PortfolioContext";
import { useColors } from "@/hooks/useColors";

export default function DepositNetBankingVerifyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { deposit } = usePortfolio();
  const params = useLocalSearchParams<{
    bankId?: string;
    agentId?: string;
    amount?: string;
  }>();

  const payee = useMemo(() => {
    if (params.agentId) {
      const agent = P2P_AGENTS.find((a) => a.id === params.agentId);
      if (agent) {
        return {
          kind: "agent" as const,
          id: agent.id,
          shortName: agent.name,
          color: agent.avatarColor,
          initial: agent.initial,
          statusSub: `Submit UTR & screenshot from your UPI app`,
          verifyingLabel: agent.name,
        };
      }
      return null;
    }
    if (params.bankId) {
      const bank = BANKS.find((b) => b.id === params.bankId);
      if (bank) {
        return {
          kind: "bank" as const,
          id: bank.id,
          shortName: bank.shortName,
          color: bank.color,
          initial: bank.initial,
          statusSub: `Submit UTR & screenshot from ${bank.shortName} transfer`,
          verifyingLabel: bank.shortName,
        };
      }
    }
    return null;
  }, [params.bankId, params.agentId]);
  const numAmount = parseFloat(params.amount ?? "0") || 0;
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  const MAX_SCREENSHOTS = 3;
  const [utr, setUtr] = useState("");
  const [screenshots, setScreenshots] = useState<
    Array<{ uri: string; name: string; id: string }>
  >([]);
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [utrError, setUtrError] = useState<string | null>(null);

  const UTR_MIN = 12;
  const UTR_MAX = 22;

  const utrTrimmed = utr.trim();
  // Real Indian UTRs vary: NEFT 16 digits, IMPS 12 alphanumeric, RTGS 22 alphanumeric.
  // Accept 12–22 uppercase alphanumeric chars.
  const utrValid = new RegExp(`^[A-Z0-9]{${UTR_MIN},${UTR_MAX}}$`).test(
    utrTrimmed,
  );
  const remainingSlots = MAX_SCREENSHOTS - screenshots.length;
  const formValid = utrValid && screenshots.length > 0;

  const handlePickScreenshots = async () => {
    if (picking || submitting || remainingSlots <= 0) return;
    setPicking(true);
    setPickError(null);
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setPickError(
            "Photo library access denied. Enable it in Settings to upload your screenshot.",
          );
          setPicking(false);
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
      });
      if (!result.canceled && result.assets.length > 0) {
        const stamp = Date.now();
        const newOnes = result.assets.slice(0, remainingSlots).map((a, i) => ({
          uri: a.uri,
          name: a.fileName ?? `payment-proof-${stamp}-${i}.jpg`,
          id: `${stamp}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        }));
        setScreenshots((prev) => [...prev, ...newOnes]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setPickError("Couldn't open image picker. Please try again.");
    } finally {
      setPicking(false);
    }
  };

  const removeScreenshot = (id: string) => {
    if (submitting) return;
    setScreenshots((prev) => prev.filter((s) => s.id !== id));
    Haptics.selectionAsync();
  };

  const handleSubmit = async () => {
    if (!payee || !formValid || submitting) return;
    if (!utrValid) {
      setUtrError(`UTR must be ${UTR_MIN}–${UTR_MAX} alphanumeric characters`);
      return;
    }
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((r) => setTimeout(r, 1800));
    await deposit(numAmount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({
      pathname: "/deposit-success",
      params: {
        amount: String(numAmount),
        ...(payee.kind === "agent"
          ? { agentId: payee.id }
          : { bankId: payee.id }),
        utr: utrTrimmed,
      },
    });
  };

  const handleUtrChange = (val: string) => {
    // Allow uppercase alphanumeric only, auto-uppercase, cap at UTR_MAX.
    setUtr(val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, UTR_MAX));
    if (utrError) setUtrError(null);
  };

  if (!payee) {
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
            We couldn&apos;t find this payment. Please go back and start your
            deposit again.
          </Text>
          <Pressable
            onPress={() => router.replace("/deposit")}
            accessibilityRole="button"
            accessibilityLabel="Back to deposit"
            style={({ pressed }) => [
              styles.errorBtn,
              { backgroundColor: colors.purple, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text
              style={{
                fontSize: 15,
                fontFamily: "Inter_700Bold",
                color: "#fff",
                letterSpacing: 0.3,
              }}
            >
              Back to Deposit
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPadding, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            disabled={submitting}
            style={({ pressed }) => [
              styles.backBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: submitting ? 0.4 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.eyebrow, { color: colors.purple }]}>
              VERIFY PAYMENT
            </Text>
            <Text style={[styles.payTitle, { color: colors.foreground }]}>
              Confirm ₹{numAmount.toLocaleString("en-IN")}
            </Text>
          </View>
          <View style={styles.backBtnSpacer} />
        </View>

        {/* Status banner */}
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: "rgba(168,85,247,0.10)",
              borderColor: "rgba(168,85,247,0.35)",
            },
          ]}
        >
          <View
            style={[
              styles.bankLogo,
              {
                backgroundColor: `${payee.color}22`,
                borderColor: `${payee.color}66`,
              },
            ]}
          >
            <Text style={[styles.bankInitial, { color: payee.color }]}>
              {payee.initial}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.statusTitle, { color: colors.foreground }]}>
              Awaiting verification
            </Text>
            <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
              {payee.statusSub}
            </Text>
          </View>
        </View>

        {/* UTR input */}
        <View style={{ gap: 8 }}>
          <View style={styles.fieldHeader}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              UTR / Transaction Reference
            </Text>
            <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
              {utrTrimmed.length}/{UTR_MAX}
            </Text>
          </View>
          <View
            style={[
              styles.utrBox,
              {
                backgroundColor: colors.card,
                borderColor: utrError
                  ? colors.red
                  : utrValid
                    ? "rgba(46,204,113,0.5)"
                    : colors.border,
              },
            ]}
          >
            <Feather
              name="hash"
              size={16}
              color={utrValid ? colors.green : colors.textMuted}
            />
            <TextInput
              value={utr}
              onChangeText={handleUtrChange}
              placeholder="e.g. 240501234567 or N12345678901234"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={UTR_MAX}
              editable={!submitting}
              style={[styles.utrInput, { color: colors.foreground }]}
            />
            {utrValid && (
              <Feather name="check-circle" size={16} color={colors.green} />
            )}
          </View>
          {utrError ? (
            <Text style={[styles.errorText, { color: colors.red }]}>
              {utrError}
            </Text>
          ) : (
            <Text style={[styles.helpText, { color: colors.textMuted }]}>
              Find UTR in your bank app's transaction history ({UTR_MIN}–{UTR_MAX} characters,
              IMPS/NEFT/RTGS).
            </Text>
          )}
        </View>

        {/* Screenshot upload */}
        <View style={{ gap: 8 }}>
          <View style={styles.fieldHeader}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              Payment Screenshot
            </Text>
            <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
              {screenshots.length}/{MAX_SCREENSHOTS}
            </Text>
          </View>

          <View style={styles.thumbGrid}>
            {screenshots.map((s) => (
              <View
                key={s.id}
                style={[
                  styles.thumbCell,
                  {
                    backgroundColor: colors.card,
                    borderColor: "rgba(46,204,113,0.45)",
                  },
                ]}
              >
                <Image source={{ uri: s.uri }} style={styles.thumbImg} />
                <View
                  style={[
                    styles.thumbCheck,
                    {
                      backgroundColor: colors.green,
                      borderColor: colors.background,
                    },
                  ]}
                >
                  <Feather name="check" size={10} color="#fff" />
                </View>
                <Pressable
                  onPress={() => removeScreenshot(s.id)}
                  disabled={submitting}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.thumbRemove,
                    {
                      backgroundColor: colors.red,
                      borderColor: colors.background,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Feather name="x" size={12} color="#fff" />
                </Pressable>
              </View>
            ))}

            {remainingSlots > 0 && (
              <Pressable
                onPress={handlePickScreenshots}
                disabled={picking || submitting}
                style={({ pressed }) => [
                  styles.addCell,
                  {
                    backgroundColor: colors.card,
                    borderColor: pickError
                      ? "rgba(239,68,68,0.55)"
                      : "rgba(168,85,247,0.45)",
                    opacity: picking ? 0.6 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                {picking ? (
                  <ActivityIndicator color={colors.purple} />
                ) : (
                  <>
                    <View
                      style={[
                        styles.addIcon,
                        {
                          backgroundColor: pickError
                            ? "rgba(239,68,68,0.15)"
                            : "rgba(168,85,247,0.15)",
                          borderColor: pickError
                            ? "rgba(239,68,68,0.4)"
                            : "rgba(168,85,247,0.4)",
                        },
                      ]}
                    >
                      <Feather
                        name={
                          pickError
                            ? "alert-circle"
                            : screenshots.length === 0
                              ? "upload-cloud"
                              : "plus"
                        }
                        size={18}
                        color={pickError ? colors.red : colors.purple}
                      />
                    </View>
                    <Text
                      style={[
                        styles.addCellText,
                        {
                          color: pickError ? colors.red : colors.foreground,
                        },
                      ]}
                    >
                      {pickError
                        ? "Retry"
                        : screenshots.length === 0
                          ? "Upload"
                          : "Add more"}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          {pickError ? (
            <Text style={[styles.errorText, { color: colors.red }]}>
              {pickError}
            </Text>
          ) : (
            <Text style={[styles.helpText, { color: colors.textMuted }]}>
              Up to {MAX_SCREENSHOTS} images · PNG or JPG · Max 5 MB each ·
              Show full transaction
            </Text>
          )}
        </View>

        {/* Info banner */}
        <View
          style={[
            styles.infoBanner,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather name="shield" size={13} color={colors.purple} />
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            Verified within 2 mins · Auto-credited on UTR match · 24/7 support if delayed
          </Text>
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={!formValid || submitting}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: formValid ? colors.purple : colors.secondary,
              opacity: pressed && formValid ? 0.85 : 1,
            },
          ]}
        >
          {submitting ? (
            <View style={styles.btnRow}>
              <ActivityIndicator color="#fff" />
              <Text style={[styles.btnText, { color: "#fff" }]}>
                Verifying with {payee.verifyingLabel}…
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.btnText,
                { color: formValid ? "#fff" : colors.textMuted },
              ]}
            >
              {!utrValid
                ? "Enter UTR to continue"
                : screenshots.length === 0
                  ? "Upload screenshot to continue"
                  : `Submit for Verification`}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  scroll: { paddingHorizontal: 16, gap: 16 },
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
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  bankLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  bankInitial: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statusTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statusSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  fieldHint: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  utrBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
  },
  utrInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    minWidth: 0,
    height: "100%",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
  },
  helpText: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  errorText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  thumbGrid: { flexDirection: "row", gap: 10 },
  thumbCell: {
    width: 104,
    height: 104,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: "hidden",
    position: "relative",
  },
  thumbImg: { width: "100%", height: "100%", backgroundColor: "#000" },
  thumbCheck: {
    position: "absolute",
    bottom: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  addCell: {
    width: 104,
    height: 104,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addCellText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", minWidth: 0 },
  btn: {
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
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
