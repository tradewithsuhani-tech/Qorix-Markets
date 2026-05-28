import 'package:flutter/material.dart';

class PremiumLoadingPulse extends StatefulWidget {
  const PremiumLoadingPulse({this.size = 24, this.color, super.key});

  final double size;
  final Color? color;

  @override
  State<PremiumLoadingPulse> createState() => _PremiumLoadingPulseState();
}

class _PremiumLoadingPulseState extends State<PremiumLoadingPulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, __) => Container(
        width: widget.size,
        height: widget.size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: (widget.color ?? Colors.white).withValues(alpha: 0.25 + _controller.value * 0.45),
        ),
      ),
    );
  }
}
