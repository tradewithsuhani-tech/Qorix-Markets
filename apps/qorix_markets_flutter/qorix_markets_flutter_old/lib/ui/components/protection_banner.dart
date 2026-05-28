import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

/// Sticky capital protection / drawdown alert — investor trust psychology.
class ProtectionBanner extends StatelessWidget {
  const ProtectionBanner({
    super.key,
    this.isTriggered = false,
    this.drawdownPercent,
    this.limitPercent,
    this.onReview,
  });

  final bool isTriggered;
  final double? drawdownPercent;
  final double? limitPercent;
  final VoidCallback? onReview;

  @override
  Widget build(BuildContext context) {
    if (isTriggered) {
      return _TriggeredBanner(onReview: onReview);
    }
    return _ActiveProtectionStrip(
      drawdown: drawdownPercent ?? 0,
      limit: limitPercent ?? 5,
    );
  }
}

class _ActiveProtectionStrip extends StatelessWidget {
  const _ActiveProtectionStrip({required this.drawdown, required this.limit});

  final double drawdown;
  final double limit;

  @override
  Widget build(BuildContext context) {
    final pct = (drawdown / limit).clamp(0.0, 1.0);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.buy.withValues(alpha: 0.1),
            AppColors.emerald.withValues(alpha: 0.04),
          ],
        ),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: AppColors.buy.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.verified_user_outlined, color: AppColors.buy, size: 18),
              const SizedBox(width: 8),
              Text(
                'Capital protection active',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(color: AppColors.buy),
              ),
            ],
          ),
          AppSpacing.gapSm(),
          Text(
            'Drawdown ${drawdown.toStringAsFixed(1)}% of ${limit.toStringAsFixed(0)}% limit · Your capital is guarded',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          AppSpacing.gapSm(),
          ClipRRect(
            borderRadius: AppRadius.pillAll,
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 4,
              backgroundColor: AppColors.border(isDark).withValues(alpha: 0.3),
              color: AppColors.buy,
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: MotionTokens.normal);
  }
}

class _TriggeredBanner extends StatelessWidget {
  const _TriggeredBanner({this.onReview});

  final VoidCallback? onReview;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.sell.withValues(alpha: 0.15),
            AppColors.sell.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: AppColors.sell.withValues(alpha: 0.4)),
        boxShadow: [BoxShadow(color: AppColors.sell.withValues(alpha: 0.1), blurRadius: 16)],
      ),
      child: Row(
        children: [
          const Icon(Icons.shield_outlined, color: AppColors.sell, size: 24),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Under review',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(color: AppColors.sell),
                ),
                Text(
                  'Strategy paused by capital protection · our team will resume trading',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onReview ?? () => context.go(RoutePaths.invest),
            child: const Text('Review', style: TextStyle(color: AppColors.sell)),
          ),
        ],
      ),
    ).animate().shake(duration: 600.ms).fadeIn();
  }
}
