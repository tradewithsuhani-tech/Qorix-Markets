import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/application/refresh_gate.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/portfolio/data/repositories/portfolio_repository_impl.dart';
import 'package:qorix_markets_flutter/features/portfolio/domain/entities/profit_entry.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_mock_data.dart';

final profitHistoryProvider =
    AsyncNotifierProvider<ProfitHistoryNotifier, ProfitHistoryPage>(ProfitHistoryNotifier.new);

class ProfitHistoryNotifier extends AsyncNotifier<ProfitHistoryPage> with CachedAsyncMixin<ProfitHistoryPage> {
  static const _pageSize = 20;

  final _refreshGate = RefreshGate(cooldown: const Duration(milliseconds: 1500));
  bool _loadMoreInFlight = false;

  @override
  Future<ProfitHistoryPage> build() async {
    ref.keepAlive();
    if (UiDemoMode.isActive) {
      final page = _demoPage();
      cacheValue(page);
      return page;
    }
    final page = await ref.read(portfolioRepositoryProvider).getProfitHistory(page: 1, limit: _pageSize);
    cacheValue(page);
    return page;
  }

  Future<void> refresh() {
    if (UiDemoMode.isActive) {
      final page = _demoPage();
      cacheValue(page);
      state = AsyncData(page);
      return Future.value();
    }
    return _refreshGate.run(
      () => softRefresh(() => ref.read(portfolioRepositoryProvider).getProfitHistory(page: 1, limit: _pageSize)),
    );
  }

  Future<void> loadMore() async {
    final current = cachedValue ?? state.valueOrNull;
    if (current == null || !current.hasMore || current.isLoadingMore || _loadMoreInFlight) return;
    if (UiDemoMode.isActive) return;

    _loadMoreInFlight = true;
    state = AsyncData(current.copyWith(isLoadingMore: true));
    try {
      final next = await ref.read(portfolioRepositoryProvider).getProfitHistory(
            page: current.page + 1,
            limit: _pageSize,
          );
      final mergedEntries = _mergeEntries(current.entries, next.entries);
      final merged = current.copyWith(
        entries: mergedEntries,
        page: next.page,
        hasMore: next.hasMore,
        isLoadingMore: false,
      );
      cacheValue(merged);
      state = AsyncData(merged);
    } catch (_) {
      state = AsyncData(current.copyWith(isLoadingMore: false));
    } finally {
      _loadMoreInFlight = false;
    }
  }

  List<ProfitEntry> _mergeEntries(List<ProfitEntry> existing, List<ProfitEntry> incoming) {
    final seen = existing.map((e) => e.id).toSet();
    final merged = [...existing];
    for (final entry in incoming) {
      if (seen.add(entry.id)) merged.add(entry);
    }
    return merged;
  }

  ProfitHistoryPage _demoPage() {
    final entries = UiMockData.profitHistory
        .asMap()
        .entries
        .map(
          (e) => ProfitEntry(
            id: 'demo-${e.key}',
            label: e.value.type,
            dateLabel: e.value.date,
            amount: e.value.amount,
          ),
        )
        .toList();
    return ProfitHistoryPage(
      totalProfit: UiMockData.totalProfit,
      currency: 'USDT',
      entries: entries,
      page: 1,
      hasMore: false,
    );
  }
}
