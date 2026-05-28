import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/inr_payout_method.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_inr_options.dart';

class InrPayoutMethodModel {
  const InrPayoutMethodModel({
    required this.id,
    required this.type,
    required this.label,
    required this.accountName,
    required this.accountValue,
    this.bankName,
    this.ifsc,
    this.maskedValue,
    this.isDefault = false,
  });

  factory InrPayoutMethodModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    final rawType = (root['type'] as String? ?? root['payoutMethod'] as String? ?? 'bank').toLowerCase();
    return InrPayoutMethodModel(
      id: _int(root['id']),
      type: _parseType(rawType),
      label: root['label'] as String? ?? root['displayName'] as String? ?? '',
      accountName: root['accountName'] as String? ?? root['accountHolder'] as String? ?? '',
      accountValue: root['accountValue'] as String? ??
          root['accountNumber'] as String? ??
          root['upiId'] as String? ??
          root['qorixUserId'] as String? ??
          root['destination'] as String? ??
          '',
      bankName: root['bankName'] as String?,
      ifsc: root['ifsc'] as String?,
      maskedValue: root['maskedValue'] as String? ?? root['maskedNumber'] as String?,
      isDefault: root['isDefault'] as bool? ?? false,
    );
  }

  final int id;
  final InrPayoutMethod type;
  final String label;
  final String accountName;
  final String accountValue;
  final String? bankName;
  final String? ifsc;
  final String? maskedValue;
  final bool isDefault;

  InrPayoutMethodEntity toEntity() => InrPayoutMethodEntity(
        id: id,
        type: type,
        label: label.isNotEmpty ? label : InrPayoutOption.byId(type).title,
        accountName: accountName,
        accountValue: accountValue,
        bankName: bankName,
        ifsc: ifsc,
        maskedValue: maskedValue,
        isDefault: isDefault,
      );

  static InrPayoutMethod _parseType(String raw) => switch (raw) {
        'upi' => InrPayoutMethod.upi,
        'qorix_user' || 'qorixuser' || 'qorix' => InrPayoutMethod.qorixUser,
        _ => InrPayoutMethod.bank,
      };
}

List<InrPayoutMethodModel> parseInrPayoutMethodsList(dynamic raw) {
  if (raw is List) {
    return raw
        .whereType<Map>()
        .map((e) => InrPayoutMethodModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
  if (raw is Map) {
    final map = Map<String, dynamic>.from(raw);
    final data = map['data'];
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => InrPayoutMethodModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    final root = ApiJson.object(map);
    final list = root['items'] ?? root['methods'] ?? root['payoutMethods'];
    if (list is List) {
      return list
          .whereType<Map>()
          .map((e) => InrPayoutMethodModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
  }
  return const [];
}

int _int(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse('$v') ?? 0;
}
