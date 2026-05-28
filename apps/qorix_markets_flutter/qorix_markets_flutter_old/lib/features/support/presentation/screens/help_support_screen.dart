import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/support/application/help_support_provider.dart';
import 'package:qorix_markets_flutter/features/support/presentation/widgets/help_support_ui.dart';
import 'package:qorix_markets_flutter/features/support/presentation/widgets/support_chat_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';
import 'package:qorix_markets_flutter/widgets/skeleton_loader.dart' show SkeletonBox;

class HelpSupportScreen extends ConsumerWidget {
  const HelpSupportScreen({super.key});

  Future<void> _showTicketSheet(BuildContext context, WidgetRef ref) async {
    var category = 'Wallet';
    final subject = TextEditingController();
    final message = TextEditingController();
    var submitting = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF12171C),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(ctx).bottom + 16),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Submit a ticket', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                    const SizedBox(height: 4),
                    Text(
                      'Our team responds during support hours.',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 11),
                    ),
                    const SizedBox(height: 14),
                    DropdownButtonFormField<String>(
                      initialValue: category,
                      dropdownColor: const Color(0xFF12171C),
                      style: const TextStyle(color: Colors.white),
                      decoration: _fieldDecoration('Category'),
                      items: const [
                        DropdownMenuItem(value: 'Wallet', child: Text('Wallet')),
                        DropdownMenuItem(value: 'Account', child: Text('Account')),
                        DropdownMenuItem(value: 'Invest', child: Text('Invest')),
                        DropdownMenuItem(value: 'P2P', child: Text('P2P')),
                        DropdownMenuItem(value: 'Security', child: Text('Security')),
                        DropdownMenuItem(value: 'Other', child: Text('Other')),
                      ],
                      onChanged: submitting ? null : (v) => setSheetState(() => category = v ?? 'Wallet'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: subject,
                      enabled: !submitting,
                      style: const TextStyle(color: Colors.white),
                      decoration: _fieldDecoration('Subject'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: message,
                      enabled: !submitting,
                      style: const TextStyle(color: Colors.white),
                      maxLines: 4,
                      decoration: _fieldDecoration('Describe your issue'),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: submitting
                          ? null
                          : () async {
                              final subj = subject.text.trim();
                              final body = message.text.trim();
                              if (subj.isEmpty || body.isEmpty) {
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                  const SnackBar(content: Text('Subject and message are required'), behavior: SnackBarBehavior.floating),
                                );
                                return;
                              }
                              setSheetState(() => submitting = true);
                              try {
                                final result = await ref.read(helpSupportProvider.notifier).submitTicket(
                                      category: category,
                                      subject: subj,
                                      message: body,
                                    );
                                if (!ctx.mounted) return;
                                Navigator.pop(ctx);
                                if (context.mounted) {
                                  HapticFeedback.mediumImpact();
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(result.id != null ? 'Ticket #${result.id} submitted' : result.message),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                }
                              } catch (e) {
                                if (!ctx.mounted) return;
                                setSheetState(() => submitting = false);
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                  SnackBar(content: Text(ErrorMessage.brief(e)), behavior: SnackBarBehavior.floating),
                                );
                              }
                            },
                      style: FilledButton.styleFrom(backgroundColor: AppColors.authGreen, foregroundColor: Colors.black),
                      child: submitting
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                          : const Text('Submit ticket'),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  InputDecoration _fieldDecoration(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: TextStyle(color: Colors.white.withValues(alpha: 0.55)),
      filled: true,
      fillColor: const Color(0xFF0A0E12),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF1E2630))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF1E2630))),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: AppColors.authGreen.withValues(alpha: 0.6)),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final supportAsync = ref.watch(helpSupportProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      body: SafeArea(
        bottom: false,
        child: CinematicAsyncContent<HelpSupportSnapshot>(
          value: supportAsync,
          onRetry: () => ref.read(helpSupportProvider.notifier).refresh(),
          builder: (data, {required isRefreshing}) {
            return Responsive.constrained(
              context,
              RefreshIndicator(
                onRefresh: () => ref.read(helpSupportProvider.notifier).refresh(),
                child: ListView(
                  physics: AppScroll.page,
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  children: [
                    HelpSupportAppBar(title: 'Help & Support', onBack: () => safePop(context)),
                    const SizedBox(height: 16),
                    HelpSupportContactCard(contact: data.contact),
                    const SizedBox(height: 16),
                    HelpSupportActionTile(
                      icon: Icons.chat_bubble_outline_rounded,
                      title: 'Live chat',
                      subtitle: 'Qorix Assistant — instant answers & expert handoff',
                      onTap: () => context.push(RoutePaths.supportChat),
                    ),
                    const SizedBox(height: 10),
                    HelpSupportActionTile(
                      icon: Icons.email_outlined,
                      title: 'Email support',
                      subtitle: data.contact.email,
                      onTap: () => openSupportEmail(data.contact.email, subject: 'Qorix Markets support request'),
                    ),
                    const SizedBox(height: 10),
                    HelpSupportActionTile(
                      icon: Icons.confirmation_number_outlined,
                      title: 'Submit a ticket',
                      subtitle: 'Track a specific issue with our team',
                      onTap: () => _showTicketSheet(context, ref),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'FREQUENTLY ASKED',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.45),
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ...data.faqs.map(
                      (faq) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: HelpSupportFaqTile(faq: faq),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
          loading: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: const [
              SkeletonBox(height: 48, borderRadius: 12),
              SizedBox(height: 16),
              SkeletonBox(height: 72, borderRadius: 18),
              SizedBox(height: 16),
              SkeletonBox(height: 64, borderRadius: 16),
              SizedBox(height: 10),
              SkeletonBox(height: 64, borderRadius: 16),
              SizedBox(height: 10),
              SkeletonBox(height: 64, borderRadius: 16),
            ],
          ),
        ),
      ),
    );
  }
}
