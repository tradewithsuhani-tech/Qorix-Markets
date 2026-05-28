import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/features/dashboard/domain/entities/dashboard_snapshot.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_pair.dart';
import 'package:qorix_markets_flutter/features/portfolio/domain/entities/profit_entry.dart';
import 'package:qorix_markets_flutter/features/portfolio/domain/entities/portfolio_summary.dart';
import 'package:qorix_markets_flutter/features/portfolio/domain/repositories/portfolio_repository.dart';
import 'package:qorix_markets_flutter/services/api/dashboard_api_service.dart';
import 'package:qorix_markets_flutter/services/api/market_api_service.dart';
import 'package:qorix_markets_flutter/services/api/portfolio_api_service.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_mock_data.dart';

final portfolioRepositoryProvider = Provider<PortfolioRepository>((ref) {
  return PortfolioRepositoryImpl(
    ref.watch(dashboardApiServiceProvider),
    ref.watch(marketApiServiceProvider),
    ref.watch(portfolioApiServiceProvider),
  );
});

class PortfolioRepositoryImpl implements PortfolioRepository {
  PortfolioRepositoryImpl(this._dashboard, this._market, this._portfolio);

  final DashboardApiService _dashboard;
  final MarketApiService _market;
  final PortfolioApiService _portfolio;

  @override
  Future<PortfolioSummary> getSummary() async {
    try {
      final model = await _dashboard.getSummary();
      return model.toEntity();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<List<EquityPoint>> getEquityChart({int days = 30}) async {
    try {
      final points = await _dashboard.getEquityChart(days: days);
      return points
          .map((p) => EquityPoint(date: p.date, equity: p.equity, profit: p.profit))
          .toList();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<List<Holding>> getHoldingsFromTrades() async {
    try {
      final trades = await _market.getRecentTrades(limit: 30);
      final bySymbol = <String, List<double>>{};
      for (final t in trades) {
        final key = t.symbol;
        bySymbol.putIfAbsent(key, () => []);
        bySymbol[key]!.add(t.profit);
      }
      return bySymbol.entries.map((e) {
        final profits = e.value;
        final pnl = profits.fold(0.0, (a, b) => a + b);
        final pnlPct = profits.isEmpty
            ? 0.0
            : profits.fold(0.0, (a, b) => a + b) / profits.length;
        return Holding(
          symbol: e.key,
          amount: profits.length.toDouble(),
          value: pnl.abs() * 100 + 1000,
          pnl: pnl,
          pnlPercent: pnlPct,
        );
      }).toList();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<ProfitHistoryPage> getProfitHistory({int page = 1, int limit = 20}) async {
    if (UiDemoMode.isActive) {
      final entries = UiMockData.profitHistory
          .asMap()
          .entries
          .map(
            (e) => ProfitEntry(
              id: 'demo-${e.key}',
              label: e.value.type,
              dateLabel: e.value.date,
              amount: e.value.amount,
            ),
          )
          .toList();
      return ProfitHistoryPage(
        totalProfit: UiMockData.totalProfit,
        currency: 'USDT',
        entries: entries,
        page: 1,
        hasMore: false,
      );
    }
    try {
      final model = await _portfolio.getProfitHistory(page: page, limit: limit);
      return model.toEntity();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }
}
