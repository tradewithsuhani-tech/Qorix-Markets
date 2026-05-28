import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/shared/formatters/currency_formatter.dart';

class ReferralMilestone {
  const ReferralMilestone({
    required this.invitesRequired,
    required this.rewardLabel,
    required this.rewardAmount,
    required this.unlocked,
  });

  final int invitesRequired;
  final String rewardLabel;
  final double rewardAmount;
  final bool unlocked;
}

class ReferralMilestoneTracker extends StatelessWidget {
  const ReferralMilestoneTracker({
    required this.currentInvites,
    required this.milestones,
    super.key,
  });

  final int currentInvites;
  final List<ReferralMilestone> milestones;

  @override
  Widget build(BuildContext context) {
    final next = milestones.firstWhere((m) => !m.unlocked, orElse: () => milestones.last);
    final progress = (currentInvites / next.invitesRequired).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Partner milestones', style: Theme.of(context).textTheme.titleMedium),
                  Text(
                    '$currentInvites active partners · Next: ${next.rewardLabel}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            Text(
              '${(progress * 100).toInt()}%',
              style: const TextStyle(color: AppColors.brand, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        AppSpacing.gapMd(),
        ClipRRect(
          borderRadius: AppRadius.pillAll,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: progress),
            duration: MotionTokens.cinematic,
            curve: MotionTokens.enter,
            builder: (_, v, __) => LinearProgressIndicator(
              value: v,
              minHeight: 8,
              backgroundColor: AppColors.brand.withValues(alpha: 0.12),
              color: AppColors.brand,
            ),
          ),
        ),
        AppSpacing.gapLg(),
        ...milestones.map((m) {
          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Row(
              children: [
                Icon(
                  m.unlocked ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
                  size: 18,
                  color: m.unlocked ? AppColors.buy : AppColors.muted(
                    Theme.of(context).brightness == Brightness.dark,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '${m.invitesRequired} partners · ${m.rewardLabel}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
                Text(
                  CurrencyFormatter.format(m.rewardAmount),
                  style: TextStyle(
                    color: m.unlocked ? AppColors.buy : AppColors.brand,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}
