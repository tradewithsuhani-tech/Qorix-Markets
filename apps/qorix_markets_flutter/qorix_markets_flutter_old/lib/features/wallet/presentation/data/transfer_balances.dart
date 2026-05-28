import 'package:qorix_markets_flutter/features/wallet/application/transfer_flow_provider.dart';

enum InternalWallet { main, funding }

class TransferBalanceSnapshot {
  const TransferBalanceSnapshot({
    required this.main,
    required this.funding,
    this.strategyLocked = 1200,
    this.freeFunding = 2000,
  });

  final double main;
  final double funding;
  final double strategyLocked;
  final double freeFunding;

  double balanceOf(InternalWallet wallet) =>
      wallet == InternalWallet.main ? main : funding;

  double maxTransferable(TransferDirection direction) => balanceOf(direction.fromWallet);

  bool showCapitalBreakdown(TransferDirection direction) =>
      direction.fromWallet == InternalWallet.funding;

  String infoNote(TransferDirection direction) => switch (direction) {
        TransferDirection.mainToFunding =>
          'Funds move to your funding wallet for strategy deployment.',
        TransferDirection.fundingToMain =>
          'Free funding returns to main — locked capital stays deployed.',
      };
}

abstract final class TransferBalances {
  static const snapshot = TransferBalanceSnapshot(main: 7847, funding: 3200);
}
