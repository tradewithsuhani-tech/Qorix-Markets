import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/application/refresh_gate.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/dashboard/domain/entities/dashboard_snapshot.dart';
import 'package:qorix_markets_flutter/features/dashboard/infrastructure/dashboard_repository_impl.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';

final dashboardProvider =
    AsyncNotifierProvider<DashboardNotifier, DashboardSnapshot>(DashboardNotifier.new);

class DashboardNotifier extends AsyncNotifier<DashboardSnapshot> with CachedAsyncMixin<DashboardSnapshot> {
  final _refreshGate = RefreshGate(cooldown: const Duration(milliseconds: 1500));

  @override
  Future<DashboardSnapshot> build() async {
    ref.keepAlive();
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.dashboardSnapshot();
      cacheValue(data);
      return data;
    }
    final data = await ref.read(dashboardRepositoryProvider).getSnapshot();
    cacheValue(data);
    return data;
  }

  Future<void> refresh() {
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.dashboardSnapshot();
      cacheValue(data);
      state = AsyncData(data);
      return Future.value();
    }
    return _refreshGate.run(
      () => softRefresh(() => ref.read(dashboardRepositoryProvider).getSnapshot()),
    );
  }
}

/// Wallet hero PnL — sourced from dashboard in live mode.
final walletDailyPnlProvider = Provider<({double pnl, double percent})>((ref) {
  if (UiDemoMode.isActive) {
    final snap = UiDemoFixtures.dashboardSnapshot();
    return (pnl: snap.dailyPnl, percent: snap.dailyPnlPercent);
  }
  final dash = ref.watch(dashboardProvider).valueOrNull;
  return (pnl: dash?.dailyPnl ?? 0, percent: dash?.dailyPnlPercent ?? 0);
});

/// Unread count derived from notifications — avoids extra rebuilds on dashboard.
final dashboardVipLabelProvider = Provider<String?>((ref) {
  return ref.watch(dashboardProvider).valueOrNull?.vip.label;
});
