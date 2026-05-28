import 'package:equatable/equatable.dart';

import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_inr_options.dart';

class InrPayoutMethodEntity extends Equatable {
  const InrPayoutMethodEntity({
    required this.id,
    required this.type,
    required this.label,
    required this.accountName,
    required this.accountValue,
    this.bankName,
    this.ifsc,
    this.maskedValue,
    this.isDefault = false,
  });

  final int id;
  final InrPayoutMethod type;
  final String label;
  final String accountName;
  final String accountValue;
  final String? bankName;
  final String? ifsc;
  final String? maskedValue;
  final bool isDefault;

  String get displaySubtitle => switch (type) {
        InrPayoutMethod.bank =>
          '${accountName.isNotEmpty ? accountName : label} · ${maskedValue ?? _maskAccount(accountValue)}',
        InrPayoutMethod.upi => maskedValue ?? accountValue,
        InrPayoutMethod.qorixUser => accountValue,
      };

  String get typeLabel => InrPayoutOption.byId(type).title;

  static String _maskAccount(String value) {
    if (value.length <= 4) return value;
    return '···${value.substring(value.length - 4)}';
  }

  @override
  List<Object?> get props => [id, type, label, accountName, accountValue, bankName, ifsc, maskedValue, isDefault];
}
