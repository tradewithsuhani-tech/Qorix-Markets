import 'package:equatable/equatable.dart';

class ProfitEntry extends Equatable {
  const ProfitEntry({
    required this.id,
    required this.label,
    required this.dateLabel,
    required this.amount,
    this.createdAt,
  });

  final String id;
  final String label;
  final String dateLabel;
  final double amount;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [id, label, dateLabel, amount, createdAt];
}

class ProfitHistoryPage extends Equatable {
  const ProfitHistoryPage({
    required this.totalProfit,
    required this.entries,
    required this.page,
    required this.hasMore,
    this.currency = 'USDT',
    this.isLoadingMore = false,
  });

  final double totalProfit;
  final String currency;
  final List<ProfitEntry> entries;
  final int page;
  final bool hasMore;
  final bool isLoadingMore;

  ProfitHistoryPage copyWith({
    double? totalProfit,
    String? currency,
    List<ProfitEntry>? entries,
    int? page,
    bool? hasMore,
    bool? isLoadingMore,
  }) =>
      ProfitHistoryPage(
        totalProfit: totalProfit ?? this.totalProfit,
        currency: currency ?? this.currency,
        entries: entries ?? this.entries,
        page: page ?? this.page,
        hasMore: hasMore ?? this.hasMore,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      );

  @override
  List<Object?> get props => [totalProfit, currency, entries, page, hasMore, isLoadingMore];
}
