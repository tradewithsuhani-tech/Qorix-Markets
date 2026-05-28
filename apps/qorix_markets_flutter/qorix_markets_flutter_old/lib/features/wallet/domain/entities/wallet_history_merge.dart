import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_entity.dart';

/// Dedupes paginated wallet history by transaction id — stable sort newest first.
List<TransactionEntity> mergeWalletHistoryPages(
  List<TransactionEntity> existing,
  List<TransactionEntity> incoming,
) {
  if (incoming.isEmpty) return existing;

  final seen = {for (final t in existing) t.id};
  final merged = [...existing];
  for (final tx in incoming) {
    if (tx.id.isEmpty || seen.contains(tx.id)) continue;
    merged.add(tx);
    seen.add(tx.id);
  }
  merged.sort((a, b) => b.createdAt.compareTo(a.createdAt));
  return merged;
}
