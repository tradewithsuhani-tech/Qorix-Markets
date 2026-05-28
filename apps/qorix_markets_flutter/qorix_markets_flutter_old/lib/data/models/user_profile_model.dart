import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/core/utils/phone_mask.dart';
import 'package:qorix_markets_flutter/features/auth/domain/entities/user_entity.dart';

class UserProfileModel {
  const UserProfileModel({
    required this.id,
    required this.email,
    required this.fullName,
    this.phone,
    this.kycVerified = false,
    this.emailVerified = false,
    this.phoneVerified = false,
    this.twoFactorEnabled = false,
    this.referralCode,
    this.memberSince,
    this.vipTier,
    this.isPro = false,
  });

  factory UserProfileModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return UserProfileModel(
      id: root['id']?.toString() ?? '',
      email: root['email'] as String? ?? '',
      fullName: root['fullName'] as String? ?? root['name'] as String? ?? '',
      phone: root['phone'] as String?,
      kycVerified: _kycVerifiedFromJson(root),
      emailVerified: root['emailVerified'] as bool? ?? false,
      phoneVerified: root['phoneVerified'] as bool? ?? false,
      twoFactorEnabled: root['twoFactorEnabled'] as bool? ?? false,
      referralCode: root['referralCode'] as String?,
      memberSince: root['memberSince'] as String? ?? root['createdAt'] as String?,
      vipTier: root['vipTier'] as String? ?? root['tier'] as String?,
      isPro: root['isPro'] as bool? ?? root['vipTier'] != null,
    );
  }

  static bool _kycVerifiedFromJson(Map<String, dynamic> root) {
    final status = root['kycStatus'] as String?;
    if (status != null && status.isNotEmpty) {
      final normalized = status.toLowerCase();
      return normalized == 'approved' ||
          normalized == 'verified' ||
          normalized == 'complete' ||
          normalized == 'completed';
    }
    return root['kycVerified'] as bool? ?? root['isKycVerified'] as bool? ?? false;
  }

  final String id;
  final String email;
  final String fullName;
  final String? phone;
  final bool kycVerified;
  final bool emailVerified;
  final bool phoneVerified;
  final bool twoFactorEnabled;
  final String? referralCode;
  final String? memberSince;
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
        memberSince: memberSince != null ? DateTime.tryParse(memberSince!) : null,
        vipTier: vipTier,
        isPro: isPro,
      );

  String? get maskedPhone {
    if (phone == null || phone!.trim().isEmpty) return null;
    return maskPhone(phone!);
  }
}
