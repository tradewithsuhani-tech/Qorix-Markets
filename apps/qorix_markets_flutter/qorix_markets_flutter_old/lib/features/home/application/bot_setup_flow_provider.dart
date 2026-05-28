import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/features/home/presentation/data/bot_presets.dart';

enum BotSetupPhase { select, configure, preview, live }

class BotSetupFlowState {
  const BotSetupFlowState({
    this.phase = BotSetupPhase.select,
    this.selectedPresetId,
    this.drawdownLimit,
    this.amount,
    this.activating = false,
    this.fromDeployCapital = false,
  });

  final BotSetupPhase phase;
  final String? selectedPresetId;
  final double? drawdownLimit;
  final double? amount;
  final bool activating;
  final bool fromDeployCapital;

  BotPreset? get selectedPreset =>
      selectedPresetId == null ? null : BotPresets.byId(selectedPresetId!);

  BotSetupFlowState copyWith({
    BotSetupPhase? phase,
    String? selectedPresetId,
    double? drawdownLimit,
    double? amount,
    bool? activating,
    bool? fromDeployCapital,
    bool clearPreset = false,
  }) =>
      BotSetupFlowState(
        phase: phase ?? this.phase,
        selectedPresetId: clearPreset ? null : (selectedPresetId ?? this.selectedPresetId),
        drawdownLimit: drawdownLimit ?? this.drawdownLimit,
        amount: amount ?? this.amount,
        activating: activating ?? this.activating,
        fromDeployCapital: fromDeployCapital ?? this.fromDeployCapital,
      );
}

final botSetupFlowProvider =
    NotifierProvider<BotSetupFlowNotifier, BotSetupFlowState>(BotSetupFlowNotifier.new);

class BotSetupFlowNotifier extends Notifier<BotSetupFlowState> {
  @override
  BotSetupFlowState build() => const BotSetupFlowState();

  void reset() => state = const BotSetupFlowState();

  void goLive() => state = state.copyWith(phase: BotSetupPhase.live);

  void goToSelect() => state = state.copyWith(phase: BotSetupPhase.select, clearPreset: true);

  void selectPreset(BotPreset preset) {
    state = state.copyWith(
      phase: BotSetupPhase.configure,
      selectedPresetId: preset.id,
      drawdownLimit: preset.defaultDrawdown,
    );
  }

  void backFromConfigure() {
    state = state.copyWith(phase: BotSetupPhase.select, clearPreset: true);
  }

  void goToPreview() => state = state.copyWith(phase: BotSetupPhase.preview);

  void backFromPreview() => state = state.copyWith(phase: BotSetupPhase.configure);

  void setDrawdown(double limit) => state = state.copyWith(drawdownLimit: limit);

  void setAmount(double amount) => state = state.copyWith(amount: amount);

  void setActivating(bool v) => state = state.copyWith(activating: v);

  void startDeployPreview({required BotPreset preset, required double amountUsd}) {
    state = BotSetupFlowState(
      phase: BotSetupPhase.preview,
      selectedPresetId: preset.id,
      drawdownLimit: preset.defaultDrawdown,
      amount: amountUsd,
      fromDeployCapital: true,
    );
  }

  void completeDeploy({required BotPreset preset, required double amountUsd}) {
    state = BotSetupFlowState(
      phase: BotSetupPhase.live,
      selectedPresetId: preset.id,
      drawdownLimit: preset.defaultDrawdown,
      amount: amountUsd,
      fromDeployCapital: true,
    );
  }
}
