import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/support_models.dart';

final supportApiServiceProvider = Provider<SupportApiService>((ref) {
  return SupportApiService(
    readClient: ref.watch(apiClientProvider),
    writeClient: ref.watch(legacyApiClientProvider),
  );
});

class SupportApiService {
  const SupportApiService({
    required ApiClient readClient,
    required ApiClient writeClient,
  })  : _readClient = readClient,
        _writeClient = writeClient;

  final ApiClient _readClient;
  final ApiClient _writeClient;

  Future<List<SupportFaqModel>> getFaqs() async {
    final res = await _readClient.get<dynamic>(ApiEndpoints.supportFaqs);
    return parseSupportFaqsList(res.data);
  }

  Future<SupportContactModel> getContact() async {
    try {
      final res = await _readClient.get<Map<String, dynamic>>(ApiEndpoints.supportFaqs);
      final root = ApiJson.object(res.data);
      if (root['contact'] is Map) {
        return SupportContactModel.fromJson(Map<String, dynamic>.from(root['contact'] as Map));
      }
      if (root['data'] is Map && (root['data'] as Map)['contact'] is Map) {
        return SupportContactModel.fromJson(
          Map<String, dynamic>.from((root['data'] as Map)['contact'] as Map),
        );
      }
    } catch (_) {}
    return const SupportContactModel();
  }

  Future<SupportTicketResult> submitTicket({
    required String category,
    required String subject,
    required String message,
  }) async {
    final res = await _writeClient.post<Map<String, dynamic>>(
      ApiEndpoints.supportTickets,
      data: {
        'category': category,
        'subject': subject,
        'message': message,
      },
    );
    return SupportTicketResult.fromJson(res.data ?? {});
  }

  Future<ChatSessionModel> createChatSession() async {
    final res = await _writeClient.post<Map<String, dynamic>>(ApiEndpoints.chatSession, data: {});
    return ChatSessionModel.fromJson(res.data ?? {});
  }

  Future<List<ChatMessageModel>> getChatMessages(int sessionId) async {
    final res = await _writeClient.get<Map<String, dynamic>>(ApiEndpoints.chatSessionMessages(sessionId));
    final root = ApiJson.object(res.data);
    final list = root['messages'];
    if (list is! List) return const [];
    return list
        .whereType<Map>()
        .map((e) => ChatMessageModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> sendChatMessage({required int sessionId, required String content}) async {
    await _writeClient.post(
      ApiEndpoints.chatMessage,
      data: {'sessionId': sessionId, 'content': content},
    );
  }

  Future<void> saveBotMessage({required int sessionId, required String content}) async {
    await _writeClient.post(
      ApiEndpoints.chatBotMessage,
      data: {'sessionId': sessionId, 'content': content},
    );
  }

  Future<void> requestExpert({required int sessionId}) async {
    await _writeClient.post(
      ApiEndpoints.chatExpert,
      data: {'sessionId': sessionId},
    );
  }

  Future<void> endChatSession(int sessionId) async {
    await _writeClient.post(ApiEndpoints.chatSessionEnd(sessionId), data: {});
  }
}
