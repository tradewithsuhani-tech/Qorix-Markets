import 'package:qorix_markets_flutter/core/network/api_json.dart';

class MarketsBalanceModel {
  const MarketsBalanceModel({
    this.inrBalance = 0,
    this.usdtBalance = 0,
    this.currency = 'INR',
    this.pair = 'USDT/INR',
  });

  factory MarketsBalanceModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return MarketsBalanceModel(
      inrBalance: ApiJson.asDouble(root['inrBalance']),
      usdtBalance: ApiJson.asDouble(root['usdtBalance']),
      currency: root['currency'] as String? ?? 'INR',
      pair: root['pair'] as String? ?? 'USDT/INR',
    );
  }

  final double inrBalance;
  final double usdtBalance;
  final String currency;
  final String pair;
}
