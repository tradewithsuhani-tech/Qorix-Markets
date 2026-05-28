enum P2pOrderStatus {
  pending,
  paid,
  completed,
  cancelled,
  disputed,
}

enum P2pSortOption { price, orders, completion }

enum P2pInputMode { byFiat, byCrypto }

P2pOrderStatus parseP2pOrderStatus(String raw) {
  switch (raw.trim().toLowerCase()) {
    case 'pending':
    case 'pendingpayment':
      return P2pOrderStatus.pending;
    case 'paid':
    case 'pendingrelease':
      return P2pOrderStatus.paid;
    case 'completed':
      return P2pOrderStatus.completed;
    case 'cancelled':
    case 'canceled':
      return P2pOrderStatus.cancelled;
    case 'disputed':
      return P2pOrderStatus.disputed;
    default:
      return P2pOrderStatus.pending;
  }
}

extension P2pOrderStatusX on P2pOrderStatus {
  bool get isProcessing =>
      this == P2pOrderStatus.pending || this == P2pOrderStatus.paid || this == P2pOrderStatus.disputed;

  String get label => switch (this) {
        P2pOrderStatus.pending => 'Pending Payment',
        P2pOrderStatus.paid => 'Pending Release',
        P2pOrderStatus.completed => 'Completed',
        P2pOrderStatus.cancelled => 'Cancelled',
        P2pOrderStatus.disputed => 'Disputed',
      };
}

class P2PPaymentDetail {
  const P2PPaymentDetail({
    required this.method,
    required this.accountName,
    required this.accountValue,
    this.bankName,
    this.ifsc,
    this.qrNote,
  });

  final String method;
  final String accountName;
  final String accountValue;
  final String? bankName;
  final String? ifsc;
  final String? qrNote;
}

class P2POffer {
  const P2POffer({
    required this.id,
    required this.merchantName,
    required this.merchantInitial,
    required this.orderCount,
    required this.completionRate,
    required this.priceInr,
    required this.availableUsdt,
    required this.minLimitInr,
    required this.maxLimitInr,
    required this.paymentMethods,
    required this.paymentDetails,
    this.isVerified = false,
    this.isOnline = true,
    this.avgReleaseMins = 15,
    this.terms = '',
    this.timeLimitMins = 15,
    this.adType = 'SELL',
  });

  final int id;
  final String merchantName;
  final String merchantInitial;
  final int orderCount;
  final double completionRate;
  final double priceInr;
  final double availableUsdt;
  final double minLimitInr;
  final double maxLimitInr;
  final List<String> paymentMethods;
  final Map<String, P2PPaymentDetail> paymentDetails;
  final bool isVerified;
  final bool isOnline;
  final int avgReleaseMins;
  final String terms;
  final int timeLimitMins;
  final String adType;

  P2PPaymentDetail? detailFor(String method) => paymentDetails[method];

  P2POffer copyWith({
    Map<String, P2PPaymentDetail>? paymentDetails,
  }) =>
      P2POffer(
        id: id,
        merchantName: merchantName,
        merchantInitial: merchantInitial,
        orderCount: orderCount,
        completionRate: completionRate,
        priceInr: priceInr,
        availableUsdt: availableUsdt,
        minLimitInr: minLimitInr,
        maxLimitInr: maxLimitInr,
        paymentMethods: paymentMethods,
        paymentDetails: paymentDetails ?? this.paymentDetails,
        isVerified: isVerified,
        isOnline: isOnline,
        avgReleaseMins: avgReleaseMins,
        terms: terms,
        timeLimitMins: timeLimitMins,
        adType: adType,
      );
}

class P2pOrder {
  const P2pOrder({
    required this.id,
    required this.adId,
    required this.offer,
    required this.isBuy,
    required this.role,
    required this.amountInr,
    required this.amountUsdt,
    required this.paymentMethod,
    required this.status,
    required this.createdAt,
    required this.paymentDeadline,
    required this.paymentDetail,
    this.paymentRef,
    this.paymentProofUrl,
  });

  final int id;
  final int adId;
  final P2POffer offer;
  final bool isBuy;
  final String role;
  final double amountInr;
  final double amountUsdt;
  final String paymentMethod;
  final P2pOrderStatus status;
  final DateTime createdAt;
  final DateTime paymentDeadline;
  final P2PPaymentDetail paymentDetail;
  final String? paymentRef;
  final String? paymentProofUrl;

  String get idLabel => '$id';

  Duration get remaining => paymentDeadline.difference(DateTime.now());

  P2pOrder copyWith({
    P2pOrderStatus? status,
    P2POffer? offer,
    P2PPaymentDetail? paymentDetail,
    String? paymentRef,
    String? paymentProofUrl,
  }) =>
      P2pOrder(
        id: id,
        adId: adId,
        offer: offer ?? this.offer,
        isBuy: isBuy,
        role: role,
        amountInr: amountInr,
        amountUsdt: amountUsdt,
        paymentMethod: paymentMethod,
        status: status ?? this.status,
        createdAt: createdAt,
        paymentDeadline: paymentDeadline,
        paymentDetail: paymentDetail ?? this.paymentDetail,
        paymentRef: paymentRef ?? this.paymentRef,
        paymentProofUrl: paymentProofUrl ?? this.paymentProofUrl,
      );
}

class P2pUserPaymentMethod {
  const P2pUserPaymentMethod({
    required this.id,
    required this.method,
    required this.label,
    required this.accountValue,
    required this.accountName,
    this.bankName,
    this.ifsc,
    this.isDefault = false,
  });

  final int id;
  final String method;
  final String label;
  final String accountValue;
  final String accountName;
  final String? bankName;
  final String? ifsc;
  final bool isDefault;
}

class P2pChatMessage {
  const P2pChatMessage({
    required this.id,
    required this.message,
    this.senderId,
    this.createdAt,
    this.attachmentType,
    this.attachmentData,
  });

  final int id;
  final String message;
  final int? senderId;
  final DateTime? createdAt;
  final String? attachmentType;
  final String? attachmentData;

  bool get hasImageAttachment =>
      attachmentType == 'image' && attachmentData != null && attachmentData!.isNotEmpty;
}

class P2pOrderRating {
  const P2pOrderRating({
    required this.rating,
    this.comment,
    this.createdAt,
  });

  final double rating;
  final String? comment;
  final DateTime? createdAt;
}
