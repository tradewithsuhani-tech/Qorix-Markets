import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/features/dashboard/application/dashboard_providers.dart';
import 'package:qorix_markets_flutter/features/invest/application/investment_providers.dart';
import 'package:qorix_markets_flutter/features/invest/domain/entities/risk_profile.dart';
import 'package:qorix_markets_flutter/features/wallet/application/wallet_providers.dart';

class InvestUiState {
  const InvestUiState({
    this.selectedProfileId = 'MEDIUM',
    this.deployAmount = 500,
    this.isActivating = false,
  });

  final String selectedProfileId;
  final double deployAmount;
  final bool isActivating;

  RiskProfile get selectedProfile =>
      RiskProfiles.all.firstWhere((p) => p.id == selectedProfileId);

  InvestUiState copyWith({
    String? selectedProfileId,
    double? deployAmount,
    bool? isActivating,
  }) =>
      InvestUiState(
        selectedProfileId: selectedProfileId ?? this.selectedProfileId,
        deployAmount: deployAmount ?? this.deployAmount,
        isActivating: isActivating ?? this.isActivating,
      );
}

class InvestUiNotifier extends StateNotifier<InvestUiState> {
  InvestUiNotifier(this._ref) : super(const InvestUiState()) {
    _syncFromLive();
    _ref.listen(investmentProvider, (_, __) => _syncFromLive());
    _ref.listen(walletProvider, (_, __) => _syncFromLive());
  }

  final Ref _ref;

  void _syncFromLive() {
    final inv = _ref.read(investmentProvider).valueOrNull;
    final wallet = _ref.read(walletProvider).valueOrNull;
    final tradingBalance = wallet?.tradingBalance ?? wallet?.available ?? 500;

    var profileId = inv?.riskLevel ?? state.selectedProfileId;
    if (!RiskProfiles.all.any((p) => p.id == profileId)) profileId = 'MEDIUM';

    final amount = inv?.isActive == true
        ? inv!.amount
        : state.deployAmount.clamp(10, tradingBalance > 10 ? tradingBalance : 500);

    state = state.copyWith(
      selectedProfileId: profileId,
      deployAmount: amount.toDouble(),
    );
  }

  void selectProfile(String id) => state = state.copyWith(selectedProfileId: id);
  void setAmount(double amount) => state = state.copyWith(deployAmount: amount);
  void setActivating(bool v) => state = state.copyWith(isActivating: v);
}

final investUiProvider = StateNotifierProvider<InvestUiNotifier, InvestUiState>((ref) {
  return InvestUiNotifier(ref);
});

final investSlotsProvider = Provider<int>((ref) {
  final investors = ref.watch(dashboardProvider).valueOrNull?.fundStats?.activeInvestors ?? 0;
  return (100 - investors % 100).clamp(12, 99);
});

final investTradingBalanceProvider = Provider<double>((ref) {
  final wallet = ref.watch(walletProvider).valueOrNull;
  return wallet?.tradingBalance ?? wallet?.available ?? 0;
});

/// Max additional capital user can queue: trading pool − deployed − already queued topups.
final investTopupAvailableProvider = Provider<double>((ref) {
  final trading = ref.watch(investTradingBalanceProvider);
  final inv = ref.watch(investmentProvider).valueOrNull;
  final queued = ref.watch(investmentPendingTopupProvider);
  if (inv == null || !inv.isActive) return 0;
  return (trading - inv.amount - queued).clamp(0, double.infinity);
});
