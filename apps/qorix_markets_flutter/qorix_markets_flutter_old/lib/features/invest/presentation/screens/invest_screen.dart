import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/haptics.dart';
import 'package:qorix_markets_flutter/core/motion/stagger_entrance.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/app_typography.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/dashboard/application/dashboard_providers.dart';
import 'package:qorix_markets_flutter/features/invest/application/ai_desk_providers.dart';
import 'package:qorix_markets_flutter/features/invest/application/investment_providers.dart';
import 'package:qorix_markets_flutter/features/invest/domain/entities/investment_state.dart';
import 'package:qorix_markets_flutter/features/invest/domain/entities/risk_profile.dart';
import 'package:qorix_markets_flutter/features/invest/presentation/providers/invest_ui_provider.dart';
import 'package:qorix_markets_flutter/features/invest/presentation/widgets/investment_action_sheets.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/shared/formatters/currency_formatter.dart';
import 'package:qorix_markets_flutter/ui/components/ai_confidence_meter.dart';
import 'package:qorix_markets_flutter/ui/components/capital_allocation_visualizer.dart';
import 'package:qorix_markets_flutter/ui/components/desk_allocation_feed.dart';
import 'package:qorix_markets_flutter/ui/components/projected_growth_chart.dart';
import 'package:qorix_markets_flutter/ui/components/risk_profile_card.dart';
import 'package:qorix_markets_flutter/ui/components/risk_shield_visual.dart';
import 'package:qorix_markets_flutter/core/motion/sensory_feedback.dart';
import 'package:qorix_markets_flutter/ui/components/institutional_trust_bar.dart';
import 'package:qorix_markets_flutter/ui/components/protection_banner.dart';
import 'package:qorix_markets_flutter/ui/components/strategy_activation_sheet.dart';
import 'package:qorix_markets_flutter/ui/components/success_moment.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_mock_data.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';
import 'package:qorix_markets_flutter/widgets/desk_scroll.dart';
import 'package:qorix_markets_flutter/widgets/glass_card.dart';
import 'package:qorix_markets_flutter/widgets/primary_button.dart';
import 'package:qorix_markets_flutter/widgets/section_header.dart';
import 'package:qorix_markets_flutter/widgets/skeleton_loader.dart';

/// Investment desk — deploy capital with confidence, not place orders.
class InvestScreen extends ConsumerWidget {
  const InvestScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ui = ref.watch(investUiProvider);
    final uiNotifier = ref.read(investUiProvider.notifier);
    final investmentAsync = ref.watch(investmentProvider);
    final tradingBalance = ref.watch(investTradingBalanceProvider);
    final topupAvailable = ref.watch(investTopupAvailableProvider);
    final pendingTopup = ref.watch(investmentPendingTopupProvider);
    final slots = ref.watch(investSlotsProvider);
    final fundStats = ref.watch(dashboardProvider).valueOrNull?.fundStats;
    final displaySlots = slots > 0 ? slots : (100 - (fundStats?.activeInvestors ?? 0) % 100).clamp(12, 99);

    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final profile = ui.selectedProfile;
    final inv = investmentAsync.valueOrNull;
    final isActive = inv?.isActive ?? false;
    final isPaused = inv?.isPaused ?? false;
    final drawdown = ref.watch(investmentDrawdownProvider);
    final confidence = ref.watch(strategyConfidenceProvider);
    final allocationSlices = ref.watch(allocationSlicesProvider);
    final deskEvents = ref.watch(deskAllocationEventsProvider);
    final currentRiskId = inv?.riskLevel.trim().toUpperCase() ?? ui.selectedProfileId;
    final pendingRiskId = inv?.pendingRiskLevel?.trim().toUpperCase();

    return SafeArea(
      child: Responsive.constrained(
        context,
        RefreshIndicator(
          color: AppColors.brand,
          onRefresh: () async {
            await ref.read(investmentProvider.notifier).refresh();
            await ref.read(deskTradesProvider.notifier).refresh();
          },
          child: CinematicAsyncContent(
            value: investmentAsync,
            onRetry: () => ref.read(investmentProvider.notifier).refresh(),
            loading: const SkeletonMarketList(count: 4),
            builder: (_, {required isRefreshing}) => ListView(
              padding: Responsive.pagePadding(context),
              children: [
                Text('Deploy capital', style: theme.textTheme.headlineLarge).staggerIn(index: 0),
                AppSpacing.gapXs(),
                Text(
                  'Luxury wealth OS · AI-managed · Capital protected',
                  style: theme.textTheme.bodyMedium,
                ).staggerIn(index: 1),
                AppSpacing.gapMd(),
                const InstitutionalTrustBar().staggerIn(index: 2),
                AppSpacing.gapLg(),
                _ExclusivityStrip(
                  slots: displaySlots,
                  investors: fundStats?.activeInvestors ?? UiMockData.investorsOnline,
                ).staggerIn(index: 3),
                AppSpacing.gapXxl(),
                if (isPaused)
                  ProtectionBanner(
                    isTriggered: true,
                    onReview: () => context.push(RoutePaths.protection),
                  ).staggerIn(index: 4),
                if (isPaused) AppSpacing.gapMd(),
                if (pendingTopup > 0) ...[
                  _PendingTopupBanner(amount: pendingTopup).staggerIn(index: 4),
                  AppSpacing.gapMd(),
                ],
                if (inv?.hasPendingRiskChange == true) ...[
                  _PendingRiskBanner(
                    pendingLevel: inv!.pendingRiskLevelLabel ?? inv.pendingRiskLevel!,
                    effectiveDate: inv.pendingRiskLevelDate,
                    onCancel: () => _cancelRiskChange(context, ref),
                  ).staggerIn(index: 4),
                  AppSpacing.gapMd(),
                ],
                GlassCard(
                  variant: isActive && !isPaused ? GlassCardVariant.glow : GlassCardVariant.hero,
                  glowColor: isActive && !isPaused ? AppColors.buy : AppColors.emerald,
                  animateEntrance: false,
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  onTap: () => context.push('${RoutePaths.strategyDetail}?id=${profile.id}'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          _PulseDot(active: isActive && !isPaused),
                          const SizedBox(width: 8),
                          Text(
                            isPaused
                                ? 'UNDER REVIEW'
                                : isActive
                                    ? 'STRATEGY ACTIVE'
                                    : 'READY TO DEPLOY',
                            style: AppTypography.overline(isDark: isDark),
                          ),
                          const Spacer(),
                          Icon(Icons.chevron_right_rounded, color: AppColors.muted(isDark), size: 20),
                        ],
                      ),
                      AppSpacing.gapMd(),
                      Text(
                        isPaused
                            ? 'Capital protection engaged · admin review in progress'
                            : isActive
                                ? '${inv!.riskLevelLabel} · Running'
                                : 'Choose your risk profile',
                        style: theme.textTheme.titleLarge,
                      ),
                      AppSpacing.gapSm(),
                      if (isActive) ...[
                        Text(
                          'Deployed · ${CurrencyFormatter.format(inv!.amount)}',
                          style: theme.textTheme.bodyMedium,
                        ),
                        if (pendingTopup > 0) ...[
                          AppSpacing.gapXs(),
                          Text(
                            '+ ${CurrencyFormatter.format(pendingTopup)} queued for next trading day',
                            style: theme.textTheme.bodySmall?.copyWith(color: AppColors.brand),
                          ),
                        ],
                      ] else
                        Text(
                          'Trading balance · ${CurrencyFormatter.format(tradingBalance)}',
                          style: theme.textTheme.bodyMedium,
                        ),
                      if (isActive) ...[
                        AppSpacing.gapMd(),
                        AiConfidenceMeter(
                          confidence: confidence,
                          subtitle: 'Desk confidence · live',
                        ),
                      ],
                    ],
                  ),
                ).staggerIn(index: 3),
                AppSpacing.gapMd(),
                RiskShieldVisual(
                  drawdownUsed: drawdown.used,
                  drawdownLimit: drawdown.limit,
                ).staggerIn(index: 4),
                AppSpacing.gapSection(),
                SectionHeader(
                  title: isActive ? 'Risk profile' : 'Risk profile',
                  subtitle: isActive ? 'Tap to queue a change · effective next trading day' : 'Protection auto-configured per tier',
                  actionLabel: 'AI desk',
                  onAction: () => context.push(RoutePaths.aiActivity),
                ),
                AppSpacing.gapMd(),
                ...RiskProfiles.all.asMap().entries.map((e) {
                  final cardProfile = e.value;
                  String? statusLabel;
                  if (isActive) {
                    if (cardProfile.id == currentRiskId) {
                      statusLabel = 'ACTIVE';
                    } else if (cardProfile.id == pendingRiskId) {
                      statusLabel = 'QUEUED';
                    }
                  }
                  return RiskProfileCard(
                    profile: cardProfile,
                    isSelected: isActive ? cardProfile.id == currentRiskId : ui.selectedProfileId == cardProfile.id,
                    statusLabel: statusLabel,
                    onTap: isActive
                        ? () => _handleRiskChange(context, ref, cardProfile, inv!)
                        : () => uiNotifier.selectProfile(cardProfile.id),
                  ).staggerIn(index: e.key + 5);
                }),
                AppSpacing.gapSection(),
                GlassCard(
                  animateEntrance: false,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(isActive ? 'Capital' : 'Deploy amount', style: theme.textTheme.titleMedium),
                      AppSpacing.gapMd(),
                      if (isActive) ...[
                        Text(
                          CurrencyFormatter.format(inv!.amount),
                          style: theme.textTheme.displaySmall?.copyWith(color: AppColors.brand),
                        ),
                        AppSpacing.gapSm(),
                        Text(
                          'Available to queue · ${CurrencyFormatter.format(topupAvailable)}',
                          style: theme.textTheme.bodySmall,
                        ),
                        AppSpacing.gapLg(),
                        PrimaryButton(
                          label: 'Add capital',
                          variant: PrimaryButtonVariant.buy,
                          icon: Icons.add_rounded,
                          onPressed: topupAvailable >= 10
                              ? () => _handleTopup(context, ref, topupAvailable)
                              : null,
                        ),
                      ] else ...[
                        Slider(
                          value: ui.deployAmount.clamp(10, tradingBalance > 10 ? tradingBalance : ui.deployAmount),
                          min: 10,
                          max: tradingBalance > 10 ? tradingBalance : 500,
                          activeColor: AppColors.brand,
                          onChanged: (v) => uiNotifier.setAmount(v),
                        ),
                        Text(
                          CurrencyFormatter.format(ui.deployAmount),
                          style: theme.textTheme.displaySmall?.copyWith(color: AppColors.brand),
                        ),
                        AppSpacing.gapLg(),
                        ProjectedGrowthChart(
                          currentAmount: ui.deployAmount,
                          projectedPoints: UiMockData.projectedGrowth(ui.deployAmount),
                          months: 12,
                        ),
                      ],
                      AppSpacing.gapMd(),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Auto-compounding'),
                        subtitle: const Text('Reinvest profits · passive snowball'),
                        value: inv?.autoCompound ?? true,
                        activeThumbColor: AppColors.brand,
                        onChanged: isActive
                            ? (v) => ref.read(investmentProvider.notifier).toggleCompounding(v)
                            : null,
                      ),
                    ],
                  ),
                ).staggerIn(index: 8),
                if (isActive) ...[
                  AppSpacing.gapSection(),
                  SectionHeader(
                    title: 'Live allocation',
                    subtitle: 'Desk transparency',
                    actionLabel: 'Protection',
                    onAction: () => context.push(RoutePaths.protection),
                  ),
                  AppSpacing.gapMd(),
                  if (allocationSlices.isNotEmpty)
                    GlassCard(
                      animateEntrance: false,
                      child: CapitalAllocationVisualizer(slices: allocationSlices),
                    ).staggerIn(index: 9),
                  AppSpacing.gapMd(),
                  if (deskEvents.isNotEmpty)
                    GlassCard(
                      animateEntrance: false,
                      child: DeskAllocationFeed(events: deskEvents),
                    ).staggerIn(index: 10),
                ],
                AppSpacing.gapXxl(),
                if (isActive)
                  PrimaryButton(
                    label: isPaused ? 'Stop strategy' : 'Pause strategy',
                    outlined: true,
                    onPressed: () async {
                      AppHaptics.heavy();
                      try {
                        await ref.read(investmentProvider.notifier).stopInvestment();
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(ErrorMessage.brief(e))),
                          );
                        }
                      }
                    },
                  )
                else
                  PrimaryButton(
                    label: ui.isActivating ? 'Deploying…' : 'Activate strategy',
                    variant: PrimaryButtonVariant.buy,
                    icon: Icons.bolt_rounded,
                    onPressed: ui.isActivating
                        ? null
                        : () {
                            showStrategyActivationSheet(
                              context,
                              profile: profile,
                              amount: ui.deployAmount,
                              projectedPoints: UiMockData.projectedGrowth(ui.deployAmount),
                              onConfirm: () async {
                                uiNotifier.setActivating(true);
                                try {
                                  await ref.read(investmentProvider.notifier).startInvestment(
                                        amount: ui.deployAmount,
                                        riskLevel: ui.selectedProfileId,
                                      );
                                  if (!context.mounted) return;
                                  SensoryFeedback.trigger(SensoryMoment.activationSuccess);
                                  showSuccessMoment(
                                    context,
                                    title: 'Capital deployed',
                                    message:
                                        '${profile.label} strategy is active. Your wealth desk is managing capital with protection enabled.',
                                    amount: CurrencyFormatter.format(ui.deployAmount),
                                  );
                                } catch (e) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text(ErrorMessage.brief(e))),
                                    );
                                  }
                                } finally {
                                  uiNotifier.setActivating(false);
                                }
                              },
                            );
                          },
                  ),
                const NavScrollSpacer(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

Future<void> _handleTopup(BuildContext context, WidgetRef ref, double maxAmount) async {
  await showInvestmentTopupSheet(
    context,
    maxAmount: maxAmount,
    initialAmount: (maxAmount * 0.25).clamp(10, maxAmount),
    onConfirm: (amount) async {
      try {
        await ref.read(investmentProvider.notifier).topup(amount: amount);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '${CurrencyFormatter.format(amount)} queued — earns from next trading day',
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
      } catch (e) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ErrorMessage.brief(e)), behavior: SnackBarBehavior.floating),
        );
      }
    },
  );
}

Future<void> _handleRiskChange(
  BuildContext context,
  WidgetRef ref,
  RiskProfile target,
  InvestmentState inv,
) async {
  final currentId = inv.riskLevel.trim().toUpperCase();
  if (target.id == currentId) return;

  final fromProfile = RiskProfiles.all.firstWhere(
    (p) => p.id == currentId,
    orElse: () => RiskProfiles.all[1],
  );

  final confirmed = await showRiskLevelChangeSheet(
    context,
    fromProfile: fromProfile,
    toProfile: target,
    effectiveDate: inv.pendingRiskLevelDate,
  );
  if (confirmed != true || !context.mounted) return;

  try {
    await ref.read(investmentProvider.notifier).queueRiskLevelChange(target.id);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${target.label} profile queued for next trading day'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  } catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ErrorMessage.brief(e)), behavior: SnackBarBehavior.floating),
    );
  }
}

Future<void> _cancelRiskChange(BuildContext context, WidgetRef ref) async {
  try {
    await ref.read(investmentProvider.notifier).cancelRiskLevelChange();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Pending risk change cancelled'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  } catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ErrorMessage.brief(e)), behavior: SnackBarBehavior.floating),
    );
  }
}

class _PendingTopupBanner extends StatelessWidget {
  const _PendingTopupBanner({required this.amount});

  final double amount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.emerald.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.md),
        border: Border.all(color: AppColors.emerald.withValues(alpha: 0.28)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.hourglass_top_rounded, color: AppColors.emerald, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              '${CurrencyFormatter.format(amount)} pending — capital earns from the next trading day',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class _ExclusivityStrip extends StatelessWidget {
  const _ExclusivityStrip({required this.slots, required this.investors});

  final int slots;
  final int investors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.brand.withValues(alpha: 0.14), AppColors.emerald.withValues(alpha: 0.06)],
        ),
        borderRadius: BorderRadius.circular(AppSpacing.md),
        border: Border.all(color: AppColors.brand.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          const Icon(Icons.workspace_premium_outlined, color: AppColors.brand, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              '$slots elite slots left · $investors investors growing safely',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.brand,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PendingRiskBanner extends StatelessWidget {
  const _PendingRiskBanner({
    required this.pendingLevel,
    this.effectiveDate,
    required this.onCancel,
  });

  final String pendingLevel;
  final String? effectiveDate;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final when = formatPendingEffectiveDate(effectiveDate);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.brand.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.md),
        border: Border.all(color: AppColors.brand.withValues(alpha: 0.28)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.schedule_rounded, color: AppColors.brand, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Switching to $pendingLevel on $when',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                AppSpacing.gapSm(),
                TextButton(
                  onPressed: onCancel,
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text('Cancel change'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PulseDot extends StatefulWidget {
  const _PulseDot({required this.active});
  final bool active;

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot> with SingleTickerProviderStateMixin {
  late AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));
    if (widget.active) _c.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(_PulseDot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !_c.isAnimating) _c.repeat(reverse: true);
    if (!widget.active) _c.stop();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) {
      return Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.muted(Theme.of(context).brightness == Brightness.dark),
        ),
      );
    }
    return AnimatedBuilder(
      animation: _c,
      builder: (_, __) => Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.buy.withValues(alpha: 0.6 + _c.value * 0.4),
          boxShadow: [BoxShadow(color: AppColors.buyGlow(0.3 + _c.value * 0.2), blurRadius: 8)],
        ),
      ),
    );
  }
}
