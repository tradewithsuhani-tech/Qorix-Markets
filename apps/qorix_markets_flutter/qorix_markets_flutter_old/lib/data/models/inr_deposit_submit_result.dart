import 'package:qorix_markets_flutter/core/network/api_json.dart';

class InrDepositSubmitResult {
  const InrDepositSubmitResult({required this.id, required this.status, this.message});

  factory InrDepositSubmitResult.fromJson(Map<String, dynamic> json) => InrDepositSubmitResult(
        id: (json['id'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'pending',
        message: json['message'] as String?,
      );

  final int id;
  final String status;
  final String? message;
}

class InrWithdrawSubmitResult {
  const InrWithdrawSubmitResult({required this.id, required this.status, required this.amount, this.message});

  factory InrWithdrawSubmitResult.fromJson(Map<String, dynamic> json) => InrWithdrawSubmitResult(
        id: (json['id'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'pending',
        amount: ApiJson.asDouble(json['amount']),
        message: json['message'] as String?,
      );

  final int id;
  final String status;
  final double amount;
  final String? message;
}
