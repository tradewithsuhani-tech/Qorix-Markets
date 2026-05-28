import 'package:qorix_markets_flutter/features/bots/domain/entities/bot_entity.dart';

abstract interface class BotsRepository {
  Future<List<BotEntity>> getBotsList();
  Future<List<BotPerformanceEntity>> getBotsPerformance();
}
