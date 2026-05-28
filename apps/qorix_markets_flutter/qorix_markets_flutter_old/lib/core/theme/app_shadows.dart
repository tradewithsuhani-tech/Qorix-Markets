import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

abstract final class AppShadows {
  static List<BoxShadow> card(bool isDark) => [
        if (isDark)
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.45),
            blurRadius: 24,
            offset: const Offset(0, 8),
          )
        else
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
      ];

  static List<BoxShadow> cardGlow(bool isDark) => [
        ...card(isDark),
        BoxShadow(
          color: AppColors.emeraldGlowShadow(isDark ? 0.04 : 0.03),
          blurRadius: 20,
          spreadRadius: -6,
          offset: const Offset(0, 8),
        ),
      ];

  static List<BoxShadow> brandGlow({double intensity = 0.35}) => [
        BoxShadow(
          color: AppColors.brandGlow(intensity),
          blurRadius: 24,
          spreadRadius: -2,
          offset: const Offset(0, 8),
        ),
      ];

  static List<BoxShadow> buyGlow({double intensity = 0.12}) => [
        BoxShadow(
          color: AppColors.buyGlow(intensity),
          blurRadius: 20,
          spreadRadius: -2,
          offset: const Offset(0, 6),
        ),
      ];

  static List<BoxShadow> fabGlow() => [
        BoxShadow(
          color: AppColors.brandGlow(0.45),
          blurRadius: 28,
          spreadRadius: 0,
          offset: const Offset(0, 8),
        ),
        BoxShadow(
          color: AppColors.neonGlow(0.2),
          blurRadius: 40,
          spreadRadius: -4,
          offset: const Offset(0, 12),
        ),
      ];

  static List<BoxShadow> navBar(bool isDark) => [
        BoxShadow(
          color: Colors.black.withValues(alpha: isDark ? 0.5 : 0.08),
          blurRadius: 24,
          offset: const Offset(0, -4),
        ),
      ];

  static List<BoxShadow> subtle(bool isDark) => [
        BoxShadow(
          color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.04),
          blurRadius: 12,
          offset: const Offset(0, 2),
        ),
      ];

  /// Layered luxury depth — hero surfaces, wealth cards.
  static List<BoxShadow> luxuryHero(bool isDark) => [
        ...cardGlow(isDark),
        BoxShadow(
          color: AppColors.brand.withValues(alpha: isDark ? 0.06 : 0.04),
          blurRadius: 48,
          spreadRadius: -8,
          offset: const Offset(0, 16),
        ),
        BoxShadow(
          color: AppColors.emerald.withValues(alpha: 0.05),
          blurRadius: 64,
          spreadRadius: -12,
          offset: const Offset(-4, 20),
        ),
      ];

  /// Rim light separation — emerald/gold accent edge.
  static List<BoxShadow> rimGlow(Color color, {double alpha = 0.12}) => [
        BoxShadow(
          color: color.withValues(alpha: alpha),
          blurRadius: 1,
          spreadRadius: 0,
        ),
      ];
}
