import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/session_cleanup.dart';
import 'package:qorix_markets_flutter/core/config/google_auth_config.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:qorix_markets_flutter/features/auth/dev/dev_auth.dart';
import 'package:qorix_markets_flutter/core/errors/exceptions.dart';
import 'package:qorix_markets_flutter/data/models/auth_response_model.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_session_provider.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/pending_auth_flow_provider.dart';
import 'package:qorix_markets_flutter/services/auth/google_sign_in_service.dart';
import 'package:qorix_markets_flutter/services/storage/secure_storage_service.dart';

final authControllerProvider =
    StateNotifierProvider<AuthController, AsyncValue<void>>((ref) {
  return AuthController(ref);
});

enum LoginRoute { success, twoFactor, verifyEmail, deviceApproval, cancelled }

class AuthController extends StateNotifier<AsyncValue<void>> {
  AuthController(this._ref) : super(const AsyncData(null));
  final Ref _ref;

  Future<LoginRoute> login(String email, String password) async {
    if (UiDemoMode.isActive) {
      await _ref.read(authSessionProvider.notifier).signInDevMock(email: email);
      state = const AsyncData(null);
      return LoginRoute.success;
    }
    state = const AsyncLoading();
    try {
      if (DevAuth.bypassEnabled) {
        await _ref.read(authSessionProvider.notifier).signInDevMock(email: email);
        SessionCleanup.onLogin(_ref.container);
        state = const AsyncData(null);
        return LoginRoute.success;
      }

      final result = await _ref.read(authRepositoryProvider).login(
            email: email,
            password: password,
          );

      if (result.requires2FA && (result.twoFactorToken?.isNotEmpty ?? false)) {
        _ref.read(pending2faTokenProvider.notifier).state = result.twoFactorToken;
        state = const AsyncData(null);
        return LoginRoute.twoFactor;
      }

      if (result.requiresVerification) {
        _ref.read(pendingVerifyEmailProvider.notifier).state = result.email ?? email;
        state = const AsyncData(null);
        return LoginRoute.verifyEmail;
      }

      if (result.requiresApproval &&
          result.attemptId != null &&
          (result.pollToken?.isNotEmpty ?? false)) {
        _ref.read(pendingLoginApprovalProvider.notifier).state = PendingLoginApproval(
          attemptId: result.attemptId!,
          pollToken: result.pollToken!,
          expiresAt: result.expiresAt,
          otpFallbackAfterMs: result.otpFallbackAfterMs,
          deviceBrowser: result.deviceBrowser,
          deviceOs: result.deviceOs,
        );
        state = const AsyncData(null);
        return LoginRoute.deviceApproval;
      }

      final auth = result.auth;
      if (auth == null || auth.accessToken.isEmpty) {
        throw ServerException(result.message ?? 'Login failed');
      }

      await _persistTokensAndSession(auth);
      state = const AsyncData(null);
      return LoginRoute.success;
    } catch (e, st) {
      state = AsyncError(e, st);
      return LoginRoute.cancelled;
    }
  }

  Future<void> _persistTokensAndSession(AuthResponseModel auth) async {
    await _ref.read(secureStorageProvider).saveTokens(
          access: auth.accessToken,
          refresh: auth.refreshToken,
        );
    await _ref.read(authSessionProvider.notifier).setAuthenticated(auth.user.toEntity());
    SessionCleanup.onLogin(_ref.container);
  }

  Future<bool> completeLoginFromToken(AuthResponseModel auth) async {
    state = const AsyncLoading();
    try {
      await _persistTokensAndSession(auth);
      _ref.read(pendingLoginApprovalProvider.notifier).state = null;
      state = const AsyncData(null);
      return true;
    } catch (e, st) {
      state = AsyncError(e, st);
      return false;
    }
  }

  Future<bool> complete2faLogin(String code) async {
    final token = _ref.read(pending2faTokenProvider);
    if (token == null || token.isEmpty) return false;
    state = const AsyncLoading();
    try {
      final user = await _ref.read(authRepositoryProvider).verify2faLogin(
            twoFactorToken: token,
            code: code,
          );
      _ref.read(pending2faTokenProvider.notifier).state = null;
      await _ref.read(authSessionProvider.notifier).setAuthenticated(user);
      SessionCleanup.onLogin(_ref.container);
      state = const AsyncData(null);
      return true;
    } catch (e, st) {
      state = AsyncError(e, st);
      return false;
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    String? fullName,
    String? referralCode,
  }) async {
    if (UiDemoMode.isActive) {
      state = const AsyncData(null);
      return true;
    }
    state = const AsyncLoading();
    try {
      await _ref.read(authRepositoryProvider).register(
            email: email,
            password: password,
            fullName: fullName,
            referralCode: referralCode,
          );

      final user = await _ref.read(authRepositoryProvider).restoreSession();
      if (user != null) {
        await _ref.read(authSessionProvider.notifier).setAuthenticated(user);
        SessionCleanup.onLogin(_ref.container);
      }

      state = const AsyncData(null);
      return true;
    } catch (e, st) {
      state = AsyncError(e, st);
      return false;
    }
  }

  Future<bool> verifyEmail({
    required String email,
    required String otp,
  }) async {
    if (UiDemoMode.isActive) {
      await _ref.read(authSessionProvider.notifier).signInDevMock(email: email);
      state = const AsyncData(null);
      return true;
    }
    state = const AsyncLoading();
    try {
      final user = await _ref.read(authRepositoryProvider).verifyEmail(
            email: email,
            otp: otp,
          );
      await _ref.read(authSessionProvider.notifier).setAuthenticated(user);
      SessionCleanup.onLogin(_ref.container);
      state = const AsyncData(null);
      return true;
    } catch (e, st) {
      state = AsyncError(e, st);
      return false;
    }
  }

  Future<void> resendVerification(String email) async {
    if (UiDemoMode.isActive) return;
    await _ref.read(authRepositoryProvider).resendVerification(email: email);
  }

  Future<bool> forgotPassword(String email) async {
    if (UiDemoMode.isActive) return true;
    state = const AsyncLoading();
    try {
      await _ref.read(authRepositoryProvider).forgotPassword(email: email);
      state = const AsyncData(null);
      return true;
    } catch (e, st) {
      state = AsyncError(e, st);
      return false;
    }
  }

  /// Returns server reset OTP on success (for confirm screen).
  Future<String?> verifyResetOtp({
    required String email,
    required String otp,
  }) async {
    if (UiDemoMode.isActive) return '000000';
    state = const AsyncLoading();
    try {
      final resetOtp = await _ref.read(authRepositoryProvider).verifyResetOtp(
            email: email,
            otp: otp,
          );
      state = const AsyncData(null);
      return resetOtp;
    } catch (e, st) {
      state = AsyncError(e, st);
      return null;
    }
  }

  Future<bool> resetPassword({
    required String email,
    required String resetOtp,
    required String newPassword,
  }) async {
    if (UiDemoMode.isActive) return true;
    state = const AsyncLoading();
    try {
      await _ref.read(authRepositoryProvider).resetPassword(
            email: email,
            resetOtp: resetOtp,
            newPassword: newPassword,
          );
      state = const AsyncData(null);
      return true;
    } catch (e, st) {
      state = AsyncError(e, st);
      return false;
    }
  }

  Future<bool> signInWithGoogle() async {
    if (UiDemoMode.isActive) {
      await _ref.read(authSessionProvider.notifier).signInDevMock();
      state = const AsyncData(null);
      return true;
    }
    state = const AsyncLoading();
    try {
      if (DevAuth.bypassEnabled) {
        await _ref.read(authSessionProvider.notifier).signInDevMock();
        SessionCleanup.onLogin(_ref.container);
        state = const AsyncData(null);
        return true;
      }

      if (!GoogleAuthConfig.isConfigured) {
        throw StateError(
          'Google Sign-In is not configured. Use --dart-define-from-file=dart_defines.json when building.',
        );
      }

      final idToken = await _ref.read(googleSignInServiceProvider).signInAndGetIdToken();
      if (idToken == null) {
        throw StateError('Google sign-in was cancelled.');
      }

      final user = await _ref.read(authRepositoryProvider).signInWithGoogle(idToken: idToken);
      await _ref.read(authSessionProvider.notifier).setAuthenticated(user);
      SessionCleanup.onLogin(_ref.container);
      state = const AsyncData(null);
      return true;
    } catch (e, st) {
      state = AsyncError(e, st);
      return false;
    }
  }

  Future<void> logout() async {
    SessionCleanup.onLogout(_ref.container);
    await _ref.read(authSessionProvider.notifier).signOut();
  }
}
