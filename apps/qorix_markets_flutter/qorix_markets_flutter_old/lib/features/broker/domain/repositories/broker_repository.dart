import 'package:qorix_markets_flutter/data/models/broker_models.dart';

abstract class BrokerRepository {
  Future<BrokerStatusModel> getStatus();
  Future<BrokerStatusModel> setMode(BrokerTradingMode mode);
  Future<BrokerLoginUrlModel> getZerodhaLoginUrl();
  Future<BrokerStatusModel> connectZerodha({required String requestToken});
  Future<BrokerStatusModel> disconnectZerodha();
  Future<BrokerTerminalSnapshot> loadTerminal();
  Future<BrokerDemoOrderModel> placeDemoOrder({
    required String symbol,
    required String side,
    required int quantity,
    double? price,
  });
  Future<void> resetDemoPortfolio();
}
