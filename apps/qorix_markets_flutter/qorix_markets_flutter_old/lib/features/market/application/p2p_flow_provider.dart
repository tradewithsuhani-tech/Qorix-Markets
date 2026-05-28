import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/data/models/p2p_models.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/p2p_entities.dart';
import 'package:qorix_markets_flutter/features/market/domain/repositories/p2p_repository.dart';
import 'package:qorix_markets_flutter/features/market/infrastructure/p2p_repository_impl.dart';

class P2pMarketFilter {
  const P2pMarketFilter({
    this.payment = 'All',
    this.amountInr,
    this.sort = P2pSortOption.price,
    this.isBuy = true,
  });

  final String payment;
  final double? amountInr;
  final P2pSortOption sort;
  final bool isBuy;

  P2pMarketFilter copyWith({
    String? payment,
    double? amountInr,
    bool clearAmount = false,
    P2pSortOption? sort,
    bool? isBuy,
  }) =>
      P2pMarketFilter(
        payment: payment ?? this.payment,
        amountInr: clearAmount ? null : (amountInr ?? this.amountInr),
        sort: sort ?? this.sort,
        isBuy: isBuy ?? this.isBuy,
      );
}

class P2pFlowState {
  const P2pFlowState({
    this.filter = const P2pMarketFilter(),
    this.offers = const [],
    this.orders = const [],
    this.walletBalance = 0,
    this.isLoading = true,
    this.errorMessage,
  });

  final P2pMarketFilter filter;
  final List<P2POffer> offers;
  final List<P2pOrder> orders;
  final double walletBalance;
  final bool isLoading;
  final String? errorMessage;

  P2pFlowState copyWith({
    P2pMarketFilter? filter,
    List<P2POffer>? offers,
    List<P2pOrder>? orders,
    double? walletBalance,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) =>
      P2pFlowState(
        filter: filter ?? this.filter,
        offers: offers ?? this.offers,
        orders: orders ?? this.orders,
        walletBalance: walletBalance ?? this.walletBalance,
        isLoading: isLoading ?? this.isLoading,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );

  List<P2POffer> get filteredOffers {
    var list = offers.where((o) {
      if (filter.payment == 'All') return true;
      final key = filter.payment.toLowerCase();
      return o.paymentMethods.any((m) => m.toLowerCase().contains(key));
    }).toList();

    if (filter.amountInr != null) {
      final amt = filter.amountInr!;
      list = list.where((o) => amt >= o.minLimitInr && amt <= o.maxLimitInr).toList();
    }

    list = List<P2POffer>.from(list);
    switch (filter.sort) {
      case P2pSortOption.price:
        list.sort((a, b) => filter.isBuy ? a.priceInr.compareTo(b.priceInr) : b.priceInr.compareTo(a.priceInr));
      case P2pSortOption.orders:
        list.sort((a, b) => b.orderCount.compareTo(a.orderCount));
      case P2pSortOption.completion:
        list.sort((a, b) => b.completionRate.compareTo(a.completionRate));
    }
    return list;
  }

  P2pOrder? orderById(String id) {
    final parsed = int.tryParse(id);
    if (parsed == null) return null;
    for (final o in orders) {
      if (o.id == parsed) return o;
    }
    return null;
  }

  int get processingCount => orders.where((o) => o.status.isProcessing).length;
}

final p2pFlowProvider = NotifierProvider<P2pFlowNotifier, P2pFlowState>(P2pFlowNotifier.new);

class P2pFlowNotifier extends Notifier<P2pFlowState> {
  @override
  P2pFlowState build() {
    Future.microtask(refreshAll);
    return const P2pFlowState();
  }

  P2pRepository get _repo => ref.read(p2pRepositoryProvider);

  Future<void> refreshAll() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final results = await Future.wait([
        _repo.getAvailableBalance(),
        _repo.getMyOrders(),
        _repo.getAds(userWantsToBuy: state.filter.isBuy, paymentMethod: state.filter.payment),
      ]);
      state = state.copyWith(
        walletBalance: results[0] as double,
        orders: results[1] as List<P2pOrder>,
        offers: results[2] as List<P2POffer>,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: ErrorMessage.brief(e));
    }
  }

  Future<void> _reloadOffers() async {
    try {
      final offers = await _repo.getAds(
        userWantsToBuy: state.filter.isBuy,
        paymentMethod: state.filter.payment,
      );
      state = state.copyWith(offers: offers, clearError: true);
    } catch (e) {
      state = state.copyWith(errorMessage: ErrorMessage.brief(e));
    }
  }

  void setBuySide(bool isBuy) {
    state = state.copyWith(
      filter: state.filter.copyWith(isBuy: isBuy, payment: 'All', clearAmount: true),
    );
    _reloadOffers();
  }

  void setPaymentFilter(String payment) {
    state = state.copyWith(filter: state.filter.copyWith(payment: payment));
    _reloadOffers();
  }

  void setSort(P2pSortOption sort) => state = state.copyWith(filter: state.filter.copyWith(sort: sort));

  void setAmountFilter(double? amountInr) =>
      state = state.copyWith(filter: state.filter.copyWith(amountInr: amountInr, clearAmount: amountInr == null));

  Future<P2pOrder> placeOrder({
    required P2POffer offer,
    required bool isBuy,
    required double amountInr,
    required double amountUsdt,
    required String paymentMethod,
  }) async {
    final order = await _repo.createOrder(
      offer: offer,
      fiatAmount: amountInr,
      paymentMethod: paymentMethod,
    );
    state = state.copyWith(orders: [order, ...state.orders]);
    await _reloadOffers();
    return order;
  }

  Future<P2pOrder> refreshOrder(int id) async {
    final order = await _repo.getOrder(id);
    await _syncOrder(order);
    return order;
  }

  Future<P2pOrder> markPaid(int id, {String? paymentRef}) async {
    final order = await _repo.markPaid(id, paymentRef: paymentRef);
    await _syncOrder(order);
    return order;
  }

  Future<P2pOrder> confirmOrder(int id) async {
    final order = await _repo.confirmOrder(id);
    await _syncOrder(order);
    return order;
  }

  Future<P2pOrder> cancelOrder(int id) async {
    final order = await _repo.cancelOrder(id);
    await _syncOrder(order);
    await _reloadOffers();
    return order;
  }

  Future<P2pOrder> disputeOrder(int id, {required String reason}) async {
    final order = await _repo.disputeOrder(id, reason: reason);
    await _syncOrder(order);
    return order;
  }

  Future<void> _syncOrder(P2pOrder order) async {
    state = state.copyWith(
      orders: state.orders.any((o) => o.id == order.id)
          ? state.orders.map((o) => o.id == order.id ? order : o).toList()
          : [order, ...state.orders],
    );
  }
}

final p2pPaymentMethodsProvider = FutureProvider.autoDispose<List<P2pUserPaymentMethod>>((ref) async {
  return ref.watch(p2pRepositoryProvider).getPaymentMethods();
});

final p2pUserProfileProvider = FutureProvider.autoDispose.family<P2pUserProfileModel, int>((ref, userId) async {
  return ref.watch(p2pRepositoryProvider).getUserProfile(userId);
});
