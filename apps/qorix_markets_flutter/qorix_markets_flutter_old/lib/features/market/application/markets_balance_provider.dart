import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/data/models/markets_balance_model.dart';
import 'package:qorix_markets_flutter/features/market/data/repositories/market_repository_impl.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_mock_data.dart';

final marketsBalanceProvider =
    AsyncNotifierProvider<MarketsBalanceNotifier, MarketsBalanceModel>(MarketsBalanceNotifier.new);

class MarketsBalanceNotifier extends AsyncNotifier<MarketsBalanceModel> {
  @override
  Future<MarketsBalanceModel> build() async {
    if (UiDemoMode.isActive) {
      return const MarketsBalanceModel(inrBalance: 50000, usdtBalance: 1250);
    }
    return ref.read(marketRepositoryProvider).getMarketsBalance();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(marketRepositoryProvider).getMarketsBalance());
  }
}

/// Fallback when balance API is loading or failed.
MarketsBalanceModel marketsBalanceFallback(double livePrice) => MarketsBalanceModel(
      inrBalance: UiMockData.capitalFlowMain * livePrice,
      usdtBalance: UiMockData.capitalFlowMain,
    );
