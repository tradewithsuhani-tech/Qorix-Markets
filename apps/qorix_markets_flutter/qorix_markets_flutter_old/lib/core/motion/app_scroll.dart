import 'package:flutter/material.dart';

/// Consistent scroll feel — clamped, no rubber-band bounce.
abstract final class AppScroll {
  /// Primary page lists — always scrollable, institutional deceleration.
  static const ScrollPhysics page = AlwaysScrollableScrollPhysics(
    parent: ClampingScrollPhysics(),
  );

  static const ScrollPhysics never = NeverScrollableScrollPhysics();
  static const ScrollPhysics clamping = ClampingScrollPhysics();
}
