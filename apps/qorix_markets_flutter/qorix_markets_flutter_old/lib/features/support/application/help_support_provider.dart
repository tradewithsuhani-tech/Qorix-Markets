import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/data/models/support_models.dart';
import 'package:qorix_markets_flutter/features/support/infrastructure/support_repository_impl.dart';
import 'package:qorix_markets_flutter/features/support/presentation/data/help_support_demo.dart';

class HelpSupportSnapshot {
  const HelpSupportSnapshot({required this.contact, required this.faqs});
  final SupportContactModel contact;
  final List<SupportFaqModel> faqs;
}

final helpSupportProvider =
    AsyncNotifierProvider<HelpSupportNotifier, HelpSupportSnapshot>(HelpSupportNotifier.new);

class HelpSupportNotifier extends AsyncNotifier<HelpSupportSnapshot>
    with CachedAsyncMixin<HelpSupportSnapshot> {
  @override
  Future<HelpSupportSnapshot> build() async {
    final repo = ref.read(supportRepositoryProvider);
    final contact = await repo.getContact();
    final faqs = await repo.getFaqs();
    final snapshot = HelpSupportSnapshot(contact: contact, faqs: faqs);
    cacheValue(snapshot);
    return snapshot;
  }

  Future<void> refresh() => softRefresh(() async {
        final repo = ref.read(supportRepositoryProvider);
        final snapshot = HelpSupportSnapshot(
          contact: await repo.getContact(),
          faqs: await repo.getFaqs(),
        );
        cacheValue(snapshot);
        return snapshot;
      });

  Future<SupportTicketResult> submitTicket({
    required String category,
    required String subject,
    required String message,
  }) async {
    if (UiDemoMode.blocksWriteApi) {
      return const SupportTicketResult(id: 'DEMO-001');
    }
    return ref.read(supportRepositoryProvider).submitTicket(
          category: category,
          subject: subject,
          message: message,
        );
  }
}
