import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/data/models/broker_models.dart';
import 'package:qorix_markets_flutter/features/broker/data/broker_repository_impl.dart';
import 'package:qorix_markets_flutter/features/broker/domain/repositories/broker_repository.dart';

final brokerRepositoryProvider = Provider<BrokerRepository>((ref) {
  return BrokerRepositoryImpl(ref);
});

final brokerStatusProvider = AsyncNotifierProvider<BrokerStatusNotifier, BrokerStatusModel>(
  BrokerStatusNotifier.new,
);

final brokerTerminalProvider =
    AsyncNotifierProvider<BrokerTerminalNotifier, BrokerTerminalSnapshot>(
  BrokerTerminalNotifier.new,
);

class BrokerStatusNotifier extends AsyncNotifier<BrokerStatusModel> {
  @override
  Future<BrokerStatusModel> build() => ref.read(brokerRepositoryProvider).getStatus();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(brokerRepositoryProvider).getStatus());
  }

  Future<void> setMode(BrokerTradingMode mode) async {
    state = await AsyncValue.guard(() => ref.read(brokerRepositoryProvider).setMode(mode));
    ref.invalidate(brokerTerminalProvider);
  }

  Future<void> connectZerodha(String requestToken) async {
    state = await AsyncValue.guard(
      () => ref.read(brokerRepositoryProvider).connectZerodha(requestToken: requestToken),
    );
    ref.invalidate(brokerTerminalProvider);
  }

  Future<void> disconnectZerodha() async {
    state = await AsyncValue.guard(() => ref.read(brokerRepositoryProvider).disconnectZerodha());
    ref.invalidate(brokerTerminalProvider);
  }
}

class BrokerTerminalNotifier extends AsyncNotifier<BrokerTerminalSnapshot> {
  @override
  Future<BrokerTerminalSnapshot> build() => ref.read(brokerRepositoryProvider).loadTerminal();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(brokerRepositoryProvider).loadTerminal());
  }

  Future<void> placeDemoOrder({
    required String symbol,
    required String side,
    required int quantity,
  }) async {
    await ref.read(brokerRepositoryProvider).placeDemoOrder(
          symbol: symbol,
          side: side,
          quantity: quantity,
        );
    await refresh();
    ref.invalidate(brokerStatusProvider);
  }

  Future<void> resetDemo() async {
    await ref.read(brokerRepositoryProvider).resetDemoPortfolio();
    await refresh();
  }
}
