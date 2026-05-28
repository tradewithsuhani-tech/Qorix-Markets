import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/wallet/data/repositories/wallet_repository_impl.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/deposit_entity.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';

final depositAddressDetailProvider =
    AsyncNotifierProvider<DepositAddressDetailNotifier, DepositAddressEntity>(
  DepositAddressDetailNotifier.new,
);

class DepositAddressDetailNotifier extends AsyncNotifier<DepositAddressEntity>
    with CachedAsyncMixin<DepositAddressEntity> {
  @override
  Future<DepositAddressEntity> build() async {
    if (UiDemoMode.isActive) {
      final demo = UiDemoFixtures.depositAddress();
      cacheValue(demo);
      return demo;
    }
    final addr = await ref.read(walletRepositoryProvider).getDepositAddress();
    cacheValue(addr);
    return addr;
  }

  Future<void> refresh() => softRefresh(() async {
        final addr = await ref.read(walletRepositoryProvider).getDepositAddress();
        cacheValue(addr);
        return addr;
      });
}
