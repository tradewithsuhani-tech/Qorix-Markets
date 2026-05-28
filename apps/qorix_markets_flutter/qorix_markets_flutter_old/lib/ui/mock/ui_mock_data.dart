class ProfitHistoryEntry {
  const ProfitHistoryEntry({required this.type, required this.date, required this.amount});
  final String type;
  final String date;
  final double amount;
}

class UiMockData {
  static const totalBalance = 12847.0;
  static const dailyPnl = 102.78;
  static const dailyPnlPercent = 0.8;
  static const totalProfit = 380.5;
  static const activeStrategyDeployed = 5000.0;
  static const isTrading = true;
  static const capitalFlowMain = 7847.0;
  static const capitalFlowTrading = 3200.0;
  static const capitalFlowProfit = 1800.0;
  static const daysUntilPayout = 3;
  static const drawdownPercent = 1.2;
  static const drawdownLimit = 5.0;
  static const isProtectionTriggered = false;
  static const monthlyReturn = 8.4;
  static const totalReturn = 24.5;
  static const fundAum = 12.8;
  static const investorsOnline = 842;
  static const depositAddress = 'TXYZqorixDemoAddress123';
  static const referralCode = 'QORIX2026';
  static const totalReferred = 12;
  static const activeReferrals = 8;
  static const referralTotalEarned = 420.0;
  static const referralMonthly = 86.0;
  static const unreadNotifications = 3;
  static const vipTier = 'gold';
  static const vipLabel = 'Gold';
  static const vipProfitBonus = 0.15;
  static const vipWithdrawalFee = 0.5;
  static const vipMinAmount = 5000.0;
  static const vipNextTierLabel = 'Platinum';
  static const vipNextTierMin = 25000.0;
  static const vipAmountNeeded = 12153.0;
  static const equityPoints = <double>[11800, 11950, 12100, 12280, 12410, 12550, 12700, 12847];
  static const profitHistory = <ProfitHistoryEntry>[
    ProfitHistoryEntry(type: 'Daily profit', date: 'Today', amount: 42.5),
    ProfitHistoryEntry(type: 'Referral reward', date: 'Yesterday', amount: 18.0),
    ProfitHistoryEntry(type: 'Compounding', date: '2 days ago', amount: 65.2),
  ];
  static const liveActivities = <({String name, String city, String action, int minutesAgo, double? amount})>[
    (name: 'Alex', city: 'Mumbai', action: 'profit credited', minutesAgo: 2, amount: 42.0),
  ];

  static List<double> projectedGrowth(double amount) {
    final base = amount <= 0 ? 100.0 : amount;
    return List<double>.generate(12, (i) => base * (1 + 0.02 * (i + 1)));
  }
}

class UiMockNotifications {
  static final list = [
    _MockNotification(
      id: '1',
      type: 'profit',
      title: 'Daily profit',
      message: '+\$102.78 credited',
      isRead: false,
      createdAt: DateTime.now(),
    ),
  ];
}

class _MockNotification {
  const _MockNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
  });
  final String id;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final DateTime createdAt;
}
