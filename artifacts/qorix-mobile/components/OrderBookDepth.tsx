import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export interface OrderBookLevel {
  price: number;
  qty: number;
  total: number;
}

interface OrderBookDepthProps {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  midPrice: number;
}

export function OrderBookDepth({ bids, asks, spread, midPrice }: OrderBookDepthProps) {
  const colors = useColors();
  const maxBid = Math.max(...bids.map((b) => b.total), 1);
  const maxAsk = Math.max(...asks.map((a) => a.total), 1);
  const maxTotal = Math.max(maxBid, maxAsk);

  const formatPrice = (p: number) =>
    p >= 1000 ? p.toLocaleString("en-US", { maximumFractionDigits: 2 }) : p.toFixed(4);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.headerCell, { color: colors.textMuted }]}>Price (USDT)</Text>
        <Text style={[styles.headerCell, { color: colors.textMuted, textAlign: "right" }]}>Amount</Text>
      </View>

      {/* Asks (top) */}
      <View style={styles.side}>
        {asks.slice(0, 5).reverse().map((a, i) => {
          const pct = (a.total / maxTotal) * 100;
          return (
            <View key={`a${i}`} style={styles.level}>
              <View style={[styles.depthBar, { width: `${pct}%`, backgroundColor: "rgba(239,68,68,0.18)", right: 0 }]} />
              <Text style={[styles.priceText, { color: colors.red }]}>{formatPrice(a.price)}</Text>
              <Text style={[styles.qtyText, { color: colors.foreground }]}>{a.qty.toFixed(4)}</Text>
            </View>
          );
        })}
      </View>

      {/* Spread divider */}
      <View style={[styles.spreadRow, { borderColor: colors.border }]}>
        <Text style={[styles.midPrice, { color: colors.foreground }]}>{formatPrice(midPrice)}</Text>
        <Text style={[styles.spreadText, { color: colors.textMuted }]}>
          spread {spread.toFixed(4)}
        </Text>
      </View>

      {/* Bids */}
      <View style={styles.side}>
        {bids.slice(0, 5).map((b, i) => {
          const pct = (b.total / maxTotal) * 100;
          return (
            <View key={`b${i}`} style={styles.level}>
              <View style={[styles.depthBar, { width: `${pct}%`, backgroundColor: "rgba(16,208,112,0.18)", right: 0 }]} />
              <Text style={[styles.priceText, { color: colors.green }]}>{formatPrice(b.price)}</Text>
              <Text style={[styles.qtyText, { color: colors.foreground }]}>{b.qty.toFixed(4)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  headerCell: { fontSize: 10, fontFamily: "Inter_500Medium", flex: 1 },
  side: { gap: 1 },
  level: {
    height: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    position: "relative",
  },
  depthBar: { position: "absolute", top: 0, bottom: 0, opacity: 0.6 },
  priceText: { flex: 1, fontSize: 11, fontFamily: "Inter_600SemiBold", zIndex: 1 },
  qtyText: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right", zIndex: 1 },
  spreadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginVertical: 2,
  },
  midPrice: { fontSize: 13, fontFamily: "Inter_700Bold" },
  spreadText: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
