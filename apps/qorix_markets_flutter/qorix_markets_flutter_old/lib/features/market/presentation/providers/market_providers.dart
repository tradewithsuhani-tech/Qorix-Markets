import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/app_lifecycle.dart';
import 'package:qorix_markets_flutter/core/application/refresh_gate.dart';
import 'package:qorix_markets_flutter/core/config/env_config.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/market/data/repositories/market_repository_impl.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/candle.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_pair.dart';
import 'package:qorix_markets_flutter/features/portfolio/data/repositories/portfolio_repository_impl.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';

/// Live tickers via HTTP poll of `/markets/ticker` — WS handled by [LiveDeskHub].
final marketStreamProvider = StreamProvider<List<MarketPair>>((ref) async* {
  if (UiDemoMode.isActive) {
    yield UiDemoFixtures.marketPairs;
    await for (final _ in Stream.periodic(const Duration(seconds: 3))) {
      yield UiDemoFixtures.marketPairsWithJitter();
    }
    return;
  }

  ref.keepAlive();

  final repo = ref.watch(marketRepositoryProvider);
  final foreground = ref.watch(appForegroundProvider);
  final pollGate = RefreshGate(cooldown: EnvConfig.marketPollInterval);

  var pairs = <MarketPair>[];
  final controller = StreamController<List<MarketPair>>.broadcast();
  Timer? poll;

  void emitPairs(List<MarketPair> next) {
    if (!controller.isClosed) controller.add(next);
  }

  Future<void> pollTrades() async {
    if (ref.read(appForegroundProvider.notifier).isForeground == false) return;
    await pollGate.run(() async {
      try {
        final next = await repo.getTicker();
        if (next.isNotEmpty) {
          pairs = next;
          emitPairs(pairs);
        }
      } catch (_) {
        try {
          final fallback = await repo.getTickerFromTrades();
          if (fallback.isNotEmpty) {
            pairs = fallback;
            emitPairs(pairs);
          }
        } catch (_) {}
      }
    });
  }

  ref.listen(appForegroundProvider, (prev, next) {
    if (next == AppForegroundState.foreground) {
      if (poll?.isActive != true) {
        poll = Timer.periodic(EnvConfig.marketPollInterval, (_) => pollTrades());
        pollTrades();
      }
    } else {
      poll?.cancel();
      poll = null;
    }
  });

  await pollTrades();
  if (pairs.isNotEmpty) yield List.from(pairs);
  if (foreground == AppForegroundState.foreground) {
    poll = Timer.periodic(EnvConfig.marketPollInterval, (_) => pollTrades());
  }

  ref.onDispose(() {
    poll?.cancel();
    controller.close();
  });

  yield* controller.stream;
});

final candleStreamProvider =
    StreamProvider.autoDispose.family<List<Candle>, String>((ref, symbol) async* {
  final tradesAsync = ref.watch(marketStreamProvider);
  final pairs = tradesAsync.valueOrNull ?? [];
  MarketPair? pair;
  for (final p in pairs) {
    if (p.symbol == symbol) {
      pair = p;
      break;
    }
  }

  var candles = _seedCandles(symbol, pair?.price ?? 100);
  yield candles;

  await for (final _ in Stream.periodic(const Duration(seconds: 3))) {
    final latest = ref.read(marketStreamProvider).valueOrNull;
    MarketPair? current;
    if (latest != null) {
      for (final p in latest) {
        if (p.symbol == symbol) {
          current = p;
          break;
        }
      }
    }
    if (current != null) {
      candles = _appendCandle(candles, current.price);
      yield List.from(candles);
    }
  }
});

List<Candle> _seedCandles(String symbol, double price) {
  final now = DateTime.now();
  return List.generate(40, (i) {
    final o = price * (1 + (i - 20) * 0.001);
    final c = o * 1.002;
    return Candle(
      open: o,
      high: o * 1.004,
      low: o * 0.996,
      close: c,
      timestamp: now.subtract(Duration(minutes: (40 - i) * 15)),
    );
  });
}

List<Candle> _appendCandle(List<Candle> candles, double price) {
  final last = candles.isNotEmpty ? candles.last : null;
  final open = last?.close ?? price;
  final next = Candle(
    open: open,
    high: [open, price].reduce((a, b) => a > b ? a : b) * 1.001,
    low: [open, price].reduce((a, b) => a < b ? a : b) * 0.999,
    close: price,
    timestamp: DateTime.now(),
  );
  final updated = [...candles, next];
  return updated.length > 80 ? updated.sublist(updated.length - 80) : updated;
}

final portfolioProvider = FutureProvider.autoDispose<List<Holding>>((ref) async {
  if (UiDemoMode.isActive) return UiDemoFixtures.holdings();
  return ref.watch(portfolioRepositoryProvider).getHoldingsFromTrades();
});

final portfolioSummaryProvider = FutureProvider.autoDispose((ref) async {
  if (UiDemoMode.isActive) return UiDemoFixtures.portfolioSummary();
  return ref.watch(portfolioRepositoryProvider).getSummary();
});

final equityChartProvider = FutureProvider.autoDispose((ref) async {
  if (UiDemoMode.isActive) return UiDemoFixtures.equityChart();
  return ref.watch(portfolioRepositoryProvider).getEquityChart(days: 30);
});
