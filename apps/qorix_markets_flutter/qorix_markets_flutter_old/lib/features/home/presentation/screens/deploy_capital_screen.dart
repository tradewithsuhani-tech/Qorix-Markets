import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/home/application/bot_setup_flow_provider.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/bot_presets.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/bot_setup_demo.dart';
import 'package:qorix_markets_flutter/features/home/presentation/widgets/deploy_capital_ui.dart';
import 'package:qorix_markets_flutter/features/invest/application/investment_providers.dart';
import 'package:qorix_markets_flutter/features/invest/presentation/providers/invest_ui_provider.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

const _inrPerUsdt = 83.5;

class DeployCapitalScreen extends ConsumerStatefulWidget {
  const DeployCapitalScreen({required this.botId, super.key});

  final String botId;

  @override
  ConsumerState<DeployCapitalScreen> createState() => _DeployCapitalScreenState();
}

class _DeployCapitalScreenState extends ConsumerState<DeployCapitalScreen> {
  final _amountCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  bool _loading = false;

  BotExploreItem? get _bot => BotSetupDemo.findExploreBot(widget.botId);

  double get _amountInr => double.tryParse(_amountCtrl.text.trim()) ?? 0;

  bool get _canDeploy => _amountInr >= BotSetupDemo.minDeployInr && _amountInr <= BotSetupDemo.availableDeployInr;

  @override
  void initState() {
    super.initState();
    _amountCtrl.addListener(_onAmountChanged);
  }

  @override
  void dispose() {
    _amountCtrl.removeListener(_onAmountChanged);
    _amountCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onAmountChanged() => setState(() {});

  void _onAmountSubmitted() {
    FocusManager.instance.primaryFocus?.unfocus();
    if (_amountInr <= 0) return;
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToDeployButton());
  }

  void _scrollToDeployButton() {
    if (!_scrollCtrl.hasClients) return;
    _scrollCtrl.animateTo(
      _scrollCtrl.position.maxScrollExtent,
      duration: MotionTokens.normal,
      curve: MotionTokens.standard,
    );
  }

  void _setAmount(double inr) {
    _amountCtrl.text = inr == inr.truncateToDouble() ? inr.toStringAsFixed(0) : inr.toStringAsFixed(3);
  }

  void _clearAmount() => _amountCtrl.clear();

  bool get _showRiskReward => _amountInr > 0;

  Future<void> _deploy() async {
    final bot = _bot;
    if (bot == null || !_canDeploy) return;

    setState(() => _loading = true);
    final preset = BotPresets.byId(bot.presetId);
    final amountUsd = _amountInr / _inrPerUsdt;
    ref.read(investUiProvider.notifier).selectProfile(preset.riskProfileId);
    try {
      await ref.read(investmentProvider.notifier).startInvestment(
            amount: amountUsd,
            riskLevel: preset.riskProfileId,
          );
      ref.read(botSetupFlowProvider.notifier).completeDeploy(preset: preset, amountUsd: amountUsd);
    } catch (_) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    if (!mounted) return;
    setState(() => _loading = false);
    context.push('${RoutePaths.deployReceipt}?bot=${widget.botId}&amount=${Uri.encodeComponent(_amountInr.toString())}');
  }

  @override
  Widget build(BuildContext context) {
    final bot = _bot;
    if (bot == null) {
      return Scaffold(
        backgroundColor: AppDesk.bg,
        body: Center(
          child: Text('Bot not found', style: TextStyle(color: AppColors.authMuted.withValues(alpha: 0.7))),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppDesk.bg,
      body: SafeArea(
        bottom: false,
        child: Responsive.constrained(
          context,
          ListView(
            controller: _scrollCtrl,
            physics: AppScroll.page,
            padding: EdgeInsets.fromLTRB(
              Responsive.pagePadding(context).left,
              AppSpacing.screenTopInset,
              Responsive.pagePadding(context).right,
              AppSpacing.lg + MediaQuery.paddingOf(context).bottom,
            ),
            children: [
              DeployCapitalHeader(onBack: () => safePop(context)),
              AppSpacing.gapSection(),
              DeployAvailableCard(availableInr: BotSetupDemo.availableDeployInr, riskLabel: bot.riskLabel),
              AppSpacing.gapSection(),
              DeployAmountSection(
                controller: _amountCtrl,
                onMax: () => _setAmount(BotSetupDemo.availableDeployInr),
                onQuickPick: _setAmount,
                onClear: _clearAmount,
                onSubmitted: _onAmountSubmitted,
              ),
              const SizedBox(height: AppSpacing.lg),
              DeploySelectedBotCard(bot: bot),
              AnimatedSize(
                duration: MotionTokens.normal,
                curve: MotionTokens.standard,
                alignment: Alignment.topCenter,
                child: _showRiskReward
                    ? Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.lg),
                        child: DeployRiskRewardMonthlyCard(bot: bot, amountInr: _amountInr),
                      )
                    : const SizedBox.shrink(),
              ),
              const SizedBox(height: AppSpacing.xl),
              DeployCapitalButton(
                enabled: _canDeploy,
                loading: _loading,
                amountInr: _canDeploy ? _amountInr : null,
                onTap: _deploy,
              ),
              const SizedBox(height: AppSpacing.md),
              const DeployCapitalFooter(),
            ],
          ),
        ),
      ),
    );
  }
}
