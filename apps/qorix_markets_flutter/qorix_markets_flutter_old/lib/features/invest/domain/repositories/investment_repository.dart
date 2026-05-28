import 'package:qorix_markets_flutter/data/models/trade_model.dart';
import 'package:qorix_markets_flutter/features/invest/domain/entities/investment_state.dart';

abstract interface class InvestmentRepository {
  Future<InvestmentState> getInvestment();
  Future<InvestmentState> startInvestment({required double amount, required String riskLevel});
  Future<InvestmentState> stopInvestment();
  Future<InvestmentState> updateProtection({required double drawdownLimit});
  Future<InvestmentState> updateCompounding({required bool autoCompound});
  Future<List<TradeModel>> getTrades({int page = 1, int limit = 20});
  Future<InvestmentState> topup({required double amount});
  Future<InvestmentState> queueRiskLevelChange({required String riskLevel});
  Future<InvestmentState> cancelRiskLevelChange();
}
