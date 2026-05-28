import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/features/wallet/application/wallet_providers.dart';
import 'package:qorix_markets_flutter/features/wallet/data/repositories/wallet_repository_impl.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/transfer_balances.dart';

enum TransferFlowPhase { form, confirm, success }

enum TransferDirection { mainToFunding, fundingToMain }

extension TransferDirectionX on TransferDirection {
  InternalWallet get fromWallet => switch (this) {
        TransferDirection.mainToFunding => InternalWallet.main,
        TransferDirection.fundingToMain => InternalWallet.funding,
      };

  InternalWallet get toWallet => switch (this) {
        TransferDirection.mainToFunding => InternalWallet.funding,
        TransferDirection.fundingToMain => InternalWallet.main,
      };

  String get apiDirection => switch (this) {
        TransferDirection.mainToFunding => 'to_trading',
        TransferDirection.fundingToMain => 'to_main',
      };
}

class TransferFlowState {
  const TransferFlowState({
    this.phase = TransferFlowPhase.form,
    this.direction = TransferDirection.mainToFunding,
    this.amount,
    this.submitting = false,
    this.referenceId,
    this.error,
  });

  final TransferFlowPhase phase;
  final TransferDirection direction;
  final double? amount;
  final bool submitting;
  final String? referenceId;
  final String? error;
}

class TransferFlowNotifier extends Notifier<TransferFlowState> {
  @override
  TransferFlowState build() => const TransferFlowState();

  void setDirection(TransferDirection direction) {
    state = TransferFlowState(direction: direction, amount: state.amount);
  }

  void setAmount(double amount) {
    state = TransferFlowState(direction: state.direction, amount: amount);
  }

  void swapDirection() {
    final next = state.direction == TransferDirection.mainToFunding
        ? TransferDirection.fundingToMain
        : TransferDirection.mainToFunding;
    setDirection(next);
  }

  void reset() => state = const TransferFlowState();

  Future<void> submitTransfer(double amount) async {
    state = TransferFlowState(
      direction: state.direction,
      amount: amount,
      submitting: true,
    );

    if (UiDemoMode.isActive) {
      await Future<void>.delayed(const Duration(milliseconds: 600));
      state = TransferFlowState(
        phase: TransferFlowPhase.success,
        direction: state.direction,
        amount: amount,
        referenceId: 'TRF-${DateTime.now().millisecondsSinceEpoch}',
      );
      return;
    }

    try {
      await ref.read(walletRepositoryProvider).transfer(
            amount: amount,
            direction: state.direction.apiDirection,
            source: 'main',
          );
      ref.read(walletProvider.notifier).reconcile();
      state = TransferFlowState(
        phase: TransferFlowPhase.success,
        direction: state.direction,
        amount: amount,
        referenceId: 'TRF-${DateTime.now().millisecondsSinceEpoch}',
      );
    } catch (e) {
      state = TransferFlowState(
        direction: state.direction,
        amount: amount,
        error: ErrorMessage.from(e),
      );
    }
  }
}

final transferFlowProvider =
    NotifierProvider<TransferFlowNotifier, TransferFlowState>(TransferFlowNotifier.new);

final transferBalanceProvider = Provider<TransferBalanceSnapshot>((ref) {
  final wallet = ref.watch(walletProvider).valueOrNull;
  if (wallet == null) return TransferBalances.snapshot;
  return TransferBalanceSnapshot(
    main: wallet.mainBalance,
    funding: wallet.tradingBalance,
    strategyLocked: 0,
    freeFunding: wallet.tradingBalance,
  );
});
