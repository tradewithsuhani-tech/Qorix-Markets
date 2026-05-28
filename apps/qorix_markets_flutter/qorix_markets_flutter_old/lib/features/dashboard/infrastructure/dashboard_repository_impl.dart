import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/dashboard_summary_model.dart';
import 'package:qorix_markets_flutter/features/dashboard/domain/entities/dashboard_snapshot.dart';
import 'package:qorix_markets_flutter/features/dashboard/domain/repositories/dashboard_repository.dart';
import 'package:qorix_markets_flutter/services/api/dashboard_api_service.dart';

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  return DashboardRepositoryImpl(ref.watch(dashboardApiServiceProvider));
});

class DashboardRepositoryImpl implements DashboardRepository {
  DashboardRepositoryImpl(this._api);
  final DashboardApiService _api;

  @override
  Future<DashboardSnapshot> getSnapshot() async {
    try {
      final model = await _api.getSummary();
      final fundStats = await _api.getFundStats();
      return model.toSnapshot(fundStats: fundStats);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }
}
