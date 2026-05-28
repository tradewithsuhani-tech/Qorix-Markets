import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/shared/formatters/currency_formatter.dart';
import 'package:qorix_markets_flutter/widgets/glass_card.dart';

/// Animated VIP tier progress — HNI aspiration psychology.
class VipProgressCard extends StatelessWidget {
  const VipProgressCard({
    required this.tierLabel,
    required this.nextTierLabel,
    required this.currentAmount,
    required this.nextTierMin,
    required this.amountNeeded,
    super.key,
    this.profitBonus,
    this.withdrawalFee,
  });

  final String tierLabel;
  final String nextTierLabel;
  final double currentAmount;
  final double nextTierMin;
  final double amountNeeded;
  final double? profitBonus;
  final double? withdrawalFee;

  double get _progress => (currentAmount / nextTierMin).clamp(0.0, 1.0);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: EdgeInsets.zero,
      child: GlassCard(
        variant: GlassCardVariant.glow,
        glowColor: AppColors.brand,
        padding: const EdgeInsets.all(AppSpacing.lg),
        animateEntrance: false,
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  gradient: AppColors.brandGradient,
                  borderRadius: AppRadius.smAll,
                ),
                child: const Icon(Icons.diamond_outlined, color: AppColors.darkBg, size: 20),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('$tierLabel VIP', style: Theme.of(context).textTheme.titleMedium),
                    Text(
                      'Unlock $nextTierLabel for higher returns',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              Text(
                '${(_progress * 100).toInt()}%',
                style: TextStyle(
                  color: AppColors.brand,
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          AppSpacing.gapMd(),
          ClipRRect(
            borderRadius: AppRadius.pillAll,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: _progress),
              duration: MotionTokens.cinematic,
              curve: MotionTokens.enter,
              builder: (_, value, __) => LinearProgressIndicator(
                value: value,
                minHeight: 6,
                backgroundColor: AppColors.border(isDark).withValues(alpha: 0.3),
                color: AppColors.brand,
              ),
            ),
          ),
          AppSpacing.gapSm(),
          Text(
            '${CurrencyFormatter.format(amountNeeded)} to $nextTierLabel · ${CurrencyFormatter.format(currentAmount)} invested',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (profitBonus != null) ...[
            AppSpacing.gapSm(),
            Row(
              children: [
                _PerkChip(label: '+${(profitBonus! * 100).toInt()}% profit bonus'),
                const SizedBox(width: 8),
                if (withdrawalFee != null)
                  _PerkChip(label: '${(withdrawalFee! * 100).toStringAsFixed(1)}% withdraw fee'),
              ],
            ),
          ],
        ],
      ),
    ),
    ).animate().fadeIn(duration: MotionTokens.normal).slideY(begin: 0.04);
  }
}

class _PerkChip extends StatelessWidget {
  const _PerkChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.brand.withValues(alpha: 0.1),
        borderRadius: AppRadius.xsAll,
      ),
      child: Text(
        label,
        style: const TextStyle(color: AppColors.brand, fontSize: 10, fontWeight: FontWeight.w600),
      ),
    );
  }
}
