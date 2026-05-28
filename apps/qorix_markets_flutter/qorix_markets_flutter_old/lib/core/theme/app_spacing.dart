import 'package:flutter/material.dart';

/// 4px base spacing scale for consistent premium layouts.
abstract final class AppSpacing {
  static const double unit = 4;

  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
  static const double huge = 40;
  static const double massive = 48;
  static const double giant = 64;

  // ── Page layout ────────────────────────────────────────────────────────
  static const double pageHorizontalMobile = 20;
  static const double pageHorizontalTablet = 28;
  static const double pageVertical = 16;
  static const double screenTopInset = 12;
  static const double sectionGap = 28;
  static const double cardGap = 12;
  static const double listItemGap = 10;
  static const double cardPadding = 16;
  static const double cardInnerGap = 14;

  // ── Component sizing ───────────────────────────────────────────────────
  static const double buttonHeight = 52;
  static const double deskButtonHeight = 48;
  static const double buttonHeightSm = 44;
  static const double navBarHeight = 72;
  static const double botFabDiameter = 48;
  static const double navBarBottomMargin = md;
  static const double navBarTopSpacer = 4;
  static const double scrollEndBuffer = lg;

  /// Height of floating nav stack (bar + center BOT overlap), excluding safe area.
  static const double navBarStackHeight =
      navBarBottomMargin + navBarHeight + botFabDiameter / 2 + navBarTopSpacer;

  static const double fabSize = 56;
  static const double iconSm = 18;
  static const double iconMd = 22;
  static const double iconLg = 28;

  // ── Convenience widgets ────────────────────────────────────────────────
  static SizedBox gapXs() => const SizedBox(height: xs, width: xs);
  static SizedBox gapSm() => const SizedBox(height: sm, width: sm);
  static SizedBox gapMd() => const SizedBox(height: md, width: md);
  static SizedBox gapLg() => const SizedBox(height: lg, width: lg);
  static SizedBox gapXl() => const SizedBox(height: xl, width: xl);
  static SizedBox gapXxl() => const SizedBox(height: xxl, width: xxl);
  static SizedBox gapXxxl() => const SizedBox(height: xxxl, width: xxxl);
  static SizedBox gapSection() => const SizedBox(height: sectionGap);

  static EdgeInsets pagePadding({bool isTablet = false}) =>
      EdgeInsets.symmetric(
        horizontal: isTablet ? pageHorizontalTablet : pageHorizontalMobile,
        vertical: pageVertical,
      );

  static EdgeInsets scrollPage({required double horizontal}) =>
      EdgeInsets.fromLTRB(horizontal, screenTopInset, horizontal, 0);
}
