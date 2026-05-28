import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/app_lifecycle.dart';
import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/application/refresh_gate.dart';
import 'package:qorix_markets_flutter/core/config/env_config.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/data/models/market_orderbook_model.dart';
import 'package:qorix_markets_flutter/features/bots/application/bots_providers.dart';
import 'package:qorix_markets_flutter/features/market/data/repositories/market_repository_impl.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_pair.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/markets_demo.dart';
import 'package:qorix_markets_flutter/features/market/presentation/providers/market_providers.dart';

List<OrderBookRow> marketsOrderBookRows(List<MarketsOrderLevel> levels, BookSide side) {
  if (levels.isEmpty) return const [];
  final maxAmt = levels.map((l) => l.amount).reduce((a, b) => a > b ? a : b);
  return [
    for (final level in levels)
      OrderBookRow(
        price: level.price,
        amount: level.amount,
        side: side,
        depth: maxAmt > 0 ? (level.amount / maxAmt).clamp(0.15, 1.0) : 0.5,
      ),
  ];
}

class MarketsOrderLevel {
  const MarketsOrderLevel({required this.price, required this.amount});

  final double price;
  final double amount;
}

typedef MarketsOrderBookSnapshot = ({
  List<MarketsOrderLevel> bids,
  List<MarketsOrderLevel> asks,
});

MarketsOrderBookSnapshot buildSyntheticOrderBook(double mid) {
  final bids = <MarketsOrderLevel>[];
  final asks = <MarketsOrderLevel>[];
  for (var i = 0; i < 8; i++) {
    final spread = (i + 1) * 0.08;
    bids.add(MarketsOrderLevel(price: mid - spread, amount: 1200 + i * 340));
    asks.add(MarketsOrderLevel(price: mid + spread, amount: 980 + i * 290));
  }
  return (bids: bids, asks: asks);
}

MarketsOrderBookSnapshot orderBookFromApi(MarketOrderBookModel book) {
  return (
    bids: book.bids.map((l) => MarketsOrderLevel(price: l.price, amount: l.amount)).toList(),
    asks: book.asks.map((l) => MarketsOrderLevel(price: l.price, amount: l.amount)).toList(),
  );
}

/// Live ticker mid-price from `/markets/ticker`.
final marketsTickerPriceProvider = Provider<double>((ref) {
  if (UiDemoMode.isActive) return MarketsDemo.baseInr;

  final pairs = ref.watch(marketStreamProvider).valueOrNull;
  if (pairs == null || pairs.isEmpty) return MarketsDemo.baseInr;

  MarketPair? picked;
  for (final p in pairs) {
    if (p.symbol.contains('INR') || p.symbol.contains('USDT')) {
      picked = p;
      break;
    }
  }
  return (picked ?? pairs.first).price;
});

/// Rounded mid-price — only notifies when display value changes (reduces rebuild jitter).
final marketsStableTickerPriceProvider =
    NotifierProvider<MarketsStablePriceNotifier, double>(MarketsStablePriceNotifier.new);

class MarketsStablePriceNotifier extends Notifier<double> {
  static const _tick = 0.01;

  @override
  double build() {
    ref.listen(marketsTickerPriceProvider, (_, next) {
      final rounded = (next * 100).roundToDouble() / 100;
      if ((state - rounded).abs() >= _tick) state = rounded;
    });
    final raw = ref.read(marketsTickerPriceProvider);
    return (raw * 100).roundToDouble() / 100;
  }
}

final marketsTickerHighProvider = Provider<double>((ref) {
  if (UiDemoMode.isActive) return MarketsDemo.high24h;
  final stats = ref.watch(marketsUsdtInr24hProvider).valueOrNull;
  if (stats != null && stats.$1 > 0) return stats.$1;
  final mid = ref.watch(marketsStableTickerPriceProvider);
  return mid * 1.008;
});

final marketsTickerLowProvider = Provider<double>((ref) {
  if (UiDemoMode.isActive) return MarketsDemo.low24h;
  final stats = ref.watch(marketsUsdtInr24hProvider).valueOrNull;
  if (stats != null && stats.$2 > 0) return stats.$2;
  final mid = ref.watch(marketsStableTickerPriceProvider);
  return mid * 0.992;
});

final marketsUsdtInr24hProvider = FutureProvider<(double, double)>((ref) async {
  if (UiDemoMode.isActive) return (MarketsDemo.high24h, MarketsDemo.low24h);
  ref.watch(marketStreamProvider);
  final snap = await ref.read(marketRepositoryProvider).getTickerSnapshot();
  final mid = snap.pairs.isNotEmpty ? snap.pairs.first.price : MarketsDemo.baseInr;
  return (
    snap.high24h ?? mid * 1.008,
    snap.low24h ?? mid * 0.992,
  );
});

/// Live order book from `/markets/orderbook` — pauses when app is backgrounded.
final marketsOrderBookProvider =
    AsyncNotifierProvider<MarketsOrderBookNotifier, MarketsOrderBookSnapshot>(MarketsOrderBookNotifier.new);

class MarketsOrderBookNotifier extends AsyncNotifier<MarketsOrderBookSnapshot>
    with CachedAsyncMixin<MarketsOrderBookSnapshot> {
  Timer? _poll;
  final _refreshGate = RefreshGate(cooldown: const Duration(milliseconds: 1200));

  @override
  Future<MarketsOrderBookSnapshot> build() async {
    ref.keepAlive();

    if (UiDemoMode.isActive) {
      final snap = buildSyntheticOrderBook(MarketsDemo.baseInr);
      cacheValue(snap);
      return snap;
    }

    ref.listen(appForegroundProvider, (prev, next) {
      if (next == AppForegroundState.foreground) {
        _startPoll();
        _refreshGate.run(refresh);
      } else {
        _stopPoll();
      }
    });

    ref.onDispose(_stopPoll);

    if (ref.read(appForegroundProvider) == AppForegroundState.foreground) {
      _startPoll();
    }

    final snap = await _fetch();
    cacheValue(snap);
    return snap;
  }

  void _startPoll() {
    if (_poll?.isActive == true) return;
    _poll = Timer.periodic(EnvConfig.marketPollInterval, (_) {
      if (ref.read(appForegroundProvider.notifier).isForeground) {
        _refreshGate.run(refresh);
      }
    });
  }

  void _stopPoll() {
    _poll?.cancel();
    _poll = null;
  }

  Future<MarketsOrderBookSnapshot> _fetch() async {
    try {
      final book = await ref.read(marketRepositoryProvider).getOrderBook(symbol: 'USDT/INR');
      if (book.bids.isNotEmpty || book.asks.isNotEmpty) {
        return orderBookFromApi(book);
      }
    } catch (_) {}
    final mid = ref.read(marketsTickerPriceProvider);
    return buildSyntheticOrderBook(mid);
  }

  Future<void> refresh() => softRefresh(_fetch);
}

/// Bot desk performance feed (READ) — `/bots/performance`.
final botPerformanceTradesProvider = Provider((ref) => ref.watch(botsPerformanceProvider));
