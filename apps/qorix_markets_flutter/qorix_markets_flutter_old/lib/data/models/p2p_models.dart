import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/p2p_entities.dart';

class P2pWalletModel {
  const P2pWalletModel({
    this.availableBalance = 0,
    this.frozenBalance = 0,
    this.escrowBalance = 0,
  });

  factory P2pWalletModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return P2pWalletModel(
      availableBalance: ApiJson.asDouble(root['availableBalance']),
      frozenBalance: ApiJson.asDouble(root['frozenBalance']),
      escrowBalance: ApiJson.asDouble(root['escrowBalance']),
    );
  }

  final double availableBalance;
  final double frozenBalance;
  final double escrowBalance;
}

class P2pAdModel {
  const P2pAdModel({
    required this.id,
    required this.userId,
    required this.type,
    required this.price,
    required this.remainingQuantity,
    required this.minLimit,
    required this.maxLimit,
    this.paymentMethods = const [],
    this.terms = '',
    this.timeLimit = 15,
    this.advertiserName = '',
    this.tradesCount = 0,
    this.completionRate = 0,
    this.isVerifiedMerchant = false,
    this.avgReleaseSeconds = 0,
    this.avgRating,
    this.ratingCount,
    this.status = 'active',
  });

  factory P2pAdModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    final methods = root['paymentMethods'];
    return P2pAdModel(
      id: _int(root['id']),
      userId: _int(root['userId']),
      type: (root['type'] as String? ?? 'SELL').toUpperCase(),
      price: ApiJson.asDouble(root['price']),
      remainingQuantity: ApiJson.asDouble(root['remainingQuantity'] ?? root['quantity']),
      minLimit: ApiJson.asDouble(root['minLimit']),
      maxLimit: ApiJson.asDouble(root['maxLimit']),
      paymentMethods: methods is List ? methods.map((e) => '$e').toList() : const [],
      terms: root['terms'] as String? ?? '',
      timeLimit: root['timeLimit'] as int? ?? 15,
      advertiserName: root['advertiserName'] as String? ?? '',
      tradesCount: _int(root['tradesCount']),
      completionRate: _int(root['completionRate']),
      isVerifiedMerchant: root['isVerifiedMerchant'] as bool? ?? false,
      avgReleaseSeconds: _int(root['avgReleaseSeconds']),
      avgRating: (root['avgRating'] as num?)?.toDouble(),
      ratingCount: root['ratingCount'] as int?,
      status: root['status'] as String? ?? 'active',
    );
  }

  final int id;
  final int userId;
  final String type;
  final double price;
  final double remainingQuantity;
  final double minLimit;
  final double maxLimit;
  final List<String> paymentMethods;
  final String terms;
  final int timeLimit;
  final String advertiserName;
  final int tradesCount;
  final int completionRate;
  final bool isVerifiedMerchant;
  final int avgReleaseSeconds;
  final double? avgRating;
  final int? ratingCount;
  final String status;

  P2POffer toOffer() {
    final name = advertiserName.trim();
    return P2POffer(
      id: id,
      merchantName: name.isEmpty ? 'Merchant' : name,
      merchantInitial: name.isNotEmpty ? name[0].toUpperCase() : 'M',
      orderCount: tradesCount,
      completionRate: completionRate.toDouble(),
      priceInr: price,
      availableUsdt: remainingQuantity,
      minLimitInr: minLimit,
      maxLimitInr: maxLimit,
      paymentMethods: paymentMethods,
      paymentDetails: const {},
      isVerified: isVerifiedMerchant,
      isOnline: true,
      avgReleaseMins: avgReleaseSeconds > 0 ? (avgReleaseSeconds / 60).ceil() : 15,
      terms: terms,
      timeLimitMins: timeLimit,
      adType: type,
    );
  }
}

class P2pSellerPaymentMethodModel {
  const P2pSellerPaymentMethodModel({
    required this.id,
    required this.type,
    this.displayName,
    this.upiId,
    this.bankName,
    this.accountHolder,
    this.accountNumber,
    this.ifsc,
    this.qrCodeData,
  });

  factory P2pSellerPaymentMethodModel.fromJson(Map<String, dynamic> json) {
    return P2pSellerPaymentMethodModel(
      id: _int(json['id']),
      type: json['type'] as String? ?? 'UPI',
      displayName: json['displayName'] as String?,
      upiId: json['upiId'] as String?,
      bankName: json['bankName'] as String?,
      accountHolder: json['accountHolder'] as String?,
      accountNumber: json['accountNumber'] as String?,
      ifsc: json['ifsc'] as String?,
      qrCodeData: json['qrCodeData'] as String?,
    );
  }

  final int id;
  final String type;
  final String? displayName;
  final String? upiId;
  final String? bankName;
  final String? accountHolder;
  final String? accountNumber;
  final String? ifsc;
  final String? qrCodeData;

  P2PPaymentDetail toDetail() => P2PPaymentDetail(
        method: type,
        accountName: accountHolder ?? displayName ?? type,
        accountValue: upiId ?? accountNumber ?? '',
        bankName: bankName,
        ifsc: ifsc,
        qrNote: qrCodeData,
      );
}

class P2pOrderModel {
  const P2pOrderModel({
    required this.id,
    required this.adId,
    required this.fiatAmount,
    required this.usdtAmount,
    required this.price,
    required this.paymentMethod,
    required this.status,
    this.buyerId,
    this.sellerId,
    this.paymentDeadline,
    this.paidAt,
    this.completedAt,
    this.cancelledAt,
    this.cancelReason,
    this.paymentRef,
    this.paymentProofUrl,
    this.createdAt,
    this.adType,
    this.role,
    this.sellerPaymentMethods = const [],
    this.advertiserName,
  });

  factory P2pOrderModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    final methods = root['sellerPaymentMethods'];
    return P2pOrderModel(
      id: _int(root['id']),
      adId: _int(root['adId']),
      buyerId: _intOrNull(root['buyerId']),
      sellerId: _intOrNull(root['sellerId']),
      fiatAmount: ApiJson.asDouble(root['fiatAmount']),
      usdtAmount: ApiJson.asDouble(root['usdtAmount']),
      price: ApiJson.asDouble(root['price']),
      paymentMethod: root['paymentMethod'] as String? ?? '',
      status: root['status'] as String? ?? 'pending',
      paymentDeadline: root['paymentDeadline'] as String?,
      paidAt: root['paidAt'] as String?,
      completedAt: root['completedAt'] as String?,
      cancelledAt: root['cancelledAt'] as String?,
      cancelReason: root['cancelReason'] as String?,
      paymentRef: root['paymentRef'] as String?,
      paymentProofUrl: root['paymentProofUrl'] as String?,
      createdAt: root['createdAt'] as String?,
      adType: root['adType'] as String?,
      role: root['role'] as String?,
      advertiserName: root['advertiserName'] as String?,
      sellerPaymentMethods: methods is List
          ? methods
              .whereType<Map>()
              .map((e) => P2pSellerPaymentMethodModel.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
    );
  }

  final int id;
  final int adId;
  final int? buyerId;
  final int? sellerId;
  final double fiatAmount;
  final double usdtAmount;
  final double price;
  final String paymentMethod;
  final String status;
  final String? paymentDeadline;
  final String? paidAt;
  final String? completedAt;
  final String? cancelledAt;
  final String? cancelReason;
  final String? paymentRef;
  final String? paymentProofUrl;
  final String? createdAt;
  final String? adType;
  final String? role;
  final String? advertiserName;
  final List<P2pSellerPaymentMethodModel> sellerPaymentMethods;

  P2pOrder toEntity({P2POffer? offer}) {
    final deadline = paymentDeadline != null ? DateTime.tryParse(paymentDeadline!) : null;
    final created = createdAt != null ? DateTime.tryParse(createdAt!) : DateTime.now();
    final paymentDetails = <String, P2PPaymentDetail>{};
    for (final m in sellerPaymentMethods) {
      paymentDetails[m.type] = m.toDetail();
    }
    final selectedDetail = paymentDetails[paymentMethod] ??
        (paymentDetails.isNotEmpty ? paymentDetails.values.first : null);

    final name = advertiserName ?? offer?.merchantName ?? 'Merchant';
    final resolvedOffer = offer ??
        P2POffer(
          id: adId,
          merchantName: name,
          merchantInitial: name.isNotEmpty ? name[0].toUpperCase() : 'M',
          orderCount: 0,
          completionRate: 0,
          priceInr: price,
          availableUsdt: 0,
          minLimitInr: 0,
          maxLimitInr: 0,
          paymentMethods: paymentDetails.keys.toList(),
          paymentDetails: paymentDetails,
          adType: adType ?? 'SELL',
        );

    final isBuyer = role == 'buyer';

    return P2pOrder(
      id: id,
      adId: adId,
      offer: resolvedOffer.copyWith(paymentDetails: paymentDetails.isEmpty ? offer?.paymentDetails ?? {} : paymentDetails),
      isBuy: isBuyer,
      role: role ?? (isBuyer ? 'buyer' : 'seller'),
      amountInr: fiatAmount,
      amountUsdt: usdtAmount,
      paymentMethod: paymentMethod,
      status: parseP2pOrderStatus(status),
      createdAt: created ?? DateTime.now(),
      paymentDeadline: deadline ?? created?.add(const Duration(minutes: 15)) ?? DateTime.now().add(const Duration(minutes: 15)),
      paymentDetail: selectedDetail ??
          P2PPaymentDetail(method: paymentMethod, accountName: name, accountValue: ''),
      paymentRef: paymentRef,
      paymentProofUrl: paymentProofUrl,
    );
  }
}

class P2pPaymentMethodModel {
  const P2pPaymentMethodModel({
    required this.id,
    required this.type,
    this.displayName,
    this.upiId,
    this.accountHolder,
    this.accountNumber,
    this.bankName,
    this.ifsc,
    this.qrCodeData,
  });

  factory P2pPaymentMethodModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return P2pPaymentMethodModel(
      id: _int(root['id']),
      type: root['type'] as String? ?? 'UPI',
      displayName: root['displayName'] as String?,
      upiId: root['upiId'] as String?,
      accountHolder: root['accountHolder'] as String?,
      accountNumber: root['accountNumber'] as String?,
      bankName: root['bankName'] as String?,
      ifsc: root['ifsc'] as String?,
      qrCodeData: root['qrCodeData'] as String?,
    );
  }

  final int id;
  final String type;
  final String? displayName;
  final String? upiId;
  final String? accountHolder;
  final String? accountNumber;
  final String? bankName;
  final String? ifsc;
  final String? qrCodeData;

  P2pUserPaymentMethod toEntity() => P2pUserPaymentMethod(
        id: id,
        method: type,
        label: displayName ?? type,
        accountName: accountHolder ?? '',
        accountValue: upiId ?? accountNumber ?? '',
        bankName: bankName,
        ifsc: ifsc,
      );
}

class P2pUserProfileModel {
  const P2pUserProfileModel({
    this.orderCount = 0,
    this.completionRate = 0,
    this.avgReleaseSeconds = 0,
    this.avgRating,
    this.ratingCount = 0,
    this.isVerifiedMerchant = false,
    this.kycVerified = false,
  });

  factory P2pUserProfileModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return P2pUserProfileModel(
      orderCount: _int(root['orderCount'] ?? root['tradesCount']),
      completionRate: _int(root['completionRate']),
      avgReleaseSeconds: _int(root['avgReleaseSeconds']),
      avgRating: (root['avgRating'] as num?)?.toDouble(),
      ratingCount: _int(root['ratingCount']),
      isVerifiedMerchant: root['isVerifiedMerchant'] as bool? ?? false,
      kycVerified: root['kycVerified'] as bool? ?? false,
    );
  }

  final int orderCount;
  final int completionRate;
  final int avgReleaseSeconds;
  final double? avgRating;
  final int ratingCount;
  final bool isVerifiedMerchant;
  final bool kycVerified;
}

class P2pChatMessageModel {
  const P2pChatMessageModel({
    required this.id,
    required this.message,
    this.senderId,
    this.createdAt,
    this.attachmentType,
    this.attachmentData,
  });

  factory P2pChatMessageModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return P2pChatMessageModel(
      id: _int(root['id']),
      message: root['message'] as String? ?? '',
      senderId: _intOrNull(root['senderId'] ?? root['userId']),
      createdAt: root['createdAt'] as String?,
      attachmentType: root['attachmentType'] as String?,
      attachmentData: root['attachmentData'] as String?,
    );
  }

  final int id;
  final String message;
  final int? senderId;
  final String? createdAt;
  final String? attachmentType;
  final String? attachmentData;

  P2pChatMessage toEntity() => P2pChatMessage(
        id: id,
        message: message,
        senderId: senderId,
        createdAt: createdAt != null ? DateTime.tryParse(createdAt!) : null,
        attachmentType: attachmentType,
        attachmentData: attachmentData,
      );
}

class P2pStreamTokenModel {
  const P2pStreamTokenModel({required this.token, this.expiresIn = 300});

  factory P2pStreamTokenModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return P2pStreamTokenModel(
      token: root['token'] as String? ?? '',
      expiresIn: _int(root['expiresIn'] ?? 300),
    );
  }

  final String token;
  final int expiresIn;
}

class P2pOrderRatingModel {
  const P2pOrderRatingModel({
    required this.rating,
    this.comment,
    this.createdAt,
  });

  factory P2pOrderRatingModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    final ratingRaw = root['rating'] ?? root['score'] ?? root['stars'];
    return P2pOrderRatingModel(
      rating: (ratingRaw as num?)?.toDouble() ?? 0,
      comment: root['comment'] as String? ?? root['review'] as String?,
      createdAt: root['createdAt'] as String?,
    );
  }

  final double rating;
  final String? comment;
  final String? createdAt;

  P2pOrderRating toEntity() => P2pOrderRating(
        rating: rating,
        comment: comment,
        createdAt: createdAt != null ? DateTime.tryParse(createdAt!) : null,
      );
}

P2pOrderRatingModel? parseP2pOrderRatingResponse(dynamic data) {
  if (data == null) return null;
  if (data is Map) {
    final root = ApiJson.object(Map<String, dynamic>.from(data));
    if (root['rating'] is Map) {
      return P2pOrderRatingModel.fromJson(Map<String, dynamic>.from(root['rating'] as Map));
    }
    if (root['rated'] == false) return null;
    if (root['rating'] == null && root['score'] == null) return null;
    return P2pOrderRatingModel.fromJson(root);
  }
  return null;
}

int _int(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse('$v') ?? 0;
}

int? _intOrNull(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse('$v');
}

List<P2pAdModel> parseP2pAdsList(dynamic data) {
  if (data is List) {
    return data.whereType<Map>().map((e) => P2pAdModel.fromJson(Map<String, dynamic>.from(e))).toList();
  }
  final root = ApiJson.object(data is Map ? Map<String, dynamic>.from(data) : {});
  final list = root['ads'] ?? root['items'] ?? root['data'];
  if (list is List) {
    return list.whereType<Map>().map((e) => P2pAdModel.fromJson(Map<String, dynamic>.from(e))).toList();
  }
  return const [];
}

List<P2pOrderModel> parseP2pOrdersList(dynamic data) {
  if (data is List) {
    return data.whereType<Map>().map((e) => P2pOrderModel.fromJson(Map<String, dynamic>.from(e))).toList();
  }
  final root = ApiJson.object(data is Map ? Map<String, dynamic>.from(data) : {});
  final list = root['orders'] ?? root['items'] ?? root['data'];
  if (list is List) {
    return list.whereType<Map>().map((e) => P2pOrderModel.fromJson(Map<String, dynamic>.from(e))).toList();
  }
  return const [];
}

List<P2pPaymentMethodModel> parseP2pPaymentMethodsList(dynamic data) {
  if (data is List) {
    return data
        .whereType<Map>()
        .map((e) => P2pPaymentMethodModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
  final root = ApiJson.object(data is Map ? Map<String, dynamic>.from(data) : {});
  final list = root['paymentMethods'] ?? root['items'] ?? root['data'];
  if (list is List) {
    return list
        .whereType<Map>()
        .map((e) => P2pPaymentMethodModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
  return const [];
}

P2pOrderModel parseP2pOrderResponse(Map<String, dynamic> json) {
  final root = ApiJson.object(json);
  if (root['order'] is Map) {
    return P2pOrderModel.fromJson(Map<String, dynamic>.from(root['order'] as Map));
  }
  return P2pOrderModel.fromJson(root);
}

P2pAdModel parseP2pAdResponse(Map<String, dynamic> json) {
  final root = ApiJson.object(json);
  if (root['ad'] is Map) {
    return P2pAdModel.fromJson(Map<String, dynamic>.from(root['ad'] as Map));
  }
  return P2pAdModel.fromJson(root);
}
