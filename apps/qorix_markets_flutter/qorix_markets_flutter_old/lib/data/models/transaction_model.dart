import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_entity.dart';

class TransactionModel {
  const TransactionModel({
    required this.id,
    required this.type,
    required this.amount,
    required this.status,
    required this.createdAt,
    this.description,
  });

  factory TransactionModel.fromJson(Map<String, dynamic> json) {
    return TransactionModel(
      id: json['id']?.toString() ?? '',
      type: json['type'] as String? ?? 'unknown',
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      status: json['status'] as String? ?? 'pending',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      description: json['description'] as String?,
    );
  }

  final String id;
  final String type;
  final double amount;
  final String status;
  final DateTime createdAt;
  final String? description;

  TransactionEntity toEntity() {
    final signed = _signedAmount(type, amount);
    return TransactionEntity(
      id: id,
      type: type,
      amount: signed,
      currency: 'USDT',
      status: status,
      createdAt: createdAt,
      description: description,
    );
  }

  static double _signedAmount(String type, double amount) {
    if (type == 'withdrawal') return -amount.abs();
    if (type == 'deposit') return amount.abs();
    return amount;
  }
}

class TransactionListModel {
  factory TransactionListModel.fromJson(dynamic raw) {
    final items = ApiJson.list(raw)
        .map((e) => TransactionModel.fromJson(e))
        .toList();
    final meta = ApiJson.meta(raw);
    return TransactionListModel(
      items: items,
      page: meta.page,
      limit: meta.limit,
      total: meta.total > 0 ? meta.total : items.length,
      hasMore: meta.hasMore || (meta.total > 0 && meta.page * meta.limit < meta.total),
    );
  }

  const TransactionListModel({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.hasMore,
  });

  final List<TransactionModel> items;
  final int page;
  final int limit;
  final int total;
  final bool hasMore;
}
