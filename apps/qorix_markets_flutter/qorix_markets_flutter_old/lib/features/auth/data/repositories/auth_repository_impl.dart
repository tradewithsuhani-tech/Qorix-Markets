import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/errors/exceptions.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/auth_response_model.dart';
import 'package:qorix_markets_flutter/data/models/login_attempt_status_model.dart';
import 'package:qorix_markets_flutter/data/models/login_result_model.dart';
import 'package:qorix_markets_flutter/data/models/pending_login_attempt_item_model.dart';
import 'package:qorix_markets_flutter/features/auth/domain/entities/user_entity.dart';
import 'package:qorix_markets_flutter/features/auth/domain/repositories/auth_repository.dart';
import 'package:qorix_markets_flutter/features/profile/domain/repositories/profile_repository.dart';
import 'package:qorix_markets_flutter/features/profile/infrastructure/profile_repository_impl.dart';
import 'package:qorix_markets_flutter/services/api/auth_api_service.dart';
import 'package:qorix_markets_flutter/services/storage/secure_storage_service.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(
    ref.watch(authApiServiceProvider),
    ref.watch(secureStorageProvider),
    ref.watch(profileRepositoryProvider),
  );
});

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._api, this._storage, this._profile);

  final AuthApiService _api;
  final SecureStorageService _storage;
  final ProfileRepository _profile;

  @override
  Future<LoginResultModel> login({
    required String email,
    required String password,
  }) async {
    try {
      return await _api.login(email: email, password: password);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<UserEntity> verify2faLogin({
    required String twoFactorToken,
    required String code,
  }) async {
    try {
      final response = await _api.verify2faLogin(
        twoFactorToken: twoFactorToken,
        code: code,
      );
      final auth = response.auth;
      if (auth == null || auth.accessToken.isEmpty) {
        throw const ServerException('Invalid 2FA login response');
      }
      await _storage.saveTokens(
        access: auth.accessToken,
        refresh: auth.refreshToken,
      );
      return auth.user.toEntity();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<LoginAttemptStatusModel> pollLoginAttemptStatus({
    required int attemptId,
    required String pollToken,
  }) async {
    try {
      return await _api.pollLoginAttemptStatus(
        attemptId: attemptId,
        pollToken: pollToken,
      );
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> requestLoginAttemptOtp({
    required int attemptId,
    required String pollToken,
  }) async {
    try {
      await _api.requestLoginAttemptOtp(
        attemptId: attemptId,
        pollToken: pollToken,
      );
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<List<PendingLoginAttemptItemModel>> fetchPendingLoginAttempts() async {
    try {
      return await _api.fetchPendingLoginAttempts();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> respondToLoginAttempt({
    required int attemptId,
    required String decision,
  }) async {
    try {
      await _api.respondToLoginAttempt(attemptId: attemptId, decision: decision);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<UserEntity> verifyLoginAttemptOtp({
    required int attemptId,
    required String pollToken,
    required String otp,
  }) async {
    try {
      final auth = await _api.verifyLoginAttemptOtp(
        attemptId: attemptId,
        pollToken: pollToken,
        otp: otp,
      );
      if (auth.accessToken.isEmpty) {
        throw const ServerException('Invalid approval OTP response');
      }
      await _storage.saveTokens(
        access: auth.accessToken,
        refresh: auth.refreshToken,
      );
      return auth.user.toEntity();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<String> register({
    required String email,
    required String password,
    String? fullName,
    String? referralCode,
  }) async {
    if (fullName == null || fullName.isEmpty) {
      throw const ValidationException('Full name is required');
    }
    try {
      final response = await _api.register(
        email: email,
        password: password,
        fullName: fullName,
        referralCode: referralCode,
      );

      final auth = response.auth;
      if (auth != null && auth.accessToken.isNotEmpty) {
        await _storage.saveTokens(
          access: auth.accessToken,
          refresh: auth.refreshToken,
        );
      }

      if (response.email.isNotEmpty) return response.email;
      return email;
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<UserEntity> verifyEmail({
    required String email,
    required String otp,
  }) async {
    try {
      final response = await _api.verifyEmail(email: email, otp: otp);
      if (response.accessToken.isEmpty) {
        throw const ServerException('Invalid verification response');
      }
      await _storage.saveTokens(
        access: response.accessToken,
        refresh: response.refreshToken,
      );
      return response.user.toEntity();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> resendVerification({required String email}) async {
    try {
      await _api.resendVerification(email: email);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> forgotPassword({required String email}) async {
    try {
      await _api.forgotPassword(email: email);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<String> verifyResetOtp({
    required String email,
    required String otp,
  }) async {
    try {
      return await _api.verifyResetOtp(email: email, otp: otp);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> resetPassword({
    required String email,
    required String resetOtp,
    required String newPassword,
  }) async {
    try {
      await _api.resetPassword(
        email: email,
        resetOtp: resetOtp,
        newPassword: newPassword,
      );
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<UserEntity> signInWithGoogle({required String idToken}) async {
    try {
      final response = await _api.signInWithGoogle(idToken: idToken);
      if (response.accessToken.isEmpty) {
        throw const ServerException('Invalid Google sign-in response');
      }
      await _storage.saveTokens(
        access: response.accessToken,
        refresh: response.refreshToken,
      );
      return response.user.toEntity();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<UserEntity?> restoreSession() async {
    if (!await _storage.hasSession()) return null;
    try {
      return await _profile.getProfile();
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        await _storage.clearSession();
      }
      return null;
    }
  }

  @override
  Future<void> logout() async {
    await _storage.clearSession();
  }
}
