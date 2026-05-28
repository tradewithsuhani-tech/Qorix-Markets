import 'package:equatable/equatable.dart';

class MarketPair extends Equatable {
  const MarketPair({
    required this.symbol,
    required this.price,
    required this.changePercent,
    this.change24h,
    this.volume24h,
  });

  final String symbol;
  final double price;
  final double changePercent;
  final double? change24h;
  final double? volume24h;

  @override
  List<Object?> get props => [symbol, price, changePercent, change24h, volume24h];
}

class Holding extends Equatable {
  const Holding({
    required this.symbol,
    required this.amount,
    required this.value,
    required this.pnl,
    required this.pnlPercent,
  });
  final String symbol;
  final double amount;
  final double value;
  final double pnl;
  final double pnlPercent;
  @override
  List<Object?> get props => [symbol, amount, value, pnl, pnlPercent];
}
