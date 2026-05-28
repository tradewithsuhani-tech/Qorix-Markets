import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:qorix_markets_flutter/core/motion/haptics.dart';
import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/features/invest/domain/entities/risk_profile.dart';

class RiskProfileCard extends StatelessWidget {
  const RiskProfileCard({
    required this.profile,
    required this.isSelected,
    required this.onTap,
    this.statusLabel,
    super.key,
  });

  final RiskProfile profile;
  final bool isSelected;
  final VoidCallback onTap;
  final String? statusLabel;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: () {
        AppHaptics.selection();
        onTap();
      },
      child: AnimatedContainer(
        duration: MotionTokens.normal,
        curve: MotionTokens.standard,
        margin: const EdgeInsets.only(bottom: AppSpacing.md),
        decoration: BoxDecoration(
          borderRadius: AppRadius.xlAll,
          gradient: isSelected
              ? LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    profile.accentColor.withValues(alpha: 0.2),
                    AppColors.card(isDark).withValues(alpha: 0.9),
                  ],
                )
              : null,
          color: isSelected ? null : AppColors.card(isDark).withValues(alpha: 0.6),
          border: Border.all(
            color: isSelected
                ? profile.accentColor.withValues(alpha: 0.5)
                : AppColors.border(isDark).withValues(alpha: 0.35),
            width: isSelected ? 1.5 : 1,
          ),
          boxShadow: isSelected
              ? [BoxShadow(color: profile.accentColor.withValues(alpha: 0.15), blurRadius: 24)]
              : null,
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: profile.accentColor.withValues(alpha: 0.15),
                      borderRadius: AppRadius.mdAll,
                    ),
                    child: Icon(profile.icon, color: profile.accentColor, size: 22),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(profile.label, style: Theme.of(context).textTheme.titleMedium),
                            if (profile.recommended) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.brand.withValues(alpha: 0.15),
                                  borderRadius: AppRadius.pillAll,
                                ),
                                child: const Text(
                                  'Recommended',
                                  style: TextStyle(
                                    color: AppColors.brand,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                            if (statusLabel != null) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: profile.accentColor.withValues(alpha: 0.15),
                                  borderRadius: AppRadius.pillAll,
                                ),
                                child: Text(
                                  statusLabel!,
                                  style: TextStyle(
                                    color: profile.accentColor,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        Text(profile.tagline, style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                  if (isSelected)
                    Icon(Icons.check_circle_rounded, color: profile.accentColor, size: 22),
                ],
              ),
              AppSpacing.gapMd(),
              Text(profile.description, style: Theme.of(context).textTheme.bodyMedium),
              AppSpacing.gapMd(),
              Row(
                children: [
                  _StatChip(
                    label: 'Monthly',
                    value: profile.monthlyRange,
                    color: profile.accentColor,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  _StatChip(
                    label: 'Drawdown cap',
                    value: '${profile.drawdownLimit.toInt()}%',
                    color: AppColors.sell.withValues(alpha: 0.8),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ).animate(target: isSelected ? 1 : 0).scale(
          begin: const Offset(1, 1),
          end: const Offset(1.01, 1.01),
          duration: MotionTokens.fast,
        );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: AppRadius.smAll,
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('$label: ', style: Theme.of(context).textTheme.labelSmall),
          Text(
            value,
            style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
