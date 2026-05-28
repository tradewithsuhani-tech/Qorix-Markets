import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/data/portfolio_bot_insights_demo.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/data/portfolio_demo.dart';
import 'package:qorix_markets_flutter/shared/formatters/currency_formatter.dart';

abstract final class _M {
  static const rLg = AppRadius.lg;
  static const rSm = AppRadius.sm;

  static Color get card => AppDesk.surface;
  static Color get line => AppDesk.border;
  static Color get text2 => AppDesk.textSecondary;
  static Color get text3 => AppDesk.textTertiary;

  static final _usd = NumberFormat.currency(symbol: '\$', decimalDigits: 2);

  static String usd(double v) => _usd.format(v);
}

class ManagePlanHeader extends StatelessWidget {
  const ManagePlanHeader({required this.onClose, super.key});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          onPressed: onClose,
          icon: const Icon(Icons.close_rounded, color: Colors.white, size: 22),
          style: IconButton.styleFrom(
            backgroundColor: Colors.white.withValues(alpha: 0.06),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        const Expanded(
          child: Text(
            'Manage plan',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.3),
          ),
        ),
        const SizedBox(width: 48),
      ],
    );
  }
}

class ManagePlanBotLiveCard extends StatelessWidget {
  const ManagePlanBotLiveCard({required this.data, super.key});

  final PortfolioViewData data;

  @override
  Widget build(BuildContext context) {
    final subtitle = data.preset != null
        ? 'Neural · ${data.preset!.personality.toLowerCase()} risk profile'
        : PortfolioBotInsightsDemo.activeBotSubtitle;

    return Container(
      decoration: BoxDecoration(
        color: _M.card,
        borderRadius: BorderRadius.circular(_M.rLg),
        border: Border.all(color: const Color(0xFF60A5FA).withValues(alpha: 0.38)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF60A5FA).withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: const Color(0xFF60A5FA).withValues(alpha: 0.14),
                  border: Border.all(color: const Color(0xFF60A5FA).withValues(alpha: 0.32)),
                ),
                child: const Icon(Icons.memory_rounded, size: 22, color: Color(0xFF60A5FA)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      PortfolioBotInsightsDemo.activeBotName,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white),
                    ),
                    const SizedBox(height: 2),
                    Text(subtitle, style: TextStyle(fontSize: 12, color: _M.text2)),
                  ],
                ),
              ),
              if (!data.isPaused) const _LivePill(),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: AppColors.authGreen.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.22)),
            ),
            child: Row(
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.authGreen,
                    boxShadow: [BoxShadow(color: AppColors.authGreen.withValues(alpha: 0.6), blurRadius: 6)],
                  ),
                ),
                const SizedBox(width: 8),
                const Text(
                  'LIVE',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 0.6, color: AppColors.authGreen),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    PortfolioBotInsightsDemo.statusMessage,
                    style: TextStyle(fontSize: 11, color: _M.text2),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LivePill extends StatelessWidget {
  const _LivePill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.authGreen.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.authGreen,
              boxShadow: [BoxShadow(color: AppColors.authGreen.withValues(alpha: 0.55), blurRadius: 5)],
            ),
          ),
          const SizedBox(width: 5),
          const Text('ACTIVE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: AppColors.authGreen)),
        ],
      ),
    );
  }
}

class ManagePlanProfitCard extends StatelessWidget {
  const ManagePlanProfitCard({required this.data, super.key});

  final PortfolioViewData data;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _M.card,
        borderRadius: BorderRadius.circular(_M.rLg),
        border: Border.all(color: _M.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('TOTAL PROFIT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1, color: _M.text3)),
          const SizedBox(height: 8),
          Text(
            '+${_M.usd(data.netProfit)}',
            style: const TextStyle(
              fontSize: 36,
              fontWeight: FontWeight.w800,
              color: AppColors.authGreen,
              letterSpacing: -1.2,
              height: 1,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '↑ +${data.roiPercent.toStringAsFixed(2)}% ROI · ${_M.usd(data.currentValue)} portfolio',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _M.text2),
          ),
          const SizedBox(height: 16),
          Container(height: 1, color: _M.line.withValues(alpha: 0.6)),
          const SizedBox(height: 14),
          Row(
            children: [
              _ProfitStat(label: 'Today', value: _M.usd(data.todayProfit), accent: true),
              Container(width: 1, height: 32, color: _M.line),
              _ProfitStat(label: 'This month', value: _M.usd(data.earnedThisMonth)),
              Container(width: 1, height: 32, color: _M.line),
              _ProfitStat(label: 'Invested', value: _M.usd(data.invested)),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProfitStat extends StatelessWidget {
  const _ProfitStat({required this.label, required this.value, this.accent = false});

  final String label;
  final String value;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(label, style: TextStyle(fontSize: 10, color: _M.text3)),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: accent ? AppColors.authGreen : Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class ManagePlanRiskPanel extends StatelessWidget {
  const ManagePlanRiskPanel({
    required this.data,
    required this.drawdownLimit,
    required this.drawdownUsed,
    required this.onDrawdownChanged,
    required this.onCompoundChanged,
    required this.onViewProtection,
    super.key,
  });

  final PortfolioViewData data;
  final double drawdownLimit;
  final double drawdownUsed;
  final ValueChanged<double> onDrawdownChanged;
  final ValueChanged<bool> onCompoundChanged;
  final VoidCallback onViewProtection;

  static const _drawdownOptions = [3.0, 5.0, 7.0, 10.0];

  @override
  Widget build(BuildContext context) {
    final usedRatio = drawdownLimit <= 0 ? 0.0 : (drawdownUsed / drawdownLimit).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _M.card,
        borderRadius: BorderRadius.circular(_M.rLg),
        border: Border.all(color: _M.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.shield_outlined, size: 18, color: AppColors.authGreen.withValues(alpha: 0.9)),
              const SizedBox(width: 8),
              const Text('Risk management', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
            ],
          ),
          const SizedBox(height: 16),
          Text('Drawdown limit', style: TextStyle(fontSize: 12, color: _M.text2)),
          const SizedBox(height: 10),
          Row(
            children: [
              for (final opt in _drawdownOptions) ...[
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(right: opt == _drawdownOptions.last ? 0 : 8),
                    child: _DrawdownChip(
                      label: '${opt.toStringAsFixed(0)}%',
                      selected: drawdownLimit == opt,
                      onTap: () => onDrawdownChanged(opt),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Drawdown used', style: TextStyle(fontSize: 12, color: _M.text3)),
              Text(
                '${drawdownUsed.toStringAsFixed(1)}% of ${drawdownLimit.toStringAsFixed(0)}%',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: usedRatio,
              minHeight: 6,
              backgroundColor: Colors.white.withValues(alpha: 0.06),
              color: usedRatio > 0.75 ? AppColors.sell : AppColors.authGreen,
            ),
          ),
          const SizedBox(height: 16),
          Container(height: 1, color: _M.line.withValues(alpha: 0.6)),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Auto-compound', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                    Text('Reinvest daily profits', style: TextStyle(fontSize: 11, color: _M.text3)),
                  ],
                ),
              ),
              Switch.adaptive(
                value: data.autoCompound,
                onChanged: onCompoundChanged,
                activeTrackColor: AppColors.authGreen.withValues(alpha: 0.45),
                activeThumbColor: AppColors.authGreen,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _RiskTag(label: 'Profile', value: data.riskLabel),
              const SizedBox(width: 8),
              _RiskTag(label: 'Sessions', value: '${data.tradingDaysSettled}/${data.tradingDaysTotal}'),
            ],
          ),
          const SizedBox(height: 14),
          GestureDetector(
            onTap: onViewProtection,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.03),
                borderRadius: BorderRadius.circular(_M.rSm),
                border: Border.all(color: _M.line),
              ),
              child: Row(
                children: [
                  Icon(Icons.security_rounded, size: 16, color: AppColors.authGreen.withValues(alpha: 0.85)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text('View capital protection system', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _M.text2)),
                  ),
                  Icon(Icons.chevron_right_rounded, size: 18, color: _M.text3),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DrawdownChip extends StatelessWidget {
  const _DrawdownChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.authGreen.withValues(alpha: 0.14) : Colors.white.withValues(alpha: 0.04),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: selected ? AppColors.authGreen.withValues(alpha: 0.5) : _M.line),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: selected ? AppColors.authGreen : _M.text2,
            ),
          ),
        ),
      ),
    );
  }
}

class _RiskTag extends StatelessWidget {
  const _RiskTag({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _M.line),
      ),
      child: Text.rich(
        TextSpan(
          text: '$label  ',
          style: TextStyle(fontSize: 11, color: _M.text3),
          children: [
            TextSpan(text: value, style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white)),
          ],
        ),
      ),
    );
  }
}

class ManagePlanAllocationStrip extends StatelessWidget {
  const ManagePlanAllocationStrip({required this.data, super.key});

  final PortfolioViewData data;

  @override
  Widget build(BuildContext context) {
    final slices = [...data.allocation]..sort((a, b) => b.percent.compareTo(a.percent));
    if (slices.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _M.card,
        borderRadius: BorderRadius.circular(_M.rLg),
        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('Asset allocation', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
              const Spacer(),
              Text('Gold-heavy', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFFF59E0B))),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: SizedBox(
              height: 8,
              child: Row(
                children: [
                  for (final slice in slices)
                    Expanded(
                      flex: (slice.percent * 1000).round().clamp(1, 1000),
                      child: Container(color: slice.color),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          for (final slice in slices.take(2))
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  Container(width: 7, height: 7, decoration: BoxDecoration(shape: BoxShape.circle, color: slice.color)),
                  const SizedBox(width: 8),
                  Expanded(child: Text(slice.label, style: TextStyle(fontSize: 12, color: _M.text2))),
                  Text('${(slice.percent * 100).round()}%', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class ManagePlanAiMetricsGrid extends StatefulWidget {
  const ManagePlanAiMetricsGrid({super.key});

  @override
  State<ManagePlanAiMetricsGrid> createState() => _ManagePlanAiMetricsGridState();
}

class _ManagePlanAiMetricsGridState extends State<ManagePlanAiMetricsGrid> with SingleTickerProviderStateMixin {
  late final AnimationController _scanCtrl;
  late final Ticker _ticker;
  Duration _elapsed = Duration.zero;

  final _rng = math.Random(17);
  final Map<int, double> _pulse = {};

  static const _tickEvery = Duration(milliseconds: 260);

  @override
  void initState() {
    super.initState();
    _scanCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat(reverse: true);
    for (var i = 0; i < PortfolioBotInsightsDemo.metrics.length; i++) {
      _pulse[i] = PortfolioBotInsightsDemo.metrics[i].pct.toDouble();
    }
    _ticker = createTicker(_onTick)..start();
  }

  void _onTick(Duration elapsed) {
    if (elapsed - _elapsed < _tickEvery) return;
    _elapsed = elapsed;

    setState(() {
      for (var i = 0; i < PortfolioBotInsightsDemo.metrics.length; i++) {
        final base = PortfolioBotInsightsDemo.metrics[i].pct.toDouble();
        final swing = (_rng.nextDouble() - 0.5) * 6;
        _pulse[i] = (base + swing).clamp(base - 5, base + 4).clamp(60.0, 99.0);
      }
    });
  }

  @override
  void dispose() {
    _ticker.dispose();
    _scanCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _M.card,
        borderRadius: BorderRadius.circular(_M.rLg),
        border: Border.all(color: const Color(0xFF60A5FA).withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('AI engine confidence', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
              const Spacer(),
              AnimatedBuilder(
                animation: _scanCtrl,
                builder: (context, _) {
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF60A5FA).withValues(alpha: 0.08 + _scanCtrl.value * 0.06),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFF60A5FA).withValues(alpha: 0.28 + _scanCtrl.value * 0.18)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 5,
                          height: 5,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFF60A5FA),
                            boxShadow: [BoxShadow(color: const Color(0xFF60A5FA).withValues(alpha: 0.35 + _scanCtrl.value * 0.45), blurRadius: 6)],
                          ),
                        ),
                        const SizedBox(width: 5),
                        const Text('SCANNING', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Color(0xFF60A5FA))),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: 14),
          for (var i = 0; i < PortfolioBotInsightsDemo.metrics.length; i++) ...[
            _LiveAiMetricRow(
              label: PortfolioBotInsightsDemo.metrics[i].label,
              pct: _pulse[i] ?? PortfolioBotInsightsDemo.metrics[i].pct.toDouble(),
              highlight: i == 0 && _scanCtrl.value > 0.55,
            ),
            if (i < PortfolioBotInsightsDemo.metrics.length - 1) const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

class _LiveAiMetricRow extends StatelessWidget {
  const _LiveAiMetricRow({required this.label, required this.pct, this.highlight = false});

  final String label;
  final double pct;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final value = (pct / 100).clamp(0.0, 1.0);
    final display = pct.round();

    return Row(
      children: [
        SizedBox(
          width: 118,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: highlight ? FontWeight.w600 : FontWeight.w400,
              color: highlight ? Colors.white.withValues(alpha: 0.9) : _M.text3,
            ),
          ),
        ),
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: SizedBox(
                  height: 6,
                  child: Stack(
                    children: [
                      Container(color: Colors.white.withValues(alpha: 0.06)),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 240),
                        curve: Curves.easeOutCubic,
                        width: constraints.maxWidth * value,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(4),
                          gradient: LinearGradient(
                            colors: [
                              const Color(0xFF60A5FA).withValues(alpha: highlight ? 1 : 0.85),
                              const Color(0xFF818CF8).withValues(alpha: highlight ? 0.95 : 0.75),
                            ],
                          ),
                          boxShadow: highlight
                              ? [BoxShadow(color: const Color(0xFF60A5FA).withValues(alpha: 0.35), blurRadius: 6)]
                              : null,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(width: 10),
        SizedBox(
          width: 34,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            transitionBuilder: (child, anim) => FadeTransition(
              opacity: anim,
              child: SlideTransition(
                position: Tween<Offset>(begin: const Offset(0, 0.35), end: Offset.zero).animate(anim),
                child: child,
              ),
            ),
            child: Text(
              '$display%',
              key: ValueKey(display),
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: highlight ? const Color(0xFF60A5FA) : Colors.white,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class ManagePlanStopButton extends StatelessWidget {
  const ManagePlanStopButton({required this.onStop, super.key});

  final VoidCallback onStop;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.sell.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onStop,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.sell.withValues(alpha: 0.45)),
          ),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.stop_circle_outlined, color: AppColors.sell, size: 20),
              SizedBox(width: 10),
              Text(
                'STOP BOT',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: 0.4, color: AppColors.sell),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<bool?> showManagePlanStopConfirmDialog(BuildContext context) {
  return showDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierColor: Colors.black.withValues(alpha: 0.78),
    builder: (ctx) => const ManagePlanStopConfirmDialog(),
  );
}

class ManagePlanStopConfirmDialog extends StatefulWidget {
  const ManagePlanStopConfirmDialog({super.key});

  @override
  State<ManagePlanStopConfirmDialog> createState() => _ManagePlanStopConfirmDialogState();
}

class _ManagePlanStopConfirmDialogState extends State<ManagePlanStopConfirmDialog> with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 22),
      child: AnimatedBuilder(
        animation: _pulseCtrl,
        builder: (context, _) {
          return Container(
            padding: const EdgeInsets.fromLTRB(22, 24, 22, 20),
            decoration: BoxDecoration(
              color: const Color(0xFF0F1419),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.28 + _pulseCtrl.value * 0.12)),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.08 + _pulseCtrl.value * 0.06),
                  blurRadius: 28,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.12 + _pulseCtrl.value * 0.06),
                    border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4 + _pulseCtrl.value * 0.2)),
                    boxShadow: [BoxShadow(color: const Color(0xFFF59E0B).withValues(alpha: 0.18 * _pulseCtrl.value), blurRadius: 16)],
                  ),
                  child: const Icon(Icons.show_chart_rounded, color: Color(0xFFF59E0B), size: 26),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.sell.withValues(alpha: 0.1 + _pulseCtrl.value * 0.05),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.sell.withValues(alpha: 0.35 + _pulseCtrl.value * 0.15)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.sell,
                          boxShadow: [BoxShadow(color: AppColors.sell.withValues(alpha: 0.5 + _pulseCtrl.value * 0.3), blurRadius: 6)],
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'LIVE TRADE OPEN',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 0.8, color: AppColors.sell),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Wait — a trade is still running',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.3, height: 1.2),
                ),
                const SizedBox(height: 12),
                Text(
                  'MomentumBot has an active position on XAU/USD right now. Stopping the bot will force-close it immediately — you could lock in a loss before take-profit is reached.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, height: 1.45, color: AppColors.authMuted.withValues(alpha: 0.88)),
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.04),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Icon(Icons.bolt_rounded, size: 15, color: AppColors.authGreen.withValues(alpha: 0.9)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'XAU/USD · Long position active',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.92)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(Icons.trending_up_rounded, size: 15, color: AppColors.authGreen.withValues(alpha: 0.85)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Session still in profit — let this cycle finish',
                              style: TextStyle(fontSize: 11, color: AppColors.authMuted.withValues(alpha: 0.78)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Most desks recover within the next few minutes. Your capital stays in funding either way.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, height: 1.4, color: AppColors.authMuted.withValues(alpha: 0.62)),
                ),
                const SizedBox(height: 20),
                Material(
                  color: AppColors.authGreen.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    onTap: () => Navigator.pop(context, false),
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.45)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.play_circle_filled_rounded, color: AppColors.authGreen, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Keep bot running',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.authGreen),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: () => Navigator.pop(context, true),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.authMuted.withValues(alpha: 0.45),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  ),
                  child: const Text(
                    'Stop anyway · I accept the risk',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class ManagePlanPendingTopupBanner extends StatelessWidget {
  const ManagePlanPendingTopupBanner({required this.amount, super.key});

  final double amount;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.authGreen.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(_M.rLg),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.28)),
      ),
      child: Text(
        '${CurrencyFormatter.format(amount)} queued — earns from next trading day',
        style: TextStyle(fontSize: 12, color: AppColors.authMuted.withValues(alpha: 0.85), height: 1.4),
      ),
    );
  }
}

class ManagePlanTopupCard extends StatelessWidget {
  const ManagePlanTopupCard({
    required this.deployed,
    required this.available,
    required this.onAddCapital,
    super.key,
  });

  final double deployed;
  final double available;
  final VoidCallback? onAddCapital;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _M.card,
        borderRadius: BorderRadius.circular(_M.rLg),
        border: Border.all(color: _M.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Add capital',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
          ),
          const SizedBox(height: 6),
          Text(
            'Deployed ${_M.usd(deployed)} · ${_M.usd(available)} available to queue',
            style: TextStyle(fontSize: 11, color: _M.text2, height: 1.4),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: onAddCapital,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Queue topup'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF6366F1),
                disabledBackgroundColor: Colors.white.withValues(alpha: 0.06),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
