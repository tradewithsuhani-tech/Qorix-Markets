import 'package:qorix_markets_flutter/features/market/domain/entities/market_pair.dart';
import 'package:qorix_markets_flutter/features/portfolio/domain/entities/profit_entry.dart';
import 'package:qorix_markets_flutter/features/dashboard/domain/entities/dashboard_snapshot.dart';
import 'package:qorix_markets_flutter/features/portfolio/domain/entities/portfolio_summary.dart';

abstract interface class PortfolioRepository {
  Future<PortfolioSummary> getSummary();
  Future<List<EquityPoint>> getEquityChart({int days});
  Future<List<Holding>> getHoldingsFromTrades();
  Future<ProfitHistoryPage> getProfitHistory({int page = 1, int limit = 20});
}
