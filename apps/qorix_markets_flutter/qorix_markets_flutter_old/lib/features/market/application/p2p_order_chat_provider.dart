import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/data/models/p2p_models.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/p2p_entities.dart';
import 'package:qorix_markets_flutter/features/market/infrastructure/p2p_repository_impl.dart';

final p2pOrderChatProvider =
    AsyncNotifierProvider.autoDispose.family<P2pOrderChatNotifier, List<P2pChatMessage>, int>(P2pOrderChatNotifier.new);

class P2pOrderChatNotifier extends AutoDisposeFamilyAsyncNotifier<List<P2pChatMessage>, int> {
  @override
  Future<List<P2pChatMessage>> build(int orderId) async {
    return ref.read(p2pRepositoryProvider).getMessages(orderId);
  }

  void ingestSsePayload(Map<String, dynamic>? data) {
    if (data == null) return;
    final msg = P2pChatMessageModel.fromJson(data).toEntity();
    final current = state.valueOrNull ?? [];
    if (current.any((m) => m.id == msg.id)) return;
    state = AsyncData([...current, msg]);
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(p2pRepositoryProvider).getMessages(arg));
  }

  Future<bool> send({
    required String message,
    String? attachmentData,
    String? attachmentType,
  }) async {
    final trimmed = message.trim();
    if (trimmed.isEmpty && attachmentData == null) return false;

    try {
      await ref.read(p2pRepositoryProvider).sendMessage(
            arg,
            message: trimmed.isEmpty ? ' ' : trimmed,
            attachmentData: attachmentData,
            attachmentType: attachmentType,
          );
      await refresh();
      return true;
    } catch (e, st) {
      state = AsyncError(ErrorMessage.brief(e), st);
      return false;
    }
  }
}
