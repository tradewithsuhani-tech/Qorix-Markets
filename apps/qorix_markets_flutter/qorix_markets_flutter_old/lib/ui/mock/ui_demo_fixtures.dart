import 'package:qorix_markets_flutter/data/models/trade_model.dart';
import 'package:qorix_markets_flutter/features/activity/domain/entities/live_activity_event.dart';
import 'package:qorix_markets_flutter/features/bots/domain/entities/bot_entity.dart';
import 'package:qorix_markets_flutter/features/dashboard/domain/entities/dashboard_snapshot.dart';
import 'package:qorix_markets_flutter/features/invest/domain/entities/investment_state.dart';
import 'package:qorix_markets_flutter/features/kyc/domain/entities/kyc_state.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_pair.dart';
import 'package:qorix_markets_flutter/features/notifications/domain/entities/notification_entity.dart';
import 'package:qorix_markets_flutter/features/portfolio/domain/entities/portfolio_summary.dart';
import 'package:qorix_markets_flutter/features/referral/domain/entities/referral_info.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/deposit_entity.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_entity.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_mock_data.dart';

/// Domain entities built from [UiMockData] — instant, no network.
abstract final class UiDemoFixtures {
  static DashboardSnapshot dashboardSnapshot() => DashboardSnapshot(
        totalBalance: UiMockData.totalBalance,
        dailyPnl: UiMockData.dailyPnl,
        dailyPnlPercent: UiMockData.dailyPnlPercent,
        totalProfit: UiMockData.totalProfit,
        activeInvestment: UiMockData.activeStrategyDeployed,
        isTrading: UiMockData.isTrading,
        tradingBalance: UiMockData.capitalFlowTrading,
        profitBalance: UiMockData.capitalFlowProfit,
        mainBalance: UiMockData.capitalFlowMain,
        daysUntilPayout: UiMockData.daysUntilPayout,
        equityPoints: UiMockData.equityPoints
            .asMap()
            .entries
            .map((e) => EquityPoint(date: 'd${e.key}', equity: e.value, profit: e.value * 0.02))
            .toList(),
        monthlyReturn: UiMockData.monthlyReturn,
        totalReturn: UiMockData.totalReturn,
        vip: const VipInfo(
          tier: UiMockData.vipTier,
          label: UiMockData.vipLabel,
          profitBonus: UiMockData.vipProfitBonus,
          withdrawalFee: UiMockData.vipWithdrawalFee,
          minAmount: UiMockData.vipMinAmount,
          nextTierLabel: UiMockData.vipNextTierLabel,
          nextTierMin: UiMockData.vipNextTierMin,
          amountNeeded: UiMockData.vipAmountNeeded,
        ),
        riskLevel: 'MEDIUM',
        fundStats: FundStats(
          aum: UiMockData.fundAum * 1000000,
          activeInvestors: UiMockData.investorsOnline,
          winRate: 0.847,
        ),
      );

  static WalletEntity wallet() => const WalletEntity(
        balance: UiMockData.totalBalance,
        available: UiMockData.totalBalance - 200,
        currency: 'USDT',
        pending: 200,
        mainBalance: UiMockData.capitalFlowMain,
        tradingBalance: UiMockData.capitalFlowTrading,
        profitBalance: UiMockData.capitalFlowProfit,
      );

  static List<TransactionEntity> transactions() => [
        TransactionEntity(
          id: 'tx-pending-inr',
          type: 'deposit',
          amount: 10000,
          currency: 'INR',
          status: 'pending',
          createdAt: DateTime.now().subtract(const Duration(minutes: 18)),
          description: 'INR UPI deposit',
        ),
        TransactionEntity(
          id: 'tx-1',
          type: 'deposit',
          amount: 500,
          currency: 'USDT',
          status: 'confirmed',
          createdAt: DateTime.now().subtract(const Duration(days: 14)),
          description: 'TRC20 USDT deposit',
        ),
        TransactionEntity(
          id: 'tx-2',
          type: 'profit',
          amount: UiMockData.dailyPnl,
          currency: 'USDT',
          status: 'confirmed',
          createdAt: DateTime.now().subtract(const Duration(days: 1)),
          description: 'Daily profit credit',
        ),
        TransactionEntity(
          id: 'tx-3',
          type: 'transfer',
          amount: -UiMockData.activeStrategyDeployed,
          currency: 'USDT',
          status: 'confirmed',
          createdAt: DateTime.now().subtract(const Duration(days: 45)),
          description: 'Capital transfer',
        ),
        TransactionEntity(
          id: 'tx-4',
          type: 'referral',
          amount: UiMockData.referralMonthly,
          currency: 'USDT',
          status: 'confirmed',
          createdAt: DateTime.now().subtract(const Duration(days: 7)),
          description: 'Partner commission',
        ),
        TransactionEntity(
          id: 'tx-5',
          type: 'withdrawal',
          amount: -120,
          currency: 'USDT',
          status: 'confirmed',
          createdAt: DateTime.now().subtract(const Duration(days: 21)),
          description: 'Profit withdrawal',
        ),
      ];

  static InvestmentState investment() => InvestmentState(
        id: 1,
        amount: UiMockData.activeStrategyDeployed,
        riskLevel: 'MEDIUM',
        isActive: UiMockData.isTrading,
        autoCompound: true,
        totalProfit: UiMockData.totalProfit,
        dailyProfit: UiMockData.dailyPnl,
        drawdown: UiMockData.drawdownPercent,
        drawdownLimit: UiMockData.drawdownLimit,
        peakBalance: 4800,
        drawdownFromPeak: UiMockData.drawdownPercent,
        recoveryPct: 0.92,
        isPaused: UiMockData.isProtectionTriggered,
        startedAt: DateTime.now().subtract(const Duration(days: 45)),
      );

  static ReferralInfo referral() => const ReferralInfo(
        referralCode: UiMockData.referralCode,
        totalReferred: UiMockData.totalReferred,
        activeReferrals: UiMockData.activeReferrals,
        totalEarned: UiMockData.referralTotalEarned,
        monthlyEarnings: UiMockData.referralMonthly,
      );

  static List<ReferredUser> referredUsers() => [
        ReferredUser(
          id: 1,
          fullName: 'Priya S.',
          email: 'p***@email.com',
          investmentAmount: 500,
          isActive: true,
          joinedAt: DateTime.now().subtract(const Duration(days: 60)),
        ),
        ReferredUser(
          id: 2,
          fullName: 'Rakesh K.',
          email: 'r***@email.com',
          investmentAmount: 1200,
          isActive: true,
          joinedAt: DateTime.now().subtract(const Duration(days: 45)),
        ),
        ReferredUser(
          id: 3,
          fullName: 'Ananya M.',
          email: 'a***@email.com',
          investmentAmount: 800,
          isActive: true,
          joinedAt: DateTime.now().subtract(const Duration(days: 30)),
        ),
        ReferredUser(
          id: 4,
          fullName: 'Vikram P.',
          email: 'v***@email.com',
          investmentAmount: 250,
          isActive: false,
          joinedAt: DateTime.now().subtract(const Duration(days: 90)),
        ),
      ];

  static List<NotificationEntity> notifications() => UiMockNotifications.list
      .map(
        (n) => NotificationEntity(
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          isRead: n.isRead,
          createdAt: n.createdAt,
        ),
      )
      .toList();

  static const kycState = KycState(status: KycStatus.notStarted);

  static DepositAddressEntity depositAddress() => const DepositAddressEntity(
        address: UiMockData.depositAddress,
        network: 'TRC20',
        token: 'USDT',
      );

  static List<LiveActivityEvent> liveActivityEvents() {
    return UiMockData.liveActivities.map((a) {
      final kind = switch (a.action) {
        final s when s.contains('profit') => LiveActivityKind.profit,
        final s when s.contains('deposit') => LiveActivityKind.capital,
        final s when s.contains('activated') => LiveActivityKind.deployment,
        _ => LiveActivityKind.platform,
      };
      return LiveActivityEvent(
        id: 'demo-${a.name}-${a.minutesAgo}',
        kind: kind,
        headline: a.action,
        detail: '${a.name} · ${a.city}',
        occurredAt: DateTime.now().subtract(Duration(minutes: a.minutesAgo)),
        amount: a.amount,
      );
    }).toList();
  }

  static List<TradeModel> deskTrades() {
    final now = DateTime.now();
    return [
      TradeModel(
        id: 1,
        symbol: 'XAU/USD',
        direction: 'long',
        entryPrice: 2340,
        exitPrice: 2356,
        profit: 124,
        profitPercent: 1.24,
        executedAt: now.subtract(const Duration(minutes: 2)).toIso8601String(),
      ),
      TradeModel(
        id: 2,
        symbol: 'EUR/USD',
        direction: 'short',
        entryPrice: 1.084,
        exitPrice: 1.081,
        profit: 87,
        profitPercent: 0.87,
        executedAt: now.subtract(const Duration(minutes: 14)).toIso8601String(),
      ),
      TradeModel(
        id: 3,
        symbol: 'BTC/USDT',
        direction: 'long',
        entryPrice: 66800,
        exitPrice: 67250,
        profit: 210,
        profitPercent: 0.67,
        executedAt: now.subtract(const Duration(minutes: 28)).toIso8601String(),
      ),
      TradeModel(
        id: 4,
        symbol: 'GBP/JPY',
        direction: 'long',
        entryPrice: 188.4,
        exitPrice: 189.1,
        profit: 56,
        profitPercent: 0.37,
        executedAt: now.subtract(const Duration(hours: 1)).toIso8601String(),
      ),
    ];
  }

  static List<BotEntity> botsList() => const [
        BotEntity(
          id: 'momentum-v3',
          name: 'Momentum Alpha',
          strategy: 'momentum',
          status: 'active',
          allocatedAmount: 2400,
          totalReturn: 312,
          totalReturnPercent: 13.0,
          isActive: true,
        ),
        BotEntity(
          id: 'hedge-v2',
          name: 'Hedge Shield',
          strategy: 'hedge',
          status: 'idle',
          allocatedAmount: 0,
          totalReturn: 84,
          totalReturnPercent: 4.2,
          isActive: false,
        ),
      ];

  static List<BotPerformanceEntity> botsPerformance() => const [
        BotPerformanceEntity(
          botId: 'momentum-v3',
          botName: 'Momentum Alpha',
          pnl: 124,
          pnlPercent: 1.24,
          winRate: 84.7,
          tradesCount: 128,
        ),
        BotPerformanceEntity(
          botId: 'hedge-v2',
          botName: 'Hedge Shield',
          pnl: 87,
          pnlPercent: 0.87,
          winRate: 79.2,
          tradesCount: 96,
        ),
      ];

  static const marketPairs = [
    MarketPair(symbol: 'BTC/USDT', price: 67250, changePercent: 2.34, change24h: 2.34, volume24h: 1200000000),
    MarketPair(symbol: 'ETH/USDT', price: 3450, changePercent: -0.82, change24h: -0.82, volume24h: 800000000),
    MarketPair(symbol: 'XAU/USD', price: 2356, changePercent: 0.54, change24h: 0.54, volume24h: 450000000),
    MarketPair(symbol: 'USDT/INR', price: 83.42, changePercent: 0.12, change24h: 0.12, volume24h: 320000000),
    MarketPair(symbol: 'SOL/USDT', price: 148.2, changePercent: 3.15, change24h: 3.15, volume24h: 280000000),
  ];

  static List<MarketPair> marketPairsWithJitter() {
    final seed = DateTime.now().second;
    return marketPairs
        .map(
          (p) => MarketPair(
            symbol: p.symbol,
            price: p.price * (1 + (seed % 7 - 3) * 0.0003),
            changePercent: (p.changePercent) + (seed % 5 - 2) * 0.01,
            change24h: p.change24h! + (seed % 5 - 2) * 0.01,
            volume24h: p.volume24h,
          ),
        )
        .toList();
  }

  static List<Holding> holdings() => const [
        Holding(symbol: 'XAU/USD', amount: 12, value: 1240, pnl: 124, pnlPercent: 1.24),
        Holding(symbol: 'BTC/USDT', amount: 8, value: 980, pnl: 87, pnlPercent: 0.87),
        Holding(symbol: 'EUR/USD', amount: 15, value: 760, pnl: 56, pnlPercent: 0.37),
      ];

  static PortfolioSummary portfolioSummary() => PortfolioSummary(
        totalBalance: UiMockData.totalBalance,
        dailyPnl: UiMockData.dailyPnl,
        dailyPnlPercent: UiMockData.dailyPnlPercent,
        totalProfit: UiMockData.totalProfit,
        activeInvestment: UiMockData.activeStrategyDeployed,
        isTrading: UiMockData.isTrading,
      );

  static List<EquityPoint> equityChart({int days = 30}) {
    final now = DateTime.now();
    return List.generate(days, (i) {
      final equity = UiMockData.equityPoints[i % UiMockData.equityPoints.length];
      return EquityPoint(
        date: now.subtract(Duration(days: days - 1 - i)).toIso8601String().split('T').first,
        equity: equity,
        profit: equity * 0.018,
      );
    });
  }
}
