import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/deposit_model.dart';
import 'package:qorix_markets_flutter/data/models/inr_deposit_submit_result.dart';
import 'package:qorix_markets_flutter/data/models/inr_merchant_model.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/inr_payout_method.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/deposit_demo.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/inr_payout_methods_demo.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_inr_options.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/deposit_entity.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_entity.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_history_page.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/repositories/wallet_repository.dart';
import 'package:qorix_markets_flutter/services/api/wallet_api_service.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';

List<P2pMerchant> inrMerchantsToPresentation(List<InrMerchantModel> merchants) {
  if (merchants.isEmpty) return DepositMerchants.list;
  return merchants
      .map((m) {
        final fallback = DepositMerchants.byId(m.id);
        return P2pMerchant(
          id: m.id,
          name: m.name,
          limitLabel: fallback.limitLabel,
          avatarLetter: m.name.isNotEmpty ? m.name[0].toUpperCase() : 'M',
          ringColor: fallback.ringColor,
          upiId: fallback.upiId,
          referenceCode: fallback.referenceCode,
          accountHolder: fallback.accountHolder,
          accountNumber: fallback.accountNumber,
          ifsc: fallback.ifsc,
          bankName: fallback.bankName,
        );
      })
      .toList();
}

final walletRepositoryProvider = Provider<WalletRepository>((ref) {
  return WalletRepositoryImpl(ref.watch(walletApiServiceProvider));
});

class WalletRepositoryImpl implements WalletRepository {
  WalletRepositoryImpl(this._api);

  final WalletApiService _api;

  @override
  Future<WalletEntity> getWallet() async {
    try {
      final model = await _api.getBalance();
      return model.toEntity();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<List<TransactionEntity>> getTransactions({int limit = 20}) async {
    try {
      final page = await _api.getHistory(page: 1, limit: limit);
      return page.items.map((m) => m.toEntity()).toList();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<WalletHistoryPage> getHistoryPage({int page = 1, int limit = 25}) async {
    try {
      final result = await _api.getHistory(page: page, limit: limit);
      return WalletHistoryPage(
        items: result.items.map((m) => m.toEntity()).toList(),
        page: result.page,
        total: result.total,
        hasMore: result.hasMore,
      );
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<WalletEntity> deposit({required double amount, required String asset}) async {
    if (UiDemoMode.blocksWriteApi) return UiDemoFixtures.wallet();
    try {
      final model = await _api.deposit(amount: amount);
      return model.toEntity();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> withdraw({
    required double amount,
    required String address,
    required String asset,
    String? otp,
  }) async {
    if (UiDemoMode.blocksWriteApi) return;
    try {
      await _api.withdraw(amount: amount, walletAddress: address, otp: otp);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<DepositAddressEntity> getDepositAddress() async {
    try {
      final data = await _api.getDepositAddress();
      return DepositAddressModel.fromJson(data).toEntity();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<List<BlockchainDepositEntity>> getDepositHistory({int limit = 20}) async {
    try {
      final data = await _api.getDepositHistory(limit: limit);
      final history = BlockchainDepositHistoryModel.fromJson(data);
      return history.deposits.map((m) => m.toEntity()).toList();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<WalletEntity> transfer({
    required double amount,
    required String direction,
    String source = 'main',
  }) async {
    if (UiDemoMode.blocksWriteApi) return UiDemoFixtures.wallet();
    try {
      final model = await _api.transfer(
        amount: amount,
        direction: direction,
        source: source,
      );
      return model.toEntity();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<InrDepositSubmitResult> submitInrDeposit({
    required double amount,
    required String method,
    required String merchantId,
    required String utr,
    String? referenceCode,
  }) async {
    if (UiDemoMode.blocksWriteApi) {
      return const InrDepositSubmitResult(
        id: 0,
        status: 'pending',
        message: 'Deposit submitted (demo)',
      );
    }
    try {
      return await _api.submitInrDeposit(
        amount: amount,
        method: method,
        merchantId: merchantId,
        utr: utr,
        referenceCode: referenceCode,
      );
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<InrWithdrawSubmitResult> withdrawInr({
    required double amount,
    required String payoutMethod,
    required String destination,
    required String otp,
  }) async {
    if (UiDemoMode.blocksWriteApi) {
      return InrWithdrawSubmitResult(
        id: 0,
        status: 'pending',
        amount: amount,
        message: 'Withdrawal submitted (demo)',
      );
    }
    try {
      return await _api.withdrawInr(
        amount: amount,
        payoutMethod: payoutMethod,
        destination: destination,
        otp: otp,
      );
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<List<P2pMerchant>> getInrMerchants({
    required String method,
    required double amount,
  }) async {
    if (UiDemoMode.blocksWriteApi) return DepositMerchants.list;
    try {
      final merchants = await _api.getInrMerchants(method: method, amount: amount);
      return inrMerchantsToPresentation(merchants);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<List<InrPayoutMethodEntity>> getInrPayoutMethods() async {
    if (UiDemoMode.isActive) return InrPayoutMethodsDemo.methods;
    try {
      final models = await _api.getPayoutMethods();
      return models.map((m) => m.toEntity()).toList();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<InrPayoutMethodEntity> addInrPayoutMethod(Map<String, dynamic> body) async {
    if (UiDemoMode.blocksWriteApi) {
      return InrPayoutMethodEntity(
        id: DateTime.now().millisecondsSinceEpoch,
        type: InrPayoutMethod.values.firstWhere(
          (t) => t.apiValue == (body['type'] as String? ?? 'bank'),
          orElse: () => InrPayoutMethod.bank,
        ),
        label: body['label'] as String? ?? 'Saved method',
        accountName: body['accountName'] as String? ?? '',
        accountValue: body['accountValue'] as String? ?? '',
        bankName: body['bankName'] as String?,
        ifsc: body['ifsc'] as String?,
      );
    }
    try {
      final model = await _api.addPayoutMethod(body);
      return model.toEntity();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> deleteInrPayoutMethod(int id) async {
    if (UiDemoMode.blocksWriteApi) return;
    try {
      await _api.deletePayoutMethod(id);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> setDefaultInrPayoutMethod(int id) async {
    if (UiDemoMode.blocksWriteApi) return;
    try {
      await _api.setDefaultPayoutMethod(id);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }
}
