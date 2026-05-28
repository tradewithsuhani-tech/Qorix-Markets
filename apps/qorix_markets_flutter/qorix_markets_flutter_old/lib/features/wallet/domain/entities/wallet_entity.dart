import 'package:equatable/equatable.dart';

class WalletEntity extends Equatable {
  const WalletEntity({
    required this.balance,
    required this.available,
    required this.currency,
    this.pending = 0,
    this.mainBalance = 0,
    this.tradingBalance = 0,
    this.profitBalance = 0,
  });

  final double balance;
  final double available;
  final String currency;
  final double pending;
  final double mainBalance;
  final double tradingBalance;
  final double profitBalance;

  @override
  List<Object?> get props => [balance, available, currency, pending, mainBalance, tradingBalance, profitBalance];
}

class TransactionEntity extends Equatable {
  const TransactionEntity({
    required this.id,
    required this.type,
    required this.amount,
    required this.currency,
    required this.status,
    required this.createdAt,
    this.description,
  });

  final String id;
  final String type;
  final double amount;
  final String currency;
  final String status;
  final DateTime createdAt;
  final String? description;

  bool get isCredit => amount >= 0;

  @override
  List<Object?> get props => [id, type, amount, currency, status, createdAt, description];
}
