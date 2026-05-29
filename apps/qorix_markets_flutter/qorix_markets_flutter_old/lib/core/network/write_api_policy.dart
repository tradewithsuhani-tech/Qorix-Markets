import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/errors/exceptions.dart';

/// Phase 1 guard — blocks mutating HTTP calls while [UiDemoMode.readOnlyApi] is active.
abstract final class WriteApiPolicy {
  static const _readSafePrefixes = [
    '/auth/login',
    '/auth/register',
    '/auth/google/mobile',
    '/auth/forgot-password',
    '/auth/verify-reset-otp',
    '/auth/reset-password',
    '/auth/refresh',
    '/auth/verify-email-public',
    '/auth/resend-verification',
    '/auth/login-attempts',
    '/notifications/',
    '/auth/2fa/login-verify',
    '/auth/withdrawal-otp',
    '/auth/send-otp',
    '/kyc/',
    '/wallet/transfer',
    '/wallet/withdraw',
    '/wallet/withdraw/inr',
    '/wallet/payout-methods',
    '/deposit/inr/',
    '/payment-methods',
    '/inr-deposits',
    '/inr-withdrawals',
    '/investment/',
    '/auth/change-password',
    '/auth/sessions',
    '/support/',
    '/chat/',
    '/security/',
    '/p2p/',
    '/markets/orders',
    '/broker/',
  ];

  static void guardMutation(String path) {
    if (path.startsWith('/wallet/deposit')) {
      throw WriteApiBlockedException(
        'Self-credit wallet deposit is disabled. Use INR or blockchain deposit.',
      );
    }
    if (!UiDemoMode.blocksWriteApi) return;
    if (_isAuthBootstrap(path)) return;
    throw WriteApiBlockedException(
      'Write API blocked in read-only integration mode: $path',
    );
  }

  static bool _isAuthBootstrap(String path) {
    for (final prefix in _readSafePrefixes) {
      if (path.startsWith(prefix)) return true;
    }
    return false;
  }
}
