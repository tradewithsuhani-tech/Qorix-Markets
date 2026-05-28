import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

/// Restrained success mark — single ring + check, no overshoot.
class CelebrationBurst extends StatefulWidget {
  const CelebrationBurst({
    super.key,
    this.color = AppColors.buy,
    this.size = 72,
  });

  final Color color;
  final double size;

  @override
  State<CelebrationBurst> createState() => _CelebrationBurstState();
}

class _CelebrationBurstState extends State<CelebrationBurst> with TickerProviderStateMixin {
  late final AnimationController _ring;
  late final AnimationController _icon;

  @override
  void initState() {
    super.initState();
    _ring = AnimationController(vsync: this, duration: MotionTokens.successReveal);
    _icon = AnimationController(vsync: this, duration: MotionTokens.normal);
    _ring.forward();
    _icon.forward();
  }

  @override
  void dispose() {
    _ring.dispose();
    _icon.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _ring,
            builder: (_, __) {
              final t = MotionTokens.enter.transform(_ring.value);
              return Container(
                width: widget.size * (0.72 + t * 0.28),
                height: widget.size * (0.72 + t * 0.28),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: widget.color.withValues(alpha: (1 - t) * 0.28),
                    width: 1.5,
                  ),
                ),
              );
            },
          ),
          FadeTransition(
            opacity: CurvedAnimation(parent: _icon, curve: MotionTokens.enter),
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.94, end: 1).animate(
                CurvedAnimation(parent: _icon, curve: MotionTokens.enter),
              ),
              child: Container(
                width: widget.size * 0.62,
                height: widget.size * 0.62,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: widget.color.withValues(alpha: 0.12),
                  border: Border.all(color: widget.color.withValues(alpha: 0.35)),
                ),
                child: Icon(Icons.check_rounded, size: widget.size * 0.32, color: widget.color),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
