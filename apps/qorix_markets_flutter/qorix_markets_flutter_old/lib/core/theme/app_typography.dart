import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

abstract final class AppTypography {
  static TextTheme build({required bool isDark}) {
    final base = GoogleFonts.interTextTheme();
    final color = AppColors.textPrimary(isDark);
    return base.apply(bodyColor: color, displayColor: color);
  }

  static TextStyle overline({required bool isDark}) => TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.55,
        color: AppColors.muted(isDark),
      );

  static TextStyle price({required bool isDark, double size = 16, Color? color}) => TextStyle(
        fontSize: size,
        fontWeight: FontWeight.w800,
        color: color ?? AppColors.textPrimary(isDark),
      );
}
