import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';

extension StaggerEntrance on Widget {
  Widget staggerIn({required int index, bool enabled = true}) {
    if (!enabled) return this;
    return animate(delay: MotionTokens.stagger(index))
        .fadeIn(duration: MotionTokens.normal, curve: MotionTokens.enter)
        .slideY(begin: 0.02, duration: MotionTokens.normal, curve: MotionTokens.enter);
  }
}

/// Wraps child in RepaintBoundary for animated lists on low-end devices.
class MotionBoundary extends StatelessWidget {
  const MotionBoundary({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) => RepaintBoundary(child: child);
}
