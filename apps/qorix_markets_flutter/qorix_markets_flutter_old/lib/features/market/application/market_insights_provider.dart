import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/application/refresh_gate.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/market/data/repositories/market_repository_impl.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_insights_entities.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/market_insights_demo.dart';

final marketInsightsProvider =
    AsyncNotifierProvider<MarketInsightsNotifier, MarketInsightsSnapshot>(MarketInsightsNotifier.new);

class MarketInsightsNotifier extends AsyncNotifier<MarketInsightsSnapshot> with CachedAsyncMixin<MarketInsightsSnapshot> {
  final _refreshGate = RefreshGate(cooldown: const Duration(milliseconds: 1500));

  @override
  Future<MarketInsightsSnapshot> build() async {
    ref.keepAlive();
    if (UiDemoMode.isActive) {
      final snap = MarketInsightsDemo.snapshot();
      cacheValue(snap);
      return snap;
    }
    final snap = await ref.read(marketRepositoryProvider).getMarketCalendar();
    cacheValue(snap);
    return snap;
  }

  Future<void> refresh() {
    if (UiDemoMode.isActive) {
      final snap = MarketInsightsDemo.snapshot();
      cacheValue(snap);
      state = AsyncData(snap);
      return Future.value();
    }
    return _refreshGate.run(() => softRefresh(() => ref.read(marketRepositoryProvider).getMarketCalendar()));
  }
}
