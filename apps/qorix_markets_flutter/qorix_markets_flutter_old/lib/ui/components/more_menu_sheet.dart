import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/desk_sheets.dart';
import 'package:qorix_markets_flutter/core/motion/haptics.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

Future<void> showMoreMenuSheet(BuildContext context) {
  AppHaptics.light();
  return showDeskBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (ctx) => const _MoreMenuSheet(),
  );
}

class _MoreMenuSheet extends StatelessWidget {
  const _MoreMenuSheet();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.card(isDark).withValues(alpha: 0.95),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
            border: Border(top: BorderSide(color: AppColors.border(isDark).withValues(alpha: 0.4))),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.lg),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: AppSpacing.lg),
                      decoration: BoxDecoration(
                        color: AppColors.border(isDark),
                        borderRadius: AppRadius.pillAll,
                      ),
                    ),
                  ),
                  Text('More', style: Theme.of(context).textTheme.titleLarge),
                  AppSpacing.gapXs(),
                  Text('Explore your investment ecosystem', style: Theme.of(context).textTheme.bodySmall),
                  AppSpacing.gapLg(),
                  _MenuGrid(
                    items: [
                      _MenuItem(Icons.card_giftcard_outlined, 'Earn', RoutePaths.earn, AppColors.emerald),
                      _MenuItem(Icons.add_circle_outline, 'Deposit', RoutePaths.deposit, AppColors.buy),
                      _MenuItem(Icons.people_outline, 'Referrals', RoutePaths.referral, const Color(0xFF6366F1)),
                      _MenuItem(Icons.emoji_events_outlined, 'VIP Club', RoutePaths.vip, const Color(0xFFF59E0B)),
                      _MenuItem(Icons.psychology_outlined, 'AI desk', RoutePaths.aiActivity, AppColors.emerald),
                      _MenuItem(Icons.shield_outlined, 'Protection', RoutePaths.protection, AppColors.buy),
                      _MenuItem(Icons.insights_outlined, 'Profit history', RoutePaths.profitHistory, const Color(0xFF3B82F6)),
                      _MenuItem(Icons.verified_user_outlined, 'KYC', RoutePaths.kyc, AppColors.buy),
                      _MenuItem(Icons.settings_outlined, 'Settings', RoutePaths.profile, AppColors.muted(isDark)),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MenuItem {
  const _MenuItem(this.icon, this.label, this.route, this.color);
  final IconData icon;
  final String label;
  final String route;
  final Color color;
}

class _MenuGrid extends StatelessWidget {
  const _MenuGrid({required this.items});
  final List<_MenuItem> items;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        mainAxisSpacing: AppSpacing.md,
        crossAxisSpacing: AppSpacing.sm,
        childAspectRatio: 0.85,
      ),
      itemCount: items.length,
      itemBuilder: (context, i) {
        final item = items[i];
        return GestureDetector(
          onTap: () {
            Navigator.pop(context);
            context.push(item.route);
          },
          child: Column(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: item.color.withValues(alpha: 0.12),
                  borderRadius: AppRadius.lgAll,
                  border: Border.all(color: item.color.withValues(alpha: 0.25)),
                ),
                child: Icon(item.icon, color: item.color, size: 24),
              ),
              const SizedBox(height: 6),
              Text(
                item.label,
                style: Theme.of(context).textTheme.labelSmall,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        );
      },
    );
  }
}
