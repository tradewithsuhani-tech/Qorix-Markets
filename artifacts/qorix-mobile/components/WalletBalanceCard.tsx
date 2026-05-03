import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useColors } from "@/hooks/useColors";

interface WalletBalanceCardProps {
  balance: number;
  network?: string;
  walletAddress?: string;
  onTap?: () => void;
}

export function WalletBalanceCard({
  balance,
  network = "AutoTrader Wallet · INR",
  walletAddress = "ATR• ••••••••••••3464",
  onTap,
}: WalletBalanceCardProps) {
  const colors = useColors();

  return (
    <LinearGradient
      colors={["#161D27", "#0B1014"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor: colors.border }]}
    >
      <View style={[styles.glow, { backgroundColor: colors.purple }]} />
      <View style={[styles.glow2, { backgroundColor: colors.pink }]} />

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Current Wallet Balance
      </Text>

      <AnimatedNumber
        value={balance}
        prefix="₹"
        decimals={2}
        style={[styles.balance, { color: colors.foreground }]}
      />

      <View style={styles.bottomRow}>
        <View style={[styles.networkPill, { backgroundColor: "rgba(168,85,247,0.15)", borderColor: "rgba(168,85,247,0.3)" }]}>
          <View style={[styles.networkDot, { backgroundColor: colors.purple }]} />
          <Text style={[styles.networkText, { color: colors.foreground }]}>
            {network}
          </Text>
          <Feather name="chevron-down" size={12} color={colors.textSecondary} />
        </View>
      </View>

      <View style={[styles.addressRow, { borderTopColor: colors.border }]}>
        <View style={[styles.coinIcon, { backgroundColor: "rgba(168,85,247,0.18)" }]}>
          <Feather name="zap" size={12} color={colors.purple} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.coinName, { color: colors.foreground }]}>INR</Text>
          <Text style={[styles.coinSub, { color: colors.textMuted }]}>{walletAddress}</Text>
        </View>
        <Pressable
          onPress={onTap}
          style={[styles.copyBtn, { backgroundColor: colors.card2 }]}
        >
          <Feather name="copy" size={12} color={colors.textSecondary} />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    overflow: "hidden",
    position: "relative",
  },
  glow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.15,
    top: -90,
    right: -60,
  },
  glow2: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.08,
    bottom: -60,
    left: -40,
  },
  label: { fontSize: 12, fontFamily: "Inter_500Medium" },
  balance: { fontSize: 34, fontFamily: "Inter_700Bold", letterSpacing: -1, marginVertical: 2 },
  bottomRow: { marginTop: 4 },
  networkPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  networkDot: { width: 7, height: 7, borderRadius: 3.5 },
  networkText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  coinIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  coinName: { fontSize: 13, fontFamily: "Inter_700Bold" },
  coinSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  copyBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
