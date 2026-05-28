import 'package:equatable/equatable.dart';

class DepositAddressEntity extends Equatable {
  const DepositAddressEntity({required this.address, required this.network, required this.token});
  final String address;
  final String network;
  final String token;
  @override
  List<Object?> get props => [address, network, token];
}

class BlockchainDepositEntity extends Equatable {
  const BlockchainDepositEntity({required this.id, required this.amount, required this.status, required this.createdAt});
  final String id;
  final double amount;
  final String status;
  final DateTime createdAt;
  @override
  List<Object?> get props => [id, amount, status, createdAt];
}
