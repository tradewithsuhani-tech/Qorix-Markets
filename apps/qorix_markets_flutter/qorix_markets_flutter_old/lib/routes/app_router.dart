import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/motion/page_transitions.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_session_expiry_sync.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_session_provider.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/screens/forgot_password_screen.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/screens/login_approval_screen.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/screens/login_screen.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/screens/login_two_factor_screen.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/screens/otp_verification_screen.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/screens/register_screen.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/screens/reset_password_confirm_screen.dart';
import 'package:qorix_markets_flutter/features/earn/presentation/screens/earn_screen.dart';
import 'package:qorix_markets_flutter/features/market/presentation/screens/market_insights_screen.dart';
import 'package:qorix_markets_flutter/features/market/presentation/screens/markets_screen.dart';
import 'package:qorix_markets_flutter/features/market/presentation/screens/p2p_order_detail_screen.dart';
import 'package:qorix_markets_flutter/features/market/presentation/screens/p2p_orders_screen.dart';
import 'package:qorix_markets_flutter/features/market/presentation/screens/p2p_post_ad_screen.dart';
import 'package:qorix_markets_flutter/features/market/presentation/screens/p2p_trade_screen.dart';
import 'package:qorix_markets_flutter/features/market/presentation/screens/p2p_user_center_screen.dart';
import 'package:qorix_markets_flutter/features/home/presentation/screens/bot_setup_screen.dart';
import 'package:qorix_markets_flutter/features/home/presentation/screens/deploy_capital_screen.dart';
import 'package:qorix_markets_flutter/features/home/presentation/screens/deploy_receipt_screen.dart';
import 'package:qorix_markets_flutter/features/home/presentation/screens/your_bots_screen.dart';
import 'package:qorix_markets_flutter/features/home/presentation/screens/home_screen.dart';
import 'package:qorix_markets_flutter/features/invest/presentation/screens/ai_activity_screen.dart';
import 'package:qorix_markets_flutter/features/invest/presentation/screens/invest_screen.dart';
import 'package:qorix_markets_flutter/features/invest/presentation/screens/protection_system_screen.dart';
import 'package:qorix_markets_flutter/features/invest/presentation/screens/strategy_detail_screen.dart';
import 'package:qorix_markets_flutter/features/kyc/presentation/screens/kyc_screen.dart';
import 'package:qorix_markets_flutter/features/kyc/presentation/screens/kyc_verification_flow_screen.dart';
import 'package:qorix_markets_flutter/features/onboarding/presentation/providers/onboarding_provider.dart';
import 'package:qorix_markets_flutter/features/onboarding/presentation/screens/onboarding_screen.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/screens/manage_plan_screen.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/screens/portfolio_screen.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/screens/profit_history_screen.dart';
import 'package:qorix_markets_flutter/features/profile/presentation/screens/change_password_screen.dart';
import 'package:qorix_markets_flutter/features/profile/presentation/screens/my_devices_screen.dart';
import 'package:qorix_markets_flutter/features/support/presentation/screens/help_support_screen.dart';
import 'package:qorix_markets_flutter/features/support/presentation/screens/support_chat_screen.dart';
import 'package:qorix_markets_flutter/features/profile/presentation/screens/profile_screen.dart';
import 'package:qorix_markets_flutter/features/profile/presentation/screens/two_factor_auth_screen.dart';
import 'package:qorix_markets_flutter/features/referral/presentation/screens/referral_screen.dart';
import 'package:qorix_markets_flutter/features/security/presentation/screens/app_lock_setup_screen.dart';
import 'package:qorix_markets_flutter/features/vip/presentation/screens/vip_screen.dart';
import 'package:qorix_markets_flutter/features/splash/presentation/screens/splash_screen.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/screens/inr_payout_methods_screen.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/screens/deposit_screen.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/screens/history_screen.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/screens/wallet_screen.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/screens/withdrawal_screen.dart';
import 'package:qorix_markets_flutter/routes/root_navigator.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/widgets/main_shell.dart';

/// Re-run [GoRouter.redirect] without recreating the router (avoids route reset).
final class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(this._ref) {
    _ref.listen(authSessionProvider, (_, __) => notifyListeners());
    _ref.listen(onboardingCompleteProvider, (_, __) => notifyListeners());
  }

  final Ref _ref;
}

final appRouterProvider = Provider<GoRouter>((ref) {
  ref.watch(authSessionExpirySyncProvider);
  final refresh = _RouterRefresh(ref);
  ref.onDispose(refresh.dispose);

  final router = GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: RoutePaths.splash,
    refreshListenable: refresh,
    redirect: (context, state) {
      final loc = state.matchedLocation;

      if (loc == RoutePaths.market) return RoutePaths.markets;

      // UI demo: free navigation — never kick user off login/register.
      if (UiDemoMode.isActive) return null;

      final auth = ref.read(authSessionProvider);
      final onboardingAsync = ref.read(onboardingCompleteProvider);

      final isSplash = loc == RoutePaths.splash;
      final isOnboarding = loc == RoutePaths.onboarding;
      final isAuth = loc == RoutePaths.login ||
          loc == RoutePaths.loginApproval ||
          loc == RoutePaths.loginTwoFactor ||
          loc == RoutePaths.register ||
          loc == RoutePaths.forgotPassword ||
          loc == RoutePaths.resetPasswordConfirm ||
          loc == RoutePaths.otp;

      if (auth.isLoading || isSplash) return null;

      if (!auth.isAuthenticated) {
        if (onboardingAsync.isLoading) return null;
        final onboardingDone = onboardingAsync.valueOrNull ?? false;
        if (!onboardingDone && !isOnboarding && !isAuth) {
          return RoutePaths.onboarding;
        }
        if (!isAuth && !isOnboarding) return RoutePaths.login;
      }
      if (auth.isAuthenticated && isAuth) return RoutePaths.home;
      return null;
    },
    routes: [
      GoRoute(
        path: RoutePaths.splash,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const SplashScreen(), fadeOnly: true),
      ),
      GoRoute(
        path: RoutePaths.onboarding,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const OnboardingScreen()),
      ),
      GoRoute(
        path: RoutePaths.login,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const LoginScreen(), fadeOnly: true),
      ),
      GoRoute(
        path: RoutePaths.loginApproval,
        pageBuilder: (_, s) => cinematicPage(
          key: s.pageKey,
          child: const LoginApprovalScreen(),
          fadeOnly: true,
        ),
      ),
      GoRoute(
        path: RoutePaths.loginTwoFactor,
        pageBuilder: (_, s) => cinematicPage(
          key: s.pageKey,
          child: const LoginTwoFactorScreen(),
          fadeOnly: true,
        ),
      ),
      GoRoute(
        path: RoutePaths.register,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const RegisterScreen(), fadeOnly: true),
      ),
      GoRoute(
        path: RoutePaths.forgotPassword,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const ForgotPasswordScreen(), fadeOnly: true),
      ),
      GoRoute(
        path: RoutePaths.resetPasswordConfirm,
        pageBuilder: (_, s) {
          final extra = s.extra;
          String email = s.uri.queryParameters['email']?.trim() ?? '';
          String resetOtp = s.uri.queryParameters['resetOtp']?.trim() ?? '';
          if (extra is Map) {
            email = (extra['email'] as String?)?.trim() ?? email;
            resetOtp = (extra['resetOtp'] as String?)?.trim() ?? resetOtp;
          }
          if (email.isEmpty || resetOtp.isEmpty) {
            return cinematicPage(
              key: s.pageKey,
              child: const ForgotPasswordScreen(),
              fadeOnly: true,
            );
          }
          return cinematicPage(
            key: s.pageKey,
            child: ResetPasswordConfirmScreen(email: email, resetOtp: resetOtp),
            fadeOnly: true,
          );
        },
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, __, navigationShell) => MainShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.home,
                pageBuilder: (_, s) => shellTabPage(key: s.pageKey, child: const HomeScreen()),
              ),
              GoRoute(
                path: RoutePaths.markets,
                pageBuilder: (_, s) => shellTabPage(key: s.pageKey, child: const MarketsScreen()),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.wallet,
                pageBuilder: (_, s) => shellTabPage(key: s.pageKey, child: const WalletScreen()),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.botSetup,
                pageBuilder: (_, s) => shellTabPage(key: s.pageKey, child: const YourBotsScreen()),
              ),
              GoRoute(
                path: RoutePaths.invest,
                pageBuilder: (_, s) => shellTabPage(key: s.pageKey, child: const InvestScreen()),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.portfolio,
                pageBuilder: (_, s) => shellTabPage(key: s.pageKey, child: const PortfolioScreen()),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.profile,
                pageBuilder: (_, s) => shellTabPage(key: s.pageKey, child: const ProfileScreen()),
              ),
              GoRoute(
                path: RoutePaths.earn,
                pageBuilder: (_, s) => shellTabPage(key: s.pageKey, child: const EarnScreen()),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: RoutePaths.deposit,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => slideUpPage(key: s.pageKey, child: const DepositScreen()),
      ),
      GoRoute(
        path: RoutePaths.withdraw,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => slideUpPage(key: s.pageKey, child: const WithdrawalScreen()),
      ),
      GoRoute(
        path: RoutePaths.deployCapital,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => slideUpPage(
          key: s.pageKey,
          child: DeployCapitalScreen(botId: s.uri.queryParameters['bot'] ?? 'arbitrage'),
        ),
      ),
      GoRoute(
        path: RoutePaths.deployReceipt,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => slideUpPage(
          key: s.pageKey,
          child: DeployReceiptScreen(
            botId: s.uri.queryParameters['bot'] ?? 'arbitrage',
            amountInr: double.tryParse(s.uri.queryParameters['amount'] ?? '') ?? 0,
          ),
        ),
      ),
      GoRoute(
        path: RoutePaths.botSetupWizard,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => slideUpPage(key: s.pageKey, child: const BotSetupScreen()),
      ),
      GoRoute(
        path: RoutePaths.kyc,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const KycScreen()),
      ),
      GoRoute(
        path: RoutePaths.kycFlow,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) {
          final step = int.tryParse(s.uri.queryParameters['step'] ?? '');
          return cinematicPage(
            key: s.pageKey,
            child: KycVerificationFlowScreen(initialStep: step),
          );
        },
      ),
      GoRoute(
        path: RoutePaths.otp,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) {
          final email = s.uri.queryParameters['email']?.trim();
          if (email == null || email.isEmpty) {
            return cinematicPage(
              key: s.pageKey,
              child: const RegisterScreen(),
              fadeOnly: true,
            );
          }
          return cinematicPage(
            key: s.pageKey,
            child: OtpVerificationScreen(
              email: email,
              isPasswordReset: s.uri.queryParameters['flow'] == 'reset',
            ),
          );
        },
      ),
      GoRoute(
        path: RoutePaths.referral,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const ReferralScreen()),
      ),
      GoRoute(
        path: RoutePaths.strategyDetail,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(
          key: s.pageKey,
          child: StrategyDetailScreen(profileId: s.uri.queryParameters['id'] ?? 'MEDIUM'),
        ),
      ),
      GoRoute(
        path: RoutePaths.profitHistory,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const ProfitHistoryScreen()),
      ),
      GoRoute(
        path: RoutePaths.managePlan,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => slideUpPage(key: s.pageKey, child: const ManagePlanScreen()),
      ),
      GoRoute(
        path: RoutePaths.protection,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const ProtectionSystemScreen()),
      ),
      GoRoute(
        path: RoutePaths.aiActivity,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const AiActivityScreen()),
      ),
      GoRoute(
        path: RoutePaths.vip,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const VipScreen()),
      ),
      GoRoute(
        path: RoutePaths.p2p,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const P2pTradeScreen()),
      ),
      GoRoute(
        path: RoutePaths.p2pOrders,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const P2pOrdersScreen()),
      ),
      GoRoute(
        path: RoutePaths.p2pOrder,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(
          key: s.pageKey,
          child: P2pOrderDetailScreen(orderId: s.uri.queryParameters['id'] ?? ''),
        ),
      ),
      GoRoute(
        path: RoutePaths.p2pUserCenter,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const P2pUserCenterScreen()),
      ),
      GoRoute(
        path: RoutePaths.p2pPostAd,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const P2pPostAdScreen()),
      ),
      GoRoute(
        path: RoutePaths.marketInsights,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const MarketInsightsScreen()),
      ),
      GoRoute(
        path: RoutePaths.changePassword,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const ChangePasswordScreen()),
      ),
      GoRoute(
        path: RoutePaths.twoFactorAuth,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const TwoFactorAuthScreen()),
      ),
      GoRoute(
        path: RoutePaths.myDevices,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const MyDevicesScreen()),
      ),
      GoRoute(
        path: RoutePaths.appLockSetup,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const AppLockSetupScreen()),
      ),
      GoRoute(
        path: RoutePaths.history,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const HistoryScreen()),
      ),
      GoRoute(
        path: RoutePaths.inrPayoutMethods,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const InrPayoutMethodsScreen()),
      ),
      GoRoute(
        path: RoutePaths.helpSupport,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const HelpSupportScreen()),
      ),
      GoRoute(
        path: RoutePaths.supportChat,
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (_, s) => cinematicPage(key: s.pageKey, child: const SupportChatScreen()),
      ),
      GoRoute(
        path: RoutePaths.market,
        redirect: (_, __) => RoutePaths.invest,
      ),
    ],
  );

  ref.onDispose(router.dispose);
  return router;
});
