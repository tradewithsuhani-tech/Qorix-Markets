import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/application/refresh_gate.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/dashboard/application/dashboard_providers.dart';
import 'package:qorix_markets_flutter/features/invest/domain/entities/investment_state.dart';
import 'package:qorix_markets_flutter/features/invest/infrastructure/investment_repository_impl.dart';
import 'package:qorix_markets_flutter/features/wallet/application/wallet_providers.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';

final investmentProvider =
    AsyncNotifierProvider<InvestmentNotifier, InvestmentState>(InvestmentNotifier.new);

/// Client-side queue — backend navPendingAdd is not returned in API responses.
final investmentPendingTopupProvider = NotifierProvider<InvestmentPendingTopupNotifier, double>(
  InvestmentPendingTopupNotifier.new,
);

class InvestmentPendingTopupNotifier extends Notifier<double> {
  @override
  double build() => 0;

  void add(double amount) => state = state + amount;

  void reconcile({required double previousAmount, required double newAmount}) {
    if (newAmount > previousAmount) {
      state = (state - (newAmount - previousAmount)).clamp(0, double.infinity);
    }
  }

  void reset() => state = 0;
}

/// Scoped drawdown — only protection widgets should watch this.
final investmentDrawdownProvider = Provider<({double used, double limit, bool paused})>((ref) {
  final inv = ref.watch(investmentProvider).valueOrNull;
  if (inv == null) return (used: 0.0, limit: 5.0, paused: false);
  return (used: inv.drawdownUsedPercent, limit: inv.drawdownLimit, paused: inv.isPaused);
});

/// Scoped strategy confidence — AI desk widgets only.
final strategyConfidenceProvider = Provider<double>((ref) {
  return ref.watch(investmentProvider).valueOrNull?.strategyConfidence ?? 0.75;
});

class InvestmentNotifier extends AsyncNotifier<InvestmentState> with CachedAsyncMixin<InvestmentState> {
  final _refreshGate = RefreshGate(cooldown: const Duration(milliseconds: 1500));

  @override
  Future<InvestmentState> build() async {
    ref.keepAlive();
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.investment();
      cacheValue(data);
      return data;
    }
    final data = await ref.read(investmentRepositoryProvider).getInvestment();
    cacheValue(data);
    return data;
  }

  Future<void> refresh() {
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.investment();
      cacheValue(data);
      state = AsyncData(data);
      return Future.value();
    }
    final previousAmount = cachedValue?.amount;
    return _refreshGate.run(() async {
      await softRefresh(() => ref.read(investmentRepositoryProvider).getInvestment());
      final newAmount = cachedValue?.amount;
      if (previousAmount != null && newAmount != null) {
        ref.read(investmentPendingTopupProvider.notifier).reconcile(
              previousAmount: previousAmount,
              newAmount: newAmount,
            );
      }
    });
  }

  /// Optimistic activation — cinematic sheet completes before API resolves.
  Future<void> startInvestment({
    required double amount,
    required String riskLevel,
  }) async {
    final previous = cachedValue;
    final optimistic = (previous ?? const InvestmentState(
          id: 0,
          amount: 0,
          riskLevel: 'MEDIUM',
          isActive: false,
          autoCompound: true,
          totalProfit: 0,
          dailyProfit: 0,
          drawdown: 0,
          drawdownLimit: 5,
          peakBalance: 0,
          drawdownFromPeak: 0,
          recoveryPct: 0,
          isPaused: false,
        ))
        .copyWith(
      isActive: true,
      amount: amount,
      riskLevel: riskLevel,
      startedAt: DateTime.now(),
    );
    cacheValue(optimistic);
    state = AsyncData(optimistic);

    if (UiDemoMode.blocksWriteApi) {
      _reconcileCapital();
      return;
    }

    try {
      final result = await ref.read(investmentRepositoryProvider).startInvestment(
            amount: amount,
            riskLevel: riskLevel,
          );
      cacheValue(result);
      state = AsyncData(result);
      _reconcileCapital();
    } catch (e, st) {
      if (previous != null) {
        cacheValue(previous);
        state = AsyncData(previous);
      } else {
        state = AsyncError(e, st);
      }
      rethrow;
    }
  }

  Future<void> stopInvestment() async {
    final previous = cachedValue;
    if (previous == null) return;

    cacheValue(previous.copyWith(isActive: false));
    state = AsyncData(cachedValue!);

    if (UiDemoMode.blocksWriteApi) {
      _reconcileCapital();
      return;
    }

    try {
      final result = await ref.read(investmentRepositoryProvider).stopInvestment();
      cacheValue(result);
      state = AsyncData(result);
      ref.read(investmentPendingTopupProvider.notifier).reset();
      _reconcileCapital();
    } catch (e) {
      cacheValue(previous);
      state = AsyncData(previous);
      rethrow;
    }
  }

  Future<void> toggleCompounding(bool enabled) async {
    final previous = cachedValue;
    if (previous == null) return;

    cacheValue(previous.copyWith(autoCompound: enabled));
    state = AsyncData(cachedValue!);

    if (UiDemoMode.blocksWriteApi) return;

    try {
      final result =
          await ref.read(investmentRepositoryProvider).updateCompounding(autoCompound: enabled);
      cacheValue(result);
      state = AsyncData(result);
    } catch (e) {
      cacheValue(previous);
      state = AsyncData(previous);
      rethrow;
    }
  }

  Future<void> updateProtection(double drawdownLimit) async {
    final previous = cachedValue;
    if (previous == null) return;

    cacheValue(previous.copyWith(drawdownLimit: drawdownLimit));
    state = AsyncData(cachedValue!);

    if (UiDemoMode.blocksWriteApi) return;

    try {
      final result =
          await ref.read(investmentRepositoryProvider).updateProtection(drawdownLimit: drawdownLimit);
      cacheValue(result);
      state = AsyncData(result);
    } catch (e) {
      cacheValue(previous);
      state = AsyncData(previous);
      rethrow;
    }
  }

  Future<void> topup({required double amount}) async {
    final previous = cachedValue;
    if (previous == null || !previous.isActive) return;

    if (UiDemoMode.blocksWriteApi) {
      ref.read(investmentPendingTopupProvider.notifier).add(amount);
      return;
    }

    try {
      final result = await ref.read(investmentRepositoryProvider).topup(amount: amount);
      cacheValue(result);
      state = AsyncData(result);
      ref.read(investmentPendingTopupProvider.notifier).add(amount);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> queueRiskLevelChange(String riskLevel) async {
    final previous = cachedValue;
    if (previous == null || !previous.isActive) return;

    if (UiDemoMode.blocksWriteApi) {
      cacheValue(
        previous.copyWith(
          pendingRiskLevel: riskLevel.toUpperCase(),
          pendingRiskLevelDate: DateTime.now().add(const Duration(days: 1)).toIso8601String().split('T').first,
        ),
      );
      state = AsyncData(cachedValue!);
      return;
    }

    try {
      final result = await ref.read(investmentRepositoryProvider).queueRiskLevelChange(riskLevel: riskLevel);
      cacheValue(result);
      state = AsyncData(result);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> cancelRiskLevelChange() async {
    final previous = cachedValue;
    if (previous == null) return;

    if (UiDemoMode.blocksWriteApi) {
      cacheValue(previous.copyWith(clearPendingRisk: true));
      state = AsyncData(cachedValue!);
      return;
    }

    try {
      final result = await ref.read(investmentRepositoryProvider).cancelRiskLevelChange();
      cacheValue(result);
      state = AsyncData(result);
    } catch (e) {
      rethrow;
    }
  }

  /// Apply drawdown alert from live stream without full rebuild storm.
  void applyDrawdownAlert({required double drawdownPercent, required bool isPaused}) {
    final current = cachedValue;
    if (current == null) return;
    final updated = current.copyWith(
      drawdownFromPeak: drawdownPercent,
      isPaused: isPaused,
    );
    cacheValue(updated);
    state = AsyncData(updated);
  }

  void _reconcileCapital() {
    ref.invalidate(dashboardProvider);
    ref.invalidate(walletProvider);
  }
}
