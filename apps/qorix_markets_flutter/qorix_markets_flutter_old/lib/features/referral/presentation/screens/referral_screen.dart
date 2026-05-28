import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';

import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/referral/application/referral_providers.dart';
import 'package:qorix_markets_flutter/features/referral/domain/entities/referral_info.dart';
import 'package:qorix_markets_flutter/features/referral/presentation/widgets/referral_ui.dart';

class ReferralScreen extends ConsumerWidget {
  const ReferralScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final referralAsync = ref.watch(referralProvider);
    final partnersAsync = ref.watch(referredUsersProvider);

    if (embedded) {
      return referralAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF00E676))),
        error: (_, __) => const SizedBox.shrink(),
        data: (info) => _ReferralsBody(
          info: info,
          partners: partnersAsync.valueOrNull ?? [],
          embedded: true,
          onRefresh: () async {
            await ref.read(referralProvider.notifier).refresh();
            await ref.read(referredUsersProvider.notifier).refresh();
          },
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
              child: ReferralsAppBar(onBack: () => safePop(context)),
            ),
            Expanded(
              child: referralAsync.when(
                loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF00E676))),
                error: (_, __) => Center(child: Text('Failed to load', style: TextStyle(color: Colors.white.withValues(alpha: 0.5)))),
                data: (info) => _ReferralsBody(
                  info: info,
                  partners: partnersAsync.valueOrNull ?? [],
                  onRefresh: () async {
                    await ref.read(referralProvider.notifier).refresh();
                    await ref.read(referredUsersProvider.notifier).refresh();
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReferralsBody extends StatelessWidget {
  const _ReferralsBody({
    required this.info,
    required this.partners,
    this.embedded = false,
    this.onRefresh,
  });

  final ReferralInfo info;
  final List<ReferredUser> partners;
  final bool embedded;
  final Future<void> Function()? onRefresh;

  void _copyLink(BuildContext context) {
    Clipboard.setData(ClipboardData(text: info.shareLink));
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Partner link copied'), behavior: SnackBarBehavior.floating, duration: Duration(seconds: 1)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: const Color(0xFF00E676),
      onRefresh: onRefresh ?? () async {},
      child: ListView(
        padding: EdgeInsets.fromLTRB(16, embedded ? 0 : 8, 16, embedded ? 24 : Responsive.bottomNavClearance),
        children: [
          ReferralsHeroCard(
            totalPartners: info.totalReferred,
            activePartners: info.activeReferrals,
            commissionEarned: info.totalEarned,
            monthlyEarnings: info.monthlyEarnings,
          ),
          const SizedBox(height: 12),
          const ReferralsRewardCard(),
          const SizedBox(height: 12),
          ReferralsCredentialsCard(link: info.shareLink, code: info.referralCode),
          const SizedBox(height: 12),
          ReferralsNetworkCard(
            partners: partners,
            onCopyLink: () => _copyLink(context),
          ),
        ],
      ),
    );
  }
}
