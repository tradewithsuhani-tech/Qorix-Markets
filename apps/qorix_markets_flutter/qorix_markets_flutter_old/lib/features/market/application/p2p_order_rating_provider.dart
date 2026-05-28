import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/p2p_entities.dart';
import 'package:qorix_markets_flutter/features/market/infrastructure/p2p_repository_impl.dart';

final p2pOrderRatingProvider =
    AsyncNotifierProvider.autoDispose.family<P2pOrderRatingNotifier, P2pOrderRating?, int>(P2pOrderRatingNotifier.new);

class P2pOrderRatingNotifier extends AutoDisposeFamilyAsyncNotifier<P2pOrderRating?, int> {
  @override
  Future<P2pOrderRating?> build(int orderId) async {
    return ref.read(p2pRepositoryProvider).getMyRating(orderId);
  }

  Future<bool> submit({required int rating, String? comment}) async {
    try {
      final saved = await ref.read(p2pRepositoryProvider).submitRating(
            arg,
            rating: rating,
            comment: comment,
          );
      state = AsyncData(saved);
      return true;
    } catch (e, st) {
      state = AsyncError(ErrorMessage.brief(e), st);
      return false;
    }
  }
}
