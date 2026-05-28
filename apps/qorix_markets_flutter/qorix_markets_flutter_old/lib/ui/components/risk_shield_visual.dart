import 'package:flutter/material.dart';

class RiskShieldVisual extends StatelessWidget {
  const RiskShieldVisual({
    required this.drawdownUsed,
    required this.drawdownLimit,
    this.label,
    super.key,
  });

  final double drawdownUsed;
  final double drawdownLimit;
  final String? label;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: const Icon(Icons.shield_outlined),
      title: Text(label ?? 'Drawdown shield'),
      subtitle: Text('${drawdownUsed.toStringAsFixed(1)}% used · ${drawdownLimit.toStringAsFixed(0)}% limit'),
    );
  }
}
