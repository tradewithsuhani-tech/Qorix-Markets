import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/data/models/kyc_status_model.dart';
import 'package:qorix_markets_flutter/features/kyc/domain/entities/kyc_state.dart';
import 'package:qorix_markets_flutter/features/kyc/presentation/providers/kyc_providers.dart';
import 'package:qorix_markets_flutter/features/kyc/presentation/widgets/kyc_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

class KycScreen extends ConsumerStatefulWidget {
  const KycScreen({super.key});

  @override
  ConsumerState<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends ConsumerState<KycScreen> {
  KycPreviewMode _preview = KycPreviewMode.live;

  KycStatus _effectiveStatus(KycStatus live) {
    if (!UiDemoMode.isActive || _preview == KycPreviewMode.live) return live;
    return switch (_preview) {
      KycPreviewMode.verified => KycStatus.verified,
      KycPreviewMode.pending => KycStatus.pending,
      KycPreviewMode.notStarted => KycStatus.notStarted,
      KycPreviewMode.live => live,
    };
  }

  int _completedDocs(KycStatusModel? detail, KycStatus status) {
    if (status == KycStatus.verified) return 3;
    return detail?.completedLevels ?? 0;
  }

  String _ctaLabel(KycStatus status, KycStatusModel? detail) {
    if (status == KycStatus.verified) return 'Verification complete';
    if (status == KycStatus.pending) return 'View submission status';
    if (status == KycStatus.rejected) return 'Retry verification';
    final step = detail?.nextStepIndex();
    return step == null ? 'Start verification' : 'Continue verification';
  }

  void _openFlow(KycStatusModel? detail) {
    final step = detail?.nextStepIndex() ?? 0;
    context.push('${RoutePaths.kycFlow}?step=$step');
  }

  Future<void> _onCta(KycStatus status, KycStatusModel? detail) async {
    if (status == KycStatus.verified) {
      safePop(context);
      return;
    }
    _openFlow(detail);
  }

  @override
  Widget build(BuildContext context) {
    final statusAsync = ref.watch(kycStatusProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      body: SafeArea(
        bottom: false,
        child: statusAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text(ErrorMessage.from(e), style: const TextStyle(color: Colors.white70))),
          data: (state) {
            final detail = state.detail is KycStatusModel ? state.detail! as KycStatusModel : null;
            final status = _effectiveStatus(state.status);
            final completed = _completedDocs(detail, status);

            return Responsive.constrained(
              context,
              ListView(
                physics: AppScroll.page,
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  KycAppBar(onBack: () => safePop(context)),
                  if (UiDemoMode.isActive) ...[
                    const SizedBox(height: 12),
                    KycPreviewStrip(
                      selected: _preview,
                      onSelect: (m) => setState(() => _preview = m),
                    ),
                  ],
                  const SizedBox(height: 16),
                  KycStatusHero(status: status, completedDocs: completed),
                  const SizedBox(height: 20),
                  KycDocumentsCard(
                    documents: kycDefaultDocuments(status: status),
                    onDocTap: status == KycStatus.verified
                        ? null
                        : (_) => _openFlow(detail),
                  ),
                  const SizedBox(height: 18),
                  KycLimitsCard(status: status),
                  if (status != KycStatus.verified) ...[
                    const SizedBox(height: 22),
                    KycStartButton(
                      label: _ctaLabel(status, detail),
                      loading: ref.watch(kycActionProvider).isLoading,
                      pendingStyle: status == KycStatus.pending,
                      onTap: () => _onCta(status, detail),
                    ),
                  ],
                  const SizedBox(height: 14),
                  const KycSecurityNote(),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
