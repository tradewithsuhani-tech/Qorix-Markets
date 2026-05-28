import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/referral/domain/entities/referral_info.dart';

class ReferralSummaryModel {
  const ReferralSummaryModel({
    required this.referralCode,
    required this.totalReferred,
    required this.activeReferrals,
    required this.totalEarned,
    required this.monthlyEarnings,
    required this.referralLink,
  });

  factory ReferralSummaryModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return ReferralSummaryModel(
      referralCode: root['referralCode'] as String? ?? '',
      totalReferred: ApiJson.asInt(root['totalReferred']),
      activeReferrals: ApiJson.asInt(root['activeReferrals']),
      totalEarned: ApiJson.asDouble(root['totalEarned']),
      monthlyEarnings: ApiJson.asDouble(root['monthlyEarnings']),
      referralLink: root['referralLink'] as String? ?? '',
    );
  }

  final String referralCode;
  final int totalReferred;
  final int activeReferrals;
  final double totalEarned;
  final double monthlyEarnings;
  final String referralLink;

  ReferralInfo toEntity() => ReferralInfo(
        referralCode: referralCode,
        totalReferred: totalReferred,
        activeReferrals: activeReferrals,
        totalEarned: totalEarned,
        monthlyEarnings: monthlyEarnings,
        referralLink: referralLink,
      );
}

class ReferredUserModel {
  const ReferredUserModel({
    required this.id,
    required this.fullName,
    required this.email,
    required this.investmentAmount,
    required this.isActive,
    required this.joinedAt,
  });

  factory ReferredUserModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return ReferredUserModel(
      id: ApiJson.asInt(root['id']),
      fullName: root['fullName'] as String? ?? '',
      email: root['email'] as String? ?? '',
      investmentAmount: ApiJson.asDouble(root['investmentAmount']),
      isActive: root['isActive'] as bool? ?? false,
      joinedAt: DateTime.tryParse(root['joinedAt'] as String? ?? '') ?? DateTime.now(),
    );
  }

  final int id;
  final String fullName;
  final String email;
  final double investmentAmount;
  final bool isActive;
  final DateTime joinedAt;

  ReferredUser toEntity() => ReferredUser(
        id: id,
        fullName: fullName,
        email: email,
        investmentAmount: investmentAmount,
        isActive: isActive,
        joinedAt: joinedAt,
      );
}
