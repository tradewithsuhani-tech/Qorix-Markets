import 'package:flutter/material.dart';

abstract final class DeviceMotion {
  static bool get prefersReducedMotion =>
      WidgetsBinding.instance.platformDispatcher.accessibilityFeatures.disableAnimations;

  static bool preferReducedEffects(BuildContext context) => prefersReducedMotion;
}
