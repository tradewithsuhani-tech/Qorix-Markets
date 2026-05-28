import 'package:flutter/animation.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';

/// Curves for UI motion — institutional cubic only (no springs / overshoot).
abstract final class SpringCurves {
  static const Curve gentle = MotionTokens.enter;
  static const Curve enter = MotionTokens.enter;
  static const Curve exit = MotionTokens.exit;
  static const Curve magnetic = MotionTokens.enter;
  static const Curve countUp = MotionTokens.enter;
}
