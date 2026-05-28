import 'package:flutter/material.dart';

abstract final class AppColors {
  static const brand = Color(0xFF8B5CF6);
  static const buy = Color(0xFF22C55E);
  static const sell = Color(0xFFEF4444);
  static const emerald = Color(0xFF10B981);
  static const warning = Color(0xFFF59E0B);
  static const darkBg = Color(0xFF0B1014);
  static const darkElevated = Color(0xFF161D28);
  static const darkBorder = Color(0xFF1E2630);
  static const lightBg = Color(0xFFF8FAFC);
  static const lightBgSecondary = Color(0xFFE2E8F0);
  static const lightElevated = Color(0xFFFFFFFF);
  static const lightSurface = Color(0xFFF1F5F9);
  static const authPageBg = Color(0xFF0A0E12);
  static const authCardBg = Color(0xFF12171C);
  static const authInputBg = Color(0xFF0E1217);
  static const authInputBorder = Color(0xFF252D38);
  static const authMuted = Color(0xFF94A3B8);
  static const authGreen = Color(0xFF10B981);
  static const authGreenDark = Color(0xFF059669);
  static const authGreenLight = Color(0xFF34D399);
  static const authGold = Color(0xFFEAB308);
  static const authGoldLight = Color(0xFFFDE047);
  static const neonGreen = Color(0xFF22FF88);
  static const brandGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFF3B82F6), Color(0xFF8B5CF6), Color(0xFFEC4899)],
  );
  static const authGreenGradient = LinearGradient(
    colors: [authGreenDark, authGreen, authGreenLight],
  );
  static const authGoldGradient = LinearGradient(
    colors: [Color(0xFFCA8A04), authGold, authGoldLight],
  );

  static Color surface(bool isDark) => isDark ? darkElevated : lightSurface;
  static Color card(bool isDark) => isDark ? const Color(0xFF11161E) : Colors.white;
  static Color muted(bool isDark) => isDark ? authMuted : const Color(0xFF64748B);
  static Color textPrimary(bool isDark) => isDark ? const Color(0xFFF9FAFB) : const Color(0xFF0F172A);
  static Color border(bool isDark) => isDark ? darkBorder : const Color(0xFFCBD5E1);
  static Color brandGlow([double a = 0.35]) => brand.withValues(alpha: a);
  static Color buyGlow([double a = 0.12]) => buy.withValues(alpha: a);
  static Color neonGlow([double a = 0.2]) => neonGreen.withValues(alpha: a);
  static Color emeraldGlowShadow([double a = 0.04]) => emerald.withValues(alpha: a);
}
