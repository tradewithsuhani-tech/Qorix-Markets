/// Demo constants for withdrawal UI preview.
abstract final class WithdrawDemo {
  static const usdtMin = 50.0;
  static const inrMin = 500.0;

  static const usdtQuickAmounts = [100.0, 250.0, 500.0, 890.0];
  static const inrQuickAmounts = [1000.0, 5000.0, 10000.0, 25000.0];

  static const demoTrc20Address = 'TXkP3vN8qR2mL5wY9zH4jF6gD1cB7aE3sK';
  static const demoUpiId = 'investor@oksbi';
}

class SavedBankAccount {
  const SavedBankAccount({
    required this.id,
    required this.bankName,
    required this.accountHolder,
    required this.accountNumber,
    required this.ifsc,
    required this.maskedNumber,
  });

  final String id;
  final String bankName;
  final String accountHolder;
  final String accountNumber;
  final String ifsc;
  final String maskedNumber;
}

abstract final class WithdrawInrDemo {
  static const savedBanks = [
    SavedBankAccount(
      id: 'hdfc',
      bankName: 'HDFC Bank',
      accountHolder: 'Raj Kumar',
      accountNumber: '123456789012',
      ifsc: 'HDFC0001234',
      maskedNumber: '···9012',
    ),
    SavedBankAccount(
      id: 'icici',
      bankName: 'ICICI Bank',
      accountHolder: 'Raj Kumar',
      accountNumber: '987654321098',
      ifsc: 'ICIC0000456',
      maskedNumber: '···1098',
    ),
  ];
}
