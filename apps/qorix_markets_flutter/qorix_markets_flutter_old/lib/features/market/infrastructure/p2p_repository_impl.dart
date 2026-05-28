import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/p2p_models.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/p2p_entities.dart';
import 'package:qorix_markets_flutter/features/market/domain/repositories/p2p_repository.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/p2p_demo.dart';
import 'package:qorix_markets_flutter/services/api/p2p_api_service.dart';

final p2pRepositoryProvider = Provider<P2pRepository>((ref) {
  return P2pRepositoryImpl(ref.watch(p2pApiServiceProvider));
});

class P2pRepositoryImpl implements P2pRepository {
  P2pRepositoryImpl(this._api);
  final P2pApiService _api;

  /// User Buy tab → merchants SELL USDT. User Sell tab → merchants BUY USDT.
  static String _adTypeForUserBuyTab(bool userWantsToBuy) => userWantsToBuy ? 'SELL' : 'BUY';

  Future<T> _wrap<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<double> getAvailableBalance() async {
    if (UiDemoMode.isActive) return 1250;
    final wallet = await _wrap(_api.getWallet);
    return wallet.availableBalance;
  }

  @override
  Future<List<P2POffer>> getAds({required bool userWantsToBuy, String? paymentMethod}) async {
    if (UiDemoMode.isActive) {
      final base = userWantsToBuy ? P2pDemo.buyOffers : P2pDemo.sellOffers;
      return base;
    }
    final ads = await _wrap(
      () => _api.getAds(type: _adTypeForUserBuyTab(userWantsToBuy), paymentMethod: paymentMethod),
    );
    return ads.map((a) => a.toOffer()).toList();
  }

  @override
  Future<P2pOrder> createOrder({
    required P2POffer offer,
    required double fiatAmount,
    required String paymentMethod,
  }) async {
    if (UiDemoMode.blocksWriteApi) {
      return P2pOrder(
        id: DateTime.now().millisecondsSinceEpoch,
        adId: offer.id,
        offer: offer,
        isBuy: true,
        role: 'buyer',
        amountInr: fiatAmount,
        amountUsdt: fiatAmount / offer.priceInr,
        paymentMethod: paymentMethod,
        status: P2pOrderStatus.pending,
        createdAt: DateTime.now(),
        paymentDeadline: DateTime.now().add(Duration(minutes: offer.timeLimitMins)),
        paymentDetail: offer.detailFor(paymentMethod) ??
            P2PPaymentDetail(method: paymentMethod, accountName: offer.merchantName, accountValue: ''),
      );
    }
    final model = await _wrap(
      () => _api.createOrder(adId: offer.id, fiatAmount: fiatAmount, paymentMethod: paymentMethod),
    );
    final detail = await getOrder(model.id, offerHint: offer);
    return detail;
  }

  @override
  Future<List<P2pOrder>> getMyOrders() async {
    if (UiDemoMode.isActive) return P2pDemo.sampleOrders();
    final models = await _wrap(_api.getMyOrders);
    return models.map((m) => m.toEntity()).toList();
  }

  @override
  Future<P2pOrder> getOrder(int id, {P2POffer? offerHint}) async {
    if (UiDemoMode.isActive) {
      return P2pDemo.sampleOrders().firstWhere((o) => o.id == id, orElse: () => P2pDemo.sampleOrders().first);
    }
    final model = await _wrap(() => _api.getOrder(id));
    P2POffer? hint = offerHint;
    if (hint == null) {
      try {
        hint = (await _wrap(() => _api.getAd(model.adId))).toOffer();
      } catch (_) {}
    }
    return model.toEntity(offer: hint);
  }

  @override
  Future<P2pOrder> markPaid(int id, {String? paymentRef, String? paymentProofUrl}) async {
    if (UiDemoMode.blocksWriteApi) {
      final orders = await getMyOrders();
      final order = orders.firstWhere((o) => o.id == id);
      return order.copyWith(status: P2pOrderStatus.paid);
    }
    final model = await _wrap(
      () => _api.markPaid(id, paymentRef: paymentRef, paymentProofUrl: paymentProofUrl),
    );
    return getOrder(model.id);
  }

  @override
  Future<P2pOrder> confirmOrder(int id) async {
    if (UiDemoMode.blocksWriteApi) {
      final orders = await getMyOrders();
      final order = orders.firstWhere((o) => o.id == id);
      return order.copyWith(status: P2pOrderStatus.completed);
    }
    final model = await _wrap(() => _api.confirmOrder(id));
    return getOrder(model.id);
  }

  @override
  Future<P2pOrder> cancelOrder(int id, {String? cancelReason}) async {
    if (UiDemoMode.blocksWriteApi) {
      final orders = await getMyOrders();
      final order = orders.firstWhere((o) => o.id == id);
      return order.copyWith(status: P2pOrderStatus.cancelled);
    }
    final model = await _wrap(() => _api.cancelOrder(id, cancelReason: cancelReason));
    return getOrder(model.id);
  }

  @override
  Future<P2pOrder> disputeOrder(int id, {required String reason, String? description}) async {
    if (UiDemoMode.blocksWriteApi) {
      final orders = await getMyOrders();
      final order = orders.firstWhere((o) => o.id == id);
      return order.copyWith(status: P2pOrderStatus.disputed);
    }
    final model = await _wrap(
      () => _api.disputeOrder(id, reason: reason, description: description),
    );
    return getOrder(model.id);
  }

  @override
  Future<void> createAd({
    required bool isSell,
    required double price,
    required double quantity,
    required double minLimit,
    required double maxLimit,
    required List<String> paymentMethods,
    String? terms,
    int? timeLimit,
  }) async {
    if (UiDemoMode.blocksWriteApi) return;
    await _wrap(
      () => _api.createAd({
        'type': isSell ? 'SELL' : 'BUY',
        'price': price,
        'quantity': quantity,
        'minLimit': minLimit,
        'maxLimit': maxLimit,
        'paymentMethods': paymentMethods,
        if (terms != null && terms.isNotEmpty) 'terms': terms,
        if (timeLimit != null) 'timeLimit': timeLimit,
      }),
    );
  }

  @override
  Future<List<P2pUserPaymentMethod>> getPaymentMethods() async {
    if (UiDemoMode.isActive) return P2pDemo.userPaymentMethods;
    final models = await _wrap(_api.getPaymentMethods);
    return models.map((m) => m.toEntity()).toList();
  }

  @override
  Future<P2pUserPaymentMethod> addPaymentMethod(Map<String, dynamic> body) async {
    if (UiDemoMode.blocksWriteApi) {
      return const P2pUserPaymentMethod(
        id: 0,
        method: 'UPI',
        label: 'Demo',
        accountName: 'Demo',
        accountValue: 'demo@ybl',
      );
    }
    final model = await _wrap(() => _api.addPaymentMethod(body));
    return model.toEntity();
  }

  @override
  Future<void> deletePaymentMethod(int id) async {
    if (UiDemoMode.blocksWriteApi) return;
    await _wrap(() => _api.deletePaymentMethod(id));
  }

  @override
  Future<P2pUserProfileModel> getUserProfile(int userId) async {
    if (UiDemoMode.isActive) {
      return const P2pUserProfileModel(orderCount: 24, completionRate: 100, avgReleaseSeconds: 240);
    }
    return _wrap(() => _api.getUserProfile(userId));
  }

  @override
  Future<List<P2pChatMessage>> getMessages(int orderId) async {
    if (UiDemoMode.isActive) return P2pDemo.sampleChatMessages(orderId);
    final models = await _wrap(() => _api.getMessages(orderId));
    return models.map((m) => m.toEntity()).toList();
  }

  @override
  Future<void> sendMessage(
    int orderId, {
    required String message,
    String? attachmentData,
    String? attachmentType,
  }) async {
    if (UiDemoMode.blocksWriteApi) return;
    await _wrap(
      () => _api.sendMessage(
        orderId,
        message: message,
        attachmentData: attachmentData,
        attachmentType: attachmentType,
      ),
    );
  }

  @override
  Future<P2pOrderRating?> getMyRating(int orderId) async {
    if (UiDemoMode.isActive) return null;
    try {
      final model = await _api.getMyRating(orderId);
      if (model == null || model.rating <= 0) return null;
      return model.toEntity();
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<P2pOrderRating> submitRating(int orderId, {required int rating, String? comment}) async {
    if (UiDemoMode.blocksWriteApi) {
      return P2pOrderRating(rating: rating.toDouble(), comment: comment, createdAt: DateTime.now());
    }
    final model = await _wrap(() => _api.rateOrder(orderId, rating: rating, comment: comment));
    return model.toEntity();
  }
}
