import React from "react";
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from "react-native-svg";

interface SparklineProps {
  data: number[];
  width: number;
  height: number;
  color: string;
  fillColor?: string;
  strokeWidth?: number;
  showDot?: boolean;
}

export function Sparkline({
  data,
  width,
  height,
  color,
  fillColor,
  strokeWidth = 2,
  showDot = true,
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const padding = strokeWidth + 1;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * w;
    const y = padding + h - ((v - min) / range) * h;
    return { x, y };
  });

  const lineCommands: string[] = [];
  points.forEach((p, i) => {
    if (i === 0) {
      lineCommands.push(`M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
    } else {
      const prev = points[i - 1];
      const cpx = (prev.x + p.x) / 2;
      lineCommands.push(`Q ${cpx.toFixed(2)} ${prev.y.toFixed(2)}, ${cpx.toFixed(2)} ${((prev.y + p.y) / 2).toFixed(2)}`);
      lineCommands.push(`T ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
    }
  });
  const linePath = lineCommands.join(" ");

  const fillPath =
    `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(padding + h).toFixed(2)} ` +
    `L ${points[0].x.toFixed(2)} ${(padding + h).toFixed(2)} Z`;

  const last = points[points.length - 1];
  const gradientId = `grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={fillColor ?? color} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={fillColor ?? color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={fillPath} fill={`url(#${gradientId})`} />
      <Path
        d={linePath}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <>
          <Circle cx={last.x} cy={last.y} r={5} fill={color} fillOpacity={0.2} />
          <Circle cx={last.x} cy={last.y} r={2.5} fill={color} />
        </>
      )}
    </Svg>
  );
}
