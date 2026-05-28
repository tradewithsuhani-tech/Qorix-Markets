import 'package:flutter/material.dart';

class FloatingGlowOrbs extends StatelessWidget {
  const FloatingGlowOrbs({super.key, this.child, this.intensity = 1.0});
  final Widget? child;
  final double intensity;

  @override
  Widget build(BuildContext context) => child ?? const SizedBox.shrink();
}
