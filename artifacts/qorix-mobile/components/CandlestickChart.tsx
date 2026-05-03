import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

export interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
}

interface CandlestickChartProps {
  candles: Candle[];
  width: number;
  height: number;
  live?: boolean;
}

export function CandlestickChart({ candles: initial, width, height, live = true }: CandlestickChartProps) {
  const colors = useColors();
  const [candles, setCandles] = useState<Candle[]>(initial);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      setCandles((prev) => {
        const last = prev[prev.length - 1];
        const drift = (Math.random() - 0.5) * (last.c * 0.004);
        const newClose = Math.max(0.0001, last.c + drift);
        const updated: Candle = {
          o: last.o,
          h: Math.max(last.h, newClose),
          l: Math.min(last.l, newClose),
          c: newClose,
        };
        return [...prev.slice(0, -1), updated];
      });
    }, 1500);
    return () => clearInterval(id);
  }, [live]);

  if (!candles || candles.length === 0) return null;

  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const allHighs = candles.map((c) => c.h);
  const allLows = candles.map((c) => c.l);
  const max = Math.max(...allHighs);
  const min = Math.min(...allLows);
  const range = max - min || 1;

  const slot = chartW / candles.length;
  const bodyW = Math.max(2, slot * 0.65);

  const yFor = (p: number) => padding + chartH - ((p - min) / range) * chartH;

  // Horizontal grid lines
  const gridLines = 4;
  const grids = Array.from({ length: gridLines }, (_, i) => padding + (i / (gridLines - 1)) * chartH);

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height}>
        {grids.map((y, i) => (
          <Line
            key={`g${i}`}
            x1={padding}
            y1={y}
            x2={width - padding}
            y2={y}
            stroke={colors.border}
            strokeWidth={0.5}
            strokeDasharray="2 4"
          />
        ))}
        {candles.map((c, i) => {
          const isUp = c.c >= c.o;
          const fill = isUp ? colors.green : colors.red;
          const cx = padding + i * slot + slot / 2;
          const yHigh = yFor(c.h);
          const yLow = yFor(c.l);
          const yOpen = yFor(c.o);
          const yClose = yFor(c.c);
          const yTop = Math.min(yOpen, yClose);
          const yBottom = Math.max(yOpen, yClose);
          const bodyH = Math.max(1, yBottom - yTop);
          return (
            <React.Fragment key={i}>
              <Line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={fill} strokeWidth={1} />
              <Rect
                x={cx - bodyW / 2}
                y={yTop}
                width={bodyW}
                height={bodyH}
                fill={fill}
                rx={1}
              />
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },
});

// Generate seed candles
export function generateCandles(count: number, startPrice: number, volatility: number = 0.015): Candle[] {
  const out: Candle[] = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const o = price;
    const direction = Math.random() > 0.5 ? 1 : -1;
    const move = price * volatility * (Math.random() * 0.6 + 0.4) * direction;
    const c = Math.max(0.01, o + move);
    const h = Math.max(o, c) * (1 + Math.random() * volatility * 0.4);
    const l = Math.min(o, c) * (1 - Math.random() * volatility * 0.4);
    out.push({ o, h, l, c });
    price = c;
  }
  return out;
}
