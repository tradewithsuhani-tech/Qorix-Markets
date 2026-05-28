import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/features/market/application/markets_balance_provider.dart';
import 'package:qorix_markets_flutter/features/market/data/repositories/market_repository_impl.dart';
import 'package:qorix_markets_flutter/features/market/domain/repositories/market_repository.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/markets_demo.dart';

class SpotOrdersState {
  const SpotOrdersState({
    this.openOrders = const [],
    this.orderHistory = const [],
    this.isLoading = true,
    this.errorMessage,
  });

  final List<SpotOrder> openOrders;
  final List<SpotOrder> orderHistory;
  final bool isLoading;
  final String? errorMessage;

  SpotOrdersState copyWith({
    List<SpotOrder>? openOrders,
    List<SpotOrder>? orderHistory,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) =>
      SpotOrdersState(
        openOrders: openOrders ?? this.openOrders,
        orderHistory: orderHistory ?? this.orderHistory,
        isLoading: isLoading ?? this.isLoading,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );
}

final spotOrdersProvider = NotifierProvider<SpotOrdersNotifier, SpotOrdersState>(SpotOrdersNotifier.new);

class SpotOrdersNotifier extends Notifier<SpotOrdersState> {
  @override
  SpotOrdersState build() {
    Future.microtask(refresh);
    return SpotOrdersState(
      openOrders: UiDemoMode.isActive ? MarketsDemo.initialOpenOrders(MarketsDemo.baseInr) : const [],
      orderHistory: UiDemoMode.isActive ? List<SpotOrder>.from(MarketsDemo.orderHistory) : const [],
    );
  }

  MarketRepository get _repo => ref.read(marketRepositoryProvider);

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final results = await Future.wait([
        _repo.getSpotOrders(status: 'open'),
        _repo.getSpotOrders(status: 'history'),
      ]);
      final open = results[0];
      final history = List<SpotOrder>.from(results[1])
        ..sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)));
      state = state.copyWith(openOrders: open, orderHistory: history, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: ErrorMessage.brief(e));
    }
  }

  Future<SpotOrder?> placeOrder({
    required bool isBuy,
    required bool isLimit,
    required double quantity,
    required double price,
  }) async {
    try {
      final order = await _repo.placeSpotOrder(
        isBuy: isBuy,
        isLimit: isLimit,
        quantity: quantity,
        price: price,
      );
      if (isLimit) {
        await refresh();
      } else if (order.status == SpotOrderStatus.open) {
        state = state.copyWith(openOrders: [order, ...state.openOrders], clearError: true);
      } else {
        state = state.copyWith(orderHistory: [order, ...state.orderHistory], clearError: true);
      }
      await ref.read(marketsBalanceProvider.notifier).refresh();
      return order;
    } catch (e) {
      state = state.copyWith(errorMessage: ErrorMessage.brief(e));
      rethrow;
    }
  }

  Future<void> cancelOrder(String id) async {
    try {
      await _repo.cancelSpotOrder(id);
      final idx = state.openOrders.indexWhere((o) => o.id == id);
      if (idx >= 0) {
        final order = state.openOrders[idx];
        final open = [...state.openOrders]..removeAt(idx);
        state = state.copyWith(
          openOrders: open,
          orderHistory: [
            SpotOrder(
              id: order.id,
              isBuy: order.isBuy,
              isLimit: order.isLimit,
              price: order.price,
              amount: order.amount,
              status: SpotOrderStatus.cancelled,
              timeLabel: 'Just now',
            ),
            ...state.orderHistory,
          ],
          clearError: true,
        );
      } else {
        await refresh();
      }
      await ref.read(marketsBalanceProvider.notifier).refresh();
    } catch (e) {
      state = state.copyWith(errorMessage: ErrorMessage.brief(e));
      rethrow;
    }
  }
}
