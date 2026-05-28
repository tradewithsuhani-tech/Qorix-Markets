import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/auth_response_model.dart';

class RegisterResponseModel {
  const RegisterResponseModel({
    required this.email,
    this.requiresVerification = false,
    this.message,
    this.auth,
  });

  factory RegisterResponseModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    if (root['requiresVerification'] == true) {
      return RegisterResponseModel(
        email: root['email'] as String? ?? '',
        requiresVerification: true,
        message: root['message'] as String?,
      );
    }

    final auth = AuthResponseModel.fromJson(root);
    if (auth.accessToken.isNotEmpty) {
      return RegisterResponseModel(
        email: auth.user.email,
        auth: auth,
      );
    }

    return RegisterResponseModel(
      email: root['email'] as String? ?? '',
      requiresVerification: true,
      message: root['message'] as String?,
    );
  }

  final String email;
  final bool requiresVerification;
  final String? message;
  final AuthResponseModel? auth;
}
