import 'package:flutter/material.dart';

class InstitutionalTrustBar extends StatelessWidget {
  const InstitutionalTrustBar({super.key, this.child});
  final Widget? child;

  @override
  Widget build(BuildContext context) => child ?? const SizedBox.shrink();
}
