import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/stagger_entrance.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/app_typography.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/invest/application/investment_providers.dart';
import 'package:qorix_markets_flutter/ui/components/institutional_trust_bar.dart';
import 'package:qorix_markets_flutter/ui/components/protection_banner.dart';
import 'package:qorix_markets_flutter/ui/components/risk_shield_visual.dart';
import 'package:qorix_markets_flutter/widgets/app_background.dart';
import 'package:qorix_markets_flutter/widgets/glass_card.dart';

class ProtectionSystemScreen extends ConsumerWidget {
  const ProtectionSystemScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final drawdown = ref.watch(investmentDrawdownProvider);

    return AppBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, size: 20),
            onPressed: () => context.pop(),
          ),
          title: const Text('Capital protection'),
        ),
        body: SafeArea(
          child: Responsive.constrained(
            context,
            ListView(
              padding: Responsive.pagePadding(context),
              children: [
                Text(
                  'Your safety net',
                  style: Theme.of(context).textTheme.headlineLarge,
                ).staggerIn(index: 0),
                AppSpacing.gapXs(),
                Text(
                  'Hard limits · Auto-pause · Segregated funds',
                  style: Theme.of(context).textTheme.bodyMedium,
                ).staggerIn(index: 1),
                AppSpacing.gapMd(),
                const InstitutionalTrustBar().staggerIn(index: 2),
                AppSpacing.gapXxl(),
                ProtectionBanner(
                  isTriggered: drawdown.paused,
                  drawdownPercent: drawdown.used,
                  limitPercent: drawdown.limit,
                ).staggerIn(index: 3),
                AppSpacing.gapLg(),
                RiskShieldVisual(
                  drawdownUsed: drawdown.used,
                  drawdownLimit: drawdown.limit,
                  label: 'Protection engine',
                ).staggerIn(index: 4),
                AppSpacing.gapSection(),
                GlassCard(
                  animateEntrance: false,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('How it works', style: Theme.of(context).textTheme.titleMedium),
                      AppSpacing.gapMd(),
                      const _Rule(
                        icon: Icons.pause_circle_outline,
                        text: 'Trading pauses before your drawdown limit is breached',
                      ),
                      const _Rule(
                        icon: Icons.account_balance_wallet_outlined,
                        text: 'Funds held in segregated Main · Trading · Profit buckets',
                      ),
                      const _Rule(
                        icon: Icons.notifications_active_outlined,
                        text: 'Instant alerts when protection thresholds are approached',
                      ),
                      const _Rule(
                        icon: Icons.restart_alt_rounded,
                        text: 'Manual review required to resume after a protection event',
                      ),
                    ],
                  ),
                ).staggerIn(index: 4),
                AppSpacing.gapSection(),
                GlassCard(
                  animateEntrance: false,
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Row(
                    children: [
                      Icon(Icons.verified_user_outlined, color: AppColors.brand),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          drawdown.paused
                              ? 'Capital protection engaged · strategy paused until review'
                              : 'Capital protected · ${drawdown.used.toStringAsFixed(1)}% of ${drawdown.limit.toStringAsFixed(0)}% limit used',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                ).staggerIn(index: 5),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Rule extends StatelessWidget {
  const _Rule({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: AppColors.brand),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: Theme.of(context).textTheme.bodyMedium)),
        ],
      ),
    );
  }
}
