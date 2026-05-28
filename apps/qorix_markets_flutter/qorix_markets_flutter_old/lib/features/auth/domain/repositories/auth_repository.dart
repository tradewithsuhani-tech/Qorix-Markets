import 'package:qorix_markets_flutter/data/models/login_attempt_status_model.dart';
import 'package:qorix_markets_flutter/data/models/login_result_model.dart';
import 'package:qorix_markets_flutter/data/models/pending_login_attempt_item_model.dart';
import 'package:qorix_markets_flutter/features/auth/domain/entities/user_entity.dart';

abstract interface class AuthRepository {
  Future<LoginResultModel> login({required String email, required String password});

  Future<UserEntity> verify2faLogin({
    required String twoFactorToken,
    required String code,
  });

  Future<LoginAttemptStatusModel> pollLoginAttemptStatus({
    required int attemptId,
    required String pollToken,
  });

  Future<void> requestLoginAttemptOtp({
    required int attemptId,
    required String pollToken,
  });

  Future<UserEntity> verifyLoginAttemptOtp({
    required int attemptId,
    required String pollToken,
    required String otp,
  });

  /// Signed-in device — pending logins from other devices.
  Future<List<PendingLoginAttemptItemModel>> fetchPendingLoginAttempts();

  /// Signed-in device — `decision` is `approve` or `deny`.
  Future<void> respondToLoginAttempt({
    required int attemptId,
    required String decision,
  });

  /// Creates account — returns email for OTP step when verification is required.
  Future<String> register({
    required String email,
    required String password,
    String? fullName,
    String? referralCode,
  });

  Future<UserEntity> verifyEmail({
    required String email,
    required String otp,
  });

  Future<void> resendVerification({required String email});

  Future<void> forgotPassword({required String email});

  /// Validates email OTP; returns server OTP required for [resetPassword].
  Future<String> verifyResetOtp({required String email, required String otp});

  Future<void> resetPassword({
    required String email,
    required String resetOtp,
    required String newPassword,
  });

  Future<UserEntity> signInWithGoogle({required String idToken});

  Future<UserEntity?> restoreSession();

  Future<void> logout();
}
