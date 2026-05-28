import 'package:qorix_markets_flutter/data/models/inr_deposit_submit_result.dart'
    show InrDepositSubmitResult, InrWithdrawSubmitResult;
import 'package:qorix_markets_flutter/features/wallet/domain/entities/inr_payout_method.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/deposit_entity.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_entity.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_history_page.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/deposit_demo.dart';

abstract interface class WalletRepository {
  Future<WalletEntity> getWallet();
  Future<List<TransactionEntity>> getTransactions({int limit = 20});
  Future<WalletHistoryPage> getHistoryPage({int page = 1, int limit = 25});
  Future<WalletEntity> deposit({required double amount, required String asset});
  Future<void> withdraw({
    required double amount,
    required String address,
    required String asset,
    String? otp,
  });
  Future<DepositAddressEntity> getDepositAddress();
  Future<List<BlockchainDepositEntity>> getDepositHistory({int limit});
  Future<WalletEntity> transfer({
    required double amount,
    required String direction,
    String source,
  });
  Future<InrDepositSubmitResult> submitInrDeposit({
    required double amount,
    required String method,
    required String merchantId,
    required String utr,
    String? referenceCode,
  });
  Future<InrWithdrawSubmitResult> withdrawInr({
    required double amount,
    required String payoutMethod,
    required String destination,
    required String otp,
  });
  Future<List<P2pMerchant>> getInrMerchants({
    required String method,
    required double amount,
  });
  Future<List<InrPayoutMethodEntity>> getInrPayoutMethods();
  Future<InrPayoutMethodEntity> addInrPayoutMethod(Map<String, dynamic> body);
  Future<void> deleteInrPayoutMethod(int id);
  Future<void> setDefaultInrPayoutMethod(int id);
}
