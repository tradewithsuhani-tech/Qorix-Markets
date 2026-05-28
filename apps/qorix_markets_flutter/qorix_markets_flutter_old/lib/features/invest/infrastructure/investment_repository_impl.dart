import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart' show mapDioExceptionToException;
import 'package:qorix_markets_flutter/data/models/trade_model.dart';
import 'package:qorix_markets_flutter/features/invest/domain/entities/investment_state.dart';
import 'package:qorix_markets_flutter/features/invest/domain/repositories/investment_repository.dart';
import 'package:qorix_markets_flutter/services/api/investment_api_service.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';

final investmentRepositoryProvider = Provider<InvestmentRepository>((ref) {
  return InvestmentRepositoryImpl(ref.watch(investmentApiServiceProvider));
});

class InvestmentRepositoryImpl implements InvestmentRepository {
  InvestmentRepositoryImpl(this._api);
  final InvestmentApiService _api;

  Future<InvestmentState> _wrap(Future<dynamic> Function() call) async {
    try {
      final model = await call();
      return model.toEntity();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<InvestmentState> getInvestment() async {
    try {
      return await _wrap(() => _api.getInvestment());
    } on DioException catch (e) {
      if (e.response?.statusCode == 404 && UiDemoMode.isActive) {
        return UiDemoFixtures.investment();
      }
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<InvestmentState> startInvestment({
    required double amount,
    required String riskLevel,
  }) {
    if (UiDemoMode.blocksWriteApi) {
      return Future.value(
        UiDemoFixtures.investment().copyWith(isActive: true, amount: amount, riskLevel: riskLevel),
      );
    }
    return _wrap(() => _api.startInvestment(amount: amount, riskLevel: riskLevel));
  }

  @override
  Future<InvestmentState> stopInvestment() {
    if (UiDemoMode.blocksWriteApi) {
      return Future.value(UiDemoFixtures.investment().copyWith(isActive: false));
    }
    return _wrap(() => _api.stopInvestment());
  }

  @override
  Future<InvestmentState> updateProtection({required double drawdownLimit}) {
    if (UiDemoMode.blocksWriteApi) {
      return Future.value(UiDemoFixtures.investment().copyWith(drawdownLimit: drawdownLimit));
    }
    return _wrap(() => _api.updateProtection(drawdownLimit: drawdownLimit));
  }

  @override
  Future<InvestmentState> updateCompounding({required bool autoCompound}) {
    if (UiDemoMode.blocksWriteApi) {
      return Future.value(UiDemoFixtures.investment().copyWith(autoCompound: autoCompound));
    }
    return _wrap(() => _api.updateCompounding(autoCompound: autoCompound));
  }

  @override
  Future<List<TradeModel>> getTrades({int page = 1, int limit = 20}) async {
    if (UiDemoMode.isActive) return UiDemoFixtures.deskTrades();
    try {
      return await _api.getTrades(page: page, limit: limit);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<InvestmentState> topup({required double amount}) {
    if (UiDemoMode.blocksWriteApi) {
      final base = UiDemoFixtures.investment();
      return Future.value(base.copyWith(isActive: true));
    }
    return _wrap(() => _api.topup(amount: amount));
  }

  @override
  Future<InvestmentState> queueRiskLevelChange({required String riskLevel}) {
    if (UiDemoMode.blocksWriteApi) {
      return Future.value(
        UiDemoFixtures.investment().copyWith(
          isActive: true,
          pendingRiskLevel: riskLevel.toUpperCase(),
          pendingRiskLevelDate: DateTime.now().add(const Duration(days: 1)).toIso8601String().split('T').first,
        ),
      );
    }
    return _wrap(() => _api.queueRiskLevelChange(riskLevel: riskLevel));
  }

  @override
  Future<InvestmentState> cancelRiskLevelChange() {
    if (UiDemoMode.blocksWriteApi) {
      return Future.value(UiDemoFixtures.investment().copyWith(isActive: true, clearPendingRisk: true));
    }
    return _wrap(_api.cancelRiskLevelChange);
  }
}
