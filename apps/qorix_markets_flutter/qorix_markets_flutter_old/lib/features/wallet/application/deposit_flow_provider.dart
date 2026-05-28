import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/wallet/data/repositories/wallet_repository_impl.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/deposit_demo.dart';

enum DepositMode { inr, crypto }

enum DepositFlowPhase { amount, merchant, qr, verify, confirming, success }

class DepositFlowState {
  const DepositFlowState({
    this.phase = DepositFlowPhase.amount,
    this.mode = DepositMode.inr,
    this.amount,
    this.inrMethod,
    this.cryptoAsset,
    this.merchants = const [],
    this.merchantsLoading = false,
    this.selectedMerchantId,
    this.submitting = false,
    this.submittedAt,
    this.depositReferenceId,
    this.confirmedAmount,
  });

  final DepositFlowPhase phase;
  final DepositMode mode;
  final double? amount;
  final InrPaymentMethod? inrMethod;
  final CryptoAsset? cryptoAsset;
  final List<P2pMerchant> merchants;
  final bool merchantsLoading;
  final String? selectedMerchantId;
  final bool submitting;
  final DateTime? submittedAt;
  final String? depositReferenceId;
  final double? confirmedAmount;

  DepositFlowState copyWith({
    DepositFlowPhase? phase,
    DepositMode? mode,
    double? amount,
    InrPaymentMethod? inrMethod,
    CryptoAsset? cryptoAsset,
    List<P2pMerchant>? merchants,
    bool? merchantsLoading,
    String? selectedMerchantId,
    bool? submitting,
    DateTime? submittedAt,
    String? depositReferenceId,
    double? confirmedAmount,
    bool clearMerchant = false,
  }) =>
      DepositFlowState(
        phase: phase ?? this.phase,
        mode: mode ?? this.mode,
        amount: amount ?? this.amount,
        inrMethod: inrMethod ?? this.inrMethod,
        cryptoAsset: cryptoAsset ?? this.cryptoAsset,
        merchants: merchants ?? this.merchants,
        merchantsLoading: merchantsLoading ?? this.merchantsLoading,
        selectedMerchantId: clearMerchant ? null : (selectedMerchantId ?? this.selectedMerchantId),
        submitting: submitting ?? this.submitting,
        submittedAt: submittedAt ?? this.submittedAt,
        depositReferenceId: depositReferenceId ?? this.depositReferenceId,
        confirmedAmount: confirmedAmount ?? this.confirmedAmount,
      );
}

class DepositFlowNotifier extends Notifier<DepositFlowState> {
  @override
  DepositFlowState build() => const DepositFlowState();

  void setMode(DepositMode mode) => state = state.copyWith(mode: mode, phase: DepositFlowPhase.amount, clearMerchant: true);

  void reset() => state = const DepositFlowState();

  void backToAmount() => state = state.copyWith(phase: DepositFlowPhase.amount, clearMerchant: true);

  void backToMerchant() => state = state.copyWith(phase: DepositFlowPhase.merchant);

  void backToQr() => state = state.copyWith(phase: DepositFlowPhase.qr);

  void backToVerify() => state = state.copyWith(phase: DepositFlowPhase.verify);

  void proceedToVerify() => state = state.copyWith(phase: DepositFlowPhase.verify);

  void startConfirming() => state = state.copyWith(phase: DepositFlowPhase.confirming, submitting: true);

  void onDepositConfirmed({double? amount}) {
    state = state.copyWith(
      phase: DepositFlowPhase.success,
      confirmedAmount: amount ?? state.amount,
      submitting: false,
    );
  }

  Future<void> proceedWithInr(InrPaymentMethod method, double amount) async {
    state = state.copyWith(
      mode: DepositMode.inr,
      amount: amount,
      inrMethod: method,
      phase: DepositFlowPhase.merchant,
      merchantsLoading: true,
      merchants: const [],
    );
    if (UiDemoMode.isActive) {
      state = state.copyWith(merchantsLoading: false, merchants: DepositMerchants.list);
      return;
    }
    try {
      final merchants = await ref.read(walletRepositoryProvider).getInrMerchants(method: method.name, amount: amount);
      state = state.copyWith(merchantsLoading: false, merchants: merchants);
    } catch (_) {
      state = state.copyWith(merchantsLoading: false, merchants: DepositMerchants.list);
    }
  }

  Future<void> selectMerchant(String merchantId) async {
    state = state.copyWith(selectedMerchantId: merchantId, phase: DepositFlowPhase.qr);
  }

  Future<void> proceedWithCrypto(CryptoAsset asset, double amount) async {
    state = state.copyWith(
      mode: DepositMode.crypto,
      cryptoAsset: asset,
      amount: amount,
      phase: DepositFlowPhase.qr,
    );
  }

  Future<void> submitInrPayment({required String utr, String? referenceCode}) async {
    state = state.copyWith(submitting: true);
    if (UiDemoMode.blocksWriteApi) {
      await Future<void>.delayed(const Duration(milliseconds: 600));
      state = state.copyWith(
        phase: DepositFlowPhase.success,
        submitting: false,
        submittedAt: DateTime.now(),
        depositReferenceId: 'INR-${DateTime.now().millisecondsSinceEpoch}',
      );
      return;
    }
    try {
      await ref.read(walletRepositoryProvider).submitInrDeposit(
            amount: state.amount ?? 0,
            method: state.inrMethod?.name ?? 'upi',
            merchantId: state.selectedMerchantId ?? '',
            utr: utr,
            referenceCode: referenceCode,
          );
      state = state.copyWith(
        phase: DepositFlowPhase.success,
        submitting: false,
        submittedAt: DateTime.now(),
      );
    } catch (e) {
      state = state.copyWith(submitting: false);
      rethrow;
    }
  }
}

final depositFlowProvider =
    NotifierProvider<DepositFlowNotifier, DepositFlowState>(DepositFlowNotifier.new);
