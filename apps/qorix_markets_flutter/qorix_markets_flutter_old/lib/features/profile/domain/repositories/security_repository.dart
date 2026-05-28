import 'package:qorix_markets_flutter/data/models/security_models.dart';

abstract interface class SecurityRepository {
  Future<SecurityStatusModel> getSecurityStatus();
  Future<ChangePasswordResult> changePassword({
    required String currentPassword,
    required String newPassword,
  });
  Future<TwoFactorStatusModel> get2faStatus();
  Future<TwoFactorSetupModel> setup2fa();
  Future<TwoFactorVerifySetupResult> verify2faSetup(String code);
  Future<void> disable2fa({required String password, required String code});
  Future<DevicesListModel> getDevices();
  Future<void> revokeSession(String sessionId);
  Future<void> revokeOtherSessions();
}
