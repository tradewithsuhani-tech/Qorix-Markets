import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/invest/application/investment_providers.dart';
import 'package:qorix_markets_flutter/features/invest/presentation/providers/invest_ui_provider.dart';
import 'package:qorix_markets_flutter/features/invest/presentation/widgets/investment_action_sheets.dart';
import 'package:qorix_markets_flutter/shared/formatters/currency_formatter.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/data/portfolio_demo.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/widgets/manage_plan_ui.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/widgets/momentum_bot_live_console.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/widgets/skeleton_loader.dart';

class ManagePlanScreen extends ConsumerStatefulWidget {
  const ManagePlanScreen({super.key});

  @override
  ConsumerState<ManagePlanScreen> createState() => _ManagePlanScreenState();
}

class _ManagePlanScreenState extends ConsumerState<ManagePlanScreen> {
  double? _drawdownDraft;

  Future<void> _toggleCompound(bool enabled) async {
    try {
      await ref.read(investmentProvider.notifier).toggleCompounding(enabled);
    } catch (e) {
      if (!mounted) return;
      _showError(e);
    }
  }

  Future<void> _setDrawdown(double limit) async {
    setState(() => _drawdownDraft = limit);
    try {
      await ref.read(investmentProvider.notifier).updateProtection(limit);
    } catch (e) {
      if (!mounted) return;
      _showError(e);
    }
  }

  void _showError(Object e) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ErrorMessage.brief(e)), backgroundColor: AppColors.authCardBg),
    );
  }

  Future<void> _confirmStop() async {
    final confirmed = await showManagePlanStopConfirmDialog(context);
    if (confirmed != true || !mounted) return;

    try {
      await ref.read(investmentProvider.notifier).stopInvestment();
      if (!mounted) return;
      context.pop();
    } catch (e) {
      if (!mounted) return;
      _showError(e);
    }
  }

  Future<void> _handleTopup(double maxAmount) async {
    await showInvestmentTopupSheet(
      context,
      maxAmount: maxAmount,
      initialAmount: (maxAmount * 0.25).clamp(10, maxAmount),
      onConfirm: (amount) async {
        try {
          await ref.read(investmentProvider.notifier).topup(amount: amount);
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('${CurrencyFormatter.format(amount)} queued for next trading day'),
              backgroundColor: AppColors.authCardBg,
            ),
          );
        } catch (e) {
          if (!mounted) return;
          _showError(e);
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final investmentAsync = ref.watch(investmentProvider);
    final topupAvailable = ref.watch(investTopupAvailableProvider);
    final pendingTopup = ref.watch(investmentPendingTopupProvider);

    return Scaffold(
      backgroundColor: AppDesk.bg,
      body: SafeArea(
        bottom: false,
        child: investmentAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(20),
            child: Column(
              children: [
                SkeletonHeroCard(),
                SizedBox(height: 16),
                SkeletonHeroCard(),
              ],
            ),
          ),
          error: (e, _) => Center(
            child: Text(ErrorMessage.brief(e), style: TextStyle(color: AppColors.authMuted.withValues(alpha: 0.8))),
          ),
          data: (inv) {
            if (!inv.isActive) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('No active bot', style: TextStyle(color: AppColors.authMuted.withValues(alpha: 0.85))),
                      const SizedBox(height: 16),
                      TextButton(onPressed: () => context.pop(), child: const Text('Go back')),
                    ],
                  ),
                ),
              );
            }

            final data = PortfolioViewData.fromInvestment(inv);
            final drawdownLimit = _drawdownDraft ?? data.drawdownLimit;
            final drawdownUsed = inv.drawdownUsedPercent;

            return Responsive.constrained(
              context,
              ListView(
                physics: AppScroll.page,
                padding: EdgeInsets.fromLTRB(
                  20,
                  8,
                  20,
                  24 + MediaQuery.paddingOf(context).bottom,
                ),
                children: [
                  ManagePlanHeader(onClose: () => context.pop()),
                  const SizedBox(height: 20),
                  MomentumBotLiveConsole(data: data, mode: MomentumBotLiveMode.managePlanHero),
                  const SizedBox(height: 16),
                  ManagePlanProfitCard(data: data),
                  if (pendingTopup > 0) ...[
                    const SizedBox(height: 12),
                    ManagePlanPendingTopupBanner(amount: pendingTopup),
                  ],
                  const SizedBox(height: 16),
                  ManagePlanTopupCard(
                    deployed: inv.amount,
                    available: topupAvailable,
                    onAddCapital: topupAvailable >= 10 ? () => _handleTopup(topupAvailable) : null,
                  ),
                  const SizedBox(height: 16),
                  ManagePlanRiskPanel(
                    data: data,
                    drawdownLimit: drawdownLimit,
                    drawdownUsed: drawdownUsed,
                    onDrawdownChanged: _setDrawdown,
                    onCompoundChanged: _toggleCompound,
                    onViewProtection: () => context.push(RoutePaths.protection),
                  ),
                  const SizedBox(height: 16),
                  ManagePlanAllocationStrip(data: data),
                  const SizedBox(height: 16),
                  const ManagePlanAiMetricsGrid(),
                  const SizedBox(height: 24),
                  ManagePlanStopButton(onStop: _confirmStop),
                  const SizedBox(height: 12),
                  Text(
                    'Capital remains in your wallet after stopping. You can redeploy anytime.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11, height: 1.4, color: AppColors.authMuted.withValues(alpha: 0.55)),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
