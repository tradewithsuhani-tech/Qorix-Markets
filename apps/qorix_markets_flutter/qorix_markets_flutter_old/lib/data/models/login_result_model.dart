import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/auth_response_model.dart';

/// Parsed POST /api/auth/login (and 2FA verify) responses.
class LoginResultModel {
  const LoginResultModel({
    this.auth,
    this.requires2FA = false,
    this.twoFactorToken,
    this.requiresVerification = false,
    this.email,
    this.requiresApproval = false,
    this.attemptId,
    this.pollToken,
    this.expiresAt,
    this.otpFallbackAfterMs = 0,
    this.deviceBrowser,
    this.deviceOs,
    this.message,
  });

  factory LoginResultModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    if (root['requires2FA'] == true) {
      return LoginResultModel(
        requires2FA: true,
        twoFactorToken: root['twoFactorToken'] as String?,
        message: root['message'] as String?,
      );
    }
    if (root['requiresVerification'] == true) {
      return LoginResultModel(
        requiresVerification: true,
        email: root['email'] as String?,
        message: root['message'] as String?,
      );
    }
    if (root['requiresApproval'] == true) {
      final device = root['device'];
      final deviceMap = device is Map ? Map<String, dynamic>.from(device) : null;
      return LoginResultModel(
        requiresApproval: true,
        attemptId: ApiJson.asInt(root['attemptId']),
        pollToken: root['pollToken'] as String?,
        expiresAt: root['expiresAt'] as String?,
        otpFallbackAfterMs: ApiJson.asInt(root['otpFallbackAfterMs']),
        deviceBrowser: deviceMap?['browser'] as String?,
        deviceOs: deviceMap?['os'] as String?,
        message: root['message'] as String?,
      );
    }
    final token = root['accessToken'] as String? ?? root['token'] as String? ?? '';
    if (token.isNotEmpty) {
      return LoginResultModel(auth: AuthResponseModel.fromJson(root));
    }
    return LoginResultModel(message: root['message'] as String? ?? root['error'] as String?);
  }

  final AuthResponseModel? auth;
  final bool requires2FA;
  final String? twoFactorToken;
  final bool requiresVerification;
  final String? email;
  final bool requiresApproval;
  final int? attemptId;
  final String? pollToken;
  final String? expiresAt;
  final int otpFallbackAfterMs;
  final String? deviceBrowser;
  final String? deviceOs;
  final String? message;

  bool get isAuthenticated => auth != null && auth!.accessToken.isNotEmpty;
}
