import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/live_desk_hub.dart';
import 'package:qorix_markets_flutter/core/security/session_guard.dart';
import 'package:qorix_markets_flutter/features/bots/application/bots_providers.dart';
import 'package:qorix_markets_flutter/features/dashboard/application/dashboard_providers.dart';
import 'package:qorix_markets_flutter/features/invest/application/investment_providers.dart';
import 'package:qorix_markets_flutter/features/market/application/markets_read_providers.dart';
import 'package:qorix_markets_flutter/features/market/presentation/providers/market_providers.dart';
import 'package:qorix_markets_flutter/features/notifications/application/notification_providers.dart';
import 'package:qorix_markets_flutter/features/profile/application/profile_providers.dart';
import 'package:qorix_markets_flutter/features/referral/application/referral_providers.dart';
import 'package:qorix_markets_flutter/features/wallet/application/wallet_providers.dart';

/// Central logout / session-expire cleanup — stops hubs and clears live caches.
abstract final class SessionCleanup {
  static void onLogout(ProviderContainer container) {
    container.read(sessionExpiredProvider.notifier).dismiss();
    container.read(liveDeskHubProvider.notifier).stop();
    _invalidateLiveData(container);
  }

  static void onLogin(ProviderContainer container) {
    container.read(sessionExpiredProvider.notifier).dismiss();
    _invalidateLiveData(container);
  }

  static void _invalidateLiveData(ProviderContainer container) {
    container.invalidate(dashboardProvider);
    container.invalidate(walletProvider);
    container.invalidate(transactionsProvider);
    container.invalidate(historyTransactionsProvider);
    container.invalidate(notificationsProvider);
    container.invalidate(investmentProvider);
    container.invalidate(referralProvider);
    container.invalidate(profileUserProvider);
    container.invalidate(botsListProvider);
    container.invalidate(botsPerformanceProvider);
    container.invalidate(marketsOrderBookProvider);
    container.invalidate(marketStreamProvider);
  }
}
