import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/data/models/broker_models.dart';
import 'package:qorix_markets_flutter/features/broker/domain/repositories/broker_repository.dart';
import 'package:qorix_markets_flutter/services/api/broker_api_service.dart';

class BrokerRepositoryImpl implements BrokerRepository {
  BrokerRepositoryImpl(this._ref);

  final Ref _ref;

  BrokerApiService get _api => _ref.read(brokerApiServiceProvider);

  @override
  Future<BrokerStatusModel> getStatus() => _api.getStatus();

  @override
  Future<BrokerStatusModel> setMode(BrokerTradingMode mode) => _api.setMode(mode);

  @override
  Future<BrokerLoginUrlModel> getZerodhaLoginUrl() => _api.getZerodhaLoginUrl();

  @override
  Future<BrokerStatusModel> connectZerodha({required String requestToken}) =>
      _api.connectZerodha(requestToken: requestToken);

  @override
  Future<BrokerStatusModel> disconnectZerodha() => _api.disconnectZerodha();

  @override
  Future<BrokerTerminalSnapshot> loadTerminal() async {
    final status = await _api.getStatus();
    final results = await Future.wait([
      _api.getProfile(),
      _api.getFunds(),
      _api.getHoldings(),
      _api.getPositions(),
    ]);
    final profile = results[0] as BrokerProfileModel;
    final funds = results[1] as BrokerFundsModel;
    final holdings = results[2] as List<BrokerHoldingModel>;
    final positions = results[3] as List<BrokerPositionModel>;

    final watch = holdings.isEmpty
        ? brokerDefaultWatchlist
        : holdings.map((h) => h.instrument).toList();
    final quotes = await _api.getQuotes(watch);

    return BrokerTerminalSnapshot(
      status: status,
      profile: profile,
      funds: funds,
      holdings: holdings,
      positions: positions,
      quotes: quotes,
    );
  }

  @override
  Future<BrokerDemoOrderModel> placeDemoOrder({
    required String symbol,
    required String side,
    required int quantity,
    double? price,
  }) =>
      _api.placeDemoOrder(symbol: symbol, side: side, quantity: quantity, price: price);

  @override
  Future<void> resetDemoPortfolio() => _api.resetDemoPortfolio();
}
