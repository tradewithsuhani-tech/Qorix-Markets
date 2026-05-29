/// Auth bootstrap — POST /api/auth/*` ([EnvConfig.authApiBaseUrl]).
/// Legacy reads — GET /api/dashboard/*` ([EnvConfig.legacyApiBaseUrl]).
/// V1 reads — GET /api/v1/*` ([EnvConfig.apiBaseUrl]).
abstract final class ApiEndpoints {
  // Health & public
  static const String health = '/healthz';
  static const String marketIndicators = '/public/market-indicators';

  // Auth bootstrap — POST /api/auth/*
  static const String register = '/auth/register';
  static const String login = '/auth/login';
  static const String authGoogle = '/auth/google';
  static const String authGoogleMobile = '/auth/google/mobile';
  static const String forgotPassword = '/auth/forgot-password';
  static const String verifyResetOtp = '/auth/verify-reset-otp';
  static const String resetPassword = '/auth/reset-password';
  static const String me = '/auth/me';
  static const String authChangePassword = '/auth/change-password';
  static const String authChangePasswordSendOtp = '/auth/change-password/send-otp';
  static const String authSecurityStatus = '/auth/security-status';
  static const String authRefresh = '/auth/refresh';
  static const String verifyEmailPublic = '/auth/verify-email-public';
  static const String verifyEmail = '/auth/verify-email';
  static const String resendVerification = '/auth/resend-verification';
  static const String twoFactorLoginVerify = '/auth/2fa/login-verify';
  static const String twoFactorEmailFallbackRequest = '/auth/2fa/email-fallback/request';
  static const String authSessions = '/auth/sessions';
  static String authSession(String id) => '/auth/sessions/$id';
  static const String authSessionsOthers = '/auth/sessions/others';
  static const String withdrawalOtp = '/auth/withdrawal-otp';
  static const String authSyncDevice = '/auth/sync-device';

  // Security — /api/security/*
  static const String security2faStatus = '/security/2fa/status';
  static const String security2faSetup = '/security/2fa/setup';
  static const String security2faVerifySetup = '/security/2fa/verify-setup';
  static const String security2faDisable = '/security/2fa/disable';

  // Devices — /api/devices
  static const String devices = '/devices';

  // Single-active-device login approval (unauthenticated, pollToken-gated)
  static String loginAttemptStatus(int attemptId) =>
      '/auth/login-attempts/$attemptId/status';
  static String loginAttemptRequestOtp(int attemptId) =>
      '/auth/login-attempts/$attemptId/request-otp';
  static String loginAttemptVerifyOtp(int attemptId) =>
      '/auth/login-attempts/$attemptId/verify-otp';

  /// Active device — poll pending logins from other devices.
  static const String loginAttemptsPending = '/auth/login-attempts/pending';

  /// Active device — approve or deny (`decision`: approve | deny).
  static String loginAttemptRespond(int attemptId) =>
      '/auth/login-attempts/$attemptId/respond';

  // User profile (read)
  static const String userProfile = '/user/profile';

  // Portfolio (read)
  static const String portfolioSummary = '/portfolio/summary';
  static const String dashboardSummary = '/dashboard/summary';
  static const String profitHistory = '/profit/history';
  static const String dashboardEquityChart = '/dashboard/equity-chart';
  static const String dashboardFundStats = '/dashboard/fund-stats';

  // Wallet (read)
  static const String walletBalance = '/wallet/balance';
  static const String walletHistory = '/wallet/history';
  static const String walletPayoutMethods = '/wallet/payout-methods';
  static String walletPayoutMethod(int id) => '/wallet/payout-methods/$id';
  static String walletPayoutMethodDefault(int id) => '/wallet/payout-methods/$id/default';

  // Wallet writes — Phase 2 (guarded in read-only mode)
  static const String walletDeposit = '/wallet/deposit';
  static const String walletWithdraw = '/wallet/withdraw';
  static const String walletTransfer = '/wallet/transfer';
  static const String walletWithdrawInr = '/wallet/withdraw/inr';

  // INR deposit
  static const String depositInrSubmit = '/deposit/inr/submit';
  static const String depositInrMerchants = '/deposit/inr/merchants';
  /// Legacy web endpoint — live on prod before mobile-api aliases shipped.
  static const String paymentMethods = '/payment-methods';
  static const String inrDeposits = '/inr-deposits';
  static const String inrWithdrawals = '/inr-withdrawals';
  static const String withdrawalLimits = '/withdrawal-limits';

  // Blockchain deposit
  static const String depositAddress = '/deposit/address';
  static const String depositHistory = '/deposit/history';
  static const String inrRate = '/inr-rate';

  // Markets (read + spot orders)
  static const String marketsTicker = '/markets/ticker';
  static const String marketsOrderbook = '/markets/orderbook';
  static const String marketsBalance = '/markets/balance';
  static const String marketsOrders = '/markets/orders';
  static const String marketsCalendar = '/markets/calendar';
  static String marketsOrder(String id) => '/markets/orders/$id';

  // Bots (read)
  static const String botsList = '/bots/list';
  static const String botsPerformance = '/bots/performance';

  // Bot terminal — live quotes + auth state (matches web BotTerminalCard)
  static const String botTradingQuotes = '/bot-trading/quotes';
  static const String botTradingState = '/bot-trading/state';

  // Investment writes — Phase 2
  static const String investment = '/investment';
  static const String investmentStart = '/investment/start';
  static const String investmentStop = '/investment/stop';
  static const String investmentProtection = '/investment/protection';
  static const String investmentCompounding = '/investment/compounding';
  static const String investmentTrades = '/investment/trades';
  static const String investmentTopup = '/investment/topup';
  static const String investmentRiskLevel = '/investment/risk-level';

  // Legacy market activity (fallback)
  static const String trades = '/trades';

  // Referral
  static const String referral = '/referral';
  static const String referralReferredUsers = '/referral/referred-users';

  // Notifications — /api/notifications/*
  static const String notifications = '/notifications';
  static const String notificationsReadAll = '/notifications/read-all';
  static String notificationRead(int id) => '/notifications/$id/read';

  // KYC — POST/GET /api/kyc/*
  static const String kycStatus = '/kyc/status';
  static const String kycPersonal = '/kyc/personal';
  static const String kycPhoneSendOtp = '/kyc/phone/send-otp';
  static const String kycPhoneVerifyOtp = '/kyc/phone/verify-otp';
  static const String kycSubmit = '/kyc/submit';
  static const String kycAddress = '/kyc/address';

  // P2P — /api/p2p/*
  static const String p2pWallet = '/p2p/wallet';
  static const String p2pWalletFund = '/p2p/wallet/fund';
  static const String p2pWalletWithdraw = '/p2p/wallet/withdraw';
  static const String p2pPaymentMethods = '/p2p/payment-methods';
  static String p2pPaymentMethod(int id) => '/p2p/payment-methods/$id';
  static const String p2pAds = '/p2p/ads';
  static const String p2pAdsMy = '/p2p/ads/my';
  static String p2pAd(int id) => '/p2p/ads/$id';
  static String p2pAdToggle(int id) => '/p2p/ads/$id/toggle';
  static const String p2pOrders = '/p2p/orders';
  static const String p2pOrdersMy = '/p2p/orders/my';
  static String p2pOrder(int id) => '/p2p/orders/$id';
  static String p2pOrderPaid(int id) => '/p2p/orders/$id/paid';
  static String p2pOrderConfirm(int id) => '/p2p/orders/$id/confirm';
  static String p2pOrderCancel(int id) => '/p2p/orders/$id/cancel';
  static String p2pOrderDispute(int id) => '/p2p/orders/$id/dispute';
  static String p2pOrderMessages(int id) => '/p2p/orders/$id/messages';
  static String p2pOrderStreamToken(int id) => '/p2p/orders/$id/stream-token';
  static String p2pOrderStream(int id) => '/p2p/orders/$id/stream';
  static String p2pOrderRating(int id) => '/p2p/orders/$id/rate';
  static String p2pOrderMyRating(int id) => '/p2p/orders/$id/myrating';
  static String p2pUserProfile(int id) => '/p2p/users/$id/profile';

  // Support — read via v1, writes via /api
  static const String supportFaqs = '/support/faqs';
  static const String supportTickets = '/support/tickets';
  static String supportTicketDetail(String ticketId) => '/support/tickets/$ticketId';

  // Live chat — /api/chat/*
  static const String chatSession = '/chat/session';
  static String chatSessionMessages(int id) => '/chat/session/$id/messages';
  static String chatSessionEnd(int id) => '/chat/session/$id/end';
  static const String chatMessage = '/chat/message';
  static const String chatBotMessage = '/chat/bot-message';
  static const String chatExpert = '/chat/expert';

  // Broker — Zerodha live + demo trading (Phase 1 read + simulated writes)
  static const String brokerStatus = '/broker/status';
  static const String brokerMode = '/broker/mode';
  static const String brokerProfile = '/broker/profile';
  static const String brokerHoldings = '/broker/holdings';
  static const String brokerPositions = '/broker/positions';
  static const String brokerFunds = '/broker/funds';
  static const String brokerQuotes = '/broker/quotes';
  static const String brokerZerodhaLoginUrl = '/broker/zerodha/login-url';
  static const String brokerZerodhaSession = '/broker/zerodha/session';
  static const String brokerZerodhaDisconnect = '/broker/zerodha/disconnect';
  static const String brokerDemoPortfolio = '/broker/demo/portfolio';
  static const String brokerDemoOrder = '/broker/demo/order';
  static const String brokerDemoReset = '/broker/demo/reset';
}
