import 'package:flutter/services.dart';

import 'package:qorix_markets_flutter/core/motion/device_motion.dart';

abstract final class AppHaptics {
  static void light() {
    if (DeviceMotion.prefersReducedMotion) return;
    HapticFeedback.lightImpact();
  }

  static void selection() {
    if (DeviceMotion.prefersReducedMotion) return;
    HapticFeedback.selectionClick();
  }

  static void success() {
    if (DeviceMotion.prefersReducedMotion) return;
    HapticFeedback.mediumImpact();
  }

  static void heavy() {
    if (DeviceMotion.prefersReducedMotion) return;
    HapticFeedback.heavyImpact();
  }

  static void medium() => success();

  static void tabSwitch() => selection();

  static void deployCapital() => heavy();

  static void investFab() => heavy();

  static void softSuccessTap() => light();
}
