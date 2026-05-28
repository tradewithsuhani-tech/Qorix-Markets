/// Demo data for USDT/INR spot market (UI preview).
abstract final class MarketsDemo {
  static const pair = 'USDT/INR';
  static const baseInr = 83.52;
  static const high24h = 84.18;
  static const low24h = 82.91;
  static const vol24hUsdt = 2184320.0;
  static const change24hPct = 0.34;

  static const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D'];

  static List<OrderBookRow> asks(double mid) => [
        OrderBookRow(price: mid + 0.08, amount: 8420, side: BookSide.ask, depth: 0.92),
        OrderBookRow(price: mid + 0.06, amount: 12650, side: BookSide.ask, depth: 0.78),
        OrderBookRow(price: mid + 0.04, amount: 5310, side: BookSide.ask, depth: 0.55),
        OrderBookRow(price: mid + 0.02, amount: 18900, side: BookSide.ask, depth: 0.68),
        OrderBookRow(price: mid + 0.01, amount: 7420, side: BookSide.ask, depth: 0.42),
      ];

  static List<OrderBookRow> bids(double mid) => [
        OrderBookRow(price: mid - 0.01, amount: 9100, side: BookSide.bid, depth: 0.48),
        OrderBookRow(price: mid - 0.02, amount: 15400, side: BookSide.bid, depth: 0.72),
        OrderBookRow(price: mid - 0.04, amount: 6200, side: BookSide.bid, depth: 0.35),
        OrderBookRow(price: mid - 0.06, amount: 22100, side: BookSide.bid, depth: 0.88),
        OrderBookRow(price: mid - 0.08, amount: 4800, side: BookSide.bid, depth: 0.28),
      ];

  static const recentTrades = [
    MarketTrade(price: 83.52, amount: 120, isBuy: true, timeLabel: '14:32:08'),
    MarketTrade(price: 83.51, amount: 450, isBuy: false, timeLabel: '14:32:05'),
    MarketTrade(price: 83.53, amount: 80, isBuy: true, timeLabel: '14:31:58'),
    MarketTrade(price: 83.50, amount: 920, isBuy: false, timeLabel: '14:31:44'),
    MarketTrade(price: 83.54, amount: 210, isBuy: true, timeLabel: '14:31:30'),
    MarketTrade(price: 83.49, amount: 1500, isBuy: false, timeLabel: '14:31:12'),
  ];

  static List<SpotOrder> initialOpenOrders(double mid) => [
        SpotOrder(
          id: 'OX-8841',
          isBuy: true,
          isLimit: true,
          price: mid - 0.12,
          amount: 250,
          status: SpotOrderStatus.open,
          createdAt: DateTime.now().subtract(const Duration(minutes: 18)),
        ),
        SpotOrder(
          id: 'OX-8836',
          isBuy: false,
          isLimit: true,
          price: mid + 0.24,
          amount: 180,
          status: SpotOrderStatus.open,
          createdAt: DateTime.now().subtract(const Duration(hours: 1, minutes: 4)),
        ),
      ];

  static const orderHistory = [
    SpotOrder(
      id: 'HX-7720',
      isBuy: true,
      isLimit: false,
      price: 83.48,
      amount: 500,
      status: SpotOrderStatus.filled,
      createdAt: null,
      filledAt: null,
      filledPrice: 83.48,
      timeLabel: 'Today 13:42',
    ),
    SpotOrder(
      id: 'HX-7714',
      isBuy: false,
      isLimit: true,
      price: 83.62,
      amount: 320,
      status: SpotOrderStatus.filled,
      createdAt: null,
      filledAt: null,
      filledPrice: 83.62,
      timeLabel: 'Today 11:08',
    ),
    SpotOrder(
      id: 'HX-7701',
      isBuy: true,
      isLimit: true,
      price: 83.35,
      amount: 150,
      status: SpotOrderStatus.cancelled,
      createdAt: null,
      filledAt: null,
      filledPrice: null,
      timeLabel: 'Yesterday 19:21',
    ),
    SpotOrder(
      id: 'HX-7698',
      isBuy: false,
      isLimit: false,
      price: 83.41,
      amount: 890,
      status: SpotOrderStatus.filled,
      createdAt: null,
      filledAt: null,
      filledPrice: 83.41,
      timeLabel: 'Yesterday 16:55',
    ),
  ];

  static String nextOrderId(String prefix) {
    final n = DateTime.now().millisecondsSinceEpoch % 100000;
    return '$prefix-$n';
  }
}

enum SpotOrderStatus { open, filled, cancelled, partial }

class SpotOrder {
  const SpotOrder({
    required this.id,
    required this.isBuy,
    required this.isLimit,
    required this.price,
    required this.amount,
    required this.status,
    this.createdAt,
    this.filledAt,
    this.filledPrice,
    this.timeLabel,
  });

  final String id;
  final bool isBuy;
  final bool isLimit;
  final double price;
  final double amount;
  final SpotOrderStatus status;
  final DateTime? createdAt;
  final DateTime? filledAt;
  final double? filledPrice;
  final String? timeLabel;

  double get totalInr => price * amount;

  String get sideLabel => isBuy ? 'Buy' : 'Sell';

  String get typeLabel => isLimit ? 'Limit' : 'Market';

  String get statusLabel => switch (status) {
        SpotOrderStatus.open => 'Open',
        SpotOrderStatus.filled => 'Filled',
        SpotOrderStatus.cancelled => 'Cancelled',
        SpotOrderStatus.partial => 'Partial',
      };

  SpotOrder copyWith({SpotOrderStatus? status}) => SpotOrder(
        id: id,
        isBuy: isBuy,
        isLimit: isLimit,
        price: price,
        amount: amount,
        status: status ?? this.status,
        createdAt: createdAt,
        filledAt: filledAt,
        filledPrice: filledPrice,
        timeLabel: timeLabel,
      );
}

enum BookSide { ask, bid }

class OrderBookRow {
  const OrderBookRow({
    required this.price,
    required this.amount,
    required this.side,
    required this.depth,
  });

  final double price;
  final double amount;
  final BookSide side;
  final double depth;
}

class MarketTrade {
  const MarketTrade({
    required this.price,
    required this.amount,
    required this.isBuy,
    required this.timeLabel,
  });

  final double price;
  final double amount;
  final bool isBuy;
  final String timeLabel;
}
