import 'package:flutter/animation.dart';

/// Institutional motion vocabulary — calm, restrained, expensive.
/// Target: Apple Wallet · Wealthfront · trading terminal.
abstract final class MotionTokens {
  // ── Durations ───────────────────────────────────────────────────────────
  static const Duration instant = Duration(milliseconds: 100);
  static const Duration fast = Duration(milliseconds: 180);
  static const Duration normal = Duration(milliseconds: 260);
  static const Duration slow = Duration(milliseconds: 340);
  static const Duration deliberate = Duration(milliseconds: 420);

  /// Full-screen route push (overlay flows).
  static const Duration pageEnter = Duration(milliseconds: 260);
  static const Duration pageExit = Duration(milliseconds: 200);

  /// Tab shell cross-fade.
  static const Duration tabSwitch = Duration(milliseconds: 220);

  /// Bottom sheets & modal surfaces.
  static const Duration sheetEnter = Duration(milliseconds: 280);
  static const Duration sheetExit = Duration(milliseconds: 220);

  /// Dialogs & alerts.
  static const Duration dialogEnter = Duration(milliseconds: 240);
  static const Duration dialogExit = Duration(milliseconds: 180);

  /// Success / confirmation reveal.
  static const Duration successReveal = Duration(milliseconds: 300);

  /// CTA press down/up.
  static const Duration pressDown = Duration(milliseconds: 90);
  static const Duration pressUp = Duration(milliseconds: 160);

  /// Skeleton shimmer cycle.
  static const Duration shimmerPeriod = Duration(milliseconds: 1600);

  /// Content cross-fade after load.
  static const Duration contentReveal = Duration(milliseconds: 260);

  /// Stagger step between list items (subtle).
  static const int staggerStepMs = 35;
  static const int staggerBaseMs = 60;

  // ── Curves (no spring / bounce / elastic) ─────────────────────────────────
  static const Curve enter = Curves.easeOutCubic;
  static const Curve exit = Curves.easeInCubic;
  static const Curve standard = Curves.easeInOutCubic;
  static const Curve decelerate = Curves.easeOut;

  /// Legacy aliases — map to institutional curves.
  static const Curve momentum = enter;

  static Duration stagger(int index, {int stepMs = staggerStepMs, int baseMs = staggerBaseMs}) =>
      Duration(milliseconds: baseMs + stepMs * index);

  // ── Page motion ───────────────────────────────────────────────────────────
  static const Offset pageSlideBegin = Offset(0, 0.018);
  static const Offset sheetSlideBegin = Offset(0, 0.06);

  /// CTA press scale — barely perceptible.
  static const double pressScale = 0.985;

  // Deprecated luxury/bounce tokens → institutional equivalents.
  static const Duration luxury = deliberate;
  static const Duration revealDelay = Duration(milliseconds: 50);
  static const Curve luxuryEnter = enter;
  static const Curve softElastic = enter;
  static const Curve wealthRoll = enter;
  static const Curve bounce = enter;
  static const Curve magnetic = enter;
  static const Duration cinematic = slow;
  static const Duration fabPulse = Duration(seconds: 4);
  static const Duration pageTransition = pageEnter;
}
