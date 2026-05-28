import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';

import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/wallet/application/wallet_providers.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_entity.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_history_page.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/wallet_history_demo.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/widgets/history_ui.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';
import 'package:qorix_markets_flutter/widgets/skeleton_loader.dart';

class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  String _filter = 'All';
  String _search = '';
  final _searchCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  double? _savedScrollOffset;

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
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollCtrl.hasClients) return;
    final max = _scrollCtrl.position.maxScrollExtent;
    if (_scrollCtrl.position.pixels >= max - 240) {
      ref.read(historyTransactionsProvider.notifier).loadMore();
    }
  }

  Future<void> _onRefresh() async {
    if (_scrollCtrl.hasClients) {
      _savedScrollOffset = _scrollCtrl.offset;
    }
    await ref.read(historyTransactionsProvider.notifier).refresh();
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_savedScrollOffset != null && _scrollCtrl.hasClients) {
        final target = _savedScrollOffset!.clamp(0.0, _scrollCtrl.position.maxScrollExtent);
        _scrollCtrl.jumpTo(target);
      }
      _savedScrollOffset = null;
    });
  }

  List<TransactionEntity> _filterList(List<TransactionEntity> all) {
    return all
        .where((t) => WalletHistoryDemo.matchesFilter(t, _filter))
        .where((t) => WalletHistoryDemo.matchesSearch(t, _search))
        .toList();
  }

  Future<void> _openFilter() async {
    final picked = await showHistoryFilterSheet(
      context,
      filters: WalletHistoryDemo.filters,
      selected: _filter,
    );
    if (picked != null && picked != _filter) {
      setState(() => _filter = picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    final txAsync = ref.watch(historyTransactionsProvider);
    final pageH = Responsive.pagePadding(context).left;

    return Scaffold(
      backgroundColor: AppDesk.bg,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppDesk.accent,
          onRefresh: _onRefresh,
          child: CinematicAsyncContent<WalletHistoryPage>(
            value: txAsync,
            onRetry: _onRefresh,
            builder: (page, {required isRefreshing}) {
              final filtered = _filterList(page.items);
              final totals = HistoryTotals.from(filtered);

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: EdgeInsets.fromLTRB(pageH, AppSpacing.screenTopInset, pageH, 0),
                    child: HistoryAppBar(
                      onBack: () => safePop(context),
                      visibleCount: filtered.length,
                      totalCount: page.total > 0 ? page.total : page.items.length,
                      onFilter: _openFilter,
                    ),
                  ),
                  Padding(
                    padding: EdgeInsets.fromLTRB(pageH, AppSpacing.lg, pageH, 0),
                    child: HistorySearchField(
                      controller: _searchCtrl,
                      onChanged: (v) => setState(() => _search = v.trim()),
                    ),
                  ),
                  Padding(
                    padding: EdgeInsets.fromLTRB(pageH, AppSpacing.md, pageH, 0),
                    child: HistorySummaryCard(
                      totalIn: totals.totalIn,
                      totalOut: totals.totalOut,
                      net: totals.net,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Expanded(
                    child: filtered.isEmpty && !page.isLoadingMore
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(parent: AppScroll.page),
                            children: [
                              SizedBox(height: MediaQuery.sizeOf(context).height * 0.2),
                              Center(
                                child: Text('No records', style: TextStyle(color: AppDesk.textTertiary)),
                              ),
                            ],
                          )
                        : Padding(
                            padding: EdgeInsets.fromLTRB(
                              pageH,
                              0,
                              pageH,
                              Responsive.overlayScrollBottomInset(context),
                            ),
                            child: HistoryListContainer(
                              child: ListView.separated(
                                key: const PageStorageKey('wallet_history_list'),
                                controller: _scrollCtrl,
                                padding: EdgeInsets.zero,
                                physics: const AlwaysScrollableScrollPhysics(parent: AppScroll.page),
                                itemCount: filtered.length + (page.isLoadingMore ? 1 : 0),
                                separatorBuilder: (_, __) => AppDesk.listDivider(indent: 56),
                                itemBuilder: (_, i) {
                                  if (i >= filtered.length) {
                                    return const SkeletonListTile();
                                  }
                                  return HistoryTransactionRow(
                                    key: ValueKey(filtered[i].id),
                                    tx: filtered[i],
                                  );
                                },
                              ),
                            ),
                          ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
