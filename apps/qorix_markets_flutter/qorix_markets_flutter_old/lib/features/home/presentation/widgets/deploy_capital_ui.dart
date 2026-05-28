import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/bot_setup_demo.dart';
import 'package:qorix_markets_flutter/widgets/desk_widgets.dart';

ThemeData _deployFieldTheme(BuildContext context) => Theme.of(context).copyWith(
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: AppColors.authGreen,
        selectionColor: AppColors.authGreen.withValues(alpha: 0.25),
        selectionHandleColor: AppColors.authGreen,
      ),
      inputDecorationTheme: const InputDecorationTheme(
        filled: false,
        fillColor: Colors.transparent,
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        contentPadding: EdgeInsets.zero,
        isDense: true,
      ),
    );

abstract final class _D {
  static const bg = Color(0xFF0A0E12);
  static const card = Color(0xFF12171C);
  static const field = Color(0xFF0E1217);
  static const border = Color(0xFF1E2630);

  static Color get muted => AppColors.authMuted.withValues(alpha: 0.72);
  static Color get faint => AppColors.authMuted.withValues(alpha: 0.48);

  static const green = AppColors.authGreen;

  static final _inr = NumberFormat('#,##0.###', 'en_IN');
  static String inr(num v) => '₹${_inr.format(v)}';
  static String inrAmount(num v) => _inr.format(v);
}

class DeployCapitalHeader extends StatelessWidget {
  const DeployCapitalHeader({required this.onBack, super.key});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DeskBackButton(onTap: onBack),
        const SizedBox(width: AppSpacing.md),
        const Expanded(
          child: DeskPageTitle(
            title: 'Deploy Capital',
            subtitle: 'Funds get assigned to your bot and start trading instantly',
          ),
        ),
      ],
    );
  }
}

class DeployAvailableCard extends StatelessWidget {
  const DeployAvailableCard({required this.availableInr, required this.riskLabel, super.key});

  final double availableInr;
  final String riskLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: AppDesk.densePadding,
      decoration: AppDesk.card(accent: _D.green),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('AVAILABLE TO DEPLOY', style: AppDesk.overline.copyWith(color: _D.green.withValues(alpha: 0.85))),
                const SizedBox(height: AppSpacing.sm),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                  child: Text(_D.inr(availableInr), style: AppDesk.metricHero),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text('Wallet · Instantly available', style: AppDesk.sectionCaption),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
            decoration: AppDesk.liveBadge(),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(width: 5, height: 5, decoration: BoxDecoration(color: _D.green, shape: BoxShape.circle)),
                const SizedBox(width: AppSpacing.xs),
                Text(riskLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _D.green.withValues(alpha: 0.95))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class DeployAmountSection extends StatelessWidget {
  const DeployAmountSection({
    required this.controller,
    required this.onMax,
    required this.onQuickPick,
    required this.onClear,
    this.onSubmitted,
    super.key,
  });

  final TextEditingController controller;
  final VoidCallback onMax;
  final ValueChanged<double> onQuickPick;
  final VoidCallback onClear;
  final VoidCallback? onSubmitted;

  bool get _hasAmount => (double.tryParse(controller.text.trim()) ?? 0) > 0;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text('Amount to Deploy', style: AppDesk.sectionTitle),
            const Spacer(),
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onMax,
                borderRadius: BorderRadius.circular(AppRadius.sm),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
                  decoration: AppDesk.outlineButton(accentColor: _D.green),
                  child: Text('MAX', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _D.green)),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.authInputBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: _hasAmount ? _D.green.withValues(alpha: 0.45) : AppColors.authInputBorder,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                '₹',
                style: TextStyle(
                  color: AppColors.authMuted.withValues(alpha: 0.75),
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Theme(
                  data: _deployFieldTheme(context),
                  child: TextField(
                    controller: controller,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => onSubmitted?.call(),
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 36,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      height: 1.1,
                    ),
                    cursorColor: _D.green,
                    decoration: InputDecoration.collapsed(
                      hintText: '0',
                      hintStyle: TextStyle(
                        color: AppColors.authMuted.withValues(alpha: 0.35),
                        fontSize: 36,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ),
              if (_hasAmount)
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onClear();
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.08),
                        border: Border.all(color: _D.border),
                      ),
                      child: Icon(Icons.close_rounded, size: 16, color: _D.muted),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Icon(Icons.info_outline_rounded, size: 14, color: _D.faint),
            const SizedBox(width: 6),
            Text('Minimum ₹5,000 · No lock-in period', style: TextStyle(fontSize: 11, color: _D.muted)),
          ],
        ),
        const SizedBox(height: 14),
        Row(
          children: BotSetupDemo.quickDeployInr.map((amt) {
            return Expanded(
              child: Padding(
                padding: EdgeInsets.only(right: amt == BotSetupDemo.quickDeployInr.last ? 0 : 8),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onQuickPick(amt);
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Ink(
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.authInputBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.authInputBorder),
                      ),
                      child: Center(
                        child: Text(
                          amt >= 100000 ? '₹100K' : '₹${(amt / 1000).toStringAsFixed(0)}K',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white.withValues(alpha: 0.9)),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class DeploySelectedBotCard extends StatelessWidget {
  const DeploySelectedBotCard({required this.bot, super.key});

  final BotExploreItem bot;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: AppDesk.densePadding,
      decoration: AppDesk.card(accent: _D.green),
      child: Row(
        children: [
          Container(
            width: AppDesk.iconBoxSize,
            height: AppDesk.iconBoxSize,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.md),
              color: _D.green.withValues(alpha: 0.1),
              border: Border.all(color: _D.green.withValues(alpha: 0.22)),
            ),
            child: Icon(Icons.memory_rounded, size: AppDesk.iconMd, color: _D.green),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        '${bot.name} ${bot.deployVersion}',
                        style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (bot.isLive) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: _D.green.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: _D.green.withValues(alpha: 0.35)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(width: 4, height: 4, decoration: const BoxDecoration(color: _D.green, shape: BoxShape.circle)),
                            const SizedBox(width: 4),
                            const Text('LIVE', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: _D.green)),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '${bot.deployMarkets} · Auto-managed · ${bot.deployReturn}',
                  style: TextStyle(fontSize: 10, color: _D.muted, height: 1.35),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class DeployRiskRewardMonthlyCard extends StatelessWidget {
  const DeployRiskRewardMonthlyCard({
    required this.bot,
    required this.amountInr,
    super.key,
  });

  final BotExploreItem bot;
  final double amountInr;

  static const _red = Color(0xFFFF4D6A);

  @override
  Widget build(BuildContext context) {
    final (_, returnHigh) = BotSetupDemo.parseMonthlyReturnPct(bot.deployReturn);
    final stopPct = BotSetupDemo.hardStopLossPct(bot.presetId);
    final profitHigh = amountInr * returnHigh / 100;
    final maxLoss = amountInr * stopPct / 100;
    final returnLabel = bot.deployReturn.replaceAll('/mo', '').trim();

    return Container(
      padding: AppDesk.densePadding,
      decoration: AppDesk.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.bar_chart_rounded, size: 16, color: _D.green.withValues(alpha: 0.9)),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Risk vs reward · monthly',
                  style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800),
                ),
              ),
              _RiskPill(label: bot.riskLabel),
            ],
          ),
          const SizedBox(height: AppDesk.metricBlockGap),
          Row(
            children: [
              Expanded(
                child: _MetricTile(
                  icon: Icons.trending_up_rounded,
                  label: 'Profit potential',
                  value: '+₹${_D.inrAmount(profitHigh)}',
                  sub: returnLabel,
                  accent: _D.green,
                  bg: _D.green.withValues(alpha: 0.08),
                  border: _D.green.withValues(alpha: 0.35),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricTile(
                  icon: Icons.trending_down_rounded,
                  label: 'Max drawdown',
                  value: '-₹${_D.inrAmount(maxLoss)}',
                  sub: 'capped at -${stopPct.toStringAsFixed(2)}%',
                  accent: _red,
                  bg: _red.withValues(alpha: 0.08),
                  border: _red.withValues(alpha: 0.35),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              height: 8,
              child: Row(
                children: [
                  Expanded(
                    flex: (stopPct * 10).round().clamp(1, 100),
                    child: Container(color: _red.withValues(alpha: 0.85)),
                  ),
                  Expanded(
                    flex: (returnHigh * 10).round().clamp(1, 100),
                    child: Container(color: _D.green.withValues(alpha: 0.85)),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('-${stopPct.toStringAsFixed(2)}%', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _red.withValues(alpha: 0.9))),
              Text('0%', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _D.muted)),
              Text('+$returnLabel', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _D.green.withValues(alpha: 0.9))),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.shield_outlined, size: 14, color: _D.faint),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Hard stop-loss at -${stopPct.toStringAsFixed(2)}% · auto-exit if breached · ${BotSetupDemo.clientShareLabel}',
                  style: TextStyle(fontSize: 10, color: _D.muted, height: 1.45),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RiskPill extends StatelessWidget {
  const _RiskPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _D.green.withValues(alpha: 0.35)),
        color: _D.green.withValues(alpha: 0.08),
      ),
      child: Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: _D.green.withValues(alpha: 0.95))),
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.sub,
    required this.accent,
    required this.bg,
    required this.border,
  });

  final IconData icon;
  final String label;
  final String value;
  final String sub;
  final Color accent;
  final Color bg;
  final Color border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: accent),
              const SizedBox(width: 5),
              Expanded(
                child: Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: accent.withValues(alpha: 0.9))),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: accent, letterSpacing: -0.3, height: 1.05),
          ),
          const SizedBox(height: 4),
          Text(sub, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: accent.withValues(alpha: 0.75))),
        ],
      ),
    );
  }
}

class DeployCapitalButton extends StatelessWidget {
  const DeployCapitalButton({
    required this.enabled,
    required this.loading,
    required this.onTap,
    this.amountInr,
    super.key,
  });

  final bool enabled;
  final bool loading;
  final VoidCallback onTap;
  final double? amountInr;

  @override
  Widget build(BuildContext context) {
    final label = enabled && amountInr != null
        ? 'Deploy ${_D.inr(amountInr!)}'
        : enabled
            ? 'Deploy capital'
            : 'Enter amount to deploy';

    return DeskPrimaryCta(
      label: label,
      loading: loading,
      onTap: enabled ? onTap : null,
      trailing: enabled && !loading ? Icon(Icons.bolt_rounded, size: AppDesk.iconMd, color: AppDesk.bg) : null,
    );
  }
}

class DeployCapitalFooter extends StatelessWidget {
  const DeployCapitalFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.lock_outline_rounded, size: 14, color: _D.faint),
        const SizedBox(width: 6),
        Text('Funds secured · Tier-1 regulated FX liquidity providers', style: TextStyle(fontSize: 10, color: _D.muted)),
      ],
    );
  }
}
