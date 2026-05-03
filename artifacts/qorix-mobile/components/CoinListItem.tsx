import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Sparkline } from "@/components/Sparkline";
import { Touchable } from "@/components/Touchable";
import { useColors } from "@/hooks/useColors";

export interface CoinRowData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volumeQuote: string;
  spark: number[];
  logoColors: [string, string];
  pair?: string;
}

interface CoinListItemProps {
  coin: CoinRowData;
  onPress?: () => void;
  showVolume?: boolean;
}

export function CoinListItem({ coin, onPress, showVolume = true }: CoinListItemProps) {
  const colors = useColors();
  const isUp = coin.change24h >= 0;
  const changeColor = isUp ? colors.green : colors.red;

  const formatPrice = (n: number) => {
    if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (n >= 1) return n.toFixed(2);
    return n.toFixed(6);
  };

  return (
    <Touchable
      onPress={() => onPress?.()}
      style={styles.row}
      scaleTo={0.985}
      highlightRadius={12}
      haptic="selection"
    >
      <LinearGradient colors={coin.logoColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
        <Text style={styles.logoText}>{coin.symbol.charAt(0)}</Text>
      </LinearGradient>

      <View style={styles.middle}>
        <View style={styles.symbolRow}>
          <Text style={[styles.symbol, { color: colors.foreground }]}>{coin.symbol}</Text>
          <Text style={[styles.pair, { color: colors.textMuted }]}>/{coin.pair ?? "USDT"}</Text>
        </View>
        {showVolume && (
          <Text style={[styles.volume, { color: colors.textMuted }]} numberOfLines={1}>
            Vol {coin.volumeQuote}
          </Text>
        )}
      </View>

      <View style={styles.sparkBox}>
        <Sparkline
          data={coin.spark}
          width={60}
          height={28}
          color={changeColor}
          strokeWidth={1.5}
          showDot={false}
        />
      </View>

      <View style={styles.right}>
        <Text style={[styles.price, { color: colors.foreground }]}>
          ${formatPrice(coin.price)}
        </Text>
        <View style={[styles.changePill, { backgroundColor: changeColor }]}>
          <Text style={styles.changeText}>
            {isUp ? "+" : ""}{coin.change24h.toFixed(2)}%
          </Text>
        </View>
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  logo: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  middle: { flex: 1, gap: 2 },
  symbolRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  symbol: { fontSize: 14, fontFamily: "Inter_700Bold" },
  pair: { fontSize: 11, fontFamily: "Inter_500Medium" },
  volume: { fontSize: 10, fontFamily: "Inter_400Regular" },
  sparkBox: { width: 60, height: 28, alignItems: "center", justifyContent: "center" },
  right: { alignItems: "flex-end", gap: 4, minWidth: 88 },
  price: { fontSize: 13, fontFamily: "Inter_700Bold" },
  changePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, minWidth: 60, alignItems: "center" },
  changeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
});
