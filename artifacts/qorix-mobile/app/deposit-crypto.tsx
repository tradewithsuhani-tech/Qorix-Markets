import { Feather } from "@expo/vector-icons";
import { getGetDepositAddressQueryKey, useGetDepositAddress } from "@workspace/api-client-react";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CRYPTO_METHODS, FX_RATE } from "@/constants/cryptoMethods";
import { useAuth } from "@/context/AuthContext";
import { usePortfolio } from "@/context/PortfolioContext";
import { useColors } from "@/hooks/useColors";

export default function DepositCryptoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { deposit } = usePortfolio();
  const { user, isAuthenticated } = useAuth();
  const isDemo = user?.id === "demo_001";
  const params = useLocalSearchParams<{ id?: string; amount?: string }>();
  const isUsdt = (params.id ?? "").toLowerCase() === "usdt";
  const { data: depAddr, isLoading: depLoading } = useGetDepositAddress({
    query: {
      // Scope by user id so a previous account's deposit address never leaks
      // through the React Query cache to a new user.
      queryKey: [...getGetDepositAddressQueryKey(), user?.id ?? "anon"],
      enabled: isAuthenticated && !isDemo && isUsdt,
      staleTime: 5 * 60 * 1000,
    },
  });

  const [copied, setCopied] = useState<"address" | "tag" | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const baseCrypto = CRYPTO_METHODS.find((c) => c.id === params.id) ?? CRYPTO_METHODS[0];
  const crypto = isUsdt && depAddr?.address
    ? { ...baseCrypto, address: depAddr.address, network: depAddr.network ?? baseCrypto.network }
    : baseCrypto;
  const numAmount = parseFloat(params.amount ?? "0") || 0;
  const amountInr = numAmount * FX_RATE;
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  const copyToClipboard = async (text: string, kind: "address" | "tag") => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleConfirm = async () => {
    if (numAmount <= 0) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await deposit(amountInr);
    setLoading(false);
    setSuccess(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (success) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.successContent, { paddingTop: topPadding }]}>
          <View
            style={[
              styles.successIcon,
              { backgroundColor: "rgba(46,204,113,0.1)", borderColor: "rgba(46,204,113,0.3)" },
            ]}
          >
            <Feather name="check-circle" size={40} color={colors.green} />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Transfer Confirmed</Text>
          <Text style={[styles.successSub, { color: colors.textSecondary }]}>
            {numAmount} {crypto.label} (≈ ₹{Math.round(amountInr).toLocaleString("en-IN")}) credited after on-chain confirmation.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.doneBtn,
              { backgroundColor: colors.purple, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.doneBtnText}>Back to Wallet</Text>
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
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Deposit {crypto.label}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Send {numAmount > 0 ? `${numAmount} ${crypto.label}` : crypto.label} to the address below. Your wallet will credit ₹{Math.round(amountInr).toLocaleString("en-IN")} after on-chain confirmation.
          </Text>
        </View>

        {/* QR Card */}
        <View style={[styles.qrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.qrHeaderRow}>
            <View
              style={[
                styles.cryptoIcon,
                { backgroundColor: `${crypto.color}22`, borderColor: `${crypto.color}55` },
              ]}
            >
              <Text style={[styles.cryptoSymbol, { color: crypto.color }]}>{crypto.symbol}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[styles.qrTitle, { color: colors.foreground }]}>
                Send {crypto.label}
              </Text>
              <Text numberOfLines={1} style={[styles.qrNetwork, { color: colors.textSecondary }]}>
                {crypto.network}
              </Text>
            </View>
            <View
              style={[
                styles.netBadge,
                { backgroundColor: `${crypto.color}22`, borderColor: `${crypto.color}55` },
              ]}
            >
              <View style={[styles.netDot, { backgroundColor: crypto.color }]} />
              <Text style={[styles.netBadgeText, { color: crypto.color }]}>LIVE</Text>
            </View>
          </View>

          {/* Amount summary */}
          {numAmount > 0 && (
            <View style={[styles.amtSummary, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <View>
                <Text style={[styles.amtLabel, { color: colors.textMuted }]}>Send Amount</Text>
                <Text style={[styles.amtValue, { color: colors.foreground }]}>
                  {numAmount} <Text style={{ color: crypto.color }}>{crypto.label}</Text>
                </Text>
              </View>
              <Feather name="arrow-right" size={16} color={colors.textMuted} />
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.amtLabel, { color: colors.textMuted }]}>You Receive</Text>
                <Text style={[styles.amtValue, { color: colors.green }]}>
                  ₹{Math.round(amountInr).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>
          )}

          {/* QR */}
          <View style={styles.qrWrap}>
            {isUsdt && depLoading ? (
              <View style={[styles.qrInner, { width: 196, height: 196, alignItems: "center", justifyContent: "center" }]}>
                <ActivityIndicator color={colors.purple} />
              </View>
            ) : (
              <View style={styles.qrInner}>
                <QRCode value={crypto.address} size={172} color="#0F172A" backgroundColor="#FFFFFF" />
              </View>
            )}
            <Text style={[styles.qrHint, { color: colors.textMuted }]}>
              {isUsdt && depLoading ? "Generating your unique address..." : "Scan with your wallet app"}
            </Text>
          </View>

          {/* Address */}
          <View>
            <Text style={[styles.addrLabel, { color: colors.textSecondary }]}>Wallet Address</Text>
            <Pressable
              onPress={() => copyToClipboard(crypto.address, "address")}
              style={({ pressed }) => [
                styles.addrBox,
                {
                  backgroundColor: colors.input,
                  borderColor: copied === "address" ? colors.green : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[styles.addrText, { color: colors.foreground }]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {crypto.address}
              </Text>
              <View style={styles.copyBtn}>
                <Feather
                  name={copied === "address" ? "check" : "copy"}
                  size={14}
                  color={copied === "address" ? colors.green : colors.purple}
                />
                <Text
                  style={[
                    styles.copyText,
                    { color: copied === "address" ? colors.green : colors.purple },
                  ]}
                >
                  {copied === "address" ? "Copied" : "Copy"}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* XRP destination tag */}
          {crypto.tag && (
            <View>
              <Text style={[styles.addrLabel, { color: colors.textSecondary }]}>
                Destination Tag <Text style={{ color: colors.red }}>(Required)</Text>
              </Text>
              <Pressable
                onPress={() => copyToClipboard(crypto.tag!, "tag")}
                style={({ pressed }) => [
                  styles.addrBox,
                  {
                    backgroundColor: colors.input,
                    borderColor: copied === "tag" ? colors.green : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.addrText, { color: colors.foreground }]}>{crypto.tag}</Text>
                <View style={styles.copyBtn}>
                  <Feather
                    name={copied === "tag" ? "check" : "copy"}
                    size={14}
                    color={copied === "tag" ? colors.green : colors.purple}
                  />
                  <Text
                    style={[
                      styles.copyText,
                      { color: copied === "tag" ? colors.green : colors.purple },
                    ]}
                  >
                    {copied === "tag" ? "Copied" : "Copy"}
                  </Text>
                </View>
              </Pressable>
            </View>
          )}

          {/* Warning */}
          <View
            style={[
              styles.warnBox,
              { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" },
            ]}
          >
            <Feather name="alert-triangle" size={14} color={colors.red} />
            <Text style={[styles.warnText, { color: colors.textSecondary }]}>
              Send only{" "}
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>{crypto.label}</Text>{" "}
              via{" "}
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>{crypto.network}</Text>.
              Sending any other asset or using a different network will result in permanent loss.
            </Text>
          </View>
        </View>

        {/* Security Note */}
        <View style={[styles.secNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="shield" size={13} color={colors.purple} />
          <Text style={[styles.secText, { color: colors.textMuted }]}>
            Funded via on-chain transfer · Verified after 1 confirmation · Auto-converted to INR
          </Text>
        </View>

        <Pressable
          onPress={handleConfirm}
          disabled={loading || numAmount <= 0}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: numAmount > 0 ? colors.purple : colors.secondary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.btnText, { color: numAmount > 0 ? "#fff" : colors.textMuted }]}>
              {numAmount > 0 ? `I've Sent ${numAmount} ${crypto.label}` : "I've Sent the Transfer"}
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: { gap: 6 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  qrCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  qrHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cryptoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cryptoSymbol: { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 22 },
  qrTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  qrNetwork: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  netBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  netDot: { width: 5, height: 5, borderRadius: 3 },
  netBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  amtSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  amtLabel: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.4 },
  amtValue: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 2 },
  qrWrap: { alignItems: "center", gap: 10, paddingVertical: 4 },
  qrInner: { backgroundColor: "#fff", padding: 12, borderRadius: 14 },
  qrHint: { fontSize: 11, fontFamily: "Inter_500Medium" },
  addrLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6 },
  addrBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  addrText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  copyText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  warnBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  warnText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  secNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular" },
  btn: {
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  successContent: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  successSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  doneBtn: {
    marginTop: 12,
    height: 48,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.3 },
});
