import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/support/application/support_chat_provider.dart';
import 'package:qorix_markets_flutter/features/support/presentation/data/support_chat_flows.dart';

class HelpSupportAppBar extends StatelessWidget {
  const HelpSupportAppBar({required this.title, required this.onBack, super.key});

  final String title;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onBack,
                borderRadius: BorderRadius.circular(12),
                child: Ink(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.75)),
                  ),
                  child: Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: Colors.white.withValues(alpha: 0.9)),
                ),
              ),
            ),
          ),
          Text(title, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class SupportChatBubble extends StatelessWidget {
  const SupportChatBubble({required this.message, super.key});

  final SupportChatMessage message;

  @override
  Widget build(BuildContext context) {
    final isUser = message.sender == SupportChatSender.user;
    final isAdmin = message.sender == SupportChatSender.admin;
    final bg = isUser
        ? AppColors.authGreen.withValues(alpha: 0.18)
        : isAdmin
            ? const Color(0xFF1E3A5F)
            : const Color(0xFF12171C);
    final border = isUser
        ? AppColors.authGreen.withValues(alpha: 0.35)
        : isAdmin
            ? const Color(0xFF2563EB).withValues(alpha: 0.35)
            : const Color(0xFF1E2630);

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(isUser ? 16 : 4),
              bottomRight: Radius.circular(isUser ? 4 : 16),
            ),
            border: Border.all(color: border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!isUser)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    isAdmin ? 'Expert' : 'Qorix Assistant',
                    style: TextStyle(
                      color: isAdmin ? const Color(0xFF60A5FA) : AppColors.authGreen,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
              Text(
                message.content,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.92), fontSize: 13, height: 1.45),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class SupportChatOptions extends StatelessWidget {
  const SupportChatOptions({
    required this.options,
    required this.onSelect,
    required this.disabled,
    super.key,
  });

  final List<SupportChatOption> options;
  final ValueChanged<SupportChatOption> onSelect;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    if (options.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: options.map((option) {
        return Material(
          color: const Color(0xFF12171C),
          borderRadius: BorderRadius.circular(20),
          child: InkWell(
            onTap: disabled
                ? null
                : () {
                    HapticFeedback.selectionClick();
                    onSelect(option);
                  },
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.45)),
              ),
              child: Text(option.label, style: const TextStyle(color: AppColors.authGreen, fontSize: 12, fontWeight: FontWeight.w700)),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class SupportChatTypingIndicator extends StatelessWidget {
  const SupportChatTypingIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF12171C),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF1E2630)),
        ),
        child: Text('Typing…', style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 12)),
      ),
    );
  }
}

class SupportChatExpertBanner extends StatelessWidget {
  const SupportChatExpertBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1E3A5F).withValues(alpha: 0.45),
        border: Border(bottom: BorderSide(color: const Color(0xFF2563EB).withValues(alpha: 0.35))),
      ),
      child: Row(
        children: [
          const Icon(Icons.support_agent_rounded, color: Color(0xFF60A5FA), size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Expert mode — an advisor will reply during support hours',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.78), fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }
}

class SupportChatEndedBanner extends StatelessWidget {
  const SupportChatEndedBanner({required this.onRestart, super.key});

  final VoidCallback onRestart;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      color: const Color(0xFF12171C),
      child: Column(
        children: [
          Text('Chat ended', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12)),
          const SizedBox(height: 8),
          TextButton(onPressed: onRestart, child: const Text('Start new chat')),
        ],
      ),
    );
  }
}

class SupportChatInputBar extends StatelessWidget {
  const SupportChatInputBar({
    required this.controller,
    required this.onSend,
    required this.enabled,
    required this.sending,
    super.key,
  });

  final TextEditingController controller;
  final VoidCallback onSend;
  final bool enabled;
  final bool sending;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(12, 10, 12, MediaQuery.paddingOf(context).bottom + 10),
      decoration: const BoxDecoration(
        color: Color(0xFF0A0E12),
        border: Border(top: BorderSide(color: Color(0xFF1E2630))),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              maxLines: 4,
              minLines: 1,
              textInputAction: TextInputAction.send,
              onSubmitted: enabled ? (_) => onSend() : null,
              decoration: InputDecoration(
                hintText: enabled ? 'Type your message…' : 'Chat ended',
                hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.35)),
                filled: true,
                fillColor: const Color(0xFF12171C),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Color(0xFF1E2630)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Color(0xFF1E2630)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: AppColors.authGreen.withValues(alpha: 0.6)),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Material(
            color: AppColors.authGreen,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              onTap: enabled && !sending ? onSend : null,
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                width: 44,
                height: 44,
                child: sending
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                      )
                    : const Icon(Icons.send_rounded, color: Colors.black, size: 20),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
