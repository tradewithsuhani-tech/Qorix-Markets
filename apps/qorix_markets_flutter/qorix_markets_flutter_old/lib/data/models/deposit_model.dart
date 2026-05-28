import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/deposit_entity.dart';

class DepositAddressModel {
  const DepositAddressModel({required this.address, required this.network, required this.token});

  factory DepositAddressModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return DepositAddressModel(
      address: root['address'] as String? ?? '',
      network: root['network'] as String? ?? 'TRC20',
      token: root['token'] as String? ?? 'USDT',
    );
  }

  final String address;
  final String network;
  final String token;

  DepositAddressEntity toEntity() => DepositAddressEntity(address: address, network: network, token: token);
}

class BlockchainDepositModel {
  const BlockchainDepositModel({required this.id, required this.amount, required this.status, required this.createdAt});

  factory BlockchainDepositModel.fromJson(Map<String, dynamic> json) => BlockchainDepositModel(
        id: json['id']?.toString() ?? '',
        amount: ApiJson.asDouble(json['amount']),
        status: json['status'] as String? ?? 'pending',
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      );

  final String id;
  final double amount;
  final String status;
  final DateTime createdAt;

  BlockchainDepositEntity toEntity() => BlockchainDepositEntity(id: id, amount: amount, status: status, createdAt: createdAt);
}

class BlockchainDepositHistoryModel {
  const BlockchainDepositHistoryModel({required this.deposits});

  factory BlockchainDepositHistoryModel.fromJson(Map<String, dynamic> json) {
    final list = ApiJson.list(json['deposits'] ?? json['items'] ?? json);
    return BlockchainDepositHistoryModel(
      deposits: list.map((e) => BlockchainDepositModel.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
    );
  }

  final List<BlockchainDepositModel> deposits;
}
