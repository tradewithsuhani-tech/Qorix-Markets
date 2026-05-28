import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';

abstract final class Responsive {
  static const double tablet = 600;
  static const double desktop = 1024;

  /// @deprecated Use [scrollBottomInset] — ignores safe area and device nav height.
  static const double bottomNavClearance = AppSpacing.navBarStackHeight + AppSpacing.scrollEndBuffer;

  static bool isMobile(BuildContext context) =>
      MediaQuery.sizeOf(context).width < tablet;

  static bool isTablet(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    return w >= tablet && w < desktop;
  }

  static double contentWidth(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    if (w >= desktop) return 720;
    if (w >= tablet) return 560;
    return w;
  }

  static EdgeInsets pagePadding(BuildContext context) {
    return AppSpacing.pagePadding(isTablet: !isMobile(context));
  }

  /// Top + horizontal page padding for scroll surfaces.
  static EdgeInsets scrollPage(BuildContext context) {
    final horizontal = isMobile(context) ? AppSpacing.pageHorizontalMobile : AppSpacing.pageHorizontalTablet;
    return AppSpacing.scrollPage(horizontal: horizontal);
  }

  /// Full scroll padding including bottom clearance for floating nav + gesture bar.
  static EdgeInsets scrollPadding(BuildContext context) {
    final base = scrollPage(context);
    return EdgeInsets.fromLTRB(base.left, base.top, base.right, scrollBottomInset(context));
  }

  /// Bottom inset: nav stack + system safe area + breathing room.
  static double scrollBottomInset(BuildContext context) {
    return AppSpacing.navBarStackHeight +
        MediaQuery.paddingOf(context).bottom +
        AppSpacing.scrollEndBuffer;
  }

  /// Bottom inset for full-screen overlays (no floating nav).
  static double overlayScrollBottomInset(BuildContext context) {
    return MediaQuery.paddingOf(context).bottom + AppSpacing.xxxl;
  }

  /// Institutional list scroll — clamped, no rubber-band.
  static ScrollPhysics get pageScroll => AppScroll.page;

  static Widget constrained(BuildContext context, Widget child) {
    return Align(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: contentWidth(context)),
        child: child,
      ),
    );
  }

  /// Caps hero/CTA scaling on large accessibility font sizes.
  static TextScaler clampedTextScaler(BuildContext context, {double maxScale = 1.28}) {
    return MediaQuery.textScalerOf(context).clamp(minScaleFactor: 1.0, maxScaleFactor: maxScale);
  }
}
