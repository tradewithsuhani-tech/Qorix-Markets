import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/data/momentum_bot_live_demo.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/data/portfolio_bot_insights_demo.dart';
import 'package:qorix_markets_flutter/features/portfolio/presentation/data/portfolio_demo.dart';

enum MomentumBotLiveMode { portfolioCard, managePlanHero }

/// Animated live desk console — status feed, trade tape, AI metrics.
class MomentumBotLiveConsole extends StatefulWidget {
  const MomentumBotLiveConsole({
    required this.data,
    this.mode = MomentumBotLiveMode.portfolioCard,
    this.onTap,
    super.key,
  });

  final PortfolioViewData data;
  final MomentumBotLiveMode mode;
  final VoidCallback? onTap;

  @override
  State<MomentumBotLiveConsole> createState() => _MomentumBotLiveConsoleState();
}

class _MomentumBotLiveConsoleState extends State<MomentumBotLiveConsole> with TickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  Ticker? _ticker;
  Duration _elapsed = Duration.zero;

  final _rng = math.Random(11);
  final _tape = <MomentumTapeEntry>[];

  int _statusIndex = 0;
  int _tapeTemplateIndex = 0;
  int _tickCount = 0;
  final Map<int, double> _metricPulse = {};

  static const _tickEvery = Duration(milliseconds: 650);

  bool get _isLive => widget.data.isActive && !widget.data.isPaused;
  bool get _showMetrics => widget.mode == MomentumBotLiveMode.portfolioCard;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat(reverse: true);
    _seedTape();
    for (var i = 0; i < PortfolioBotInsightsDemo.metrics.length; i++) {
      _metricPulse[i] = PortfolioBotInsightsDemo.metrics[i].pct.toDouble();
    }
    if (_isLive) {
      _ticker = createTicker(_onTick)..start();
    }
  }

  void _seedTape() {
    final now = DateTime.now();
    final count = _showMetrics ? 4 : 5;
    for (var i = 0; i < count; i++) {
      final t = MomentumBotLiveDemo.tapeTemplates[i % MomentumBotLiveDemo.tapeTemplates.length];
      _tape.add(
        MomentumTapeEntry(
          time: _formatTime(now.subtract(Duration(seconds: i * 3))),
          tag: t.tag,
          text: t.text,
          pnl: t.pnl,
        ),
      );
    }
    _tapeTemplateIndex = count;
  }

  @override
  void didUpdateWidget(covariant MomentumBotLiveConsole oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_isLive && _ticker == null) {
      _ticker = createTicker(_onTick)..start();
    } else if (!_isLive) {
      _ticker?.dispose();
      _ticker = null;
    }
  }

  void _onTick(Duration elapsed) {
    if (!_isLive || elapsed - _elapsed < _tickEvery) return;
    _elapsed = elapsed;
    _tickCount++;

    setState(() {
      if (_tickCount % 2 == 0) {
        _statusIndex = (_statusIndex + 1) % MomentumBotLiveDemo.statusLines.length;
      }
      _pushTapeLine();
      for (var i = 0; i < PortfolioBotInsightsDemo.metrics.length; i++) {
        final base = PortfolioBotInsightsDemo.metrics[i].pct.toDouble();
        _metricPulse[i] = (base + (_rng.nextDouble() - 0.5) * 2).clamp(base - 2, 99);
      }
    });
  }

  void _pushTapeLine() {
    final template = MomentumBotLiveDemo.tapeTemplates[_tapeTemplateIndex % MomentumBotLiveDemo.tapeTemplates.length];
    _tapeTemplateIndex++;

    final pnl = template.pnl ?? (_rng.nextDouble() > 0.55 ? '+\$${(_rng.nextDouble() * 3.2 + 0.4).toStringAsFixed(2)}' : null);

    _tape.insert(
      0,
      MomentumTapeEntry(
        time: _formatTime(DateTime.now()),
        tag: template.tag,
        text: template.text,
        pnl: pnl,
      ),
    );
    if (_tape.length > (_showMetrics ? 4 : 5)) _tape.removeLast();
  }

  String _formatTime(DateTime dt) =>
      '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}:${dt.second.toString().padLeft(2, '0')}';

  @override
  void dispose() {
    _ticker?.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final subtitle = widget.data.preset != null
        ? 'Neural · ${widget.data.preset!.personality.toLowerCase()} risk profile'
        : PortfolioBotInsightsDemo.activeBotSubtitle;

    final card = AnimatedBuilder(
      animation: _pulseCtrl,
      builder: (context, child) {
        final glow = _isLive ? 0.22 + _pulseCtrl.value * 0.18 : 0.12;
        return Container(
          decoration: BoxDecoration(
            color: AppDesk.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF60A5FA).withValues(alpha: 0.28 + _pulseCtrl.value * 0.12)),
            boxShadow: [
              BoxShadow(
                color: AppColors.authGreen.withValues(alpha: glow * 0.35),
                blurRadius: 20,
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: child,
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _PulsingChipIcon(animation: _pulseCtrl, isLive: _isLive),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        MomentumBotLiveDemo.botName,
                        style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 2),
                      Text(subtitle, style: TextStyle(fontSize: 11, color: AppColors.authMuted.withValues(alpha: 0.72))),
                    ],
                  ),
                ),
                if (_isLive) _LiveBadge(animation: _pulseCtrl) else _PausedBadge(),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: _StatusStrip(line: MomentumBotLiveDemo.statusLines[_statusIndex]),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
            child: Column(
              children: [
                for (var i = 0; i < _tape.length; i++)
                  _TapeRow(entry: _tape[i], highlight: i == 0),
              ],
            ),
          ),
          if (_showMetrics)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                children: [
                  for (var i = 0; i < PortfolioBotInsightsDemo.metrics.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _AnimatedMetricRow(
                        label: PortfolioBotInsightsDemo.metrics[i].label,
                        pct: _metricPulse[i] ?? PortfolioBotInsightsDemo.metrics[i].pct.toDouble(),
                      ),
                    ),
                ],
              ),
            ),
          if (_showMetrics && widget.onTap != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: GestureDetector(
                onTap: widget.onTap,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.authGreen.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.22)),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.play_circle_outline_rounded, size: 16, color: AppColors.authGreen),
                      SizedBox(width: 8),
                      Text(
                        'Open live desk · Manage plan',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.authGreen),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );

    if (widget.onTap == null || !_showMetrics) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(onTap: widget.onTap, borderRadius: BorderRadius.circular(16), child: card),
    );
  }
}

class _PulsingChipIcon extends StatelessWidget {
  const _PulsingChipIcon({required this.animation, required this.isLive});

  final Animation<double> animation;
  final bool isLive;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        return Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(11),
            color: const Color(0xFF60A5FA).withValues(alpha: isLive ? 0.14 + animation.value * 0.06 : 0.1),
            border: Border.all(color: const Color(0xFF60A5FA).withValues(alpha: 0.32 + animation.value * 0.15)),
            boxShadow: isLive
                ? [BoxShadow(color: const Color(0xFF60A5FA).withValues(alpha: 0.2 * animation.value), blurRadius: 12)]
                : null,
          ),
          child: const Icon(Icons.memory_rounded, size: 20, color: Color(0xFF60A5FA)),
        );
      },
    );
  }
}

class _LiveBadge extends StatelessWidget {
  const _LiveBadge({required this.animation});

  final Animation<double> animation;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.authGreen.withValues(alpha: 0.1 + animation.value * 0.06),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35 + animation.value * 0.2)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 5,
                height: 5,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.authGreen,
                  boxShadow: [BoxShadow(color: AppColors.authGreen.withValues(alpha: 0.4 + animation.value * 0.4), blurRadius: 6)],
                ),
              ),
              const SizedBox(width: 5),
              const Text('LIVE', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: AppColors.authGreen)),
            ],
          ),
        );
      },
    );
  }
}

class _PausedBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: Text('PAUSED', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: AppColors.authMuted.withValues(alpha: 0.7))),
    );
  }
}

class _StatusStrip extends StatelessWidget {
  const _StatusStrip({required this.line});

  final String line;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 280),
      child: Container(
        key: ValueKey(line),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: Row(
          children: [
            const Icon(Icons.bolt_rounded, size: 14, color: Color(0xFF8B5CF6)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(line, style: TextStyle(fontSize: 11, color: AppColors.authMuted.withValues(alpha: 0.78), fontWeight: FontWeight.w500)),
            ),
          ],
        ),
      ),
    );
  }
}

class _TapeRow extends StatelessWidget {
  const _TapeRow({required this.entry, required this.highlight});

  final MomentumTapeEntry entry;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final tagColor = switch (entry.tag) {
      'TP' => AppColors.authGreen,
      'BUY' => const Color(0xFF60A5FA),
      'EDGE' => const Color(0xFFF59E0B),
      _ => AppColors.authMuted.withValues(alpha: 0.7),
    };

    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: highlight ? Colors.white.withValues(alpha: 0.05) : Colors.transparent,
        borderRadius: BorderRadius.circular(6),
        border: highlight ? Border.all(color: AppColors.authGreen.withValues(alpha: 0.18)) : null,
      ),
      child: Row(
        children: [
          Text(entry.time, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: AppColors.authMuted.withValues(alpha: 0.5))),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            decoration: BoxDecoration(
              color: tagColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(entry.tag, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: tagColor)),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              entry.text,
              style: TextStyle(fontSize: 10, color: highlight ? Colors.white : AppColors.authMuted.withValues(alpha: 0.78)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (entry.pnl != null)
            Text(
              entry.pnl!,
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.authGreen),
            ),
        ],
      ),
    );
  }
}

class _AnimatedMetricRow extends StatelessWidget {
  const _AnimatedMetricRow({required this.label, required this.pct});

  final String label;
  final double pct;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(width: 118, child: Text(label, style: TextStyle(fontSize: 11, color: AppColors.authMuted.withValues(alpha: 0.72)))),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (pct / 100).clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: Colors.white.withValues(alpha: 0.06),
              color: const Color(0xFF60A5FA),
            ),
          ),
        ),
        const SizedBox(width: 10),
        SizedBox(
          width: 34,
          child: Text(
            '${pct.round()}%',
            textAlign: TextAlign.right,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white),
          ),
        ),
      ],
    );
  }
}
