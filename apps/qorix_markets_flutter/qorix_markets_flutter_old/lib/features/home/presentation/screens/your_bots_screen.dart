import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/bots/application/bots_providers.dart';
import 'package:qorix_markets_flutter/features/bots/domain/entities/bot_entity.dart';
import 'package:qorix_markets_flutter/features/dashboard/application/dashboard_providers.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/bot_setup_demo.dart';
import 'package:qorix_markets_flutter/features/home/presentation/widgets/your_bots_ui.dart';
import 'package:qorix_markets_flutter/features/invest/application/investment_providers.dart';
import 'package:qorix_markets_flutter/features/wallet/application/wallet_providers.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';
import 'package:qorix_markets_flutter/widgets/desk_scroll.dart';

class YourBotsScreen extends ConsumerWidget {
  const YourBotsScreen({super.key});

  static const _noActiveBotMessage = "You don't have any active bot";

  ActiveBotPosition _resolvePosition(WidgetRef ref) {
    final dashboard = ref.watch(dashboardProvider).valueOrNull;
    final investment = ref.watch(investmentProvider).valueOrNull;
    final transactions = ref.watch(transactionsProvider).valueOrNull;

    final deployed = (investment != null && investment.isActive) ? investment.deployedCapital : 0.0;
    final fundStats = dashboard?.fundStats;

    return ActiveBotPosition.resolve(
      deployedUsd: deployed,
      totalAumUsd: fundStats?.aum ?? 0,
      activeInvestors: fundStats?.activeInvestors ?? 0,
      transactions: transactions,
    );
  }

  void _openManagePlan(BuildContext context, WidgetRef ref) {
    final inv = ref.read(investmentProvider).valueOrNull;
    if (inv?.isActive != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(_noActiveBotMessage),
          backgroundColor: AppColors.authCardBg,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    context.push(RoutePaths.managePlan);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final botsAsync = ref.watch(botsListProvider);
    final pagePad = Responsive.scrollPage(context);
    final position = _resolvePosition(ref);
    final investment = ref.watch(investmentProvider).valueOrNull;
    final equityPoints = ref.watch(dashboardProvider).valueOrNull?.equityPoints ?? const [];
    final activeInvestors = ref.watch(dashboardProvider).valueOrNull?.fundStats?.activeInvestors;

    return SafeArea(
      bottom: false,
      minimum: EdgeInsets.zero,
      child: Responsive.constrained(
        context,
        RefreshIndicator(
          color: AppColors.authGreen,
          onRefresh: () async {
            await Future.wait([
              ref.read(botsListProvider.notifier).refresh(),
              ref.read(botsPerformanceProvider.notifier).refresh(),
              ref.read(dashboardProvider.notifier).refresh(),
              ref.read(investmentProvider.notifier).refresh(),
              ref.read(transactionsProvider.notifier).refresh(),
            ]);
          },
          child: CinematicAsyncContent<List<BotEntity>>(
            value: botsAsync,
            onRetry: () => ref.read(botsListProvider.notifier).refresh(),
            builder: (bots, {required isRefreshing}) {
              BotEntity? activeBot;
              for (final bot in bots) {
                if (bot.isActive) {
                  activeBot = bot;
                  break;
                }
              }
              activeBot ??= bots.isNotEmpty ? bots.first : null;

              final metrics = ActiveBotHeroMetrics.resolve(
                position: position,
                investment: investment,
                equityPoints: equityPoints,
                activeBot: activeBot,
              );

              return ListView(
                physics: AppScroll.page,
                padding: EdgeInsets.fromLTRB(pagePad.left, 10, pagePad.right, 0),
                children: [
                  YourBotsHeader(activeInvestors: activeInvestors),
                  const SizedBox(height: 20),
                  ActiveBotHeroCard(
                    position: position,
                    metrics: metrics,
                    onManagePlan: () => _openManagePlan(context, ref),
                    onLiveActivity: () => context.push(RoutePaths.aiActivity),
                  ),
                  const SizedBox(height: 24),
                  const YourBotsExploreLabel(),
                  ...BotSetupDemo.exploreBots.map(
                    (bot) => ExploreBotCard(
                      bot: bot,
                      onSetup: () {
                        if (bot.id == 'market-broker') {
                          context.push(RoutePaths.brokerHub);
                          return;
                        }
                        context.push('${RoutePaths.deployCapital}?bot=${bot.id}');
                      },
                    ),
                  ),
                  const NavScrollSpacer(),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
