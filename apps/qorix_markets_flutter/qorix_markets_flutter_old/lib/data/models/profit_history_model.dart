import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/portfolio/domain/entities/profit_entry.dart';
import 'package:qorix_markets_flutter/features/portfolio/domain/profit_history_mapper.dart';

class ProfitHistoryItemModel {
  const ProfitHistoryItemModel({
    required this.id,
    required this.type,
    required this.label,
    required this.amount,
    required this.currency,
    required this.status,
    required this.createdAt,
  });

  factory ProfitHistoryItemModel.fromJson(Map<String, dynamic> json) {
    return ProfitHistoryItemModel(
      id: json['id']?.toString() ?? '',
      type: json['type'] as String? ?? 'profit',
      label: json['label'] as String? ?? '',
      amount: ApiJson.asDouble(json['amount']),
      currency: json['currency'] as String? ?? 'USDT',
      status: json['status'] as String? ?? 'completed',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }

  final String id;
  final String type;
  final String label;
  final double amount;
  final String currency;
  final String status;
  final DateTime createdAt;

  ProfitEntry toEntity() => ProfitEntry(
        id: id,
        label: label.isNotEmpty ? label : ProfitHistoryMapper.defaultLabel(type),
        dateLabel: ProfitHistoryMapper.formatDateLabel(createdAt),
        amount: amount,
        createdAt: createdAt,
      );
}

class ProfitHistoryListModel {
  factory ProfitHistoryListModel.fromJson(dynamic raw) {
    final data = ApiJson.object(raw);
    final itemsRaw = data['items'];
    final items = itemsRaw is List
        ? itemsRaw
            .whereType<Map>()
            .map((e) => ProfitHistoryItemModel.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <ProfitHistoryItemModel>[];
    final meta = ApiJson.meta(raw);
    final totalPages = _totalPages(raw, meta);
    final hasMore = meta.page < totalPages;
    return ProfitHistoryListModel(
      totalProfit: ApiJson.asDouble(data['totalProfit']),
      currency: data['currency'] as String? ?? 'USDT',
      items: items,
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      hasMore: hasMore,
    );
  }

  const ProfitHistoryListModel({
    required this.totalProfit,
    required this.currency,
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.hasMore,
  });

  final double totalProfit;
  final String currency;
  final List<ProfitHistoryItemModel> items;
  final int page;
  final int limit;
  final int total;
  final bool hasMore;

  ProfitHistoryPage toEntity() => ProfitHistoryPage(
        totalProfit: totalProfit,
        currency: currency,
        entries: items.map((m) => m.toEntity()).toList(),
        page: page,
        hasMore: hasMore,
      );

  static int _totalPages(dynamic raw, ApiPageMeta meta) {
    if (raw is Map) {
      final pagination = raw['pagination'];
      if (pagination is Map) {
        final tp = pagination['totalPages'];
        if (tp is num) return tp.toInt();
      }
    }
    if (meta.total <= 0 || meta.limit <= 0) return meta.page;
    return (meta.total / meta.limit).ceil();
  }
}
