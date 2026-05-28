import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/auth/domain/entities/user_entity.dart';

class UserModel {
  const UserModel({
    required this.id,
    required this.email,
    this.fullName,
    this.kycVerified = false,
    this.phone,
    this.emailVerified = false,
    this.phoneVerified = false,
    this.twoFactorEnabled = false,
    this.vipTier,
    this.isPro = false,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json['user'] ?? json);
    return UserModel(
      id: root['id']?.toString() ?? '',
      email: root['email'] as String? ?? '',
      fullName: root['fullName'] as String? ?? root['name'] as String?,
      kycVerified: root['kycVerified'] as bool? ?? false,
      phone: root['phone'] as String?,
      emailVerified: root['emailVerified'] as bool? ?? false,
      phoneVerified: root['phoneVerified'] as bool? ?? false,
      twoFactorEnabled: root['twoFactorEnabled'] as bool? ?? false,
      vipTier: root['vipTier'] as String?,
      isPro: root['isPro'] as bool? ?? false,
    );
  }

  final String id;
  final String email;
  final String? fullName;
  final bool kycVerified;
  final String? phone;
  final bool emailVerified;
  final bool phoneVerified;
  final bool twoFactorEnabled;
  final String? vipTier;
  final bool isPro;

  UserEntity toEntity() => UserEntity(
        id: id,
        email: email,
        fullName: fullName,
        kycVerified: kycVerified,
        phone: phone,
        emailVerified: emailVerified,
        phoneVerified: phoneVerified,
        twoFactorEnabled: twoFactorEnabled,
        vipTier: vipTier,
        isPro: isPro,
      );
}
