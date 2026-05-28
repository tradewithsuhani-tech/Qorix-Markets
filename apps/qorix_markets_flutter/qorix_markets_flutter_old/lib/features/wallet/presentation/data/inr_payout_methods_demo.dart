import 'package:qorix_markets_flutter/features/wallet/domain/entities/inr_payout_method.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_inr_options.dart';

abstract final class InrPayoutMethodsDemo {
  static const methods = [
    InrPayoutMethodEntity(
      id: 1,
      type: InrPayoutMethod.bank,
      label: 'HDFC Savings',
      accountName: 'Raj Kumar',
      accountValue: '123456789012',
      bankName: 'HDFC Bank',
      ifsc: 'HDFC0001234',
      maskedValue: '···9012',
      isDefault: true,
    ),
    InrPayoutMethodEntity(
      id: 2,
      type: InrPayoutMethod.bank,
      label: 'ICICI Salary',
      accountName: 'Raj Kumar',
      accountValue: '987654321098',
      bankName: 'ICICI Bank',
      ifsc: 'ICIC0000456',
      maskedValue: '···1098',
    ),
    InrPayoutMethodEntity(
      id: 3,
      type: InrPayoutMethod.upi,
      label: 'Personal UPI',
      accountName: 'Raj Kumar',
      accountValue: 'investor@oksbi',
    ),
  ];
}
