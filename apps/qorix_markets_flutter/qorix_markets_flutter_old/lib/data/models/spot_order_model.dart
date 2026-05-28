import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/markets_demo.dart';

class SpotOrderModel {
  const SpotOrderModel({
    required this.id,
    required this.symbol,
    required this.side,
    required this.type,
    required this.quantity,
    required this.price,
    required this.status,
    this.executedPrice,
    this.inrDebited,
    this.createdAt,
  });

  factory SpotOrderModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    final limitPrice = ApiJson.asDouble(root['limitPrice'], fallback: 0);
    final executed = ApiJson.asDouble(root['executedPrice'], fallback: 0);
    final rawPrice = ApiJson.asDouble(root['price'], fallback: 0);
    return SpotOrderModel(
      id: root['id']?.toString() ?? root['orderId']?.toString() ?? '',
      symbol: root['symbol'] as String? ?? root['pair'] as String? ?? 'USDT/INR',
      side: (root['side'] as String? ?? 'BUY').toUpperCase(),
      type: (root['type'] as String? ?? root['orderType'] as String? ?? 'LIMIT').toUpperCase(),
      quantity: ApiJson.asDouble(root['quantity'] ?? root['amount']),
      price: limitPrice > 0 ? limitPrice : (executed > 0 ? executed : rawPrice),
      status: (root['status'] as String? ?? 'pending').toLowerCase(),
      executedPrice: executed > 0 ? executed : null,
      inrDebited: ApiJson.asDouble(root['inrDebited'], fallback: 0) > 0
          ? ApiJson.asDouble(root['inrDebited'])
          : null,
      createdAt: root['createdAt'] as String?,
    );
  }

  final String id;
  final String symbol;
  final String side;
  final String type;
  final double quantity;
  final double price;
  final String status;
  final double? executedPrice;
  final double? inrDebited;
  final String? createdAt;

  SpotOrder toEntity() {
    final created = createdAt != null ? DateTime.tryParse(createdAt!) : null;
    final statusEnum = switch (status) {
      'completed' || 'filled' || 'complete' => SpotOrderStatus.filled,
      'cancelled' || 'canceled' => SpotOrderStatus.cancelled,
      'partial' || 'partially_filled' => SpotOrderStatus.partial,
      _ => SpotOrderStatus.open,
    };

    String? timeLabel;
    if (created != null) {
      final now = DateTime.now();
      if (now.difference(created).inDays == 0) {
        timeLabel = 'Today ${DateFormat('HH:mm').format(created)}';
      } else if (now.difference(created).inDays == 1) {
        timeLabel = 'Yesterday ${DateFormat('HH:mm').format(created)}';
      } else {
        timeLabel = DateFormat('d MMM HH:mm').format(created);
      }
    }

    return SpotOrder(
      id: id.isEmpty ? MarketsDemo.nextOrderId('OX') : id,
      isBuy: side == 'BUY',
      isLimit: type == 'LIMIT',
      price: price,
      amount: quantity,
      status: statusEnum,
      createdAt: created,
      filledPrice: executedPrice,
      timeLabel: timeLabel,
    );
  }
}

List<SpotOrderModel> parseSpotOrdersList(dynamic raw) {
  if (raw is List) {
    return raw.whereType<Map>().map((e) => SpotOrderModel.fromJson(Map<String, dynamic>.from(e))).toList();
  }
  if (raw is Map) {
    final map = Map<String, dynamic>.from(raw);
    final data = map['data'];
    if (data is List) {
      return data.whereType<Map>().map((e) => SpotOrderModel.fromJson(Map<String, dynamic>.from(e))).toList();
    }
    final root = ApiJson.object(map);
    final list = root['orders'] ?? root['items'];
    if (list is List) {
      return list.whereType<Map>().map((e) => SpotOrderModel.fromJson(Map<String, dynamic>.from(e))).toList();
    }
  }
  return const [];
}

SpotOrderModel parseSpotOrderResponse(Map<String, dynamic> json) {
  final root = ApiJson.object(json);
  if (root['order'] is Map) {
    return SpotOrderModel.fromJson(Map<String, dynamic>.from(root['order'] as Map));
  }
  return SpotOrderModel.fromJson(root);
}
