import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/application/refresh_gate.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/wallet/data/repositories/wallet_repository_impl.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/inr_payout_method.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/inr_payout_methods_demo.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_inr_options.dart';

final inrPayoutMethodsProvider =
    AsyncNotifierProvider<InrPayoutMethodsNotifier, List<InrPayoutMethodEntity>>(InrPayoutMethodsNotifier.new);

final inrPayoutMethodsByTypeProvider = Provider.family<List<InrPayoutMethodEntity>, InrPayoutMethod>((ref, type) {
  return ref.watch(inrPayoutMethodsProvider).valueOrNull?.where((m) => m.type == type).toList() ?? const [];
});

class InrPayoutMethodsNotifier extends AsyncNotifier<List<InrPayoutMethodEntity>>
    with CachedAsyncMixin<List<InrPayoutMethodEntity>> {
  final _refreshGate = RefreshGate(cooldown: const Duration(milliseconds: 1500));

  @override
  Future<List<InrPayoutMethodEntity>> build() async {
    ref.keepAlive();
    if (UiDemoMode.isActive) {
      final data = InrPayoutMethodsDemo.methods;
      cacheValue(data);
      return data;
    }
    final data = await ref.read(walletRepositoryProvider).getInrPayoutMethods();
    cacheValue(data);
    return data;
  }

  Future<void> refresh() {
    if (UiDemoMode.isActive) {
      final data = InrPayoutMethodsDemo.methods;
      cacheValue(data);
      state = AsyncData(data);
      return Future.value();
    }
    return _refreshGate.run(() => softRefresh(() => ref.read(walletRepositoryProvider).getInrPayoutMethods()));
  }

  Future<void> addMethod(Map<String, dynamic> body) async {
    await ref.read(walletRepositoryProvider).addInrPayoutMethod(body);
    await refresh();
  }

  Future<void> deleteMethod(int id) async {
    await ref.read(walletRepositoryProvider).deleteInrPayoutMethod(id);
    final current = (cachedValue ?? state.valueOrNull ?? const <InrPayoutMethodEntity>[])
        .where((m) => m.id != id)
        .toList();
    cacheValue(current);
    state = AsyncData(current);
  }

  Future<void> setDefaultMethod(int id) async {
    await ref.read(walletRepositoryProvider).setDefaultInrPayoutMethod(id);
    await refresh();
  }
}
