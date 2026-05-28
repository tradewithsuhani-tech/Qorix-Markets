import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/bot_setup_demo.dart';
import 'package:qorix_markets_flutter/widgets/desk_widgets.dart';

abstract final class _B {
  static const bg = Color(0xFF0A0E12);
  static const card = Color(0xFF12171C);
  static const border = Color(0xFF1E2630);

  static Color get muted => AppColors.authMuted.withValues(alpha: 0.72);
  static Color get faint => AppColors.authMuted.withValues(alpha: 0.48);

  static const green = AppColors.authGreen;

  static final _inr = NumberFormat('#,##0', 'en_IN');
  static String inr(num v) => '₹${_inr.format(v)}';
}

class YourBotsHeader extends StatelessWidget {
  const YourBotsHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const DeskIconBox(icon: Icons.memory_rounded),
        const SizedBox(width: AppSpacing.md),
        const Expanded(
          child: DeskPageTitle(
            title: 'Your bots',
            subtitle: 'Currently active bot is shown below',
          ),
        ),
      ],
    );
  }
}

class ActiveBotHeroCard extends StatelessWidget {
  const ActiveBotHeroCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: AppDesk.card(accent: _B.green),
      padding: AppDesk.densePadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'STRAT · ${ActiveBotDemo.stratId} · INCEPTION ${ActiveBotDemo.inception}',
                  style: AppDesk.overline,
                ),
              ),
              _LiveBadge(),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Container(
                width: AppDesk.iconBoxSize,
                height: AppDesk.iconBoxSize,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  color: _B.green.withValues(alpha: 0.1),
                  border: Border.all(color: _B.green.withValues(alpha: 0.22)),
                ),
                child: Icon(Icons.memory_rounded, size: AppDesk.iconMd, color: _B.green),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(ActiveBotDemo.name, style: AppDesk.sectionTitle.copyWith(fontSize: 16)),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Net Asset Value (NAV)', style: AppDesk.metricLabel),
                    const SizedBox(height: AppSpacing.xs),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                      child: Text(_B.inr(ActiveBotDemo.navInr), style: AppDesk.metricHero),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Icon(Icons.north_east_rounded, size: AppDesk.iconSm, color: _B.green),
                        const SizedBox(width: AppSpacing.xs),
                        Flexible(
                          child: Text(
                            '+${_B.inr(ActiveBotDemo.pnlInr)} · +${ActiveBotDemo.pnlPct.toStringAsFixed(2)}% (+${ActiveBotDemo.bps} bps)',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _B.green),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('30D EQUITY', style: AppDesk.overline),
                  const SizedBox(height: AppSpacing.xs),
                  SizedBox(
                    width: 88,
                    height: 44,
                    child: CustomPaint(
                      painter: _SparklinePainter(points: BotSetupDemo.activeBotEquity30d, color: _B.green),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(child: _MetricCell(label: 'SHARPE', value: ActiveBotDemo.sharpe.toStringAsFixed(2))),
              Expanded(child: _MetricCell(label: 'WIN RATE', value: '${ActiveBotDemo.winRate}%', highlight: true)),
              Expanded(child: _MetricCell(label: 'MAX DD', value: '${ActiveBotDemo.maxDd}%')),
              Expanded(child: _MetricCell(label: 'TRADES TODAY', value: '${ActiveBotDemo.tradesToday}')),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Text.rich(
            TextSpan(
              style: AppDesk.sectionCaption.copyWith(fontSize: 10),
              children: [
                const TextSpan(text: '% OF PORTFOLIO IN THIS BOT '),
                TextSpan(text: '${ActiveBotDemo.portfolioPct}%', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                TextSpan(text: ' (${_B.inr(ActiveBotDemo.botCapitalInr)} of ${_B.inr(ActiveBotDemo.totalPortfolioInr)})'),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: ActiveBotDemo.portfolioPct / 100,
              minHeight: 4,
              backgroundColor: Colors.white.withValues(alpha: 0.06),
              color: _B.green,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Icon(Icons.monitor_heart_outlined, size: AppDesk.iconSm, color: _B.faint),
              const SizedBox(width: AppSpacing.xs),
              Text.rich(
                TextSpan(
                  style: AppDesk.sectionCaption.copyWith(fontSize: 10),
                  children: [
                    const TextSpan(text: 'Last trade '),
                    TextSpan(text: '${ActiveBotDemo.lastTradeSec}s ago', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              const Spacer(),
              Icon(Icons.shield_outlined, size: AppDesk.iconSm, color: _B.faint),
              const SizedBox(width: AppSpacing.xs),
              Text.rich(
                TextSpan(
                  style: AppDesk.sectionCaption.copyWith(fontSize: 10),
                  children: [
                    const TextSpan(text: 'Risk '),
                    TextSpan(text: ActiveBotDemo.risk, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              Icon(Icons.north_east_rounded, size: AppDesk.iconSm, color: _B.faint),
            ],
          ),
        ],
      ),
    );
  }
}

class _LiveBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: AppDesk.liveBadge(),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 5, height: 5, decoration: const BoxDecoration(color: _B.green, shape: BoxShape.circle)),
          const SizedBox(width: AppSpacing.xs),
          const Text('LIVE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: _B.green, letterSpacing: 0.5)),
        ],
      ),
    );
  }
}

class _MetricCell extends StatelessWidget {
  const _MetricCell({required this.label, required this.value, this.highlight = false});

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppDesk.overline),
        const SizedBox(height: 3),
        Text(
          value,
          style: AppDesk.metricValue.copyWith(fontSize: 13, color: highlight ? _B.green : Colors.white),
        ),
      ],
    );
  }
}

class YourBotsExploreLabel extends StatelessWidget {
  const YourBotsExploreLabel({super.key});

  @override
  Widget build(BuildContext context) {
    return const DeskSectionLabel('Explore other strategies');
  }
}

class ExploreBotCard extends StatelessWidget {
  const ExploreBotCard({required this.bot, required this.onSetup, super.key});

  final BotExploreItem bot;
  final VoidCallback onSetup;

  @override
  Widget build(BuildContext context) {
    final accent = bot.accent;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [
            accent.withValues(alpha: 0.14),
            _B.card,
            _B.card,
          ],
          stops: const [0.0, 0.42, 1.0],
        ),
        border: Border.all(color: accent.withValues(alpha: 0.22)),
      ),
      child: Padding(
        padding: AppDesk.densePadding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: AppDesk.iconBoxSize,
                  height: AppDesk.iconBoxSize,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    color: accent.withValues(alpha: 0.14),
                    border: Border.all(color: accent.withValues(alpha: 0.35)),
                  ),
                  child: Icon(Icons.memory_rounded, size: AppDesk.iconMd, color: accent),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(child: Text(bot.name, style: AppDesk.sectionTitle)),
                          if (bot.isLive) ...[const SizedBox(width: AppSpacing.sm), _LiveBadge()],
                        ],
                      ),
                      Text(bot.subtitle, style: AppDesk.sectionCaption),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('+${bot.returnPct}%', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: accent)),
                    const SizedBox(height: AppSpacing.xs),
                    SizedBox(
                      width: 56,
                      height: 28,
                      child: CustomPaint(
                        painter: _SparklinePainter(
                          points: List.generate(8, (i) => 10.0 + i * 1.2 + (i % 2) * 0.8),
                          color: accent,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Divider(height: 1, color: AppDesk.border),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Icon(Icons.shield_outlined, size: AppDesk.iconSm, color: AppDesk.textTertiary),
                const SizedBox(width: AppSpacing.sm),
                Text('Capital managed', style: AppDesk.sectionCaption),
                const Spacer(),
                Text(bot.aum, style: AppDesk.metricValue.copyWith(fontSize: 16)),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                _ExploreStat(label: 'Investors', value: bot.investors),
                _ExploreStat(label: 'Win rate', value: '${bot.winRate}%', color: accent),
                _ExploreStat(label: 'Avg / mo', value: '+${bot.avgMo}%', color: accent),
                const Spacer(),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () {
                      HapticFeedback.mediumImpact();
                      onSetup();
                    },
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    child: Ink(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        color: accent,
                        boxShadow: [BoxShadow(color: accent.withValues(alpha: 0.28), blurRadius: 10, offset: const Offset(0, 4))],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('Setup', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white)),
                          Icon(Icons.arrow_forward_rounded, size: AppDesk.iconSm, color: Colors.white),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ExploreStat extends StatelessWidget {
  const _ExploreStat({required this.label, required this.value, this.color});

  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppDesk.overline),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: color ?? Colors.white)),
        ],
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  _SparklinePainter({required this.points, required this.color});

  final List<double> points;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final minY = points.reduce(math.min);
    final maxY = points.reduce(math.max);
    final range = (maxY - minY).clamp(0.001, double.infinity);

    final path = Path();
    for (var i = 0; i < points.length; i++) {
      final x = size.width * i / (points.length - 1);
      final y = size.height - ((points[i] - minY) / range) * size.height;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) => oldDelegate.points != points || oldDelegate.color != color;
}
