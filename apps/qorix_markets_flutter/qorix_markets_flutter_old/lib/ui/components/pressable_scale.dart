import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/motion/device_motion.dart';
import 'package:qorix_markets_flutter/core/motion/haptics.dart';
import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';

/// Lightweight press micro-interaction — subtle scale only.
class PressableScale extends StatefulWidget {
  const PressableScale({
    required this.child,
    super.key,
    this.onTap,
    this.scale = MotionTokens.pressScale,
    this.enableHaptics = true,
    this.borderRadius,
    @Deprecated('Glow removed for institutional motion') this.glowColor,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  final bool enableHaptics;
  final BorderRadius? borderRadius;
  final Color? glowColor;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: MotionTokens.pressDown);
    _scaleAnim = Tween<double>(begin: 1, end: widget.scale).animate(
      CurvedAnimation(parent: _controller, curve: MotionTokens.enter),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _down(TapDownDetails _) => _controller.forward();
  Future<void> _up(TapUpDetails _) async {
    if (widget.onTap == null) return;
    if (widget.enableHaptics) AppHaptics.light();
    await _controller.animateTo(0, duration: MotionTokens.pressUp, curve: MotionTokens.exit);
    widget.onTap?.call();
  }

  void _cancel() => _controller.reverse();

  @override
  Widget build(BuildContext context) {
    final reduced = DeviceMotion.preferReducedEffects(context);

    return RepaintBoundary(
      child: GestureDetector(
        onTapDown: widget.onTap != null ? _down : null,
        onTapUp: widget.onTap != null ? _up : null,
        onTapCancel: widget.onTap != null ? _cancel : null,
        child: AnimatedBuilder(
          animation: _scaleAnim,
          builder: (_, child) {
            final scale = reduced ? 1.0 : _scaleAnim.value;
            return Transform.scale(scale: scale, child: child);
          },
          child: widget.child,
        ),
      ),
    );
  }
}
