import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
}

const INITIAL: TickerItem[] = [
  { symbol: "NIFTY 50", price: 22489.5, change: 0.81 },
  { symbol: "BANKNIFTY", price: 47650.0, change: -0.36 },
  { symbol: "SENSEX", price: 74012.6, change: 0.62 },
  { symbol: "BTC/USDT", price: 67248.3, change: 2.14 },
  { symbol: "ETH/USDT", price: 3284.5, change: 1.45 },
  { symbol: "GOLD MCX", price: 71240.0, change: 0.28 },
  { symbol: "USD/INR", price: 83.42, change: -0.12 },
];

export function MarketTicker() {
  const colors = useColors();
  const [items, setItems] = useState<TickerItem[]>(INITIAL);
  const scrollX = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get("window").width;

  // Animate the ticker scrolling continuously
  useEffect(() => {
    const totalWidth = items.length * 180;
    const animation = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -totalWidth,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [items.length, scrollX]);

  // Simulate live price updates
  useEffect(() => {
    const id = setInterval(() => {
      setItems((prev) =>
        prev.map((item) => {
          const drift = (Math.random() - 0.5) * 0.0008;
          const newPrice = item.price * (1 + drift);
          const changeShift = (Math.random() - 0.5) * 0.04;
          return {
            ...item,
            price: newPrice,
            change: item.change + changeShift,
          };
        })
      );
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const renderItem = (item: TickerItem, key: string | number) => {
    const isUp = item.change >= 0;
    const color = isUp ? colors.green : colors.red;
    return (
      <View key={key} style={styles.item}>
        <Text style={[styles.symbol, { color: colors.foreground }]}>
          {item.symbol}
        </Text>
        <Text style={[styles.price, { color: colors.textSecondary }]}>
          {item.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </Text>
        <View style={[styles.changePill, { backgroundColor: `${color}18` }]}>
          <Text style={[styles.changeText, { color }]}>
            {isUp ? "▲" : "▼"} {Math.abs(item.change).toFixed(2)}%
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: "rgba(15,19,24,0.6)" }]}>
      <Animated.View
        style={[
          styles.scrollRow,
          { width: items.length * 180 * 2, transform: [{ translateX: scrollX }] },
        ]}
      >
        {items.map((item, i) => renderItem(item, `a-${i}`))}
        {items.map((item, i) => renderItem(item, `b-${i}`))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  scrollRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  item: {
    width: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  symbol: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  price: { fontSize: 11, fontFamily: "Inter_500Medium" },
  changePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  changeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
});
