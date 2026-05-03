import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { Touchable } from "@/components/Touchable";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

export interface PromoBanner {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  icon: keyof typeof Feather.glyphMap;
  gradient: [string, string];
}

interface PromoBannerCarouselProps {
  banners: PromoBanner[];
  width: number;
  onPress?: (id: string) => void;
}

export function PromoBannerCarousel({ banners, width, onPress }: PromoBannerCarouselProps) {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(id);
  }, [banners.length, width]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  };

  return (
    <View style={{ width }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        decelerationRate="fast"
      >
        {banners.map((b) => (
          <Touchable
            key={b.id}
            onPress={() => onPress?.(b.id)}
            style={[styles.slide, { width }]}
            scaleTo={0.97}
            highlightRadius={18}
            haptic="light"
          >
            <LinearGradient
              colors={b.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bannerCard}
            >
              <View style={styles.bannerOrb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle} numberOfLines={1}>
                  {b.title}
                </Text>
                <Text style={styles.bannerSubtitle} numberOfLines={2}>
                  {b.subtitle}
                </Text>
                <View style={styles.bannerCtaRow}>
                  <Text style={styles.bannerCta}>{b.cta}</Text>
                  <Feather name="arrow-right" size={11} color="#fff" />
                </View>
              </View>
              <View style={styles.bannerIconWrap}>
                <Feather name={b.icon} size={32} color="rgba(255,255,255,0.95)" />
              </View>
            </LinearGradient>
          </Touchable>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {banners.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                width: i === index ? 18 : 6,
                backgroundColor: i === index ? colors.purple : colors.border,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { paddingRight: 0 },
  bannerCard: {
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 92,
    overflow: "hidden",
    position: "relative",
  },
  bannerOrb: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.12)",
    top: -50,
    right: -30,
  },
  bannerTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  bannerSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 3, lineHeight: 15 },
  bannerCtaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  bannerCta: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  bannerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 8 },
  dot: { height: 6, borderRadius: 3 },
});
