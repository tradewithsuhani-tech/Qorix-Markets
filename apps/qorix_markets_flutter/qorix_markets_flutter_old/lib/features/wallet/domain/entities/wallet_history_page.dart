import 'package:equatable/equatable.dart';

import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_entity.dart';

class WalletHistoryPage extends Equatable {
  const WalletHistoryPage({
    required this.items,
    required this.page,
    required this.total,
    required this.hasMore,
    this.isLoadingMore = false,
  });

  final List<TransactionEntity> items;
  final int page;
  final int total;
  final bool hasMore;
  final bool isLoadingMore;

  WalletHistoryPage copyWith({
    List<TransactionEntity>? items,
    int? page,
    int? total,
    bool? hasMore,
    bool? isLoadingMore,
  }) {
    return WalletHistoryPage(
      items: items ?? this.items,
      page: page ?? this.page,
      total: total ?? this.total,
      hasMore: hasMore ?? this.hasMore,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    );
  }

  @override
  List<Object?> get props => [items, page, total, hasMore, isLoadingMore];
}
