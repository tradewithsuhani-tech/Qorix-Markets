import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/p2p_models.dart';

final p2pApiServiceProvider = Provider<P2pApiService>((ref) {
  return P2pApiService(ref.watch(legacyApiClientProvider));
});

class P2pApiService {
  const P2pApiService(this._client);
  final ApiClient _client;

  Future<P2pWalletModel> getWallet() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.p2pWallet);
    return P2pWalletModel.fromJson(res.data ?? {});
  }

  Future<P2pWalletModel> fundWallet(double amount) async {
    final res = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.p2pWalletFund,
      data: {'amount': amount},
    );
    return P2pWalletModel.fromJson(res.data ?? {});
  }

  Future<P2pWalletModel> withdrawWallet(double amount) async {
    final res = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.p2pWalletWithdraw,
      data: {'amount': amount},
    );
    return P2pWalletModel.fromJson(res.data ?? {});
  }

  Future<List<P2pAdModel>> getAds({
    required String type,
    String? paymentMethod,
  }) async {
    final res = await _client.get<dynamic>(
      ApiEndpoints.p2pAds,
      queryParameters: {
        'type': type.toUpperCase(),
        if (paymentMethod != null && paymentMethod.isNotEmpty && paymentMethod.toLowerCase() != 'all')
          'paymentMethod': paymentMethod.toUpperCase(),
      },
    );
    return parseP2pAdsList(res.data);
  }

  Future<P2pAdModel> getAd(int id) async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.p2pAd(id));
    return P2pAdModel.fromJson(res.data ?? {});
  }

  Future<P2pAdModel> createAd(Map<String, dynamic> body) async {
    final res = await _client.post<Map<String, dynamic>>(ApiEndpoints.p2pAds, data: body);
    return parseP2pAdResponse(res.data ?? {});
  }

  Future<P2pAdModel> updateAd(int id, Map<String, dynamic> body) async {
    final res = await _client.patch<Map<String, dynamic>>(ApiEndpoints.p2pAd(id), data: body);
    return parseP2pAdResponse(res.data ?? {});
  }

  Future<void> toggleAd(int id) async {
    await _client.patch(ApiEndpoints.p2pAdToggle(id));
  }

  Future<void> deleteAd(int id) async {
    await _client.delete(ApiEndpoints.p2pAd(id));
  }

  Future<P2pOrderModel> createOrder({
    required int adId,
    required double fiatAmount,
    String? paymentMethod,
  }) async {
    final res = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.p2pOrders,
      data: {
        'adId': adId,
        'fiatAmount': fiatAmount,
        if (paymentMethod != null && paymentMethod.isNotEmpty) 'paymentMethod': paymentMethod,
      },
    );
    return parseP2pOrderResponse(res.data ?? {});
  }

  Future<List<P2pOrderModel>> getMyOrders() async {
    final res = await _client.get<dynamic>(ApiEndpoints.p2pOrdersMy);
    return parseP2pOrdersList(res.data);
  }

  Future<P2pOrderModel> getOrder(int id) async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.p2pOrder(id));
    return P2pOrderModel.fromJson(res.data ?? {});
  }

  Future<P2pOrderModel> markPaid(
    int id, {
    String? paymentRef,
    String? paymentProofUrl,
  }) async {
    final res = await _client.patch<Map<String, dynamic>>(
      ApiEndpoints.p2pOrderPaid(id),
      data: {
        if (paymentRef != null && paymentRef.isNotEmpty) 'paymentRef': paymentRef,
        if (paymentProofUrl != null && paymentProofUrl.isNotEmpty) 'paymentProofUrl': paymentProofUrl,
      },
    );
    return parseP2pOrderResponse(res.data ?? {});
  }

  Future<P2pOrderModel> confirmOrder(int id) async {
    final res = await _client.patch<Map<String, dynamic>>(ApiEndpoints.p2pOrderConfirm(id));
    return parseP2pOrderResponse(res.data ?? {});
  }

  Future<P2pOrderModel> cancelOrder(int id, {String? cancelReason}) async {
    final res = await _client.patch<Map<String, dynamic>>(
      ApiEndpoints.p2pOrderCancel(id),
      data: {if (cancelReason != null && cancelReason.isNotEmpty) 'cancelReason': cancelReason},
    );
    return parseP2pOrderResponse(res.data ?? {});
  }

  Future<P2pOrderModel> disputeOrder(
    int id, {
    required String reason,
    String? description,
    String? evidenceUrl,
  }) async {
    final res = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.p2pOrderDispute(id),
      data: {
        'reason': reason,
        if (description != null) 'description': description,
        if (evidenceUrl != null) 'evidenceUrl': evidenceUrl,
      },
    );
    return parseP2pOrderResponse(res.data ?? {});
  }

  Future<List<P2pPaymentMethodModel>> getPaymentMethods() async {
    final res = await _client.get<dynamic>(ApiEndpoints.p2pPaymentMethods);
    return parseP2pPaymentMethodsList(res.data);
  }

  Future<P2pPaymentMethodModel> addPaymentMethod(Map<String, dynamic> body) async {
    final res = await _client.post<Map<String, dynamic>>(ApiEndpoints.p2pPaymentMethods, data: body);
    final root = res.data ?? {};
    if (root['paymentMethod'] is Map) {
      return P2pPaymentMethodModel.fromJson(Map<String, dynamic>.from(root['paymentMethod'] as Map));
    }
    return P2pPaymentMethodModel.fromJson(root);
  }

  Future<void> deletePaymentMethod(int id) async {
    await _client.delete(ApiEndpoints.p2pPaymentMethod(id));
  }

  Future<P2pUserProfileModel> getUserProfile(int userId) async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.p2pUserProfile(userId));
    return P2pUserProfileModel.fromJson(res.data ?? {});
  }

  Future<List<P2pChatMessageModel>> getMessages(int orderId) async {
    final res = await _client.get<dynamic>(ApiEndpoints.p2pOrderMessages(orderId));
    final data = res.data;
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => P2pChatMessageModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    if (data is Map && data['messages'] is List) {
      return (data['messages'] as List)
          .whereType<Map>()
          .map((e) => P2pChatMessageModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    return const [];
  }

  Future<void> sendMessage(int orderId, {required String message, String? attachmentData, String? attachmentType}) async {
    await _client.post(
      ApiEndpoints.p2pOrderMessages(orderId),
      data: {
        'message': message,
        if (attachmentData != null) 'attachmentData': attachmentData,
        if (attachmentType != null) 'attachmentType': attachmentType,
      },
    );
  }

  Future<P2pStreamTokenModel> getStreamToken(int orderId) async {
    final res = await _client.post<Map<String, dynamic>>(ApiEndpoints.p2pOrderStreamToken(orderId));
    return P2pStreamTokenModel.fromJson(res.data ?? {});
  }

  Future<P2pOrderRatingModel?> getMyRating(int orderId) async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.p2pOrderMyRating(orderId));
    return parseP2pOrderRatingResponse(res.data);
  }

  Future<P2pOrderRatingModel> rateOrder(
    int orderId, {
    required int rating,
    String? comment,
  }) async {
    final res = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.p2pOrderRating(orderId),
      data: {
        'rating': rating,
        if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
      },
    );
    return parseP2pOrderRatingResponse(res.data) ??
        P2pOrderRatingModel.fromJson(res.data ?? {'rating': rating, 'comment': comment});
  }
}
