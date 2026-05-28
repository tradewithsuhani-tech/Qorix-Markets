import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/dashboard/application/dashboard_providers.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/bot_terminal_demo.dart';
import 'package:qorix_markets_flutter/features/home/presentation/widgets/bot_terminal_candle_ui.dart';
import 'package:qorix_markets_flutter/features/notifications/application/notification_providers.dart';
import 'package:qorix_markets_flutter/ui/components/notification_panel.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';
import 'package:qorix_markets_flutter/widgets/skeleton_loader.dart';

/// Home — XAU/USD auto bot terminal with live candlesticks (UI demo).
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  static const _openOrderCount = BotTerminalDemo.openOrderCount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardAsync = ref.watch(dashboardProvider);
    final unread = ref.watch(unreadNotificationsCountProvider);
    final horizontal = Responsive.isMobile(context)
        ? AppSpacing.pageHorizontalMobile
        : AppSpacing.pageHorizontalTablet;

    return SafeArea(
      bottom: false,
      minimum: EdgeInsets.zero,
      child: Responsive.constrained(
        context,
        LayoutBuilder(
          builder: (context, constraints) {
            return RefreshIndicator(
              color: AppColors.authGreen,
              onRefresh: () => ref.read(dashboardProvider.notifier).refresh(),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(parent: AppScroll.page),
                child: SizedBox(
                  height: constraints.maxHeight,
                  width: double.infinity,
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(horizontal, 10, horizontal, 0),
                    child: CinematicAsyncContent(
                      value: dashboardAsync,
                      onRetry: () => ref.read(dashboardProvider.notifier).refresh(),
                      loading: const SkeletonHeroCard(),
                      builder: (snap, {required isRefreshing}) => BotTerminalDashboard(
                        openPositions: snap.isTrading ? _openOrderCount : 0,
                        isTrading: snap.isTrading,
                        unreadCount: unread,
                        onNotifications: () => showNotificationPanel(context),
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
