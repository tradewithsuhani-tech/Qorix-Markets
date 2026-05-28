import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_entity.dart';

/// Full wallet transaction history for History screen (demo).
abstract final class WalletHistoryDemo {
  static const filters = ['All', 'Deposit', 'Withdrawal', 'Profit', 'Transfer'];

  static List<TransactionEntity> get all => _records;

  static bool matchesFilter(TransactionEntity tx, String filter) {
    if (filter == 'All') return true;
    final t = tx.type.toLowerCase();
    return switch (filter) {
      'Deposit' => t == 'deposit',
      'Withdrawal' => t == 'withdrawal',
      'Profit' => t == 'profit',
      'Transfer' => t == 'transfer' || t == 'deploy' || t == 'referral',
      _ => true,
    };
  }

  static String titleFor(TransactionEntity tx) {
    return switch (tx.type.toLowerCase()) {
      'deposit' => 'Deposit',
      'withdrawal' => 'Withdrawal',
      'profit' => 'Profit',
      'deploy' => 'Capital Deployed',
      'transfer' => 'Transfer',
      'referral' => 'Referral Bonus',
      _ => tx.type,
    };
  }

  static String displayTitle(TransactionEntity tx) {
    final d = tx.description?.trim();
    if (d == null || d.isEmpty) return titleFor(tx);
    if (d.contains('TRC20')) return 'TRC20 USDT deposit';
    if (d.contains('INR UPI') || d.startsWith('INR deposit')) return 'INR UPI deposit';
    if (d.contains('INR payout') || d.contains('INR withdrawal')) return 'INR withdrawal';
    if (d.contains('Daily profit')) return 'Daily profit';
    if (d.contains('Weekly profit')) return 'Weekly profit';
    if (d.contains('Referral') || d.contains('Partner commission')) return 'Referral bonus';
    if (d.contains('transfer') || d.contains('→')) return 'Internal transfer';
    if (d.contains('deploy') || d.contains('deployed')) return 'Capital deployed';
    return d.length > 42 ? '${d.substring(0, 42)}…' : d;
  }

  static double toInr(TransactionEntity tx) {
    final abs = tx.amount.abs();
    return tx.currency == 'INR' ? abs : abs * 83.5;
  }

  static bool matchesSearch(TransactionEntity tx, String query) {
    if (query.isEmpty) return true;
    final q = query.toLowerCase();
    final hay = '${displayTitle(tx)} ${tx.description ?? ''} ${tx.type}'.toLowerCase();
    return hay.contains(q);
  }

  static final _records = <TransactionEntity>[
    TransactionEntity(
      id: 'h1',
      type: 'deploy',
      amount: 1015.31,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(0, 21, 6),
      description: 'Strategy capital deployed to trading desk',
    ),
    TransactionEntity(
      id: 'h2',
      type: 'deposit',
      amount: 51.02,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(0, 21, 6),
      description: 'INR deposit ₹5000.00 (UTR 482910334521)',
    ),
    TransactionEntity(
      id: 'h3',
      type: 'profit',
      amount: 2.31,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(0, 21, 6),
      description: 'Daily profit (high risk, 0.381% rate applied)',
    ),
    TransactionEntity(
      id: 'h4',
      type: 'profit',
      amount: 1.87,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(0, 18, 42),
      description: 'Daily profit (medium risk, 0.312% rate applied)',
    ),
    TransactionEntity(
      id: 'h5',
      type: 'deposit',
      amount: 120.48,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(0, 14, 15),
      description: 'INR deposit ₹10000.00 (UTR 991823445601)',
    ),
    TransactionEntity(
      id: 'h6',
      type: 'transfer',
      amount: -250,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(0, 11, 30),
      description: 'Main → Trading wallet transfer',
    ),
    TransactionEntity(
      id: 'h7',
      type: 'withdrawal',
      amount: -85.5,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(1, 16, 20),
      description: 'INR payout ₹7120.00 to HDFC ****4521',
    ),
    TransactionEntity(
      id: 'h8',
      type: 'profit',
      amount: 3.12,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(1, 9, 0),
      description: 'Daily profit (high risk, 0.401% rate applied)',
    ),
    TransactionEntity(
      id: 'h9',
      type: 'deposit',
      amount: 500,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(2, 10, 45),
      description: 'TRC20 USDT deposit (TxHash 0x8f3a...c21d)',
    ),
    TransactionEntity(
      id: 'h10',
      type: 'deploy',
      amount: 800,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(2, 11, 0),
      description: 'Bot setup — MEDIUM risk profile deployed',
    ),
    TransactionEntity(
      id: 'h11',
      type: 'referral',
      amount: 12.5,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(3, 14, 22),
      description: 'Partner commission — Tier 2 referral',
    ),
    TransactionEntity(
      id: 'h12',
      type: 'profit',
      amount: 2.05,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(3, 9, 0),
      description: 'Daily profit (low risk, 0.198% rate applied)',
    ),
    TransactionEntity(
      id: 'h13',
      type: 'withdrawal',
      amount: -200,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(4, 19, 10),
      description: 'Profit wallet → Main wallet',
    ),
    TransactionEntity(
      id: 'h14',
      type: 'deposit',
      amount: 25.6,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(5, 12, 8),
      description: 'INR deposit ₹2500.00 (UPI ref 8844221100)',
    ),
    TransactionEntity(
      id: 'h15',
      type: 'transfer',
      amount: 150,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(5, 12, 30),
      description: 'Funding → Main wallet transfer',
    ),
    TransactionEntity(
      id: 'h16',
      type: 'profit',
      amount: 4.22,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(6, 9, 0),
      description: 'Weekly profit settlement',
    ),
    TransactionEntity(
      id: 'h17',
      type: 'deposit',
      amount: 10000,
      currency: 'INR',
      status: 'pending',
      createdAt: _d(0, 22, 30),
      description: 'INR UPI deposit — awaiting confirmation',
    ),
    TransactionEntity(
      id: 'h18',
      type: 'withdrawal',
      amount: -50,
      currency: 'USDT',
      status: 'pending',
      createdAt: _d(0, 20, 15),
      description: 'INR payout processing',
    ),
    TransactionEntity(
      id: 'h19',
      type: 'deploy',
      amount: 420,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(8, 15, 40),
      description: 'Additional capital deployed — AGGRESSIVE bot',
    ),
    TransactionEntity(
      id: 'h20',
      type: 'profit',
      amount: 1.56,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(9, 9, 0),
      description: 'Daily profit (medium risk, 0.289% rate applied)',
    ),
    TransactionEntity(
      id: 'h21',
      type: 'deposit',
      amount: 75.3,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(10, 11, 20),
      description: 'INR deposit ₹7500.00 (IMPS ref 3344556677)',
    ),
    TransactionEntity(
      id: 'h22',
      type: 'transfer',
      amount: -100,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(11, 9, 5),
      description: 'Main → Profit wallet transfer',
    ),
    TransactionEntity(
      id: 'h23',
      type: 'referral',
      amount: 8.0,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(12, 16, 0),
      description: 'Referral bonus — new partner signup',
    ),
    TransactionEntity(
      id: 'h24',
      type: 'profit',
      amount: 2.88,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(13, 9, 0),
      description: 'Daily profit (high risk, 0.365% rate applied)',
    ),
    TransactionEntity(
      id: 'h25',
      type: 'withdrawal',
      amount: -310,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(14, 13, 45),
      description: 'INR payout ₹25800.00 to ICICI ****8890',
    ),
    TransactionEntity(
      id: 'h26',
      type: 'deposit',
      amount: 1000,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(18, 10, 0),
      description: 'TRC20 USDT deposit (TxHash 0x2b1c...9fa4)',
    ),
    TransactionEntity(
      id: 'h27',
      type: 'deploy',
      amount: 650,
      currency: 'USDT',
      status: 'completed',
      createdAt: _d(20, 14, 30),
      description: 'Initial bot deployment — CONSERVATIVE profile',
    ),
  ];

  static DateTime _d(int daysAgo, int hour, int minute) {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day - daysAgo, hour, minute);
  }
}
