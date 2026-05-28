import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';

/// Luxury glass shimmer skeletons — layout-preserving loading states.
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = AppRadius.sm,
  });

  final double? width;
  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final base = AppColors.card(isDark).withValues(alpha: 0.5);
    final highlight = AppColors.border(isDark).withValues(alpha: 0.6);

    return Shimmer.fromColors(
      baseColor: base,
      highlightColor: highlight,
      period: MotionTokens.shimmerPeriod,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: base,
          borderRadius: BorderRadius.circular(borderRadius),
          border: Border.all(color: AppColors.border(isDark).withValues(alpha: 0.2)),
        ),
      ),
    );
  }
}

class SkeletonListTile extends StatelessWidget {
  const SkeletonListTile({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          SkeletonBox(width: 44, height: 44, borderRadius: AppRadius.md),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: 120, height: 14),
                SizedBox(height: 8),
                SkeletonBox(width: 80, height: 12),
              ],
            ),
          ),
          SkeletonBox(width: 64, height: 14),
        ],
      ),
    );
  }
}

class SkeletonMarketList extends StatelessWidget {
  const SkeletonMarketList({super.key, this.count = 5});

  final int count;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      itemCount: count,
      itemBuilder: (_, __) => const Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 10),
        child: SkeletonListTile(),
      ),
    );
  }
}

class SkeletonWalletCard extends StatelessWidget {
  const SkeletonWalletCard({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonBox(width: 100, height: 12),
          SizedBox(height: 12),
          SkeletonBox(width: 200, height: 36, borderRadius: AppRadius.sm),
          SizedBox(height: 20),
          Row(
            children: [
              Expanded(child: SkeletonBox(height: 72, borderRadius: AppRadius.lg)),
              SizedBox(width: 12),
              Expanded(child: SkeletonBox(height: 72, borderRadius: AppRadius.lg)),
            ],
          ),
        ],
      ),
    );
  }
}

class SkeletonHeroCard extends StatelessWidget {
  const SkeletonHeroCard({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonBox(width: 80, height: 10),
          SizedBox(height: 16),
          SkeletonBox(width: 220, height: 40, borderRadius: AppRadius.md),
          SizedBox(height: 12),
          SkeletonBox(width: 160, height: 14),
        ],
      ),
    );
  }
}

/// Cross-fades from skeleton to content — lightweight load transition.
class SkeletonReveal extends StatelessWidget {
  const SkeletonReveal({
    required this.loading,
    required this.skeleton,
    required this.child,
    super.key,
  });

  final bool loading;
  final Widget skeleton;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: MotionTokens.contentReveal,
      switchInCurve: MotionTokens.enter,
      switchOutCurve: MotionTokens.exit,
      child: loading
          ? KeyedSubtree(key: const ValueKey('sk'), child: skeleton)
          : KeyedSubtree(key: const ValueKey('content'), child: child),
    );
  }
}
