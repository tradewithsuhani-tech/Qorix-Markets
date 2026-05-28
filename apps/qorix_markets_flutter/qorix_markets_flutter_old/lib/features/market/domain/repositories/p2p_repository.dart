import 'package:qorix_markets_flutter/data/models/p2p_models.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/p2p_entities.dart';

abstract interface class P2pRepository {
  Future<double> getAvailableBalance();
  Future<List<P2POffer>> getAds({required bool userWantsToBuy, String? paymentMethod});
  Future<P2pOrder> createOrder({
    required P2POffer offer,
    required double fiatAmount,
    required String paymentMethod,
  });
  Future<List<P2pOrder>> getMyOrders();
  Future<P2pOrder> getOrder(int id, {P2POffer? offerHint});
  Future<P2pOrder> markPaid(int id, {String? paymentRef, String? paymentProofUrl});
  Future<P2pOrder> confirmOrder(int id);
  Future<P2pOrder> cancelOrder(int id, {String? cancelReason});
  Future<P2pOrder> disputeOrder(int id, {required String reason, String? description});
  Future<void> createAd({
    required bool isSell,
    required double price,
    required double quantity,
    required double minLimit,
    required double maxLimit,
    required List<String> paymentMethods,
    String? terms,
    int? timeLimit,
  });
  Future<List<P2pUserPaymentMethod>> getPaymentMethods();
  Future<P2pUserPaymentMethod> addPaymentMethod(Map<String, dynamic> body);
  Future<void> deletePaymentMethod(int id);
  Future<P2pUserProfileModel> getUserProfile(int userId);
  Future<List<P2pChatMessage>> getMessages(int orderId);
  Future<void> sendMessage(
    int orderId, {
    required String message,
    String? attachmentData,
    String? attachmentType,
  });
  Future<P2pOrderRating?> getMyRating(int orderId);
  Future<P2pOrderRating> submitRating(int orderId, {required int rating, String? comment});
}
