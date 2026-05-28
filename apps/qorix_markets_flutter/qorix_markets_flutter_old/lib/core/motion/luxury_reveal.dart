import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';

/// Staggered opacity reveal — institutional pacing, no bounce.
extension LuxuryReveal on Widget {
  Widget luxuryReveal({required int index, double slideY = 0.03}) {
    return animate(delay: MotionTokens.stagger(index))
        .fadeIn(duration: MotionTokens.normal, curve: MotionTokens.enter)
        .slideY(begin: slideY, duration: MotionTokens.normal, curve: MotionTokens.enter);
  }

  Widget floatIn({Duration? delay}) {
    return animate(delay: delay ?? Duration.zero)
        .fadeIn(duration: MotionTokens.normal, curve: MotionTokens.enter);
  }
}
