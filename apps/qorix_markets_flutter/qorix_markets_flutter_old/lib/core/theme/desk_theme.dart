import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';

/// Institutional desk palette — hedge-fund dark shell used across logged-in app.
abstract final class AppDesk {
  static const bg = Color(0xFF0A0E12);
  static const surface = Color(0xFF12171C);
  static const elevated = Color(0xFF161C22);
  static const field = Color(0xFF0E1217);
  static const border = Color(0xFF1E2630);
  static const borderSubtle = Color(0xFF252D38);

  static const accent = AppColors.authGreen;

  /// Borders rendered ~12% softer than raw token for less visual noise.
  static Color get borderLine => border.withValues(alpha: 0.86);

  static Color get textPrimary => Colors.white.withValues(alpha: 0.94);
  static Color get textSecondary => AppColors.authMuted.withValues(alpha: 0.82);
  static Color get textTertiary => AppColors.authMuted.withValues(alpha: 0.54);

  static const double cardRadius = AppRadius.lg;
  static const EdgeInsets cardPadding = EdgeInsets.all(AppSpacing.lg);
  static const double metricBlockGap = AppSpacing.md;

  static TextStyle get sectionTitle => const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.25,
        height: 1.2,
        color: Colors.white,
      );

  static TextStyle get sectionCaption => TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        height: 1.35,
        color: textSecondary,
      );

  static TextStyle get overline => TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.55,
        color: textTertiary,
      );

  static TextStyle get heroValue => const TextStyle(
        fontSize: 32,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.75,
        height: 1.05,
        color: Colors.white,
        fontFeatures: [FontFeature.tabularFigures()],
      );

  static TextStyle get metricLabel => TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        color: textTertiary,
      );

  static TextStyle get metricValue => const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        color: Colors.white,
        fontFeatures: [FontFeature.tabularFigures()],
      );

  /// Strong tabular amount — audit / ledger readability.
  static TextStyle get amountDisplay => const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w800,
        height: 1.1,
        fontFeatures: [FontFeature.tabularFigures()],
      );

  static TextStyle get amountHero => const TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.6,
        height: 1.05,
        color: Colors.white,
        fontFeatures: [FontFeature.tabularFigures()],
      );

  static BoxDecoration card({Color? accent, double radius = cardRadius}) => BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: accent?.withValues(alpha: 0.20) ?? borderLine),
      );

  static BoxDecoration elevatedCard({double radius = cardRadius}) => BoxDecoration(
        color: elevated,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: borderSubtle.withValues(alpha: 0.52)),
      );

  static List<BoxShadow> accentGlow(Color color, {double alpha = 0.08}) => [
        BoxShadow(
          color: color.withValues(alpha: alpha),
          blurRadius: 12,
          spreadRadius: -2,
          offset: const Offset(0, 3),
        ),
      ];

  static BoxDecoration primaryButton({Color? accent}) {
    final c = accent ?? AppColors.authGreen;
    return BoxDecoration(
      borderRadius: BorderRadius.circular(AppRadius.md),
      gradient: LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [AppColors.authGreenDark, c, AppColors.authGreenLight.withValues(alpha: 0.92)],
      ),
      boxShadow: accentGlow(c, alpha: 0.04),
    );
  }

  static TextStyle get pageTitle => const TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.4,
        height: 1.15,
        color: Colors.white,
      );

  static TextStyle get pageSubtitle => TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        height: 1.35,
        color: textTertiary,
      );

  static TextStyle get metricHero => amountHero;

  static const EdgeInsets densePadding = EdgeInsets.all(AppSpacing.lg);
  static const double iconBoxSize = 40;
  static const double iconMd = 20;
  static const double iconSm = 16;

  static BoxDecoration fieldBox({bool focused = false}) => BoxDecoration(
        color: field,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: focused ? accent.withValues(alpha: 0.38) : borderLine),
      );

  static BoxDecoration liveBadge() => BoxDecoration(
        color: accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: accent.withValues(alpha: 0.22)),
      );

  static BoxDecoration outlineButton({Color? accentColor}) => BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.md),
        color: surface,
        border: Border.all(color: accentColor?.withValues(alpha: 0.32) ?? borderLine),
      );

  static Divider listDivider({double indent = 0}) => Divider(
        height: 1,
        thickness: 1,
        indent: indent,
        color: borderLine.withValues(alpha: 0.65),
      );
}
