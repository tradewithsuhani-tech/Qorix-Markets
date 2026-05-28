import 'package:equatable/equatable.dart';

import 'package:qorix_markets_flutter/core/utils/phone_mask.dart';

class UserEntity extends Equatable {
  const UserEntity({
    required this.id,
    required this.email,
    this.fullName,
    this.kycVerified = false,
    this.phone,
    this.emailVerified = false,
    this.phoneVerified = false,
    this.twoFactorEnabled = false,
    this.memberSince,
    this.vipTier,
    this.isPro = false,
  });

  final String id;
  final String email;
  final String? fullName;
  final bool kycVerified;
  final String? phone;
  final bool emailVerified;
  final bool phoneVerified;
  final bool twoFactorEnabled;
  final DateTime? memberSince;
  final String? vipTier;
  final bool isPro;

  String get displayName =>
      fullName?.isNotEmpty == true ? fullName! : email.split('@').first;

  String? get displayPhone {
    if (phone == null || phone!.trim().isEmpty) return null;
    return maskPhone(phone!);
  }

  @override
  List<Object?> get props => [
        id,
        email,
        fullName,
        kycVerified,
        phone,
        emailVerified,
        phoneVerified,
        twoFactorEnabled,
        memberSince,
        vipTier,
        isPro,
      ];
}
