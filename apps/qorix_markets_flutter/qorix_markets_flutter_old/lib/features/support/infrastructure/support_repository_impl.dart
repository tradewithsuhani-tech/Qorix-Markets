import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/support_models.dart';
import 'package:qorix_markets_flutter/features/support/presentation/data/help_support_demo.dart';
import 'package:qorix_markets_flutter/services/api/support_api_service.dart';

final supportRepositoryProvider = Provider<SupportRepository>((ref) {
  return SupportRepositoryImpl(ref.watch(supportApiServiceProvider));
});

abstract interface class SupportRepository {
  Future<List<SupportFaqModel>> getFaqs();
  Future<SupportContactModel> getContact();
  Future<SupportTicketResult> submitTicket({
    required String category,
    required String subject,
    required String message,
  });
  Future<ChatSessionModel> createChatSession();
  Future<List<ChatMessageModel>> getChatMessages(int sessionId);
  Future<void> sendChatMessage({required int sessionId, required String content});
  Future<void> saveBotMessage({required int sessionId, required String content});
  Future<void> requestExpert({required int sessionId});
  Future<void> endChatSession(int sessionId);
}

class SupportRepositoryImpl implements SupportRepository {
  SupportRepositoryImpl(this._api);
  final SupportApiService _api;

  Future<T> _wrap<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<List<SupportFaqModel>> getFaqs() async {
    if (UiDemoMode.isActive) return HelpSupportDemo.faqs;
    try {
      final faqs = await _api.getFaqs();
      if (faqs.isEmpty) return HelpSupportDemo.faqs;
      return faqs;
    } on DioException {
      return HelpSupportDemo.faqs;
    }
  }

  @override
  Future<SupportContactModel> getContact() async {
    if (UiDemoMode.isActive) return HelpSupportDemo.contact;
    try {
      return await _api.getContact();
    } on DioException {
      return HelpSupportDemo.contact;
    }
  }

  @override
  Future<SupportTicketResult> submitTicket({
    required String category,
    required String subject,
    required String message,
  }) async {
    if (UiDemoMode.blocksWriteApi) {
      return const SupportTicketResult(id: 'demo-1', message: 'Ticket submitted (demo)');
    }
    return _wrap(
      () => _api.submitTicket(category: category, subject: subject, message: message),
    );
  }

  @override
  Future<ChatSessionModel> createChatSession() {
    if (UiDemoMode.isActive) {
      return Future.value(const ChatSessionModel(id: 0, status: 'active'));
    }
    return _wrap(_api.createChatSession);
  }

  @override
  Future<List<ChatMessageModel>> getChatMessages(int sessionId) {
    if (UiDemoMode.isActive) return Future.value(const []);
    return _wrap(() => _api.getChatMessages(sessionId));
  }

  @override
  Future<void> sendChatMessage({required int sessionId, required String content}) {
    if (UiDemoMode.blocksWriteApi) return Future.value();
    return _wrap(() => _api.sendChatMessage(sessionId: sessionId, content: content));
  }

  @override
  Future<void> saveBotMessage({required int sessionId, required String content}) {
    if (UiDemoMode.blocksWriteApi) return Future.value();
    return _wrap(() => _api.saveBotMessage(sessionId: sessionId, content: content));
  }

  @override
  Future<void> requestExpert({required int sessionId}) {
    if (UiDemoMode.blocksWriteApi) return Future.value();
    return _wrap(() => _api.requestExpert(sessionId: sessionId));
  }

  @override
  Future<void> endChatSession(int sessionId) {
    if (UiDemoMode.blocksWriteApi) return Future.value();
    return _wrap(() => _api.endChatSession(sessionId));
  }
}
