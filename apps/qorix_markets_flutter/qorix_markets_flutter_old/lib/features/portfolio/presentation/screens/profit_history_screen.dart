import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:qorix_markets_flutter/core/motion/stagger_entrance.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/app_typography.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/portfolio/application/profit_history_provider.dart';
import 'package:qorix_markets_flutter/features/portfolio/domain/entities/profit_entry.dart';
import 'package:qorix_markets_flutter/shared/formatters/currency_formatter.dart';
import 'package:qorix_markets_flutter/widgets/app_background.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';
import 'package:qorix_markets_flutter/widgets/glass_card.dart';
import 'package:qorix_markets_flutter/widgets/skeleton_loader.dart';

class ProfitHistoryScreen extends ConsumerStatefulWidget {
  const ProfitHistoryScreen({super.key});

  @override
  ConsumerState<ProfitHistoryScreen> createState() => _ProfitHistoryScreenState();
}

class _ProfitHistoryScreenState extends ConsumerState<ProfitHistoryScreen> {
  final _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollCtrl
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollCtrl.hasClients) return;
    if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 240) {
      ref.read(profitHistoryProvider.notifier).loadMore();
    }
  }

  Future<void> _onRefresh() => ref.read(profitHistoryProvider.notifier).refresh();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final historyAsync = ref.watch(profitHistoryProvider);

    return AppBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, size: 20),
            onPressed: () => context.pop(),
          ),
          title: const Text('Profit history'),
        ),
        body: SafeArea(
          child: Responsive.constrained(
            context,
            CinematicAsyncContent<ProfitHistoryPage>(
              value: historyAsync,
              onRetry: _onRefresh,
              loading: _ProfitHistorySkeleton(isDark: isDark),
              builder: (page, {required isRefreshing}) => RefreshIndicator(
                onRefresh: _onRefresh,
                color: AppColors.authGreen,
                child: ListView(
                  controller: _scrollCtrl,
                  physics: const AlwaysScrollableScrollPhysics(parent: AppScroll.page),
                  padding: Responsive.pagePadding(context),
                  children: [
                    GlassCard(
                      variant: GlassCardVariant.hero,
                      glowColor: AppColors.buy,
                      animateEntrance: false,
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('TOTAL PROFIT', style: AppTypography.overline(isDark: isDark)),
                          AppSpacing.gapMd(),
                          Text(
                            CurrencyFormatter.format(page.totalProfit),
                            style: Theme.of(context).textTheme.displaySmall?.copyWith(color: AppColors.buy),
                          ),
                          AppSpacing.gapSm(),
                          Text(
                            'Passive income · Compounding · Partner rewards',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ).staggerIn(index: 0),
                    AppSpacing.gapSection(),
                    if (page.entries.isEmpty)
                      _EmptyProfitHistory(isDark: isDark)
                    else ...[
                      ...page.entries.asMap().entries.map(
                            (e) => Padding(
                              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                              child: _ProfitEntryCard(entry: e.value, isDark: isDark).staggerIn(index: e.key + 1),
                            ),
                          ),
                      if (page.isLoadingMore)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
                          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                        ),
                    ],
                    const SizedBox(height: AppSpacing.xl),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfitEntryCard extends StatelessWidget {
  const _ProfitEntryCard({required this.entry, required this.isDark});

  final ProfitEntry entry;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      animateEntrance: false,
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.buy.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.trending_up_rounded, color: AppColors.buy, size: 20),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entry.label, style: Theme.of(context).textTheme.titleSmall),
                Text(entry.dateLabel, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          Text(
            '+${CurrencyFormatter.format(entry.amount)}',
            style: AppTypography.price(isDark: isDark, size: 14, color: AppColors.buy),
          ),
        ],
      ),
    );
  }
}

class _EmptyProfitHistory extends StatelessWidget {
  const _EmptyProfitHistory({required this.isDark});

  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      animateEntrance: false,
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        children: [
          Icon(Icons.insights_outlined, size: 40, color: AppColors.buy.withValues(alpha: 0.5)),
          AppSpacing.gapMd(),
          Text('No profit credits yet', style: Theme.of(context).textTheme.titleSmall),
          AppSpacing.gapSm(),
          Text(
            'Daily desk profits and partner rewards will appear here once your strategy is active.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    ).staggerIn(index: 1);
  }
}

class _ProfitHistorySkeleton extends StatelessWidget {
  const _ProfitHistorySkeleton({required this.isDark});

  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: Responsive.pagePadding(context),
      children: [
        const SkeletonBox(height: 120, borderRadius: 16),
        AppSpacing.gapSection(),
        for (var i = 0; i < 5; i++) ...[
          const SkeletonBox(height: 72, borderRadius: 16),
          AppSpacing.gapSm(),
        ],
      ],
    );
  }
}
