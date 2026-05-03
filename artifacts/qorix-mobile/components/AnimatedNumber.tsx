import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, TextStyle } from "react-native";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  style?: TextStyle | TextStyle[];
  duration?: number;
  formatter?: (n: number) => string;
}

export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  style,
  duration = 900,
  formatter,
}: AnimatedNumberProps) {
  const animated = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    animated.setValue(0);
    const listener = animated.addListener(({ value: t }) => {
      setDisplay(start + (end - start) * t);
    });
    Animated.timing(animated, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      prevValue.current = end;
    });
    return () => {
      animated.removeListener(listener);
    };
  }, [value, animated, duration]);

  const formatted = formatter
    ? formatter(display)
    : display.toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return <Text style={style}>{prefix}{formatted}{suffix}</Text>;
}
