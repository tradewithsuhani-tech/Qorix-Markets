import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/bots/domain/entities/bot_entity.dart';
import 'package:qorix_markets_flutter/features/bots/infrastructure/bots_repository_impl.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';

final botsListProvider = AsyncNotifierProvider<BotsListNotifier, List<BotEntity>>(BotsListNotifier.new);

final botsPerformanceProvider =
    AsyncNotifierProvider<BotsPerformanceNotifier, List<BotPerformanceEntity>>(BotsPerformanceNotifier.new);

class BotsListNotifier extends AsyncNotifier<List<BotEntity>> with CachedAsyncMixin<List<BotEntity>> {
  @override
  Future<List<BotEntity>> build() async {
    ref.keepAlive();
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.botsList();
      cacheValue(data);
      return data;
    }
    final data = await ref.read(botsRepositoryProvider).getBotsList();
    cacheValue(data);
    return data;
  }

  Future<void> refresh() {
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.botsList();
      cacheValue(data);
      state = AsyncData(data);
      return Future.value();
    }
    return softRefresh(() => ref.read(botsRepositoryProvider).getBotsList());
  }
}

class BotsPerformanceNotifier extends AsyncNotifier<List<BotPerformanceEntity>>
    with CachedAsyncMixin<List<BotPerformanceEntity>> {
  @override
  Future<List<BotPerformanceEntity>> build() async {
    ref.keepAlive();
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.botsPerformance();
      cacheValue(data);
      return data;
    }
    final data = await ref.read(botsRepositoryProvider).getBotsPerformance();
    cacheValue(data);
    return data;
  }

  Future<void> refresh() {
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.botsPerformance();
      cacheValue(data);
      state = AsyncData(data);
      return Future.value();
    }
    return softRefresh(() => ref.read(botsRepositoryProvider).getBotsPerformance());
  }
}
