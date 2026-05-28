import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_entity.dart';

class WalletModel {
  const WalletModel({
    required this.mainBalance,
    required this.tradingBalance,
    required this.profitBalance,
    this.available,
    this.pending,
    this.currency,
  });

  factory WalletModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    final main = ApiJson.asDouble(root['mainBalance'] ?? root['main'] ?? root['available'] ?? root['balance']);
    final trading = ApiJson.asDouble(root['tradingBalance'] ?? root['trading']);
    final profit = ApiJson.asDouble(root['profitBalance'] ?? root['profit'] ?? root['pending']);
    return WalletModel(
      mainBalance: main,
      tradingBalance: trading,
      profitBalance: profit,
      available: ApiJson.asDouble(root['available'], fallback: main),
      pending: ApiJson.asDouble(root['pending'], fallback: profit),
      currency: root['currency'] as String? ?? 'USDT',
    );
  }

  final double mainBalance;
  final double tradingBalance;
  final double profitBalance;
  final double? available;
  final double? pending;
  final String? currency;

  double get totalBalance => mainBalance + tradingBalance + profitBalance;

  WalletEntity toEntity() => WalletEntity(
        balance: totalBalance,
        available: available ?? mainBalance,
        pending: pending ?? profitBalance,
        currency: currency ?? 'USDT',
        mainBalance: mainBalance,
        tradingBalance: tradingBalance,
        profitBalance: profitBalance,
      );
}
