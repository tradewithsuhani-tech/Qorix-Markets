import 'package:qorix_markets_flutter/core/network/api_json.dart';

enum BrokerTradingMode { demo, live }

class BrokerStatusModel {
  const BrokerStatusModel({
    required this.mode,
    this.activeBroker,
    required this.zerodhaConnected,
    this.zerodhaUserId,
    this.zerodhaUserName,
    this.zerodhaConnectedAt,
  });

  final BrokerTradingMode mode;
  final String? activeBroker;
  final bool zerodhaConnected;
  final String? zerodhaUserId;
  final String? zerodhaUserName;
  final String? zerodhaConnectedAt;

  factory BrokerStatusModel.fromJson(Map<String, dynamic> json) {
    final z = json['zerodha'] is Map ? Map<String, dynamic>.from(json['zerodha'] as Map) : const {};
    final modeRaw = '${json['mode'] ?? 'demo'}';
    return BrokerStatusModel(
      mode: modeRaw == 'live' ? BrokerTradingMode.live : BrokerTradingMode.demo,
      activeBroker: json['activeBroker'] as String?,
      zerodhaConnected: z['connected'] == true,
      zerodhaUserId: z['userId'] as String?,
      zerodhaUserName: z['userName'] as String?,
      zerodhaConnectedAt: z['connectedAt'] as String?,
    );
  }
}

class BrokerLoginUrlModel {
  const BrokerLoginUrlModel({required this.url, required this.redirectUrl});

  final String url;
  final String redirectUrl;

  factory BrokerLoginUrlModel.fromJson(Map<String, dynamic> json) {
    return BrokerLoginUrlModel(
      url: '${json['url'] ?? ''}',
      redirectUrl: '${json['redirectUrl'] ?? ''}',
    );
  }
}

class BrokerProfileModel {
  const BrokerProfileModel({
    required this.broker,
    required this.mode,
    required this.userId,
    required this.userName,
    this.email,
    this.exchanges = const [],
    required this.connected,
  });

  final String broker;
  final String mode;
  final String userId;
  final String userName;
  final String? email;
  final List<String> exchanges;
  final bool connected;

  factory BrokerProfileModel.fromJson(Map<String, dynamic> json) {
    return BrokerProfileModel(
      broker: '${json['broker'] ?? 'demo'}',
      mode: '${json['mode'] ?? 'demo'}',
      userId: '${json['userId'] ?? ''}',
      userName: '${json['userName'] ?? ''}',
      email: json['email'] as String?,
      exchanges: (json['exchanges'] as List?)?.map((e) => '$e').toList() ?? const [],
      connected: json['connected'] == true,
    );
  }
}

class BrokerHoldingModel {
  const BrokerHoldingModel({
    required this.tradingsymbol,
    required this.exchange,
    required this.quantity,
    required this.averagePrice,
    required this.lastPrice,
    required this.pnl,
    required this.dayChangePct,
  });

  final String tradingsymbol;
  final String exchange;
  final int quantity;
  final double averagePrice;
  final double lastPrice;
  final double pnl;
  final double dayChangePct;

  String get instrument => '$exchange:$tradingsymbol';

  factory BrokerHoldingModel.fromJson(Map<String, dynamic> json) {
    return BrokerHoldingModel(
      tradingsymbol: '${json['tradingsymbol'] ?? ''}',
      exchange: '${json['exchange'] ?? 'NSE'}',
      quantity: ApiJson.asInt(json['quantity']),
      averagePrice: ApiJson.asDouble(json['averagePrice']),
      lastPrice: ApiJson.asDouble(json['lastPrice']),
      pnl: ApiJson.asDouble(json['pnl']),
      dayChangePct: ApiJson.asDouble(json['dayChangePct']),
    );
  }
}

class BrokerPositionModel {
  const BrokerPositionModel({
    required this.tradingsymbol,
    required this.exchange,
    required this.product,
    required this.quantity,
    required this.averagePrice,
    required this.lastPrice,
    required this.pnl,
  });

  final String tradingsymbol;
  final String exchange;
  final String product;
  final int quantity;
  final double averagePrice;
  final double lastPrice;
  final double pnl;

  factory BrokerPositionModel.fromJson(Map<String, dynamic> json) {
    return BrokerPositionModel(
      tradingsymbol: '${json['tradingsymbol'] ?? ''}',
      exchange: '${json['exchange'] ?? 'NSE'}',
      product: '${json['product'] ?? ''}',
      quantity: ApiJson.asInt(json['quantity']),
      averagePrice: ApiJson.asDouble(json['averagePrice']),
      lastPrice: ApiJson.asDouble(json['lastPrice']),
      pnl: ApiJson.asDouble(json['pnl']),
    );
  }
}

class BrokerFundsModel {
  const BrokerFundsModel({
    required this.available,
    required this.used,
    required this.total,
    required this.currency,
  });

  final double available;
  final double used;
  final double total;
  final String currency;

  factory BrokerFundsModel.fromJson(Map<String, dynamic> json) {
    return BrokerFundsModel(
      available: ApiJson.asDouble(json['available']),
      used: ApiJson.asDouble(json['used']),
      total: ApiJson.asDouble(json['total']),
      currency: '${json['currency'] ?? 'INR'}',
    );
  }
}

class BrokerQuoteModel {
  const BrokerQuoteModel({
    required this.instrument,
    required this.tradingsymbol,
    required this.exchange,
    required this.lastPrice,
    required this.change,
    required this.changePct,
  });

  final String instrument;
  final String tradingsymbol;
  final String exchange;
  final double lastPrice;
  final double change;
  final double changePct;

  factory BrokerQuoteModel.fromJson(Map<String, dynamic> json) {
    return BrokerQuoteModel(
      instrument: '${json['instrument'] ?? ''}',
      tradingsymbol: '${json['tradingsymbol'] ?? ''}',
      exchange: '${json['exchange'] ?? 'NSE'}',
      lastPrice: ApiJson.asDouble(json['lastPrice']),
      change: ApiJson.asDouble(json['change']),
      changePct: ApiJson.asDouble(json['changePct']),
    );
  }
}

class BrokerDemoOrderModel {
  const BrokerDemoOrderModel({
    required this.id,
    required this.symbol,
    required this.side,
    required this.quantity,
    required this.price,
    required this.filledAt,
  });

  final String id;
  final String symbol;
  final String side;
  final int quantity;
  final double price;
  final String filledAt;

  factory BrokerDemoOrderModel.fromJson(Map<String, dynamic> json) {
    return BrokerDemoOrderModel(
      id: '${json['id'] ?? ''}',
      side: '${json['side'] ?? ''}',
      symbol: '${json['symbol'] ?? ''}',
      quantity: ApiJson.asInt(json['quantity']),
      price: ApiJson.asDouble(json['price']),
      filledAt: '${json['filledAt'] ?? ''}',
    );
  }
}

/// Default NSE watchlist when user has no holdings.
const brokerDefaultWatchlist = [
  'NSE:RELIANCE',
  'NSE:TCS',
  'NSE:INFY',
  'NSE:HDFCBANK',
  'NSE:ICICIBANK',
];

class BrokerTerminalSnapshot {
  const BrokerTerminalSnapshot({
    required this.status,
    required this.profile,
    required this.funds,
    required this.holdings,
    required this.positions,
    required this.quotes,
  });

  final BrokerStatusModel status;
  final BrokerProfileModel profile;
  final BrokerFundsModel funds;
  final List<BrokerHoldingModel> holdings;
  final List<BrokerPositionModel> positions;
  final List<BrokerQuoteModel> quotes;
}
