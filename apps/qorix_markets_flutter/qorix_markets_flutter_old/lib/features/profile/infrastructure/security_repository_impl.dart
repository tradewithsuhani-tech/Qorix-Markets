import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/security_models.dart';
import 'package:qorix_markets_flutter/features/profile/domain/repositories/security_repository.dart';
import 'package:qorix_markets_flutter/services/api/security_api_service.dart';

final securityRepositoryProvider = Provider<SecurityRepository>((ref) {
  return SecurityRepositoryImpl(ref.watch(securityApiServiceProvider));
});

class SecurityRepositoryImpl implements SecurityRepository {
  SecurityRepositoryImpl(this._api);
  final SecurityApiService _api;

  Future<T> _wrap<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<SecurityStatusModel> getSecurityStatus() {
    if (UiDemoMode.isActive) {
      return Future.value(const SecurityStatusModel(emailVerified: true));
    }
    return _wrap(_api.getSecurityStatus);
  }

  @override
  Future<ChangePasswordResult> changePassword({
    required String currentPassword,
    required String newPassword,
  }) {
    if (UiDemoMode.blocksWriteApi) {
      return Future.value(
        const ChangePasswordResult(
          success: true,
          message: 'Password updated (demo)',
          withdrawalLockHours: 24,
        ),
      );
    }
    return _wrap(
      () => _api.changePassword(currentPassword: currentPassword, newPassword: newPassword),
    );
  }

  @override
  Future<TwoFactorStatusModel> get2faStatus() {
    if (UiDemoMode.isActive) {
      return Future.value(const TwoFactorStatusModel());
    }
    return _wrap(_api.get2faStatus);
  }

  @override
  Future<TwoFactorSetupModel> setup2fa() {
    if (UiDemoMode.blocksWriteApi) {
      return Future.value(
        const TwoFactorSetupModel(
          manualCode: 'DEMO2FACODEXYZ123',
          issuer: 'QorixMarkets',
          accountName: 'demo@qorixmarkets.com',
        ),
      );
    }
    return _wrap(_api.setup2fa);
  }

  @override
  Future<TwoFactorVerifySetupResult> verify2faSetup(String code) {
    if (UiDemoMode.blocksWriteApi) {
      return Future.value(
        const TwoFactorVerifySetupResult(
          enabled: true,
          backupCodes: ['demo-backup-1', 'demo-backup-2'],
        ),
      );
    }
    return _wrap(() => _api.verify2faSetup(code));
  }

  @override
  Future<void> disable2fa({required String password, required String code}) {
    if (UiDemoMode.blocksWriteApi) return Future.value();
    return _wrap(() => _api.disable2fa(password: password, code: code));
  }

  @override
  Future<DevicesListModel> getDevices() {
    if (UiDemoMode.isActive) {
      return Future.value(
        DevicesListModel(
          devices: [
            DeviceRecordModel(
              id: 'current',
              browser: 'Expo Demo',
              os: 'Android 14',
              city: 'Mumbai',
              country: 'IN',
              lastSeenAt: DateTime.now().toIso8601String(),
              isCurrent: true,
            ),
          ],
          currentDeviceTracked: true,
        ),
      );
    }
    return _wrap(_api.getDevices);
  }

  @override
  Future<void> revokeSession(String sessionId) {
    if (UiDemoMode.blocksWriteApi) return Future.value();
    return _wrap(() => _api.revokeSession(sessionId));
  }

  @override
  Future<void> revokeOtherSessions() {
    if (UiDemoMode.blocksWriteApi) return Future.value();
    return _wrap(() => _api.revokeOtherSessions());
  }
}
