import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/user_model.dart';

class AuthResponseModel {
  const AuthResponseModel({required this.accessToken, required this.refreshToken, required this.user});

  factory AuthResponseModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return AuthResponseModel(
      accessToken: root['accessToken'] as String? ?? root['token'] as String? ?? '',
      refreshToken: root['refreshToken'] as String? ?? '',
      user: UserModel.fromJson(root),
    );
  }

  final String accessToken;
  final String refreshToken;
  final UserModel user;
}
