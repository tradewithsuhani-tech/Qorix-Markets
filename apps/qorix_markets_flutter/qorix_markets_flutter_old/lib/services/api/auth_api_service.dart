import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/auth_response_model.dart';
import 'package:qorix_markets_flutter/data/models/login_attempt_status_model.dart';
import 'package:qorix_markets_flutter/data/models/login_result_model.dart';
import 'package:qorix_markets_flutter/data/models/pending_login_attempt_item_model.dart';
import 'package:qorix_markets_flutter/data/models/register_response_model.dart';
import 'package:qorix_markets_flutter/data/models/user_model.dart';

final authApiServiceProvider = Provider<AuthApiService>((ref) {
  return AuthApiService(
    ref.watch(authApiClientProvider),
    ref.watch(legacyApiClientProvider),
  );
});

class AuthApiService {
  const AuthApiService(this._v1, this._legacy);
  final ApiClient _v1;
  final ApiClient _legacy;

  /// Legacy login — supports 2FA challenge, email verify, device approval.
  Future<LoginResultModel> login({
    required String email,
    required String password,
  }) async {
    final res = await _legacy.post<Map<String, dynamic>>(
      ApiEndpoints.login,
      data: {'email': email, 'password': password},
    );
    return LoginResultModel.fromJson(ApiJson.object(res.data));
  }

  Future<LoginResultModel> verify2faLogin({
    required String twoFactorToken,
    required String code,
  }) async {
    final res = await _legacy.post<Map<String, dynamic>>(
      ApiEndpoints.twoFactorLoginVerify,
      data: {'twoFactorToken': twoFactorToken, 'code': code.trim()},
    );
    return LoginResultModel.fromJson(ApiJson.object(res.data));
  }

  Future<RegisterResponseModel> register({
    required String email,
    required String password,
    required String fullName,
    String? referralCode,
  }) async {
    final res = await _v1.post<Map<String, dynamic>>(
      ApiEndpoints.register,
      data: {
        'email': email,
        'password': password,
        'fullName': fullName,
        if (referralCode != null && referralCode.isNotEmpty) 'referralCode': referralCode,
      },
    );
    return RegisterResponseModel.fromJson(res.data ?? {});
  }

  Future<AuthResponseModel> verifyEmail({
    required String email,
    required String otp,
  }) async {
    final res = await _v1.post<Map<String, dynamic>>(
      ApiEndpoints.verifyEmail,
      data: {'email': email, 'otp': otp},
    );
    return AuthResponseModel.fromJson(ApiJson.object(res.data));
  }

  Future<void> resendVerification({required String email}) async {
    await _v1.post(
      ApiEndpoints.resendVerification,
      data: {'email': email},
    );
  }

  Future<AuthResponseModel> refresh({required String refreshToken}) async {
    final res = await _v1.post<Map<String, dynamic>>(
      ApiEndpoints.authRefresh,
      data: {'refreshToken': refreshToken},
    );
    return AuthResponseModel.fromJson(ApiJson.object(res.data));
  }

  Future<UserModel> getCurrentUser() async {
    final res = await _v1.get<Map<String, dynamic>>(ApiEndpoints.me);
    return UserModel.fromJson(ApiJson.object(res.data));
  }

  Future<void> requestWithdrawalOtp() async {
    await _legacy.post(ApiEndpoints.withdrawalOtp);
  }

  /// POST /api/auth/forgot-password — always generic success.
  Future<void> forgotPassword({required String email}) async {
    await _legacy.post(
      ApiEndpoints.forgotPassword,
      data: {'email': email.trim().toLowerCase()},
    );
  }

  /// POST /api/auth/verify-reset-otp — returns server-issued OTP for reset step.
  Future<String> verifyResetOtp({
    required String email,
    required String otp,
  }) async {
    final res = await _legacy.post<Map<String, dynamic>>(
      ApiEndpoints.verifyResetOtp,
      data: {
        'email': email.trim().toLowerCase(),
        'otp': otp.trim(),
      },
    );
    final root = ApiJson.object(res.data);
    final resetOtp = root['otp'] as String? ?? '';
    if (resetOtp.isEmpty) {
      throw StateError('Invalid reset verification response');
    }
    return resetOtp;
  }

  /// POST /api/auth/reset-password
  Future<void> resetPassword({
    required String email,
    required String resetOtp,
    required String newPassword,
  }) async {
    await _legacy.post(
      ApiEndpoints.resetPassword,
      data: {
        'email': email.trim().toLowerCase(),
        'otp': resetOtp,
        'newPassword': newPassword,
      },
    );
  }

  /// GET /api/auth/login-attempts/:id/status — unauthenticated, pollToken query.
  Future<LoginAttemptStatusModel> pollLoginAttemptStatus({
    required int attemptId,
    required String pollToken,
  }) async {
    final res = await _legacy.get<Map<String, dynamic>>(
      ApiEndpoints.loginAttemptStatus(attemptId),
      queryParameters: {'pollToken': pollToken},
    );
    return LoginAttemptStatusModel.fromJson(ApiJson.object(res.data));
  }

  Future<void> requestLoginAttemptOtp({
    required int attemptId,
    required String pollToken,
  }) async {
    await _legacy.post(
      ApiEndpoints.loginAttemptRequestOtp(attemptId),
      data: {'pollToken': pollToken},
    );
  }

  Future<AuthResponseModel> verifyLoginAttemptOtp({
    required int attemptId,
    required String pollToken,
    required String otp,
  }) async {
    final res = await _legacy.post<Map<String, dynamic>>(
      ApiEndpoints.loginAttemptVerifyOtp(attemptId),
      data: {'pollToken': pollToken, 'otp': otp.trim()},
    );
    return AuthResponseModel.fromJson(ApiJson.object(res.data));
  }

  /// GET /api/auth/login-attempts/pending — signed-in device only.
  Future<List<PendingLoginAttemptItemModel>> fetchPendingLoginAttempts() async {
    final res = await _legacy.get<Map<String, dynamic>>(ApiEndpoints.loginAttemptsPending);
    final root = ApiJson.object(res.data);
    final raw = root['attempts'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => PendingLoginAttemptItemModel.fromJson(Map<String, dynamic>.from(e)))
        .where((a) => a.id > 0)
        .toList();
  }

  /// POST /api/auth/login-attempts/:id/respond — decision: approve | deny.
  Future<void> respondToLoginAttempt({
    required int attemptId,
    required String decision,
  }) async {
    await _legacy.post(
      ApiEndpoints.loginAttemptRespond(attemptId),
      data: {'decision': decision},
    );
  }

  /// POST /api/auth/google/mobile — returns JWT + user (token field).
  Future<AuthResponseModel> signInWithGoogle({required String idToken}) async {
    final res = await _legacy.post<Map<String, dynamic>>(
      ApiEndpoints.authGoogleMobile,
      data: {'idToken': idToken},
    );
    return AuthResponseModel.fromJson(ApiJson.object(res.data));
  }
}
