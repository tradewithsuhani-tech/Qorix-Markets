import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/motion/page_transitions.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/app_typography.dart';

abstract final class AppTheme {
  static ThemeData get dark => _build(isDark: true);
  static ThemeData get light => _build(isDark: false);

  static ThemeData _build({required bool isDark}) {
    final bg = isDark ? AppColors.darkBg : AppColors.lightBg;
    final surface = AppColors.surface(isDark);
    final border = AppColors.border(isDark);
    final text = AppColors.textPrimary(isDark);
    final textTheme = AppTypography.build(isDark: isDark);

    return ThemeData(
      useMaterial3: true,
      brightness: isDark ? Brightness.dark : Brightness.light,
      scaffoldBackgroundColor: bg,
      colorScheme: ColorScheme(
        brightness: isDark ? Brightness.dark : Brightness.light,
        primary: AppColors.brand,
        onPrimary: AppColors.darkBg,
        secondary: AppColors.buy,
        onSecondary: AppColors.darkBg,
        tertiary: AppColors.emerald,
        surface: surface,
        onSurface: text,
        error: AppColors.sell,
        onError: Colors.white,
      ),
      textTheme: textTheme,
      dividerColor: border.withValues(alpha: 0.5),
      splashColor: AppColors.brand.withValues(alpha: 0.08),
      highlightColor: AppColors.brand.withValues(alpha: 0.04),
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: text,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge,
        systemOverlayStyle: isDark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.transparent,
        indicatorColor: AppColors.brand.withValues(alpha: 0.12),
        height: AppSpacing.navBarHeight,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 10,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            letterSpacing: 0.2,
            color: selected
                ? AppColors.brand
                : AppColors.muted(isDark),
          );
        }),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark ? AppColors.darkElevated : AppColors.lightElevated,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.lg,
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide(color: border.withValues(alpha: 0.6)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide(color: border.withValues(alpha: 0.5)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: const BorderSide(color: AppColors.brand, width: 1.5),
        ),
        hintStyle: textTheme.bodyMedium,
        labelStyle: textTheme.labelMedium,
      ),
      cardTheme: CardThemeData(
        color: AppColors.card(isDark),
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.lgAll,
          side: BorderSide(color: border.withValues(alpha: 0.4)),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: isDark ? AppColors.darkElevated : AppColors.lightElevated,
        selectedColor: AppColors.brand.withValues(alpha: 0.15),
        labelStyle: textTheme.labelMedium,
        side: BorderSide(color: border.withValues(alpha: 0.4)),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.smAll),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: AppColors.card(isDark),
        elevation: 0,
        modalBarrierColor: Colors.black.withValues(alpha: 0.52),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
        ),
        dragHandleColor: AppColors.muted(isDark).withValues(alpha: 0.35),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.card(isDark),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.lgAll,
          side: BorderSide(color: border.withValues(alpha: 0.35)),
        ),
        titleTextStyle: textTheme.titleMedium,
        contentTextStyle: textTheme.bodyMedium,
        actionsPadding: const EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.lg),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: InstitutionalFadeTransitionsBuilder(),
          TargetPlatform.iOS: InstitutionalFadeTransitionsBuilder(),
          TargetPlatform.macOS: InstitutionalFadeTransitionsBuilder(),
        },
      ),
    );
  }
}
