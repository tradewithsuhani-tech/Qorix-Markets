import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/inr_payout_method_model.dart';
import 'package:qorix_markets_flutter/data/models/inr_deposit_submit_result.dart'
    show InrDepositSubmitResult, InrWithdrawSubmitResult;
import 'package:qorix_markets_flutter/data/models/inr_merchant_model.dart';
import 'package:qorix_markets_flutter/data/models/transaction_model.dart';
import 'package:qorix_markets_flutter/data/models/wallet_model.dart';

final walletApiServiceProvider = Provider<WalletApiService>((ref) {
  return WalletApiService(
    readClient: ref.watch(apiClientProvider),
    writeClient: ref.watch(legacyApiClientProvider),
  );
});

/// Reads via `/api/v1`, wallet/deposit writes via `/api`.
class WalletApiService {
  const WalletApiService({
    required ApiClient readClient,
    required ApiClient writeClient,
  })  : _readClient = readClient,
        _writeClient = writeClient;

  final ApiClient _readClient;
  final ApiClient _writeClient;

  Future<WalletModel> getBalance() async {
    final res = await _readClient.get<Map<String, dynamic>>(ApiEndpoints.walletBalance);
    return WalletModel.fromJson(res.data ?? {});
  }

  Future<TransactionListModel> getHistory({
    int page = 1,
    int limit = 25,
    String? type,
  }) async {
    final res = await _readClient.get<Map<String, dynamic>>(
      ApiEndpoints.walletHistory,
      queryParameters: {
        'page': page,
        'limit': limit,
        if (type != null && type.isNotEmpty) 'type': type,
      },
    );
    return TransactionListModel.fromJson(res.data ?? {});
  }

  Future<WalletModel> deposit({required double amount, String? txHash}) async {
    final res = await _writeClient.post<Map<String, dynamic>>(
      ApiEndpoints.walletDeposit,
      data: {
        'amount': amount,
        if (txHash != null) 'txHash': txHash,
      },
    );
    return WalletModel.fromJson(res.data ?? {});
  }

  Future<Map<String, dynamic>> getDepositAddress() async {
    final res = await _writeClient.get<Map<String, dynamic>>(ApiEndpoints.depositAddress);
    return res.data ?? {};
  }

  Future<Map<String, dynamic>> getDepositHistory({int limit = 20}) async {
    final res = await _writeClient.get<Map<String, dynamic>>(
      ApiEndpoints.depositHistory,
      queryParameters: {'limit': limit},
    );
    return res.data ?? {};
  }

  Future<List<InrMerchantModel>> getInrMerchants({
    required String method,
    required double amount,
  }) async {
    final res = await _writeClient.get<dynamic>(
      ApiEndpoints.depositInrMerchants,
      queryParameters: {
        'method': method,
        'amount': amount,
      },
    );
    return ApiJson.list(res.data).map(InrMerchantModel.fromJson).toList();
  }

  Future<InrDepositSubmitResult> submitInrDeposit({
    required double amount,
    required String method,
    required String merchantId,
    required String utr,
    String? referenceCode,
  }) async {
    final res = await _writeClient.post<Map<String, dynamic>>(
      ApiEndpoints.depositInrSubmit,
      data: {
        'amount': amount,
        'method': method,
        'merchantId': merchantId,
        'paymentMethodId': merchantId,
        'utr': utr.trim(),
        if (referenceCode != null && referenceCode.trim().isNotEmpty)
          'referenceCode': referenceCode.trim(),
      },
    );
    return InrDepositSubmitResult.fromJson(ApiJson.object(res.data));
  }

  Future<void> withdraw({
    required double amount,
    required String walletAddress,
    String? otp,
  }) async {
    await _writeClient.post(
      ApiEndpoints.walletWithdraw,
      data: {
        'amount': amount,
        'walletAddress': walletAddress,
        if (otp != null) 'otp': otp,
      },
    );
  }

  Future<InrWithdrawSubmitResult> withdrawInr({
    required double amount,
    required String payoutMethod,
    required String destination,
    required String otp,
  }) async {
    final res = await _writeClient.post<Map<String, dynamic>>(
      ApiEndpoints.walletWithdrawInr,
      data: {
        'amount': amount,
        'payoutMethod': payoutMethod,
        'destination': destination,
        'otp': otp,
      },
    );
    return InrWithdrawSubmitResult.fromJson(ApiJson.object(res.data));
  }

  Future<List<InrPayoutMethodModel>> getPayoutMethods() async {
    final res = await _readClient.get<dynamic>(ApiEndpoints.walletPayoutMethods);
    return parseInrPayoutMethodsList(res.data);
  }

  Future<InrPayoutMethodModel> addPayoutMethod(Map<String, dynamic> body) async {
    final res = await _writeClient.post<Map<String, dynamic>>(
      ApiEndpoints.walletPayoutMethods,
      data: body,
    );
    final root = ApiJson.object(res.data);
    if (root['method'] is Map) {
      return InrPayoutMethodModel.fromJson(Map<String, dynamic>.from(root['method'] as Map));
    }
    return InrPayoutMethodModel.fromJson(root);
  }

  Future<void> deletePayoutMethod(int id) async {
    await _writeClient.delete(ApiEndpoints.walletPayoutMethod(id));
  }

  Future<void> setDefaultPayoutMethod(int id) async {
    await _writeClient.patch(ApiEndpoints.walletPayoutMethodDefault(id));
  }

  Future<WalletModel> transfer({
    required double amount,
    required String direction,
    String source = 'main',
  }) async {
    final res = await _writeClient.post<Map<String, dynamic>>(
      ApiEndpoints.walletTransfer,
      data: {
        'amount': amount,
        'direction': direction,
        'source': source,
      },
    );
    return WalletModel.fromJson(res.data ?? {});
  }
}
