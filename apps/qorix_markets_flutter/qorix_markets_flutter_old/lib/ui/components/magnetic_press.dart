import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/motion/device_motion.dart';
import 'package:qorix_markets_flutter/core/motion/haptics.dart';
import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';

/// Restrained CTA press — subtle scale, no glow or elastic release.
class MagneticPress extends StatefulWidget {
  const MagneticPress({
    required this.child,
    super.key,
    this.onPressed,
    this.scale = MotionTokens.pressScale,
    this.enableHaptics = true,
    this.borderRadius,
    @Deprecated('Glow removed for institutional motion') this.glowColor,
  });

  final Widget child;
  final VoidCallback? onPressed;
  final double scale;
  final bool enableHaptics;
  final BorderRadius? borderRadius;
  final Color? glowColor;

  @override
  State<MagneticPress> createState() => _MagneticPressState();
}

class _MagneticPressState extends State<MagneticPress> with SingleTickerProviderStateMixin {
  late AnimationController _c;
  late Animation<double> _scaleAnim;

  bool get _enabled => widget.onPressed != null;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: MotionTokens.pressDown);
    _scaleAnim = Tween<double>(begin: 1, end: widget.scale).animate(
      CurvedAnimation(parent: _c, curve: MotionTokens.enter),
    );
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  Future<void> _down(TapDownDetails _) async {
    if (!_enabled) return;
    await _c.forward();
  }

  Future<void> _up(TapUpDetails _) async {
    if (!_enabled) return;
    if (widget.enableHaptics) AppHaptics.light();
    await _c.animateTo(0, duration: MotionTokens.pressUp, curve: MotionTokens.exit);
    widget.onPressed?.call();
  }

  void _cancel() => _c.reverse();

  @override
  Widget build(BuildContext context) {
    final reduced = DeviceMotion.preferReducedEffects(context);

    return RepaintBoundary(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: _enabled ? _down : null,
        onTapUp: _enabled ? _up : null,
        onTapCancel: _enabled ? _cancel : null,
        child: AnimatedBuilder(
          animation: _c,
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
