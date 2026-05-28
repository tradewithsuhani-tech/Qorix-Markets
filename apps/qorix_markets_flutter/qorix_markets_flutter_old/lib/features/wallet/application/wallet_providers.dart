import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/application/refresh_gate.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/wallet/data/repositories/wallet_repository_impl.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_entity.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_history_merge.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_history_page.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';

final walletProvider = AsyncNotifierProvider<WalletNotifier, WalletEntity>(WalletNotifier.new);

final transactionsProvider =
    AsyncNotifierProvider<TransactionsNotifier, List<TransactionEntity>>(TransactionsNotifier.new);

/// Paginated wallet history for History screen.
final historyTransactionsProvider =
    AsyncNotifierProvider<HistoryTransactionsNotifier, WalletHistoryPage>(HistoryTransactionsNotifier.new);

class WalletNotifier extends AsyncNotifier<WalletEntity> with CachedAsyncMixin<WalletEntity> {
  final _refreshGate = RefreshGate();

  @override
  Future<WalletEntity> build() async {
    ref.keepAlive();
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.wallet();
      cacheValue(data);
      return data;
    }
    final data = await ref.read(walletRepositoryProvider).getWallet();
    cacheValue(data);
    return data;
  }

  Future<void> refresh() {
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.wallet();
      cacheValue(data);
      state = AsyncData(data);
      return Future.value();
    }
    return _refreshGate.run(() => softRefresh(() => ref.read(walletRepositoryProvider).getWallet()));
  }

  Future<void> reconcile() async {
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.wallet();
      cacheValue(data);
      state = AsyncData(data);
      ref.invalidate(transactionsProvider);
      ref.invalidate(historyTransactionsProvider);
      return;
    }
    await softRefresh(() => ref.read(walletRepositoryProvider).getWallet());
    ref.invalidate(transactionsProvider);
    ref.invalidate(historyTransactionsProvider);
  }
}

class TransactionsNotifier extends AsyncNotifier<List<TransactionEntity>>
    with CachedAsyncMixin<List<TransactionEntity>> {
  final _refreshGate = RefreshGate();

  @override
  Future<List<TransactionEntity>> build() async {
    ref.keepAlive();
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.transactions();
      cacheValue(data);
      return data;
    }
    final data = await ref.read(walletRepositoryProvider).getTransactions(limit: 20);
    cacheValue(data);
    return data;
  }

  Future<void> refresh() {
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.transactions();
      cacheValue(data);
      state = AsyncData(data);
      return Future.value();
    }
    return _refreshGate.run(() => softRefresh(() => ref.read(walletRepositoryProvider).getTransactions(limit: 20)));
  }
}

class HistoryTransactionsNotifier extends AsyncNotifier<WalletHistoryPage>
    with CachedAsyncMixin<WalletHistoryPage> {
  static const _pageSize = 25;

  final _refreshGate = RefreshGate(cooldown: const Duration(milliseconds: 1500));
  bool _loadMoreInFlight = false;

  @override
  Future<WalletHistoryPage> build() async {
    ref.keepAlive();
    if (UiDemoMode.isActive) {
      final items = UiDemoFixtures.transactions();
      final page = WalletHistoryPage(items: items, page: 1, total: items.length, hasMore: false);
      cacheValue(page);
      return page;
    }
    final page = await ref.read(walletRepositoryProvider).getHistoryPage(page: 1, limit: _pageSize);
    cacheValue(page);
    return page;
  }

  Future<void> refresh() {
    if (UiDemoMode.isActive) {
      final items = UiDemoFixtures.transactions();
      final page = WalletHistoryPage(items: items, page: 1, total: items.length, hasMore: false);
      cacheValue(page);
      state = AsyncData(page);
      return Future.value();
    }
    return _refreshGate.run(
      () => softRefresh(() => ref.read(walletRepositoryProvider).getHistoryPage(page: 1, limit: _pageSize)),
    );
  }

  Future<void> loadMore() async {
    final current = cachedValue ?? state.valueOrNull;
    if (current == null || !current.hasMore || current.isLoadingMore || _loadMoreInFlight) return;
    if (UiDemoMode.isActive) return;

    _loadMoreInFlight = true;
    state = AsyncData(current.copyWith(isLoadingMore: true));
    try {
      final nextPage = current.page + 1;
      final fetched = await ref
          .read(walletRepositoryProvider)
          .getHistoryPage(page: nextPage, limit: _pageSize);

      final mergedItems = mergeWalletHistoryPages(current.items, fetched.items);
      final reachedEnd = fetched.items.isEmpty ||
          !fetched.hasMore ||
          (fetched.total > 0 && mergedItems.length >= fetched.total);

      final merged = WalletHistoryPage(
        items: mergedItems,
        page: fetched.page,
        total: fetched.total > 0 ? fetched.total : mergedItems.length,
        hasMore: !reachedEnd,
      );
      cacheValue(merged);
      state = AsyncData(merged);
    } catch (_) {
      state = AsyncData(current.copyWith(isLoadingMore: false));
    } finally {
      _loadMoreInFlight = false;
    }
  }
}
