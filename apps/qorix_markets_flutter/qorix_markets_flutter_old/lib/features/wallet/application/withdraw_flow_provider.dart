import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/dashboard/application/dashboard_providers.dart';
import 'package:qorix_markets_flutter/features/wallet/application/wallet_providers.dart';
import 'package:qorix_markets_flutter/features/wallet/data/repositories/wallet_repository_impl.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_demo.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_inr_options.dart';
import 'package:qorix_markets_flutter/services/api/auth_api_service.dart';

enum WithdrawMethod { usdt, inr }

enum WithdrawFlowPhase { form, inrPayoutSelect, inrDetails, otp, success, failure }

class WithdrawFlowState {
  const WithdrawFlowState({
    this.phase = WithdrawFlowPhase.form,
    this.method = WithdrawMethod.usdt,
    this.amount,
    this.destination,
    this.inrPayout,
    this.otpSent = false,
    this.submitting = false,
    this.errorMessage,
    this.submittedAt,
    this.referenceId,
    this.otpError = false,
  });

  final WithdrawFlowPhase phase;
  final WithdrawMethod method;
  final double? amount;
  final String? destination;
  final InrPayoutMethod? inrPayout;
  final bool otpSent;
  final bool submitting;
  final String? errorMessage;
  final DateTime? submittedAt;
  final String? referenceId;
  final bool otpError;

  bool get isUsdt => method == WithdrawMethod.usdt;

  String get payoutMethodLabel {
    if (isUsdt) return 'TRC20 USDT';
    if (inrPayout == null) return 'INR Payout';
    return inrPayout!.summaryLabel;
  }

  WithdrawFlowState copyWith({
    WithdrawFlowPhase? phase,
    WithdrawMethod? method,
    double? amount,
    String? destination,
    InrPayoutMethod? inrPayout,
    bool? otpSent,
    bool? submitting,
    String? errorMessage,
    DateTime? submittedAt,
    String? referenceId,
    bool? otpError,
    bool clearError = false,
    bool clearInrPayout = false,
  }) =>
      WithdrawFlowState(
        phase: phase ?? this.phase,
        method: method ?? this.method,
        amount: amount ?? this.amount,
        destination: destination ?? this.destination,
        inrPayout: clearInrPayout ? null : (inrPayout ?? this.inrPayout),
        otpSent: otpSent ?? this.otpSent,
        submitting: submitting ?? this.submitting,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
        submittedAt: submittedAt ?? this.submittedAt,
        referenceId: referenceId ?? this.referenceId,
        otpError: otpError ?? this.otpError,
      );
}

final withdrawFlowProvider =
    NotifierProvider<WithdrawFlowNotifier, WithdrawFlowState>(WithdrawFlowNotifier.new);

final withdrawLimitsProvider = Provider<({double available, double feeRate})>((ref) {
  final wallet = ref.watch(walletProvider).valueOrNull;
  final vip = ref.watch(dashboardProvider).valueOrNull?.vip;
  return (
    available: wallet?.profitBalance ?? wallet?.available ?? 0,
    feeRate: vip?.withdrawalFee ?? 0.015,
  );
});

class WithdrawFlowNotifier extends Notifier<WithdrawFlowState> {
  @override
  WithdrawFlowState build() => const WithdrawFlowState();

  void setMethod(WithdrawMethod method) {
    if (state.method == method) return;
    state = state.copyWith(
      method: method,
      phase: WithdrawFlowPhase.form,
      clearInrPayout: true,
      clearError: true,
      submitting: false,
    );
  }

  void selectInrPayout({required InrPayoutMethod payout, required double amount}) {
    if (amount < WithdrawDemo.inrMin) {
      throw StateError('Minimum ₹${WithdrawDemo.inrMin.toStringAsFixed(0)} required');
    }
    state = state.copyWith(
      amount: amount,
      inrPayout: payout,
      phase: WithdrawFlowPhase.inrDetails,
      clearError: true,
      submitting: false,
    );
  }

  void proceedInrAmount(double amount) {
    if (amount < WithdrawDemo.inrMin) {
      throw StateError('Minimum ₹${WithdrawDemo.inrMin.toStringAsFixed(0)} required');
    }
    state = state.copyWith(
      method: WithdrawMethod.inr,
      amount: amount,
      phase: WithdrawFlowPhase.inrPayoutSelect,
      clearInrPayout: true,
      clearError: true,
      submitting: false,
    );
  }

  void selectInrPayoutMethod(InrPayoutMethod payout) {
    final amount = state.amount;
    if (amount == null) return;
    state = state.copyWith(
      inrPayout: payout,
      phase: WithdrawFlowPhase.inrDetails,
      clearError: true,
      submitting: false,
    );
  }

  void backToInrPayoutSelect() {
    state = state.copyWith(
      phase: WithdrawFlowPhase.inrPayoutSelect,
      clearError: true,
      otpError: false,
      submitting: false,
    );
  }

  void backToInrForm() {
    state = state.copyWith(
      phase: WithdrawFlowPhase.form,
      clearInrPayout: true,
      clearError: true,
      otpError: false,
      submitting: false,
    );
  }

  Future<void> requestOtp({
    required double amount,
    required String destination,
    InrPayoutMethod? inrPayout,
  }) async {
    if (inrPayout != null) {
      state = state.copyWith(inrPayout: inrPayout, destination: destination.trim());
    }
    final min = state.isUsdt ? WithdrawDemo.usdtMin : WithdrawDemo.inrMin;
    if (amount < min) {
      throw StateError('Minimum ${min.toStringAsFixed(0)} ${state.isUsdt ? 'USDT' : 'INR'} required');
    }

    if (UiDemoMode.isActive || UiDemoMode.blocksWriteApi) {
      state = state.copyWith(
        phase: WithdrawFlowPhase.otp,
        amount: amount,
        destination: destination.trim(),
        otpSent: true,
        submitting: false,
        clearError: true,
        otpError: false,
      );
      return;
    }

    state = state.copyWith(submitting: true, clearError: true, otpError: false);
    try {
      await ref.read(authApiServiceProvider).requestWithdrawalOtp();
      state = state.copyWith(
        phase: WithdrawFlowPhase.otp,
        amount: amount,
        destination: destination.trim(),
        otpSent: true,
        submitting: false,
      );
    } catch (e) {
      state = state.copyWith(
        submitting: false,
        errorMessage: 'Verification unavailable. Your funds remain protected.',
      );
      rethrow;
    }
  }

  Future<void> requestInrOtp({
    required double amount,
    required InrPayoutMethod payout,
    required String destination,
  }) async {
    state = state.copyWith(
      amount: amount,
      inrPayout: payout,
      destination: destination.trim(),
    );
    await requestOtp(amount: amount, destination: destination);
  }

  Future<bool> submitWithdrawal(String otp) async {
    final amount = state.amount;
    final destination = state.destination;
    if (amount == null || destination == null) return false;
    if (otp.length != 6) {
      state = state.copyWith(otpError: true);
      return false;
    }

    state = state.copyWith(submitting: true, clearError: true, otpError: false);
    final now = DateTime.now();
    final refId = 'WD-${now.millisecondsSinceEpoch.toString().substring(7)}';

    if (UiDemoMode.isActive || UiDemoMode.blocksWriteApi) {
      await Future<void>.delayed(const Duration(milliseconds: 900));
      state = state.copyWith(
        phase: WithdrawFlowPhase.success,
        submitting: false,
        submittedAt: now,
        referenceId: refId,
      );
      return true;
    }

    try {
      await ref.read(walletRepositoryProvider).withdraw(
            amount: amount,
            address: destination,
            asset: state.isUsdt ? 'USDT' : 'INR',
            otp: otp,
          );
      state = state.copyWith(
        phase: WithdrawFlowPhase.success,
        submitting: false,
        submittedAt: now,
        referenceId: refId,
      );
      ref.read(walletProvider.notifier).reconcile();
      return true;
    } catch (e) {
      state = state.copyWith(
        phase: WithdrawFlowPhase.failure,
        submitting: false,
        errorMessage: 'Withdrawal could not be authorized. No funds were moved.',
      );
      return false;
    }
  }

  void clearOtpError() {
    if (state.otpError) state = state.copyWith(otpError: false);
  }

  void backToForm() {
    if (!state.isUsdt && state.inrPayout != null) {
      state = state.copyWith(
        phase: WithdrawFlowPhase.inrDetails,
        otpSent: false,
        clearError: true,
        otpError: false,
        submitting: false,
      );
      return;
    }
    state = state.copyWith(
      phase: WithdrawFlowPhase.form,
      otpSent: false,
      clearError: true,
      otpError: false,
      submitting: false,
    );
  }

  void reset() => state = const WithdrawFlowState();
}
