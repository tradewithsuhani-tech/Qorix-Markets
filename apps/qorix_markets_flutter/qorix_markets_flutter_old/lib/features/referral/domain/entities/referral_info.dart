import 'package:equatable/equatable.dart';

class ReferralInfo extends Equatable {
  const ReferralInfo({
    required this.referralCode,
    required this.totalReferred,
    required this.activeReferrals,
    required this.totalEarned,
    required this.monthlyEarnings,
    this.referralLink,
  });

  final String referralCode;
  final int totalReferred;
  final int activeReferrals;
  final double totalEarned;
  final double monthlyEarnings;
  final String? referralLink;

  String get shareLink =>
      referralLink?.isNotEmpty == true
          ? referralLink!
          : 'https://qorixmarkets.com/register?ref=$referralCode';

  @override
  List<Object?> get props => [referralCode, totalReferred, activeReferrals, totalEarned, monthlyEarnings, referralLink];
}

class ReferredUser extends Equatable {
  const ReferredUser({
    required this.id,
    required this.fullName,
    required this.email,
    required this.investmentAmount,
    required this.isActive,
    required this.joinedAt,
  });

  final int id;
  final String fullName;
  final String email;
  final double investmentAmount;
  final bool isActive;
  final DateTime joinedAt;

  @override
  List<Object?> get props => [id, fullName, email, investmentAmount, isActive, joinedAt];
}
