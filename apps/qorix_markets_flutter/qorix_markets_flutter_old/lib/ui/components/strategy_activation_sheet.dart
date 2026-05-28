import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:qorix_markets_flutter/core/motion/desk_sheets.dart';
import 'package:qorix_markets_flutter/core/motion/haptics.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/features/invest/domain/entities/risk_profile.dart';
import 'package:qorix_markets_flutter/shared/formatters/currency_formatter.dart';
import 'package:qorix_markets_flutter/ui/components/celebration_burst.dart';
import 'package:qorix_markets_flutter/ui/components/projected_growth_chart.dart';
import 'package:qorix_markets_flutter/widgets/primary_button.dart';

Future<void> showStrategyActivationSheet(
  BuildContext context, {
  required RiskProfile profile,
  required double amount,
  required List<double> projectedPoints,
  required VoidCallback onConfirm,
}) {
  return showDeskBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _ActivationSheet(
      profile: profile,
      amount: amount,
      projectedPoints: projectedPoints,
      onConfirm: () {
        Navigator.pop(ctx);
        onConfirm();
      },
    ),
  );
}

class _ActivationSheet extends StatefulWidget {
  const _ActivationSheet({
    required this.profile,
    required this.amount,
    required this.projectedPoints,
    required this.onConfirm,
  });

  final RiskProfile profile;
  final double amount;
  final List<double> projectedPoints;
  final VoidCallback onConfirm;

  @override
  State<_ActivationSheet> createState() => _ActivationSheetState();
}

class _ActivationSheetState extends State<_ActivationSheet> {
  bool _activated = false;

  void _activate() {
    AppHaptics.deployCapital();
    setState(() => _activated = true);
    Future<void>.delayed(const Duration(milliseconds: 1400), () {
      if (!mounted) return;
      widget.onConfirm();
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: AppColors.card(isDark).withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border(isDark).withValues(alpha: 0.4)),
        boxShadow: [BoxShadow(color: AppColors.emeraldGlowShadow(0.12), blurRadius: 32)],
      ),
      child: SafeArea(
        top: false,
        child: _activated
            ? Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CelebrationBurst(color: AppColors.buy),
                  AppSpacing.gapLg(),
                  Text(
                    'Strategy activated',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  AppSpacing.gapSm(),
                  Text(
                    '${widget.profile.label} · ${CurrencyFormatter.format(widget.amount)} deployed',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Activate strategy', style: Theme.of(context).textTheme.titleLarge),
                  AppSpacing.gapXs(),
                  Text(
                    '${widget.profile.label} · Capital protection ${widget.profile.drawdownLimit.toStringAsFixed(0)}%',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  AppSpacing.gapLg(),
                  ProjectedGrowthChart(
                    currentAmount: widget.amount,
                    projectedPoints: widget.projectedPoints,
                    months: 12,
                  ),
                  AppSpacing.gapXxl(),
                  PrimaryButton(
                    label: 'Deploy ${CurrencyFormatter.format(widget.amount)}',
                    variant: PrimaryButtonVariant.buy,
                    icon: Icons.bolt_rounded,
                    onPressed: _activate,
                  ),
                ],
              ),
      ),
    );
  }
}
