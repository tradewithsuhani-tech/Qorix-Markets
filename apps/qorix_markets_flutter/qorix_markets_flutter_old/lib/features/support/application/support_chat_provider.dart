import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/support/infrastructure/support_repository_impl.dart';
import 'package:qorix_markets_flutter/features/support/presentation/data/support_chat_flows.dart';

enum SupportChatSender { user, bot, admin }

class SupportChatMessage {
  const SupportChatMessage({
    required this.id,
    required this.sender,
    required this.content,
    required this.sentAt,
    this.options = const [],
  });

  final String id;
  final SupportChatSender sender;
  final String content;
  final DateTime sentAt;
  final List<SupportChatOption> options;

  SupportChatMessage copyWith({List<SupportChatOption>? options}) {
    return SupportChatMessage(
      id: id,
      sender: sender,
      content: content,
      sentAt: sentAt,
      options: options ?? this.options,
    );
  }
}

class SupportChatState {
  const SupportChatState({
    this.sessionId,
    this.messages = const [],
    this.expertMode = false,
    this.typing = false,
    this.loading = true,
    this.ended = false,
    this.sending = false,
  });

  final int? sessionId;
  final List<SupportChatMessage> messages;
  final bool expertMode;
  final bool typing;
  final bool loading;
  final bool ended;
  final bool sending;

  SupportChatState copyWith({
    int? sessionId,
    List<SupportChatMessage>? messages,
    bool? expertMode,
    bool? typing,
    bool? loading,
    bool? ended,
    bool? sending,
  }) {
    return SupportChatState(
      sessionId: sessionId ?? this.sessionId,
      messages: messages ?? this.messages,
      expertMode: expertMode ?? this.expertMode,
      typing: typing ?? this.typing,
      loading: loading ?? this.loading,
      ended: ended ?? this.ended,
      sending: sending ?? this.sending,
    );
  }
}

final supportChatProvider =
    NotifierProvider.autoDispose<SupportChatNotifier, SupportChatState>(SupportChatNotifier.new);

class SupportChatNotifier extends AutoDisposeNotifier<SupportChatState> {
  Timer? _pollTimer;

  @override
  SupportChatState build() {
    ref.onDispose(() => _pollTimer?.cancel());
    Future.microtask(_init);
    return const SupportChatState();
  }

  Future<void> _init() async {
    try {
      if (UiDemoMode.isActive) {
        _appendBot(SupportChatFlows.main.message, SupportChatFlows.main.options);
        state = state.copyWith(loading: false, sessionId: 0);
        return;
      }

      final session = await ref.read(supportRepositoryProvider).createChatSession();
      if (session.expertRequested || session.status == 'expert_requested') {
        final serverMessages = await ref.read(supportRepositoryProvider).getChatMessages(session.id);
        final mapped = serverMessages.map(_fromServer).toList();
        state = state.copyWith(
          sessionId: session.id,
          expertMode: true,
          messages: mapped,
          loading: false,
        );
        _startPolling();
        return;
      }

      state = state.copyWith(sessionId: session.id, loading: false);
      _appendBot(SupportChatFlows.main.message, SupportChatFlows.main.options);
      await _persistBot(SupportChatFlows.main.message);
    } catch (_) {
      state = state.copyWith(loading: false);
      _appendBot(SupportChatFlows.main.message, SupportChatFlows.main.options);
    }
  }

  SupportChatMessage _fromServer(dynamic m) {
    final type = switch (m.senderType) {
      'admin' => SupportChatSender.admin,
      'user' => SupportChatSender.user,
      _ => SupportChatSender.bot,
    };
    return SupportChatMessage(
      id: '${m.id}',
      sender: type,
      content: m.content,
      sentAt: DateTime.tryParse(m.createdAt ?? '') ?? DateTime.now(),
    );
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _pollMessages());
  }

  Future<void> _pollMessages() async {
    final sessionId = state.sessionId;
    if (sessionId == null || !state.expertMode) return;
    try {
      final serverMessages = await ref.read(supportRepositoryProvider).getChatMessages(sessionId);
      state = state.copyWith(messages: serverMessages.map(_fromServer).toList());
    } catch (_) {}
  }

  void _appendUser(String content) {
    state = state.copyWith(
      messages: [
        ...state.messages,
        SupportChatMessage(
          id: 'u-${DateTime.now().millisecondsSinceEpoch}',
          sender: SupportChatSender.user,
          content: content,
          sentAt: DateTime.now(),
        ),
      ],
    );
  }

  void _appendBot(String content, [List<SupportChatOption> options = const []]) {
    state = state.copyWith(
      messages: [
        ...state.messages,
        SupportChatMessage(
          id: 'b-${DateTime.now().millisecondsSinceEpoch}',
          sender: SupportChatSender.bot,
          content: content,
          sentAt: DateTime.now(),
          options: options,
        ),
      ],
      typing: false,
    );
  }

  Future<void> _persistUser(String content) async {
    final sessionId = state.sessionId;
    if (sessionId == null) return;
    await ref.read(supportRepositoryProvider).sendChatMessage(sessionId: sessionId, content: content);
  }

  Future<void> _persistBot(String content) async {
    final sessionId = state.sessionId;
    if (sessionId == null) return;
    await ref.read(supportRepositoryProvider).saveBotMessage(sessionId: sessionId, content: content);
  }

  Future<void> selectOption(SupportChatOption option) async {
    if (state.ended || state.sending) return;
    await _handleAction(option.value, option.label);
  }

  Future<void> sendText(String raw) async {
    final content = raw.trim();
    if (content.isEmpty || state.ended || state.sending) return;

    state = state.copyWith(sending: true);
    _appendUser(content);
    try {
      await _persistUser(content);
      if (!state.expertMode) {
        _appendBot(
          'Thanks for your message. Select an option below or connect with our expert team for personalised help.',
          SupportChatFlows.main.options,
        );
        await _persistBot(
          'Thanks for your message. Select an option below or connect with our expert team for personalised help.',
        );
      }
    } finally {
      state = state.copyWith(sending: false);
    }
  }

  Future<void> _handleAction(String value, String label) async {
    if (value == 'main_menu') {
      _appendUser(label);
      await _persistUser(label);
      _appendBot(SupportChatFlows.main.message, SupportChatFlows.main.options);
      await _persistBot(SupportChatFlows.main.message);
      return;
    }

    if (value == 'expert') {
      _appendUser(label);
      await _persistUser(label);
      state = state.copyWith(typing: true);
      try {
        final sessionId = state.sessionId;
        if (sessionId != null) {
          await ref.read(supportRepositoryProvider).requestExpert(sessionId: sessionId);
        }
        state = state.copyWith(expertMode: true, typing: false);
        _appendBot(SupportChatFlows.flows['expert_requested']!.message);
        _startPolling();
      } catch (_) {
        state = state.copyWith(typing: false);
        _appendBot(SupportChatFlows.flows['expert_requested']!.message);
        state = state.copyWith(expertMode: true);
        _startPolling();
      }
      return;
    }

    final flow = SupportChatFlows.flows[value];
    if (flow == null) return;

    _appendUser(label);
    await _persistUser(label);
    state = state.copyWith(typing: true);
    await Future<void>.delayed(const Duration(milliseconds: 500));
    _appendBot(flow.message, flow.options);
    await _persistBot(flow.message);
  }

  Future<void> endChat() async {
    final sessionId = state.sessionId;
    if (sessionId != null && sessionId > 0) {
      try {
        await ref.read(supportRepositoryProvider).endChatSession(sessionId);
      } catch (_) {}
    }
    _pollTimer?.cancel();
    state = state.copyWith(ended: true, expertMode: false);
  }

  void restart() {
    _pollTimer?.cancel();
    state = const SupportChatState();
    _init();
  }
}
