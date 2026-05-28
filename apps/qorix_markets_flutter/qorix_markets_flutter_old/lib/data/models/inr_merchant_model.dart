import 'package:qorix_markets_flutter/core/network/api_json.dart';

class InrMerchantModel {
  const InrMerchantModel({required this.id, required this.name, required this.method});

  factory InrMerchantModel.fromJson(Map<String, dynamic> json) => InrMerchantModel(
        id: json['id']?.toString() ?? '',
        name: json['name'] as String? ?? 'Merchant',
        method: json['method'] as String? ?? 'upi',
      );

  final String id;
  final String name;
  final String method;
}
