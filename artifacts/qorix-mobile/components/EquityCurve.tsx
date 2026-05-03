import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { BotPulse } from "@/components/BotPulse";
import { useColors } from "@/hooks/useColors";

export interface EquityCurveProps {
  data: Record<string, number[]>;
  width: number;
  height?: number;
  initialTimeframe?: string;
  updatedAgo?: string;
}

export function EquityCurve({
  data,
  width,
  height = 200,
  initialTimeframe = "30D",
  updatedAgo = "33s",
}: EquityCurveProps) {
  const colors = useColors();
  const [tf, setTf] = useState(initialTimeframe);
  const timeframes = Object.keys(data);
  const series = data[tf] ?? [];

  const path = useMemo(() => {
    if (series.length < 2) return { line: "", min: 0, max: 0, fill: "" };
    const padL = 44;
    const padR = 12;
    const padT = 16;
    const padB = 24;
    const w = width - padL - padR;
    const h = height - padT - padB;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;
    const points = series.map((v, i) => {
      const x = padL + (i / (series.length - 1)) * w;
      const y = padT + h - ((v - min) / range) * h;
      return { x, y };
    });

    const cmds: string[] = [];
    points.forEach((p, i) => {
      if (i === 0) cmds.push(`M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
      else {
        const prev = points[i - 1];
        const cpx = (prev.x + p.x) / 2;
        cmds.push(`Q ${cpx.toFixed(2)} ${prev.y.toFixed(2)}, ${cpx.toFixed(2)} ${((prev.y + p.y) / 2).toFixed(2)}`);
        cmds.push(`T ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
      }
    });
    const line = cmds.join(" ");
    const last = points[points.length - 1];
    const first = points[0];
    const fill = `${line} L ${last.x.toFixed(2)} ${(padT + h).toFixed(2)} L ${first.x.toFixed(2)} ${(padT + h).toFixed(2)} Z`;
    return { line, fill, min, max, padL, padR, padT, padB, w, h };
  }, [series, width, height]);

  const gridY = useMemo(() => {
    if (!path.padT && path.padT !== 0) return [];
    const lines = 5;
    return Array.from({ length: lines }, (_, i) => {
      const y = path.padT + (i / (lines - 1)) * path.h;
      const v = path.max - (i / (lines - 1)) * (path.max - path.min);
      return { y, value: v };
    });
  }, [path]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>Equity Curve</Text>
            <View style={[styles.livePill, { backgroundColor: "rgba(34,197,94,0.15)" }]}>
              <BotPulse color={colors.green} size={5} />
              <Text style={[styles.liveText, { color: colors.green }]}>LIVE</Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Live Performance · updated {updatedAgo} ago
          </Text>
        </View>
        <View style={[styles.tfBar, { backgroundColor: colors.card2 }]}>
          {timeframes.map((t) => {
            const active = t === tf;
            return (
              <Pressable
                key={t}
                onPress={() => { Haptics.selectionAsync(); setTf(t); }}
                style={[
                  styles.tfBtn,
                  active && { backgroundColor: colors.blue },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: "Inter_700Bold",
                    color: active ? "#fff" : colors.textSecondary,
                  }}
                >
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.blue} stopOpacity="0.28" />
            <Stop offset="100%" stopColor={colors.blue} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {gridY.map((g, i) => (
          <React.Fragment key={i}>
            <Line
              x1={path.padL}
              y1={g.y}
              x2={width - (path.padR ?? 0)}
              y2={g.y}
              stroke={colors.border}
              strokeWidth={0.5}
              strokeDasharray="3 4"
            />
            <SvgText
              x={path.padL ? path.padL - 6 : 0}
              y={g.y + 3}
              fontSize="9"
              fill={colors.textMuted}
              textAnchor="end"
              fontFamily="Inter_500Medium"
            >
              {`$${Math.round(g.value).toLocaleString("en-US")}`}
            </SvgText>
          </React.Fragment>
        ))}
        <Path d={path.fill} fill="url(#equityFill)" />
        <Path
          d={path.line}
          stroke={colors.blue}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  liveText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  tfBar: {
    flexDirection: "row",
    gap: 2,
    padding: 3,
    borderRadius: 12,
  },
  tfBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9 },
});
