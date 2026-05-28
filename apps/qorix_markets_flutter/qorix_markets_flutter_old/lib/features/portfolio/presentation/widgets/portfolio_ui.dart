import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/data/portfolio_demo.dart';

abstract final class _T {
  static const rLg = AppRadius.lg;
  static const rSm = AppRadius.sm;

  static Color get card => AppDesk.surface;
  static Color get line => AppDesk.border;
  static Color get text2 => AppDesk.textSecondary;
  static Color get text3 => AppDesk.textTertiary;

  static final _usd = NumberFormat.currency(symbol: '\$', decimalDigits: 2);

  static String usd(double v) => _usd.format(v);
}

// ─── Public widgets ───────────────────────────────────────────────────────────

class PortfolioPageHeader extends StatelessWidget {
  const PortfolioPageHeader({required this.unreadCount, required this.onNotifications, super.key});

  final int unreadCount;
  final VoidCallback onNotifications;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Spacer(),
        _IconBtn(icon: Icons.notifications_none_rounded, badge: unreadCount, onTap: onNotifications),
      ],
    );
  }
}

class PortfolioActionRow extends StatelessWidget {
  const PortfolioActionRow({required this.onManage, super.key});

  final VoidCallback onManage;

  @override
  Widget build(BuildContext context) {
    return _PrimaryBtn(label: 'Manage plan', icon: Icons.tune_rounded, onTap: onManage);
  }
}

class PortfolioPerformanceHero extends StatelessWidget {
  const PortfolioPerformanceHero({required this.data, super.key});

  final PortfolioViewData data;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            _BotBadge(codename: data.botCodename),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    data.preset?.personality ?? 'AI Bot',
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.3),
                  ),
                  Text(
                    '${data.botCodename} · ${data.riskLabel}',
                    style: TextStyle(fontSize: 13, color: _T.text2),
                  ),
                ],
              ),
            ),
            if (!data.isPaused) const _LiveTag(),
          ],
        ),
        const SizedBox(height: 28),
        Text(
          'PORTFOLIO VALUE',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: _T.text3),
        ),
        const SizedBox(height: 8),
        Text(
          _T.usd(data.currentValue),
          style: const TextStyle(
            fontSize: 46,
            fontWeight: FontWeight.w800,
            color: Colors.white,
            letterSpacing: -1.8,
            height: 1,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(height: 12),
        _PnlRow(value: data.netProfit, pct: data.roiPercent),
        const SizedBox(height: 24),
        _StatGrid(
          cells: [
            _StatCell(label: 'Invested', value: _T.usd(data.invested)),
            _StatCell(label: 'Net profit', value: '+${_T.usd(data.netProfit)}', accent: true),
            _StatCell(label: 'Today', value: _T.usd(data.todayProfit)),
            _StatCell(label: 'Running', value: '${data.daysRunning} days'),
          ],
        ),
      ],
    );
  }
}

class PortfolioMonthStatsRow extends StatelessWidget {
  const PortfolioMonthStatsRow({required this.data, super.key});

  final PortfolioViewData data;

  @override
  Widget build(BuildContext context) {
    final pct = (data.progressPct * 100).round();
    final month = DateFormat('MMMM yyyy').format(DateTime.now());

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('This month', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _T.text2)),
              const Spacer(),
              Text(month, style: TextStyle(fontSize: 12, color: _T.text3)),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _T.usd(data.earnedThisMonth),
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.6),
              ),
              const SizedBox(width: 10),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text('+$pct%', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.authGreen)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _ProgressBar(value: data.progressPct),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${data.tradingDaysSettled} sessions done', style: TextStyle(fontSize: 12, color: _T.text3)),
              Text('${data.tradingDaysLeft} remaining', style: TextStyle(fontSize: 12, color: _T.text3)),
            ],
          ),
        ],
      ),
    );
  }
}

class PortfolioReturnsOutlookCard extends StatelessWidget {
  const PortfolioReturnsOutlookCard({required this.data, super.key});

  final PortfolioViewData data;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _Heading(title: 'Returns outlook'),
        const SizedBox(height: 12),
        _Panel(
          child: Column(
            children: [
              _KvRow(label: 'Monthly potential', value: '${_T.usd(data.monthlyLow)} – ${_T.usd(data.monthlyHigh)}', highlight: true),
              _Divider(),
              _KvRow(label: 'Target band', value: data.preset?.monthlyTarget ?? '—'),
              _Divider(),
              _KvRow(label: 'Today', value: _T.usd(data.todayProfit)),
              if (!data.marketsOpen) ...[
                _Divider(),
                Row(
                  children: [
                    Icon(Icons.nightlight_outlined, size: 16, color: _T.text3),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text('Markets closed · resumes Monday', style: TextStyle(fontSize: 13, color: _T.text2)),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class PortfolioStrategySetupCard extends StatelessWidget {
  const PortfolioStrategySetupCard({
    required this.data,
    required this.onToggleCompound,
    required this.onStopTrading,
    super.key,
  });

  final PortfolioViewData data;
  final ValueChanged<bool> onToggleCompound;
  final VoidCallback onStopTrading;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _Heading(title: 'Bot controls'),
        const SizedBox(height: 12),
        _Panel(
          child: Column(
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _Tag(label: 'Risk', value: data.riskLabel),
                  _Tag(label: 'Drawdown', value: '${data.drawdownLimit.toStringAsFixed(0)}%'),
                  _Tag(label: 'Compound', value: data.autoCompound ? 'On' : 'Off'),
                  _Tag(label: 'Sessions', value: '${data.tradingDaysTotal}'),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Auto-compound', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                        Text('Reinvest profits automatically', style: TextStyle(fontSize: 12, color: _T.text3)),
                      ],
                    ),
                  ),
                  Switch.adaptive(
                    value: data.autoCompound,
                    onChanged: onToggleCompound,
                    activeTrackColor: AppColors.authGreen.withValues(alpha: 0.45),
                    activeThumbColor: AppColors.authGreen,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              _DangerBtn(label: 'Pause bot', onTap: onStopTrading),
            ],
          ),
        ),
      ],
    );
  }
}

class PortfolioDailyBreakdownCard extends StatelessWidget {
  const PortfolioDailyBreakdownCard({required this.data, super.key});

  final PortfolioViewData data;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Heading(title: 'Daily ledger', trailing: '${data.tradingDaysSettled}/${data.tradingDaysTotal}'),
        const SizedBox(height: 12),
        _DailyLedgerPanel(data: data),
      ],
    );
  }
}

class _DailyLedgerPanel extends StatefulWidget {
  const _DailyLedgerPanel({required this.data});

  final PortfolioViewData data;

  @override
  State<_DailyLedgerPanel> createState() => _DailyLedgerPanelState();
}

class _DailyLedgerPanelState extends State<_DailyLedgerPanel> {
  int? _selectedIndex;

  @override
  Widget build(BuildContext context) {
    final cells = widget.data.dailyCells;
    if (cells.isEmpty) {
      return _Panel(
        padding: const EdgeInsets.all(20),
        child: Text('No sessions this month', style: TextStyle(fontSize: 13, color: _T.text3), textAlign: TextAlign.center),
      );
    }

    final maxProfit = cells.fold<double>(0, (m, c) => math.max(m, c.profit ?? 0));
    final settledCount = widget.data.tradingDaysSettled;
    final avgPerSession = settledCount > 0 ? widget.data.earnedThisMonth / settledCount : 0.0;

    PortfolioDayCell? bestCell;
    for (final cell in cells) {
      final p = cell.profit;
      if (p == null) continue;
      if (bestCell == null || p > bestCell.profit!) bestCell = cell;
    }

    final todayIndex = cells.indexWhere((c) => c.isToday);
    final activeIndex = _selectedIndex ?? (todayIndex >= 0 ? todayIndex : null);

    return _Panel(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: _LedgerMiniStat(label: 'Avg / session', value: '+${_T.usd(avgPerSession)}')),
              Container(width: 1, height: 34, color: _T.line),
              Expanded(
                child: _LedgerMiniStat(
                  label: 'Best day',
                  value: bestCell?.profit != null ? '+${_T.usd(bestCell!.profit!)}' : '—',
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 52,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < cells.length; i++)
                  Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => setState(() => _selectedIndex = _selectedIndex == i ? null : i),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 1.5),
                        child: _LedgerBar(cell: cells[i], maxProfit: maxProfit, selected: activeIndex == i),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              for (final cell in cells)
                Expanded(
                  child: Text(
                    cell.label.split(' ').last,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: cell.isToday ? FontWeight.w700 : FontWeight.w500,
                      color: cell.isToday ? AppColors.authGreen : _T.text3.withValues(alpha: 0.65),
                    ),
                  ),
                ),
            ],
          ),
          if (activeIndex != null) ...[
            const SizedBox(height: 14),
            _LedgerDetailStrip(cell: cells[activeIndex!]),
          ],
          const SizedBox(height: 4),
          Text(
            'Tap a bar for session detail',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, color: _T.text3.withValues(alpha: 0.55)),
          ),
        ],
      ),
    );
  }
}

class PortfolioAllocationCard extends StatelessWidget {
  const PortfolioAllocationCard({required this.data, super.key});

  final PortfolioViewData data;

  @override
  Widget build(BuildContext context) {
    final slices = [...data.allocation]..sort((a, b) => b.percent.compareTo(a.percent));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _Heading(title: 'Allocation', trailing: 'Gold-heavy'),
        const SizedBox(height: 12),
        _Panel(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _AllocationStackBar(slices: slices),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Asset mix', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _T.text3)),
                  Text('100% deployed', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _T.text3)),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _AllocationDonut(total: data.invested, slices: slices),
                  const SizedBox(width: 18),
                  Expanded(
                    child: Column(
                      children: [
                        for (var i = 0; i < slices.length; i++) ...[
                          if (i > 0) const SizedBox(height: 12),
                          _AllocationLegendRow(slice: slices[i], emphasize: slices[i].percent >= 0.5),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(_T.rSm),
                  border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.22)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.shield_outlined, size: 16, color: const Color(0xFFF59E0B).withValues(alpha: 0.9)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '80% core weight in XAU · 20% satellite FX, indices & crypto',
                        style: TextStyle(fontSize: 12, height: 1.35, color: _T.text2),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class PortfolioDeskNoteCard extends StatelessWidget {
  const PortfolioDeskNoteCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Text(
      'Bot trades Mon–Fri. Profits settle daily to funding. Protection stays armed on weekends.',
      style: TextStyle(fontSize: 12, height: 1.5, color: _T.text3),
      textAlign: TextAlign.center,
    );
  }
}

class PortfolioEmptyState extends StatelessWidget {
  const PortfolioEmptyState({required this.onActivate, super.key});

  final VoidCallback onActivate;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: AppColors.authGreen.withValues(alpha: 0.1),
              border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.3)),
            ),
            child: const Icon(Icons.smart_toy_outlined, size: 30, color: AppColors.authGreen),
          ),
          const SizedBox(height: 22),
          const Text(
            'No bot deployed',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.4),
          ),
          const SizedBox(height: 8),
          Text(
            'Activate your AI bot to track\nreturns and allocation here.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, height: 1.45, color: _T.text2),
          ),
          const SizedBox(height: 26),
          _PrimaryBtn(label: 'Activate bot', icon: Icons.arrow_forward_rounded, onTap: onActivate),
        ],
      ),
    );
  }
}

// ─── Primitives ───────────────────────────────────────────────────────────────

class _Heading extends StatelessWidget {
  const _Heading({required this.title, this.trailing});

  final String title;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(title, style: AppDesk.sectionTitle),
        const Spacer(),
        if (trailing != null) Text(trailing!, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _T.text3)),
      ],
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child, this.padding = AppDesk.cardPadding});

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: _T.card,
        borderRadius: BorderRadius.circular(_T.rLg),
        border: Border.all(color: _T.line),
      ),
      child: child,
    );
  }
}

class _BotBadge extends StatelessWidget {
  const _BotBadge({required this.codename});

  final String codename;

  @override
  Widget build(BuildContext context) {
    final initial = codename.isNotEmpty ? codename.characters.first : 'Q';
    return Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(13),
        color: AppColors.authGreen.withValues(alpha: 0.12),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
      ),
      alignment: Alignment.center,
      child: Text(initial, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.authGreen)),
    );
  }
}

class _LiveTag extends StatelessWidget {
  const _LiveTag();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(99),
        color: AppColors.authGreen.withValues(alpha: 0.1),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _BlinkDot(),
          SizedBox(width: 6),
          Text('LIVE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.authGreen, letterSpacing: 0.6)),
        ],
      ),
    );
  }
}

class _BlinkDot extends StatefulWidget {
  const _BlinkDot();

  @override
  State<_BlinkDot> createState() => _BlinkDotState();
}

class _BlinkDotState extends State<_BlinkDot> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(begin: 0.35, end: 1.0).animate(_c),
      child: Container(
        width: 7,
        height: 7,
        decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.authGreen),
      ),
    );
  }
}

class _PnlRow extends StatelessWidget {
  const _PnlRow({required this.value, required this.pct});

  final double value;
  final double pct;

  @override
  Widget build(BuildContext context) {
    final up = value >= 0;
    final color = up ? AppColors.authGreen : AppColors.sell;
    return Row(
      children: [
        Icon(up ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded, size: 16, color: color),
        const SizedBox(width: 4),
        Text(
          '${up ? '+' : ''}${_T.usd(value)}  ·  ${pct.toStringAsFixed(2)}% ROI',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color),
        ),
      ],
    );
  }
}

class _StatCell {
  const _StatCell({required this.label, required this.value, this.accent = false});

  final String label;
  final String value;
  final bool accent;
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.cells});

  final List<_StatCell> cells;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(_T.rLg),
        border: Border.all(color: _T.line),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: _StatTile(cell: cells[0])),
              Container(width: 1, height: 52, color: _T.line),
              Expanded(child: _StatTile(cell: cells[1])),
            ],
          ),
          Container(height: 1, color: _T.line),
          Row(
            children: [
              Expanded(child: _StatTile(cell: cells[2])),
              Container(width: 1, height: 52, color: _T.line),
              Expanded(child: _StatTile(cell: cells[3])),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.cell});

  final _StatCell cell;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(cell.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _T.text3)),
          const SizedBox(height: 4),
          Text(
            cell.value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: cell.accent ? AppColors.authGreen : Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _KvRow extends StatelessWidget {
  const _KvRow({required this.label, required this.value, this.highlight = false});

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Expanded(child: Text(label, style: TextStyle(fontSize: 14, color: _T.text2))),
          Text(
            value,
            style: TextStyle(
              fontSize: highlight ? 15 : 14,
              fontWeight: FontWeight.w700,
              color: highlight ? AppColors.authGreen : Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _LedgerMiniStat extends StatelessWidget {
  const _LedgerMiniStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: _T.text3)),
        const SizedBox(height: 5),
        Text(
          value,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.authGreen),
        ),
      ],
    );
  }
}

class _LedgerBar extends StatelessWidget {
  const _LedgerBar({required this.cell, required this.maxProfit, required this.selected});

  final PortfolioDayCell cell;
  final double maxProfit;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    const maxH = 52.0;
    final settled = cell.isSettled && cell.profit != null;
    final ratio = settled && maxProfit > 0 ? (cell.profit! / maxProfit).clamp(0.12, 1.0) : 0.0;
    final barH = settled ? math.max(8.0, ratio * maxH) : cell.isToday ? 12.0 : 5.0;

    final fill = cell.isUpcoming
        ? Colors.white.withValues(alpha: 0.05)
        : cell.isToday
            ? AppColors.authGreen.withValues(alpha: settled ? 0.75 : 0.35)
            : AppColors.authGreen.withValues(alpha: 0.25 + ratio * 0.55);

    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          height: barH,
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(4),
            border: selected
                ? Border.all(color: Colors.white, width: 1.5)
                : cell.isToday
                    ? Border.all(color: AppColors.authGreen.withValues(alpha: 0.85), width: 1)
                    : null,
          ),
        ),
      ],
    );
  }
}

class _LedgerDetailStrip extends StatelessWidget {
  const _LedgerDetailStrip({required this.cell});

  final PortfolioDayCell cell;

  @override
  Widget build(BuildContext context) {
    final status = cell.isToday
        ? 'Today'
        : cell.isSettled
            ? 'Settled'
            : cell.isUpcoming
                ? 'Upcoming'
                : '—';
    final statusColor = cell.isToday ? AppColors.authGreen : _T.text3;
    final amount = cell.profit != null ? '+${_T.usd(cell.profit!)}' : '—';
    final showAmount = cell.profit != null;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(_T.rSm),
        border: Border.all(color: cell.isToday ? AppColors.authGreen.withValues(alpha: 0.35) : _T.line),
      ),
      child: Row(
        children: [
          Text(
            cell.label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: cell.isToday ? AppColors.authGreen : Colors.white,
            ),
          ),
          const SizedBox(width: 8),
          Text('·', style: TextStyle(fontSize: 12, color: _T.text3.withValues(alpha: 0.5))),
          const SizedBox(width: 8),
          Text(status, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: statusColor)),
          const Spacer(),
          Text(
            amount,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: showAmount ? AppColors.authGreen : _T.text3.withValues(alpha: 0.45),
            ),
          ),
        ],
      ),
    );
  }
}

class _AllocationStackBar extends StatelessWidget {
  const _AllocationStackBar({required this.slices});

  final List<PortfolioAllocationSlice> slices;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: SizedBox(
        height: 10,
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
    );
  }
}

class _AllocationDonut extends StatelessWidget {
  const _AllocationDonut({required this.total, required this.slices});

  final double total;
  final List<PortfolioAllocationSlice> slices;

  @override
  Widget build(BuildContext context) {
    const size = 118.0;

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: const Size(size, size),
            painter: _AllocationDonutPainter(slices: slices),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'DEPLOYED',
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: _T.text3),
              ),
              const SizedBox(height: 4),
              Text(
                _T.usd(total),
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.4),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AllocationDonutPainter extends CustomPainter {
  const _AllocationDonutPainter({required this.slices});

  final List<PortfolioAllocationSlice> slices;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    const stroke = 14.0;
    final radius = (math.min(size.width, size.height) - stroke) / 2;
    final rect = Rect.fromCircle(center: center, radius: radius);
    const gap = 0.04;

    var start = -math.pi / 2;
    for (final slice in slices) {
      final sweep = slice.percent * 2 * math.pi - gap;
      if (sweep <= 0) continue;

      final paint = Paint()
        ..color = slice.color
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round;

      canvas.drawArc(rect, start, sweep, false, paint);
      start += slice.percent * 2 * math.pi;
    }
  }

  @override
  bool shouldRepaint(covariant _AllocationDonutPainter oldDelegate) => oldDelegate.slices != slices;
}

class _AllocationLegendRow extends StatelessWidget {
  const _AllocationLegendRow({required this.slice, this.emphasize = false});

  final PortfolioAllocationSlice slice;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final pct = (slice.percent * 100).round();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Container(
              width: emphasize ? 10 : 8,
              height: emphasize ? 10 : 8,
              decoration: BoxDecoration(shape: BoxShape.circle, color: slice.color),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                slice.label,
                style: TextStyle(
                  fontSize: emphasize ? 13 : 12,
                  fontWeight: emphasize ? FontWeight.w700 : FontWeight.w600,
                  color: emphasize ? Colors.white : _T.text2,
                ),
              ),
            ),
            Text(
              '$pct%',
              style: TextStyle(
                fontSize: emphasize ? 13 : 12,
                fontWeight: FontWeight.w700,
                color: emphasize ? slice.color : _T.text3,
              ),
            ),
            const SizedBox(width: 10),
            SizedBox(
              width: 62,
              child: Text(
                _T.usd(slice.value),
                textAlign: TextAlign.end,
                style: TextStyle(
                  fontSize: emphasize ? 13 : 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: slice.percent.clamp(0.0, 1.0),
            minHeight: emphasize ? 5 : 3,
            backgroundColor: Colors.white.withValues(alpha: 0.06),
            color: slice.color.withValues(alpha: emphasize ? 1 : 0.85),
          ),
        ),
      ],
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(_T.rSm),
        color: Colors.white.withValues(alpha: 0.04),
        border: Border.all(color: _T.line),
      ),
      child: RichText(
        text: TextSpan(
          style: TextStyle(fontSize: 13, color: _T.text2),
          children: [
            TextSpan(text: '$label  ', style: TextStyle(color: _T.text3, fontSize: 12)),
            TextSpan(text: value, style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white)),
          ],
        ),
      ),
    );
  }
}

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({required this.value});

  final double value;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: LinearProgressIndicator(
        value: value.clamp(0, 1),
        minHeight: 5,
        backgroundColor: Colors.white.withValues(alpha: 0.08),
        color: AppColors.authGreen,
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    return Container(height: 1, color: _T.line.withValues(alpha: 0.6));
  }
}

class _PrimaryBtn extends StatelessWidget {
  const _PrimaryBtn({required this.label, required this.icon, required this.onTap});

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        borderRadius: BorderRadius.circular(99),
        child: Ink(
          height: AppSpacing.buttonHeight,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            color: AppColors.authGreen,
            boxShadow: AppDesk.accentGlow(AppColors.authGreen, alpha: 0.1),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.black)),
              const SizedBox(width: 6),
              Icon(icon, size: 18, color: Colors.black87),
            ],
          ),
        ),
      ),
    );
  }
}

class _DangerBtn extends StatelessWidget {
  const _DangerBtn({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(_T.rSm),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(_T.rSm),
            border: Border.all(color: AppColors.sell.withValues(alpha: 0.3)),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.sell.withValues(alpha: 0.9)),
          ),
        ),
      ),
    );
  }
}

class _IconBtn extends StatelessWidget {
  const _IconBtn({required this.icon, required this.onTap, this.badge = 0});

  final IconData icon;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(99),
        child: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: _T.card,
            border: Border.all(color: _T.line),
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(icon, size: 20, color: Colors.white.withValues(alpha: 0.9)),
              if (badge > 0)
                Positioned(
                  top: 9,
                  right: 9,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.authGreen),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
