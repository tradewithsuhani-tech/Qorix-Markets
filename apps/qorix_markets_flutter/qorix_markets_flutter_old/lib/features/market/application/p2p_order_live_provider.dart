import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/features/market/application/p2p_flow_provider.dart';
import 'package:qorix_markets_flutter/features/market/application/p2p_order_chat_provider.dart';
import 'package:qorix_markets_flutter/services/p2p/p2p_order_sse_service.dart';

/// Keeps an SSE connection open for a P2P order and fans out events.
final p2pOrderLiveProvider =
    NotifierProvider.autoDispose.family<P2pOrderLiveNotifier, P2pOrderLiveState, int>(P2pOrderLiveNotifier.new);

class P2pOrderLiveState {
  const P2pOrderLiveState({this.connected = false, this.lastEvent});

  final bool connected;
  final P2pOrderSseEvent? lastEvent;

  P2pOrderLiveState copyWith({bool? connected, P2pOrderSseEvent? lastEvent}) =>
      P2pOrderLiveState(connected: connected ?? this.connected, lastEvent: lastEvent ?? this.lastEvent);
}

class P2pOrderLiveNotifier extends AutoDisposeFamilyNotifier<P2pOrderLiveState, int> {
  StreamSubscription<P2pOrderSseEvent>? _sub;

  @override
  P2pOrderLiveState build(int orderId) {
    ref.onDispose(() {
      _sub?.cancel();
      ref.read(p2pOrderSseServiceProvider).disconnect(orderId);
    });
    Future.microtask(() => _connect(orderId));
    return const P2pOrderLiveState();
  }

  Future<void> _connect(int orderId) async {
    _sub?.cancel();
    final stream = ref.read(p2pOrderSseServiceProvider).connect(orderId);
    _sub = stream.listen((event) {
      state = state.copyWith(connected: true, lastEvent: event);
      if (event.isOrderUpdate) {
        unawaited(ref.read(p2pFlowProvider.notifier).refreshOrder(orderId));
      } else if (event.isChatMessage) {
        ref.read(p2pOrderChatProvider(orderId).notifier).ingestSsePayload(event.data);
      }
    });
  }
}
