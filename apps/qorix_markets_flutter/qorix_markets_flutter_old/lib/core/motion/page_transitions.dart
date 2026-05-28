import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';

/// Fade-only Material route transition — no platform slide overshoot.
class InstitutionalFadeTransitionsBuilder extends PageTransitionsBuilder {
  const InstitutionalFadeTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: MotionTokens.enter,
      reverseCurve: MotionTokens.exit,
    );
    return FadeTransition(opacity: curved, child: child);
  }
}

/// Bottom-nav tab — instant swap + opaque fill so stacked routes never bleed through.
Page<T> shellTabPage<T>({
  required LocalKey key,
  required Widget child,
}) {
  return NoTransitionPage<T>(
    key: key,
    child: ColoredBox(
      color: AppDesk.bg,
      child: child,
    ),
  );
}

/// Tab / shell routes — opacity only, no scale stacking.
CustomTransitionPage<T> cinematicPage<T>({
  required LocalKey key,
  required Widget child,
  bool fadeOnly = true,
}) {
  return CustomTransitionPage<T>(
    key: key,
    child: child,
    transitionDuration: MotionTokens.pageEnter,
    reverseTransitionDuration: MotionTokens.pageExit,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: MotionTokens.enter,
        reverseCurve: MotionTokens.exit,
      );
      if (fadeOnly) {
        return FadeTransition(opacity: curved, child: child);
      }
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: MotionTokens.pageSlideBegin,
            end: Offset.zero,
          ).animate(curved),
          child: child,
        ),
      );
    },
  );
}

/// Overlay flows (deposit, withdraw, bot setup) — restrained upward drift + fade.
CustomTransitionPage<T> slideUpPage<T>({
  required LocalKey key,
  required Widget child,
}) {
  return CustomTransitionPage<T>(
    key: key,
    child: child,
    transitionDuration: MotionTokens.pageEnter,
    reverseTransitionDuration: MotionTokens.pageExit,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: MotionTokens.enter,
        reverseCurve: MotionTokens.exit,
      );
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: MotionTokens.sheetSlideBegin,
            end: Offset.zero,
          ).animate(curved),
          child: child,
        ),
      );
    },
  );
}
