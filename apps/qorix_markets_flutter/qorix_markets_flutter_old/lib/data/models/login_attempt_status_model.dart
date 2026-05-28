import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/auth_response_model.dart';

/// GET /api/auth/login-attempts/:id/status?pollToken=...
class LoginAttemptStatusModel {
  const LoginAttemptStatusModel({
    required this.status,
    this.auth,
  });

  factory LoginAttemptStatusModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    final status = (root['status'] as String? ?? '').toLowerCase();
    AuthResponseModel? auth;
    final token = root['token'] as String? ?? '';
    if (token.isNotEmpty) {
      auth = AuthResponseModel.fromJson(root);
    }
    return LoginAttemptStatusModel(status: status, auth: auth);
  }

  final String status;
  final AuthResponseModel? auth;

  bool get isApproved => status == 'approved' && auth != null;
  bool get isTerminal =>
      status == 'expired' || status == 'denied' || status == 'consumed';
}
