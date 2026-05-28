import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/application/refresh_gate.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/data/models/trade_model.dart';
import 'package:qorix_markets_flutter/features/invest/application/investment_providers.dart';
import 'package:qorix_markets_flutter/features/invest/infrastructure/investment_repository_impl.dart';
import 'package:qorix_markets_flutter/ui/components/ai_desk_feed.dart';
import 'package:qorix_markets_flutter/ui/components/capital_allocation_visualizer.dart';
import 'package:qorix_markets_flutter/ui/components/desk_allocation_feed.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';

final deskTradesProvider =
    AsyncNotifierProvider<DeskTradesNotifier, List<TradeModel>>(DeskTradesNotifier.new);

class DeskTradesNotifier extends AsyncNotifier<List<TradeModel>> with CachedAsyncMixin<List<TradeModel>> {
  final _refreshGate = RefreshGate(cooldown: const Duration(milliseconds: 1500));

  @override
  Future<List<TradeModel>> build() async {
    ref.keepAlive();
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.deskTrades();
      cacheValue(data);
      return data;
    }
    final data = await ref.read(investmentRepositoryProvider).getTrades(limit: 20);
    cacheValue(data);
    return data;
  }

  Future<void> refresh() {
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.deskTrades();
      cacheValue(data);
      state = AsyncData(data);
      return Future.value();
    }
    return _refreshGate.run(() => softRefresh(() => ref.read(investmentRepositoryProvider).getTrades(limit: 20)));
  }

  void prependTrade(Map<String, dynamic> payload) {
    final trade = TradeModel(
      id: DateTime.now().millisecondsSinceEpoch,
      symbol: payload['symbol'] as String? ?? 'UNKNOWN',
      direction: payload['direction'] as String? ?? 'long',
      entryPrice: 0,
      exitPrice: 0,
      profit: 0,
      profitPercent: (payload['profitPercent'] as num?)?.toDouble() ?? 0,
      executedAt: DateTime.now().toIso8601String(),
    );
    final current = cachedValue ?? [];
    final updated = [trade, ...current].take(20).toList();
    cacheValue(updated);
    state = AsyncData(updated);
  }
}

/// AI desk events — scoped rebuild for feed widgets.
final aiDeskEventsProvider = Provider<List<AiDeskEvent>>((ref) {
  final trades = ref.watch(deskTradesProvider).valueOrNull ?? [];
  return trades.take(5).map(_tradeToAiEvent).toList();
});

/// Allocation feed derived from recent desk trades.
final deskAllocationEventsProvider = Provider<List<DeskAllocationEvent>>((ref) {
  final trades = ref.watch(deskTradesProvider).valueOrNull ?? [];
  return trades.take(4).map(_tradeToAllocationEvent).toList();
});

/// Capital allocation slices from trade symbol distribution.
final allocationSlicesProvider = Provider<List<AllocationSlice>>((ref) {
  final trades = ref.watch(deskTradesProvider).valueOrNull ?? [];
  if (trades.isEmpty) return const [];
  return _buildAllocationSlices(trades);
});

/// Live commentary lines from investment + trades.
final aiDeskCommentaryProvider = Provider<List<String>>((ref) {
  final inv = ref.watch(investmentProvider).valueOrNull;
  final trades = ref.watch(deskTradesProvider).valueOrNull ?? [];
  final lines = <String>[];

  if (inv?.isActive == true) {
    lines.add(
      'Your ${inv!.riskLevel.toLowerCase()} deployment is active · '
      '${inv.drawdownUsedPercent.toStringAsFixed(1)}% drawdown used of ${inv.drawdownLimit.toStringAsFixed(0)}% limit',
    );
    if (inv.dailyProfit > 0) {
      lines.add('Desk credited +\$${inv.dailyProfit.toStringAsFixed(2)} daily profit · compounding ${inv.autoCompound ? 'on' : 'off'}');
    }
    if (inv.isPaused) {
      lines.add('Strategy under admin review · capital protection engaged');
    }
  } else {
    lines.add('Wealth desk standing by · deploy capital to activate AI-managed strategy');
  }

  for (final t in trades.take(3)) {
    final dir = t.direction == 'long' ? 'momentum' : 'hedge';
    lines.add('Desk closed ${t.symbol} ${dir} · ${t.profitPercent >= 0 ? '+' : ''}${t.profitPercent.toStringAsFixed(2)}% impact');
  }

  return lines.isEmpty ? ['Markets monitored · capital protected'] : lines;
});

AiDeskEvent _tradeToAiEvent(TradeModel t) {
  final ago = _timeAgo(t.executedAt);
  return AiDeskEvent(
    label: '${t.symbol} · ${_directionLabel(t.direction)}',
    detail: 'Desk trade closed · portfolio impact',
    impactPercent: t.profitPercent,
    timeAgo: ago,
  );
}

DeskAllocationEvent _tradeToAllocationEvent(TradeModel t) {
  return DeskAllocationEvent(
    asset: t.symbol,
    action: '${_directionLabel(t.direction)} allocation · desk rebalance',
    allocationPercent: t.profitPercent.abs().clamp(5, 45),
    timeAgo: _timeAgo(t.executedAt),
  );
}

String _directionLabel(String direction) =>
    direction.toLowerCase() == 'long' ? 'Momentum' : 'Hedge';

String _timeAgo(String iso) {
  final dt = DateTime.tryParse(iso);
  if (dt == null) return 'just now';
  final diff = DateTime.now().difference(dt);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  return '${diff.inDays}d ago';
}

const _sliceColors = [
  Color(0xFF10B981),
  Color(0xFF6366F1),
  Color(0xFFF0B90B),
  Color(0xFF64748B),
  Color(0xFFEC4899),
];

List<AllocationSlice> _buildAllocationSlices(List<TradeModel> trades) {
  final counts = <String, int>{};
  for (final t in trades) {
    counts[t.symbol] = (counts[t.symbol] ?? 0) + 1;
  }
  final total = counts.values.fold<int>(0, (a, b) => a + b);
  if (total == 0) return const [];

  final entries = counts.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
  return entries.asMap().entries.map((e) {
    final pct = e.value.value / total;
    return AllocationSlice(
      label: e.value.key,
      percent: pct,
      color: _sliceColors[e.key % _sliceColors.length],
    );
  }).toList();
}
