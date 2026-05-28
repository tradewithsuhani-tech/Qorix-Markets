import 'package:flutter/animation.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';

/// @deprecated Prefer [MotionTokens] — kept for legacy imports.
abstract final class AppAnimations {
  static const Duration fast = MotionTokens.fast;
  static const Duration normal = MotionTokens.normal;
  static const Duration slow = MotionTokens.slow;
  static const Duration entrance = MotionTokens.deliberate;

  static const Curve standard = MotionTokens.standard;
  static const Curve bounce = MotionTokens.enter;
  static const Curve smooth = MotionTokens.standard;

  static Duration stagger(int index, {int ms = MotionTokens.staggerStepMs}) =>
      MotionTokens.stagger(index, stepMs: ms, baseMs: 0);
}
