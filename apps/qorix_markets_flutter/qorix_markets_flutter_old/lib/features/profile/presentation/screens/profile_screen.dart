import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/security/app_lock_provider.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/auth/domain/entities/user_entity.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_controller.dart';
import 'package:qorix_markets_flutter/features/dashboard/application/dashboard_providers.dart';
import 'package:qorix_markets_flutter/features/notifications/application/notification_providers.dart';
import 'package:qorix_markets_flutter/features/kyc/domain/entities/kyc_state.dart';
import 'package:qorix_markets_flutter/features/kyc/presentation/providers/kyc_providers.dart'
    show kycLiveStatusProvider, kycStatusLegacyProvider;
import 'package:qorix_markets_flutter/features/profile/application/profile_providers.dart';
import 'package:qorix_markets_flutter/features/profile/application/security_providers.dart';
import 'package:qorix_markets_flutter/features/profile/presentation/providers/two_factor_providers.dart';
import 'package:qorix_markets_flutter/features/profile/presentation/widgets/settings_ui.dart';
import 'package:qorix_markets_flutter/features/referral/application/referral_providers.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/ui/components/notification_panel.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_mock_data.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kycLive = ref.watch(kycStatusLegacyProvider);
    final profileAsync = ref.watch(profileUserProvider);
    final securityAsync = ref.watch(securityStatusProvider);
    final dashboard = ref.watch(dashboardProvider).valueOrNull;
    final referral = ref.watch(referralProvider).valueOrNull;
    final unread = ref.watch(unreadNotificationsCountProvider);
    final twoFactorEnabled = ref.watch(twoFactorEnabledProvider);
    final appLockEnabled = ref.watch(appLockProvider.select((s) => s.isActive));
    final badgeCount = unread > 0 ? unread : UiMockData.unreadNotifications;

    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(kycLiveStatusProvider);
          await Future.wait([
            ref.read(profileUserProvider.notifier).refresh(),
            ref.read(securityStatusProvider.notifier).refresh(),
            ref.read(dashboardProvider.notifier).refresh(),
            ref.read(referralProvider.notifier).refresh(),
          ]);
        },
        child: CinematicAsyncContent<UserEntity?>(
          value: profileAsync,
          onRetry: () => ref.read(profileUserProvider.notifier).refresh(),
          builder: (user, {required isRefreshing}) {
            final name = user?.fullName?.isNotEmpty == true
                ? user!.fullName!
                : (user?.displayName ?? SettingsDemo.displayName);
            final email = user?.email ?? SettingsDemo.email;
            final accountId = user != null ? 'QORIX-${user.id}' : SettingsDemo.accountId;
            final portfolioInr = dashboard?.totalBalance ?? SettingsDemo.portfolioInr;
            final totalPnlInr = dashboard?.totalProfit ?? SettingsDemo.totalPnlInr;
            final totalPnlPercent = dashboard?.totalReturn ?? SettingsDemo.totalPnlPercent;
            final isPro = user?.isPro ?? (dashboard != null ? dashboard.vip.tier != 'standard' : SettingsDemo.isPro);
            final kycVerified = kycLive.status == KycStatus.verified;
            final memberSince = user?.memberSince ?? SettingsDemo.memberSince;
            final referralEarned = referral?.totalEarned ?? SettingsDemo.referralEarnedInr;
            final security = securityAsync.valueOrNull;
            final passwordLastChanged = formatPasswordChangedFromSecurity(security);
            final maskedPhone = user?.displayPhone ?? SettingsDemo.maskedPhone;
            final emailVerified = user?.emailVerified ?? security?.emailVerified ?? SettingsDemo.emailVerified;

            return Responsive.constrained(
              context,
              ListView(
                physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, Responsive.bottomNavClearance),
                children: [
                  SettingsAppBar(
                    unreadCount: badgeCount,
                    onNotifications: () => showNotificationPanel(context),
                  ),
                  const SizedBox(height: 12),
                  SettingsProfileCard(
                    name: name,
                    email: email,
                    accountId: accountId,
                    memberSince: memberSince,
                    portfolioInr: portfolioInr,
                    totalPnlInr: totalPnlInr,
                    totalPnlPercent: totalPnlPercent,
                    isPro: isPro,
                  ),
                  const SizedBox(height: 12),
                  SettingsReferBanner(
                    earnedInr: referralEarned,
                    onTap: () => context.push(RoutePaths.referral),
                  ),
                  const SizedBox(height: 12),
                  SettingsKycBanner(
                    isVerified: kycVerified,
                    onTap: () => context.push(RoutePaths.kyc),
                  ),
                  const SizedBox(height: 20),
                  const SettingsSectionLabel('Trade'),
                  SettingsTradeCard(
                    onMarkets: () => context.go(RoutePaths.markets),
                    onP2p: () => context.push(RoutePaths.p2p),
                    onMarketInsights: () => context.push(RoutePaths.marketInsights),
                  ),
                  const SizedBox(height: 18),
                  const SettingsSectionLabel('Account'),
                  SettingsAccountMenuCard(
                    onHistory: () => context.push(RoutePaths.history),
                    onPayoutMethods: () => context.push(RoutePaths.inrPayoutMethods),
                  ),
                  const SizedBox(height: 18),
                  const SettingsSectionLabel('Contact'),
                  SettingsContactCard(
                    maskedPhone: maskedPhone,
                    email: email,
                    phoneVerified: SettingsDemo.phoneVerified,
                    emailVerified: emailVerified,
                  ),
                  const SizedBox(height: 18),
                  const SettingsSectionLabel('Security'),
                  SettingsSecurityCard(
                    passwordLastChanged: passwordLastChanged,
                    twoFactorEnabled: twoFactorEnabled,
                    appLockEnabled: appLockEnabled,
                    onUpdatePassword: () => context.push(RoutePaths.changePassword),
                    onToggle2Fa: () => context.push(RoutePaths.twoFactorAuth),
                    onAppLock: () => context.push(RoutePaths.appLockSetup),
                    onMyDevices: () => context.push(RoutePaths.myDevices),
                  ),
                  const SizedBox(height: 18),
                  const SettingsSectionLabel('Preferences & Help'),
                  SettingsPreferencesCard(
                    onHelp: () => context.push(RoutePaths.helpSupport),
                  ),
                  const SizedBox(height: 22),
                  SettingsSignOutTile(
                    onSignOut: () async {
                      await ref.read(authControllerProvider.notifier).logout();
                      if (context.mounted) context.go(RoutePaths.login);
                    },
                  ),
                  const SizedBox(height: 16),
                  const SettingsFooter(),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
