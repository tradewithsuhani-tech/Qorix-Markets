import 'package:qorix_markets_flutter/core/motion/haptics.dart';

enum SensoryMoment {
  success,
  warning,
  selection,
  deploy,
  activationSuccess,
  buy,
  transferComplete,
  softSuccessTap,
}

abstract final class SensoryFeedback {
  static void celebrate() => AppHaptics.success();
  static void tap() => AppHaptics.light();

  static void trigger(SensoryMoment moment) {
    switch (moment) {
      case SensoryMoment.success:
      case SensoryMoment.deploy:
        AppHaptics.success();
      case SensoryMoment.warning:
        AppHaptics.heavy();
      case SensoryMoment.selection:
        AppHaptics.selection();
      case SensoryMoment.activationSuccess:
      case SensoryMoment.buy:
      case SensoryMoment.transferComplete:
        AppHaptics.heavy();
      case SensoryMoment.softSuccessTap:
        AppHaptics.softSuccessTap();
    }
  }
}
