import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/dashboard/application/dashboard_providers.dart';
import 'package:qorix_markets_flutter/features/wallet/application/wallet_providers.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_entity.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/widgets/wallet_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/ui/components/transfer_flow_sheet.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';
import 'package:qorix_markets_flutter/widgets/desk_scroll.dart';

class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final walletAsync = ref.watch(walletProvider);
    final txAsync = ref.watch(transactionsProvider);
    final dailyPnl = ref.watch(walletDailyPnlProvider);

    return SafeArea(
      bottom: false,
      child: Responsive.constrained(
        context,
        RefreshIndicator(
          color: AppColors.authGreen,
          onRefresh: () async {
            await ref.read(walletProvider.notifier).refresh();
            await ref.read(transactionsProvider.notifier).refresh();
          },
          child: ListView(
            physics: AppScroll.page,
            padding: Responsive.scrollPage(context),
            children: [
              CinematicAsyncContent(
                value: walletAsync,
                onRetry: () => ref.read(walletProvider.notifier).refresh(),
                loading: const WalletHeroSkeleton(),
                builder: (wallet, {required isRefreshing}) => _WalletBody(
                  wallet: wallet,
                  txAsync: txAsync,
                  dailyPnl: dailyPnl.pnl,
                  dailyPnlPercent: dailyPnl.percent,
                  onDeposit: () => context.push(RoutePaths.deposit),
                  onWithdraw: () => context.push(RoutePaths.withdraw),
                  onTransfer: () => showTransferFlowSheet(context),
                  onRetryTx: () => ref.read(transactionsProvider.notifier).refresh(),
                ),
              ),
              const NavScrollSpacer(),
            ],
          ),
        ),
      ),
    );
  }
}

class _WalletBody extends StatelessWidget {
  const _WalletBody({
    required this.wallet,
    required this.txAsync,
    required this.dailyPnl,
    required this.dailyPnlPercent,
    required this.onDeposit,
    required this.onWithdraw,
    required this.onTransfer,
    required this.onRetryTx,
  });

  final WalletEntity wallet;
  final AsyncValue<List<TransactionEntity>> txAsync;
  final double dailyPnl;
  final double dailyPnlPercent;
  final VoidCallback onDeposit;
  final VoidCallback onWithdraw;
  final VoidCallback onTransfer;
  final VoidCallback onRetryTx;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        WalletPortfolioHero(
          wallet: wallet,
          dailyPnl: dailyPnl,
          dailyPnlPercent: dailyPnlPercent,
          onDeposit: onDeposit,
          onWithdraw: onWithdraw,
          onTransfer: onTransfer,
        ),
        const SizedBox(height: AppSpacing.sectionGap),
        WalletActivityHeader(
          onSeeMore: () => context.push(RoutePaths.history),
        ),
        const SizedBox(height: 8),
        CinematicAsyncContent(
          value: txAsync,
          skeletonCount: 4,
          onRetry: onRetryTx,
          builder: (txns, {required isRefreshing}) {
            if (txns.isEmpty) {
              return WalletEmptyActivity(onDeposit: onDeposit);
            }
            final dateFmt = DateFormat('dd MMM yyyy');
            final sorted = [...txns]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
            return Column(
              children: sorted.take(8).map((t) {
                return WalletActivityTile(
                  type: t.type,
                  amount: t.amount,
                  currency: t.currency,
                  isCredit: t.isCredit,
                  date: dateFmt.format(t.createdAt),
                  status: t.status,
                  description: t.description,
                );
              }).toList(),
            );
          },
        ),
      ],
    );
  }
}
