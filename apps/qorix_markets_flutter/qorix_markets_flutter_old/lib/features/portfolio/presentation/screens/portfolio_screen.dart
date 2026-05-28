import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/features/invest/application/investment_providers.dart';
import 'package:qorix_markets_flutter/features/notifications/application/notification_providers.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/data/portfolio_demo.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/widgets/portfolio_bot_insights_ui.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/widgets/portfolio_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/ui/components/notification_panel.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_mock_data.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';
import 'package:qorix_markets_flutter/widgets/skeleton_loader.dart';

/// Live bot portfolio — scrollable statement view.
class PortfolioScreen extends ConsumerWidget {
  const PortfolioScreen({super.key});

  static const _hPad = 20.0;
  static const _scrollPhysics = AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics());

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final investmentAsync = ref.watch(investmentProvider);
    final unread = ref.watch(unreadNotificationsCountProvider);

    return AuthBackground(
      child: SafeArea(
        bottom: false,
        child: Responsive.constrained(
          context,
          RefreshIndicator(
            color: AppColors.authGreen,
            onRefresh: () => ref.read(investmentProvider.notifier).refresh(),
            child: ListView(
              physics: _scrollPhysics,
              padding: const EdgeInsets.fromLTRB(_hPad, 8, _hPad, 0),
              children: [
                PortfolioPageHeader(
                  unreadCount: unread > 0 ? unread : UiMockData.unreadNotifications,
                  onNotifications: () => showNotificationPanel(context),
                ),
                const SizedBox(height: 20),
                CinematicAsyncContent(
                  value: investmentAsync,
                  onRetry: () => ref.read(investmentProvider.notifier).refresh(),
                  loading: const _PortfolioLoadingBody(),
                  builder: (inv, {required isRefreshing}) {
                    final data = PortfolioViewData.fromInvestment(inv.isActive ? inv : null);
                    return _PortfolioBody(
                      data: data,
                      onManage: () => context.push(RoutePaths.managePlan),
                      onActivate: () => context.push(RoutePaths.botSetup),
                      onToggleCompound: (v) => _toggleCompound(context, ref, v),
                      onStopTrading: () => _confirmStop(context, ref),
                    );
                  },
                ),
                const SizedBox(height: Responsive.bottomNavClearance),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _toggleCompound(BuildContext context, WidgetRef ref, bool enabled) async {
    try {
      await ref.read(investmentProvider.notifier).toggleCompounding(enabled);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ErrorMessage.brief(e)), backgroundColor: AppColors.authCardBg),
        );
      }
    }
  }

  Future<void> _confirmStop(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF111618),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Pause bot?', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        content: Text(
          'Trading will pause. Capital stays in funding. You can resume anytime.',
          style: TextStyle(color: AppColors.authMuted.withValues(alpha: 0.85), height: 1.4),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Cancel', style: TextStyle(color: AppColors.authMuted.withValues(alpha: 0.8)))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Pause', style: TextStyle(color: AppColors.sell, fontWeight: FontWeight.w600))),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    try {
      await ref.read(investmentProvider.notifier).stopInvestment();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ErrorMessage.brief(e)), backgroundColor: AppColors.authCardBg),
        );
      }
    }
  }
}

class _PortfolioLoadingBody extends StatelessWidget {
  const _PortfolioLoadingBody();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SkeletonHeroCard(),
        SizedBox(height: 24),
        SkeletonHeroCard(),
        SizedBox(height: 24),
        SkeletonHeroCard(),
      ],
    );
  }
}

class _PortfolioBody extends StatelessWidget {
  const _PortfolioBody({
    required this.data,
    required this.onManage,
    required this.onActivate,
    required this.onToggleCompound,
    required this.onStopTrading,
  });

  final PortfolioViewData data;
  final VoidCallback onManage;
  final VoidCallback onActivate;
  final ValueChanged<bool> onToggleCompound;
  final VoidCallback onStopTrading;

  @override
  Widget build(BuildContext context) {
    if (!data.isActive) {
      return PortfolioEmptyState(onActivate: onActivate);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PortfolioPerformanceHero(data: data),
        const SizedBox(height: 20),
        PortfolioActiveBotMetricsCard(data: data, onManage: onManage),
        const SizedBox(height: 24),
        PortfolioActionRow(onManage: onManage),
        const SizedBox(height: 28),
        PortfolioMonthStatsRow(data: data),
        const SizedBox(height: 28),
        PortfolioReturnsOutlookCard(data: data),
        const SizedBox(height: 28),
        PortfolioDailyBreakdownCard(data: data),
        const SizedBox(height: 28),
        PortfolioAllocationCard(data: data),
        const SizedBox(height: 28),
        PortfolioStrategySetupCard(
          data: data,
          onToggleCompound: onToggleCompound,
          onStopTrading: onStopTrading,
        ),
        const SizedBox(height: 20),
        const PortfolioDeskNoteCard(),
      ],
    );
  }
}
