import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/features/bots/domain/entities/bot_entity.dart';
import 'package:qorix_markets_flutter/features/bots/domain/repositories/bots_repository.dart';
import 'package:qorix_markets_flutter/services/api/bots_api_service.dart';

final botsRepositoryProvider = Provider<BotsRepository>((ref) {
  return BotsRepositoryImpl(ref.watch(botsApiServiceProvider));
});

class BotsRepositoryImpl implements BotsRepository {
  BotsRepositoryImpl(this._api);

  final BotsApiService _api;

  @override
  Future<List<BotEntity>> getBotsList() async {
    try {
      final list = await _api.getBotsList();
      return list.items.map((m) => m.toEntity()).toList();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<List<BotPerformanceEntity>> getBotsPerformance() async {
    try {
      final perf = await _api.getBotsPerformance();
      return perf.items.map((m) => m.toEntity()).toList();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }
}
