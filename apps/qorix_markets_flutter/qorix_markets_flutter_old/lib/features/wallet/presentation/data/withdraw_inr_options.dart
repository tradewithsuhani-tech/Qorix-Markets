import 'package:flutter/material.dart';

/// INR payout method id for withdraw flow selection.
enum InrPayoutMethod { bank, upi, qorixUser }

extension InrPayoutMethodApi on InrPayoutMethod {
  String get apiValue => switch (this) {
        InrPayoutMethod.bank => 'bank',
        InrPayoutMethod.upi => 'upi',
        InrPayoutMethod.qorixUser => 'qorix_user',
      };

  String get summaryLabel => InrPayoutOption.byId(this).title;
}

class InrPayoutOption {
  const InrPayoutOption({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final InrPayoutMethod id;
  final String title;
  final String subtitle;
  final IconData icon;

  static const list = [
    InrPayoutOption(
      id: InrPayoutMethod.bank,
      title: 'Bank Transfer',
      subtitle: 'NEFT / IMPS · 1–2 hrs',
      icon: Icons.account_balance_outlined,
    ),
    InrPayoutOption(
      id: InrPayoutMethod.upi,
      title: 'UPI',
      subtitle: 'Instant to verified UPI ID',
      icon: Icons.bolt_rounded,
    ),
    InrPayoutOption(
      id: InrPayoutMethod.qorixUser,
      title: 'Qorix User',
      subtitle: 'Transfer to another Qorix account',
      icon: Icons.person_outline_rounded,
    ),
  ];

  static InrPayoutOption byId(InrPayoutMethod id) =>
      list.firstWhere((o) => o.id == id);
}

String buildInrDestination({
  required InrPayoutMethod payout,
  required String accountHolder,
  required String accountNumber,
  required String ifsc,
  required String upiId,
  required String qorixUserId,
  String? bankName,
}) {
  return switch (payout) {
    InrPayoutMethod.bank => '$accountHolder|$accountNumber|$ifsc|${bankName ?? ''}',
    InrPayoutMethod.upi => upiId,
    InrPayoutMethod.qorixUser => qorixUserId,
  };
}

String maskInrDestination(String destination, InrPayoutMethod? payout) {
  if (destination.isEmpty || destination == '—') return '—';
  if (payout == InrPayoutMethod.upi && destination.length > 6) {
    return '${destination.substring(0, 3)}***${destination.substring(destination.length - 3)}';
  }
  if (destination.length <= 8) return destination;
  return '${destination.substring(0, 4)}…${destination.substring(destination.length - 4)}';
}
