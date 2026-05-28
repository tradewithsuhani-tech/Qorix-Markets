import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/sensory_feedback.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/features/home/application/bot_setup_flow_provider.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/bot_presets.dart';
import 'package:qorix_markets_flutter/features/home/presentation/widgets/bot_setup_ui.dart';
import 'package:qorix_markets_flutter/features/invest/application/investment_providers.dart';
import 'package:qorix_markets_flutter/features/invest/domain/entities/investment_state.dart';
import 'package:qorix_markets_flutter/features/invest/presentation/providers/invest_ui_provider.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/widgets/deposit_ui.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/widgets/withdraw_ui.dart';
import 'package:qorix_markets_flutter/shared/formatters/currency_formatter.dart';
import 'package:qorix_markets_flutter/ui/components/strategy_activation_sheet.dart';
import 'package:qorix_markets_flutter/ui/components/success_moment.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_mock_data.dart';

/// 3-step bot wizard: Select personality → Configure & fund → Activate.
class BotSetupScreen extends ConsumerStatefulWidget {
  const BotSetupScreen({super.key});

  @override
  ConsumerState<BotSetupScreen> createState() => _BotSetupScreenState();
}

class _BotSetupScreenState extends ConsumerState<BotSetupScreen> {
  final _amount = TextEditingController();

  @override
  void initState() {
    super.initState();
    _amount.addListener(() {
      final v = double.tryParse(_amount.text.trim());
      if (v != null) ref.read(botSetupFlowProvider.notifier).setAmount(v);
      setState(() {});
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final flow = ref.read(botSetupFlowProvider);
      if (flow.phase == BotSetupPhase.preview && flow.selectedPresetId != null) {
        final preset = flow.selectedPreset;
        if (preset != null) {
          ref.read(investUiProvider.notifier).selectProfile(preset.riskProfileId);
        }
        return;
      }
      ref.read(botSetupFlowProvider.notifier).reset();
      final inv = ref.read(investmentProvider).valueOrNull;
      if (inv?.isActive == true) {
        ref.read(botSetupFlowProvider.notifier).goLive();
        final preset = BotPresets.byRiskProfileId(inv!.riskLevel);
        if (preset != null) {
          ref.read(investUiProvider.notifier).selectProfile(preset.riskProfileId);
        }
      }
    });
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  double get _parsedAmount => double.tryParse(_amount.text.trim()) ?? 0;

  double get flowAmount {
    final flow = ref.read(botSetupFlowProvider);
    return flow.amount ?? _parsedAmount;
  }

  void _handleBack() {
    final flow = ref.read(botSetupFlowProvider);
    switch (flow.phase) {
      case BotSetupPhase.preview:
        if (flow.fromDeployCapital) {
          safePop(context);
        } else {
          ref.read(botSetupFlowProvider.notifier).backFromPreview();
        }
      case BotSetupPhase.configure:
        ref.read(botSetupFlowProvider.notifier).backFromConfigure();
      case BotSetupPhase.select:
      case BotSetupPhase.live:
        ref.read(botSetupFlowProvider.notifier).reset();
        safePop(context);
    }
  }

  void _goToPreview() {
    if (_parsedAmount < 50) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter at least \$50 to continue'), backgroundColor: AppColors.authCardBg),
      );
      return;
    }
    ref.read(botSetupFlowProvider.notifier).setAmount(_parsedAmount);
    ref.read(botSetupFlowProvider.notifier).goToPreview();
  }

  void _selectPreset(BotPreset preset) {
    ref.read(investUiProvider.notifier).selectProfile(preset.riskProfileId);
    ref.read(botSetupFlowProvider.notifier).selectPreset(preset);
    _amount.clear();
  }

  Future<void> _activate(BotPreset preset) async {
    final amount = flowAmount;
    if (amount < 50) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter at least \$50 to activate'), backgroundColor: AppColors.authCardBg),
      );
      return;
    }

    final uiNotifier = ref.read(investUiProvider.notifier);
    uiNotifier.setAmount(amount);

    showStrategyActivationSheet(
      context,
      profile: ref.read(investUiProvider).selectedProfile,
      amount: amount,
      projectedPoints: UiMockData.projectedGrowth(amount),
      onConfirm: () async {
        ref.read(botSetupFlowProvider.notifier).setActivating(true);
        uiNotifier.setActivating(true);
        try {
          await ref.read(investmentProvider.notifier).startInvestment(
                amount: amount,
                riskLevel: preset.riskProfileId,
              );
          if (!mounted) return;
          ref.read(botSetupFlowProvider.notifier).goLive();
          SensoryFeedback.trigger(SensoryMoment.activationSuccess);
          showSuccessMoment(
            context,
            title: 'Bot activated',
            message: '${preset.codename} · ${preset.personality} is live on XAU/USD.',
            amount: CurrencyFormatter.format(amount),
          );
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(ErrorMessage.brief(e)), backgroundColor: AppColors.authCardBg),
            );
          }
        } finally {
          ref.read(botSetupFlowProvider.notifier).setActivating(false);
          uiNotifier.setActivating(false);
        }
      },
    );
  }

  Widget? _buildStickyFooter(BotSetupFlowState flow, InvestUiState ui, BotPreset? preset) {
    switch (flow.phase) {
      case BotSetupPhase.configure:
        if (preset == null) return null;
        return _BotSetupStickyFooter(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              WithdrawCtaButton(
                label: 'Continue',
                enabled: _parsedAmount >= 50,
                onPressed: _goToPreview,
              ),
              if (_parsedAmount < 50) ...[
                const SizedBox(height: 8),
                Text(
                  'Enter at least \$50 to continue',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: AppColors.authMuted.withValues(alpha: 0.6)),
                ),
              ],
            ],
          ),
        );
      case BotSetupPhase.preview:
        if (preset == null) return null;
        return _BotSetupStickyFooter(
          child: WithdrawCtaButton(
            label: ui.isActivating || flow.activating ? 'Activating…' : 'Activate Bot',
            loading: ui.isActivating || flow.activating,
            enabled: flowAmount >= 50,
            onPressed: () => _activate(preset),
          ),
        );
      case BotSetupPhase.live:
        return _BotSetupStickyFooter(
          child: WithdrawCtaButton(
            label: 'Change Strategy',
            onPressed: () => ref.read(botSetupFlowProvider.notifier).goToSelect(),
          ),
        );
      case BotSetupPhase.select:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final flow = ref.watch(botSetupFlowProvider);
    final ui = ref.watch(investUiProvider);
    final tradingBalance = ref.watch(investTradingBalanceProvider);
    final inv = ref.watch(investmentProvider).valueOrNull;
    final preset = flow.selectedPreset;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBack();
      },
      child: Scaffold(
      backgroundColor: AppDesk.bg,
      resizeToAvoidBottomInset: true,
      bottomNavigationBar: _buildStickyFooter(flow, ui, preset),
      body: AuthBackground(
        child: DepositPageScaffold(
          onBack: _handleBack,
          child: ListView(
            physics: AppScroll.page,
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            children: [
              switch (flow.phase) {
                BotSetupPhase.select => _SelectStep(onSelect: _selectPreset),
                BotSetupPhase.configure => preset == null
                    ? const SizedBox.shrink()
                    : _ConfigureStep(
                        preset: preset,
                        available: tradingBalance,
                        amountController: _amount,
                        drawdownLimit: flow.drawdownLimit ?? preset.defaultDrawdown,
                        onMax: () => _amount.text = tradingBalance.toStringAsFixed(2),
                        onPercent: (pct) => _amount.text = (tradingBalance * pct).toStringAsFixed(2),
                        onDrawdown: ref.read(botSetupFlowProvider.notifier).setDrawdown,
                      ),
                BotSetupPhase.preview => preset == null
                    ? const SizedBox.shrink()
                    : _PreviewStep(
                        preset: preset,
                        amount: flowAmount,
                        drawdownLimit: flow.drawdownLimit ?? preset.defaultDrawdown,
                      ),
                BotSetupPhase.live => _LiveStep(
                    inv: inv,
                    onChangeStrategy: () => ref.read(botSetupFlowProvider.notifier).goToSelect(),
                  ),
              },
            ],
          ),
        ),
      ),
    ),
    );
  }
}

class _BotSetupStickyFooter extends StatelessWidget {
  const _BotSetupStickyFooter({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.authPageBg,
      elevation: 0,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
          child: child,
        ),
      ),
    );
  }
}

class _SelectStep extends StatelessWidget {
  const _SelectStep({required this.onSelect});

  final ValueChanged<BotPreset> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const BotWizardHeader(),
        const SizedBox(height: 20),
        BotStepHeader(step: 'STEP 01', title: 'Choose Bot Personality', trailing: '3 presets'),
        const SizedBox(height: 12),
        ...BotPresets.all.map(
          (p) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: BotPersonalityCard(preset: p, compact: true, onTap: () => onSelect(p)),
          ),
        ),
        const SizedBox(height: 8),
        const BotSetupTrustFooter(),
      ],
    );
  }
}

class _ConfigureStep extends StatelessWidget {
  const _ConfigureStep({
    required this.preset,
    required this.available,
    required this.amountController,
    required this.drawdownLimit,
    required this.onMax,
    required this.onPercent,
    required this.onDrawdown,
  });

  final BotPreset preset;
  final double available;
  final TextEditingController amountController;
  final double drawdownLimit;
  final VoidCallback onMax;
  final ValueChanged<double> onPercent;
  final ValueChanged<double> onDrawdown;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        BotPersonalityCard(preset: preset, selected: true, onTap: () {}),
        const SizedBox(height: 16),
        BotFundSection(
          available: available,
          controller: amountController,
          onMax: onMax,
          onPercent: onPercent,
        ),
        const SizedBox(height: 12),
        BotCircuitBreakerSection(
          preset: preset,
          selectedLimit: drawdownLimit,
          onSelect: onDrawdown,
        ),
        const SizedBox(height: 8),
        const BotSetupTrustFooter(),
      ],
    );
  }
}

class _PreviewStep extends StatelessWidget {
  const _PreviewStep({
    required this.preset,
    required this.amount,
    required this.drawdownLimit,
  });

  final BotPreset preset;
  final double amount;
  final double drawdownLimit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        BotStepHeader(step: 'STEP 04', title: 'Review & Confirm', trailing: 'Preview'),
        const SizedBox(height: 6),
        Text(
          'Verify your bot, returns, and protection before going live.',
          style: TextStyle(fontSize: 11.5, height: 1.4, color: AppColors.authMuted.withValues(alpha: 0.72)),
        ),
        const SizedBox(height: 14),
        BotPersonalityCard(preset: preset, selected: true, compact: true, onTap: () {}),
        const SizedBox(height: 12),
        BotRiskRewardCard(preset: preset, amount: amount, drawdownLimit: drawdownLimit),
        const SizedBox(height: 12),
        BotConfigurationSummary(preset: preset, amount: amount, drawdownLimit: drawdownLimit),
        const SizedBox(height: 12),
        BotCapabilitiesCard(preset: preset),
        const SizedBox(height: 16),
        const BotSetupTrustFooter(),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _LiveStep extends StatelessWidget {
  const _LiveStep({required this.inv, required this.onChangeStrategy});

  final InvestmentState? inv;
  final VoidCallback onChangeStrategy;

  @override
  Widget build(BuildContext context) {
    final preset = BotPresets.byRiskProfileId(inv?.riskLevel ?? 'MEDIUM');
    final deployed = inv?.amount ?? 0.0;
    final profit = inv?.totalProfit ?? 0.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const BotWizardHeader(),
        const SizedBox(height: 16),
        BotPersonalityCard(
          preset: preset,
          selected: true,
          onTap: onChangeStrategy,
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.authGreen.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
          ),
          child: Column(
            children: [
              const Text('BOT ACTIVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1, color: AppColors.authGreen)),
              const SizedBox(height: 8),
              Text(
                '\$${deployed.toStringAsFixed(2)} deployed · +\$${profit.toStringAsFixed(2)} profit',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              Text(
                'Tap Change Strategy below to switch bot personality',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: AppColors.authMuted.withValues(alpha: 0.7)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        BotCapabilitiesCard(preset: preset),
      ],
    );
  }
}
