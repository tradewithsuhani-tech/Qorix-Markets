import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:qorix_markets_flutter/core/motion/haptics.dart';
import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/motion/spring_curves.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';

/// Emotional center of the app — glowing magnetic Invest FAB.
class InvestFab extends StatefulWidget {
  const InvestFab({
    required this.isActive,
    required this.onTap,
    super.key,
  });

  final bool isActive;
  final VoidCallback onTap;

  @override
  State<InvestFab> createState() => _InvestFabState();
}

class _InvestFabState extends State<InvestFab> with TickerProviderStateMixin {
  late final AnimationController _pulse;
  late final AnimationController _press;
  late Animation<double> _pressScale;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(vsync: this, duration: MotionTokens.fabPulse)..repeat(reverse: true);
    _press = AnimationController(vsync: this, duration: MotionTokens.fast, value: 1);
    _pressScale = Tween<double>(begin: 1, end: 0.9).animate(
      CurvedAnimation(parent: _press, curve: SpringCurves.magnetic, reverseCurve: SpringCurves.enter),
    );
  }

  @override
  void dispose() {
    _pulse.dispose();
    _press.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails _) => _press.reverse();
  void _onTapUp(TapUpDetails _) {
    _press.forward();
    AppHaptics.investFab();
    widget.onTap();
  }

  void _onTapCancel() => _press.forward();

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _onTapDown,
      onTapUp: _onTapUp,
      onTapCancel: _onTapCancel,
      child: AnimatedBuilder(
        animation: Listenable.merge([_pulse, _pressScale]),
        builder: (context, child) {
          final glow = 0.35 + _pulse.value * 0.2;
          return Transform.scale(
            scale: _pressScale.value,
            child: Container(
              width: AppSpacing.fabSize + 8,
              height: AppSpacing.fabSize + 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: AppColors.brandGradient,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.brandGlow(glow),
                    blurRadius: 28 + _pulse.value * 12,
                    spreadRadius: widget.isActive ? 3 : 0,
                  ),
                  BoxShadow(
                    color: AppColors.emeraldGlowShadow(0.15 + _pulse.value * 0.12),
                    blurRadius: 40,
                    spreadRadius: -2,
                  ),
                ],
                border: Border.all(
                  color: widget.isActive
                      ? AppColors.neonGreen.withValues(alpha: 0.6)
                      : Colors.white.withValues(alpha: 0.2),
                  width: widget.isActive ? 2.5 : 1.5,
                ),
              ),
              child: child,
            ),
          );
        },
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Outer pulse ring
            ...List.generate(2, (i) {
              return AnimatedBuilder(
                animation: _pulse,
                builder: (_, __) => Container(
                  width: AppSpacing.fabSize + 8 + (i * 8) + (_pulse.value * 6),
                  height: AppSpacing.fabSize + 8 + (i * 8) + (_pulse.value * 6),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.brand.withValues(alpha: 0.15 - i * 0.05),
                      width: 1,
                    ),
                  ),
                ),
              );
            }),
            const Icon(Icons.bolt_rounded, color: AppColors.darkBg, size: 30),
            Positioned(
              bottom: 10,
              child: Text(
                'INVEST',
                style: TextStyle(
                  fontSize: 7,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1,
                  color: AppColors.darkBg.withValues(alpha: 0.7),
                ),
              ),
            ),
          ],
        ),
      ),
    )
        .animate(onPlay: (c) => c.repeat(reverse: true))
        .moveY(begin: 0, end: -3, duration: MotionTokens.fabPulse, curve: MotionTokens.enter);
  }
}
