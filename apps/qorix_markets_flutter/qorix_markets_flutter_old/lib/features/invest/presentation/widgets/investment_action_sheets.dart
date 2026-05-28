import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/motion/desk_sheets.dart';
import 'package:qorix_markets_flutter/features/invest/domain/entities/risk_profile.dart';

Future<void> showInvestmentTopupSheet(
  BuildContext context, {
  required double maxAmount,
  required double initialAmount,
  required Future<void> Function(double amount) onConfirm,
}) async {
  var amount = initialAmount.clamp(10.0, maxAmount).toDouble();
  await showDeskBottomSheet<void>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Add capital · \$${amount.toStringAsFixed(0)}'),
            Slider(
              value: amount,
              min: 10,
              max: maxAmount,
              onChanged: (v) => setState(() => amount = v),
            ),
            FilledButton(
              onPressed: () async {
                Navigator.pop(ctx);
                await onConfirm(amount);
              },
              child: const Text('Confirm top-up'),
            ),
          ],
        ),
      ),
    ),
  );
}

Future<bool?> showRiskLevelChangeSheet(
  BuildContext context, {
  required RiskProfile fromProfile,
  required RiskProfile toProfile,
  String? effectiveDate,
}) {
  return showDeskBottomSheet<bool>(
    context: context,
    builder: (ctx) => Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Change ${fromProfile.label} → ${toProfile.label}'),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Queue change'),
          ),
        ],
      ),
    ),
  );
}

String formatPendingEffectiveDate(String? date) {
  if (date == null || date.isEmpty) return 'next trading day';
  return date;
}
