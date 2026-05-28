import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/bots/application/bots_providers.dart';
import 'package:qorix_markets_flutter/features/bots/domain/entities/bot_entity.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/bot_setup_demo.dart';
import 'package:qorix_markets_flutter/features/home/presentation/widgets/your_bots_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';
import 'package:qorix_markets_flutter/widgets/desk_scroll.dart';

class YourBotsScreen extends ConsumerWidget {
  const YourBotsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final botsAsync = ref.watch(botsListProvider);
    final pagePad = Responsive.scrollPage(context);

    return SafeArea(
      bottom: false,
      minimum: EdgeInsets.zero,
      child: Responsive.constrained(
        context,
        RefreshIndicator(
          color: AppColors.authGreen,
          onRefresh: () async {
            await ref.read(botsListProvider.notifier).refresh();
            await ref.read(botsPerformanceProvider.notifier).refresh();
          },
          child: CinematicAsyncContent<List<BotEntity>>(
            value: botsAsync,
            onRetry: () => ref.read(botsListProvider.notifier).refresh(),
            builder: (_, {required isRefreshing}) {
              return ListView(
                physics: AppScroll.page,
                padding: EdgeInsets.fromLTRB(pagePad.left, 10, pagePad.right, 0),
                children: [
                  const YourBotsHeader(),
                  const SizedBox(height: 20),
                  const ActiveBotHeroCard(),
                  const SizedBox(height: 24),
                  const YourBotsExploreLabel(),
                  ...BotSetupDemo.exploreBots.map(
                    (bot) => ExploreBotCard(
                      bot: bot,
                      onSetup: () => context.push('${RoutePaths.deployCapital}?bot=${bot.id}'),
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
