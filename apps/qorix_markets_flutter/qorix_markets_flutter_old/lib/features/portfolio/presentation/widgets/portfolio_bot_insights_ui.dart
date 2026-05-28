import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/data/portfolio_bot_insights_demo.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/widgets/momentum_bot_live_console.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/data/portfolio_demo.dart';

abstract final class _I {
  static const bg = AppDesk.bg;
  static const card = AppDesk.surface;
  static const border = AppDesk.border;

  static Color get muted => AppColors.authMuted.withValues(alpha: 0.72);
  static Color get faint => AppColors.authMuted.withValues(alpha: 0.48);

  static const green = AppColors.authGreen;
  static const gold = AppColors.authGold;

  static final _inr = NumberFormat('#,##0', 'en_IN');
  static String inr(num v) => '₹${_inr.format(v)}';
}

class PortfolioBotInsightsSection extends StatelessWidget {
  const PortfolioBotInsightsSection({
    required this.data,
    required this.onSetup,
    required this.onSeeAll,
    super.key,
  });

  final PortfolioViewData data;
  final VoidCallback onSetup;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (data.isActive) ...[
          const PortfolioTierStatusCard(),
          const SizedBox(height: 12),
          const PortfolioBotIntelligenceCard(),
          const SizedBox(height: 12),
          PortfolioActiveBotMetricsCard(data: data),
          const SizedBox(height: 22),
        ],
        PortfolioBestBotResultsSection(onSetup: onSetup, onSeeAll: onSeeAll),
      ],
    );
  }
}

class PortfolioTierStatusCard extends StatelessWidget {
  const PortfolioTierStatusCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: _I.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _I.gold.withValues(alpha: 0.28)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Icon(Icons.workspace_premium_rounded, size: 18, color: _I.gold.withValues(alpha: 0.95)),
              const SizedBox(width: 8),
              Text(
                PortfolioBotInsightsDemo.tierName,
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: _I.gold.withValues(alpha: 0.95)),
              ),
              const Spacer(),
              Text(
                '${_I.inr(PortfolioBotInsightsDemo.toNextTierInr)} to ${PortfolioBotInsightsDemo.nextTier}',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _I.muted),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: PortfolioBotInsightsDemo.tierProgress,
              minHeight: 4,
              backgroundColor: Colors.white.withValues(alpha: 0.06),
              color: _I.gold,
            ),
          ),
        ],
      ),
    );
  }
}

class PortfolioBotIntelligenceCard extends StatelessWidget {
  const PortfolioBotIntelligenceCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _I.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _I.green.withValues(alpha: 0.32)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _I.green.withValues(alpha: 0.12),
              border: Border.all(color: _I.green.withValues(alpha: 0.35)),
            ),
            child: Icon(Icons.info_outline_rounded, size: 15, color: _I.green.withValues(alpha: 0.95)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'BOT INTELLIGENCE',
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: _I.green.withValues(alpha: 0.88)),
                ),
                const SizedBox(height: 4),
                Text(
                  PortfolioBotInsightsDemo.intelligenceMessage,
                  style: TextStyle(fontSize: 12, height: 1.35, color: Colors.white.withValues(alpha: 0.92)),
                ),
              ],
            ),
          ),
          Container(
            width: 8,
            height: 8,
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _I.green,
              boxShadow: [BoxShadow(color: _I.green.withValues(alpha: 0.55), blurRadius: 6)],
            ),
          ),
        ],
      ),
    );
  }
}

class PortfolioActiveBotMetricsCard extends StatelessWidget {
  const PortfolioActiveBotMetricsCard({required this.data, this.onManage, super.key});

  final PortfolioViewData data;
  final VoidCallback? onManage;

  @override
  Widget build(BuildContext context) {
    return MomentumBotLiveConsole(
      data: data,
      onTap: onManage,
    );
  }
}

class PortfolioBestBotResultsSection extends StatelessWidget {
  const PortfolioBestBotResultsSection({
    required this.onSetup,
    required this.onSeeAll,
    super.key,
  });

  final VoidCallback onSetup;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Best bot result', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text('last month', style: TextStyle(fontSize: 11, color: _I.muted)),
                ],
              ),
            ),
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onSeeAll,
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  child: Text('See all →', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _I.green.withValues(alpha: 0.95))),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 196,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: AppScroll.page,
            itemCount: PortfolioBotInsightsDemo.bestBots.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, i) {
              return _BestBotCard(bot: PortfolioBotInsightsDemo.bestBots[i], onSetup: onSetup);
            },
          ),
        ),
      ],
    );
  }
}

class _BestBotCard extends StatelessWidget {
  const _BestBotCard({required this.bot, required this.onSetup});

  final PortfolioBestBotResult bot;
  final VoidCallback onSetup;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 168,
      decoration: BoxDecoration(
        color: _I.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: bot.accent.withValues(alpha: 0.28)),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_I.card, bot.accent.withValues(alpha: 0.08)],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: bot.accent.withValues(alpha: 0.14),
                    border: Border.all(color: bot.accent.withValues(alpha: 0.3)),
                  ),
                  child: Icon(Icons.memory_rounded, size: 14, color: bot.accent),
                ),
                const Spacer(),
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _I.green,
                    boxShadow: [BoxShadow(color: _I.green.withValues(alpha: 0.45), blurRadius: 4)],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              bot.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800, height: 1.2),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: CustomPaint(
                painter: _BotSparklinePainter(points: bot.sparkline, color: bot.accent),
                child: const SizedBox.expand(),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Returns', style: TextStyle(fontSize: 9, color: _I.faint)),
                      Text(
                        '+${bot.returnPct}%',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: bot.accent, height: 1.05),
                      ),
                    ],
                  ),
                ),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onSetup();
                    },
                    borderRadius: BorderRadius.circular(8),
                    child: Ink(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: bot.accent.withValues(alpha: 0.45)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.add_rounded, size: 12, color: bot.accent),
                          const SizedBox(width: 2),
                          Text('Set up', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: bot.accent)),
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

class _BotSparklinePainter extends CustomPainter {
  _BotSparklinePainter({required this.points, required this.color});

  final List<double> points;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;

    final minY = points.reduce(math.min);
    final maxY = points.reduce(math.max);
    final range = (maxY - minY).clamp(0.01, double.infinity);
    final stepX = size.width / (points.length - 1);

    final path = Path();
    for (var i = 0; i < points.length; i++) {
      final x = i * stepX;
      final y = size.height - ((points[i] - minY) / range) * (size.height - 4) - 2;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    final fill = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();

    canvas.drawPath(fill, Paint()..color = color.withValues(alpha: 0.12));
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant _BotSparklinePainter oldDelegate) =>
      oldDelegate.points != points || oldDelegate.color != color;
}
