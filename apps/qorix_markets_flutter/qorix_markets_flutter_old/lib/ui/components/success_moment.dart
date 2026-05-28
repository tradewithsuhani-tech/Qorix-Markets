import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/motion/desk_sheets.dart';
import 'package:qorix_markets_flutter/core/motion/sensory_feedback.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';

/// Restrained success confirmation — flat surface, no particles or bounce.
Future<void> showSuccessMoment(
  BuildContext context, {
  required String title,
  required String message,
  String? amount,
  Color color = AppColors.buy,
  VoidCallback? onDismiss,
}) {
  SensoryFeedback.trigger(SensoryMoment.softSuccessTap);
  return showDeskDialog<void>(
    context: context,
    builder: (_) => _SuccessMoment(
      title: title,
      message: message,
      amount: amount,
      color: color,
      onDismiss: onDismiss,
    ),
  );
}

class _SuccessMoment extends StatelessWidget {
  const _SuccessMoment({
    required this.title,
    required this.message,
    this.amount,
    required this.color,
    this.onDismiss,
  });

  final String title;
  final String message;
  final String? amount;
  final Color color;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Material(
          color: Colors.transparent,
          child: Container(
            width: double.infinity,
            constraints: const BoxConstraints(maxWidth: 340),
            padding: const EdgeInsets.all(AppSpacing.xxl),
            decoration: BoxDecoration(
              color: AppDesk.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppDesk.borderLine),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color.withValues(alpha: 0.12),
                    border: Border.all(color: color.withValues(alpha: 0.35)),
                  ),
                  child: Icon(Icons.check_rounded, color: color, size: 28),
                ),
                AppSpacing.gapLg(),
                Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
                if (amount != null) ...[
                  AppSpacing.gapSm(),
                  Text(
                    amount!,
                    style: AppDesk.amountDisplay.copyWith(color: color, fontSize: 28),
                  ),
                ],
                AppSpacing.gapMd(),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: AppColors.authMuted,
                      ),
                ),
                AppSpacing.gapXxl(),
                TextButton(
                  onPressed: () {
                    Navigator.pop(context);
                    onDismiss?.call();
                  },
                  child: Text('Continue', style: TextStyle(color: color, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
