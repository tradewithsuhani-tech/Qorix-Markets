import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/bot_terminal_demo.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/live_candle_engine.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/candle.dart';

/// Full-screen-style bot terminal with live animated XAU/USD candlesticks.
class BotTerminalDashboard extends StatefulWidget {
  const BotTerminalDashboard({
    required this.openPositions,
    required this.isTrading,
    this.onNotifications,
    this.unreadCount = 0,
    super.key,
  });

  final int openPositions;
  final bool isTrading;
  final VoidCallback? onNotifications;
  final int unreadCount;

  @override
  State<BotTerminalDashboard> createState() => _BotTerminalDashboardState();
}

class _BotTerminalDashboardState extends State<BotTerminalDashboard>
    with SingleTickerProviderStateMixin {
  late final LiveCandleEngine _engine;
  Ticker? _ticker;
  Duration _elapsed = Duration.zero;
  int _tapeStatusIndex = 0;

  static const _tickEvery = Duration(milliseconds: 700);

  @override
  void initState() {
    super.initState();
    _engine = LiveCandleEngine(basePrice: BotTerminalDemo.livePrice)..seed();
    _ticker = createTicker(_onTick)..start();
  }

  void _onTick(Duration elapsed) {
    if (elapsed - _elapsed >= _tickEvery) {
      _elapsed = elapsed;
      setState(() {
        _engine.tick();
        _tapeStatusIndex = (_tapeStatusIndex + 1) % BotTerminalDemo.tapeStatusLines.length;
      });
    }
  }

  @override
  void dispose() {
    _ticker?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final price = _engine.currentPrice;
    final changePct = _engine.sessionChangePct();
    final priceUp = _engine.priceUp;
    final sessionUp = changePct >= 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TerminalHeader(
          price: price,
          changePct: changePct,
          priceUp: priceUp,
          sessionUp: sessionUp,
          isLive: widget.isTrading,
          openCount: widget.openPositions,
          onNotifications: widget.onNotifications,
          unreadCount: widget.unreadCount,
        ),
        const SizedBox(height: 4),
        Expanded(
          flex: 9,
          child: _LiveChartPanel(
            candles: _engine.candles,
            currentPrice: price,
            priceUp: priceUp,
            isLive: widget.isTrading,
          ),
        ),
        const SizedBox(height: 4),
        _TapeLiveBar(
          line: BotTerminalDemo.tapeStatusLines[_tapeStatusIndex],
          isLive: widget.isTrading,
        ),
        const SizedBox(height: 4),
        _OrdersPnlBar(
          orderCount: widget.openPositions,
          floatingPnl: widget.isTrading ? BotTerminalDemo.totalFloatingPnl : 0,
          isLive: widget.isTrading,
        ),
        const SizedBox(height: 4),
        Expanded(
          flex: 10,
          child: _LiveTapeFeed(
            isLive: widget.isTrading,
            currentPrice: price,
            tapeCount: widget.openPositions,
          ),
        ),
      ],
    );
  }
}

/// Compact terminal header — title, pair, price (no duplicate badges).
class _TerminalHeader extends StatelessWidget {
  const _TerminalHeader({
    required this.price,
    required this.changePct,
    required this.priceUp,
    required this.sessionUp,
    required this.isLive,
    required this.openCount,
    this.onNotifications,
    this.unreadCount = 0,
  });

  final double price;
  final double changePct;
  final bool priceUp;
  final bool sessionUp;
  final bool isLive;
  final int openCount;
  final VoidCallback? onNotifications;
  final int unreadCount;

  @override
  Widget build(BuildContext context) {
    final priceColor = priceUp ? AppColors.authGreen : const Color(0xFFFF6B8A);
    final changeColor = sessionUp ? AppColors.authGreen : const Color(0xFFFF6B8A);

    return Material(
      color: AppDesk.bg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: AppColors.authGreen.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(7),
                  border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
                ),
                child: const Padding(
                  padding: EdgeInsets.all(5),
                  child: Icon(Icons.show_chart_rounded, size: 16, color: AppColors.authGreen),
                ),
              ),
              const SizedBox(width: 12),
              const Text(
                'BOT TERMINAL',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
              const Spacer(),
              if (onNotifications != null)
                _CompactNotifyBtn(unread: unreadCount, onTap: onNotifications!),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'XAU/USD',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                        height: 1,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        _LiveDot(active: isLive),
                        const SizedBox(width: 5),
                        Text(
                          isLive ? 'Live' : 'Paused',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: isLive ? AppColors.authGreen : AppColors.authMuted,
                          ),
                        ),
                        Text(
                          ' · 5s · $openCount open',
                          style: TextStyle(
                            fontSize: 10,
                            color: AppColors.authMuted.withValues(alpha: 0.78),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerRight,
                    child: Text(
                      price.toStringAsFixed(2),
                      style: TextStyle(
                        color: priceColor,
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                        height: 1,
                      ),
                    ),
                  ),
                  Text(
                    '${sessionUp ? '+' : ''}${changePct.toStringAsFixed(2)}%',
                    style: TextStyle(
                      color: changeColor,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LiveDot extends StatelessWidget {
  const _LiveDot({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 7,
      height: 7,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: active ? AppColors.authGreen : AppColors.authMuted,
        boxShadow: active
            ? [BoxShadow(color: AppColors.authGreen.withValues(alpha: 0.45), blurRadius: 6)]
            : null,
      ),
    );
  }
}

class _LiveChartPanel extends StatelessWidget {
  const _LiveChartPanel({
    required this.candles,
    required this.currentPrice,
    required this.priceUp,
    required this.isLive,
  });

  final List<Candle> candles;
  final double currentPrice;
  final bool priceUp;
  final bool isLive;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFF060809),
          border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.85)),
        ),
        child: Stack(
          children: [
            Positioned.fill(
              child: CustomPaint(
                painter: _TerminalCandlePainter(
                  candles: candles,
                  currentPrice: currentPrice,
                  priceUp: priceUp,
                ),
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: Text(
                isLive
                    ? 'Autopilot ${(BotTerminalDemo.aiConfidence * 100).round()}% · spread ${BotTerminalDemo.spreadPips}p'
                    : 'Market closed',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w600,
                  color: AppColors.authMuted.withValues(alpha: 0.75),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CompactNotifyBtn extends StatelessWidget {
  const _CompactNotifyBtn({required this.unread, required this.onTap});

  final int unread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Ink(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.authInputBorder),
            color: Colors.white.withValues(alpha: 0.04),
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(Icons.notifications_none_rounded, size: 18, color: Colors.white.withValues(alpha: 0.9)),
              if (unread > 0)
                Positioned(
                  right: 7,
                  top: 7,
                  child: Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(color: AppColors.authGreen, shape: BoxShape.circle),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TerminalCandlePainter extends CustomPainter {
  _TerminalCandlePainter({
    required this.candles,
    required this.currentPrice,
    required this.priceUp,
  });

  final List<Candle> candles;
  final double currentPrice;
  final bool priceUp;

  static const _bear = Color(0xFFFF6B8A);

  @override
  void paint(Canvas canvas, Size size) {
    if (candles.isEmpty) return;

    const axisWidth = 52.0;
    final chartWidth = size.width - axisWidth;
    final chartRect = Rect.fromLTWH(0, 8, chartWidth, size.height - 16);

    final highs = candles.map((c) => c.high).toList();
    final lows = candles.map((c) => c.low).toList();
    var maxY = highs.reduce(math.max);
    var minY = lows.reduce(math.min);
    final pad = (maxY - minY) * 0.12;
    maxY += pad;
    minY -= pad;
    final range = maxY - minY;

    double yOf(double price) => chartRect.bottom - ((price - minY) / range) * chartRect.height;

    final gridPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.06)
      ..strokeWidth = 0.5;
    for (var i = 0; i <= 4; i++) {
      final y = chartRect.top + chartRect.height * i / 4;
      canvas.drawLine(Offset(chartRect.left, y), Offset(chartRect.right, y), gridPaint);
    }

    final gap = chartRect.width / candles.length;
    final bodyW = gap * 0.62;

    for (var i = 0; i < candles.length; i++) {
      final c = candles[i];
      final x = chartRect.left + gap * i + gap / 2;
      final bullish = c.close >= c.open;
      final color = bullish ? AppColors.authGreen : _bear;

      canvas.drawLine(
        Offset(x, yOf(c.high)),
        Offset(x, yOf(c.low)),
        Paint()
          ..color = color
          ..strokeWidth = 1.1,
      );

      final bodyTop = yOf(bullish ? c.close : c.open);
      final bodyBottom = yOf(bullish ? c.open : c.close);
      final h = (bodyBottom - bodyTop).abs().clamp(2.0, chartRect.height);

      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset(x, (bodyTop + bodyBottom) / 2), width: bodyW, height: h),
          const Radius.circular(1),
        ),
        Paint()..color = color,
      );
    }

    final liveColor = priceUp ? AppColors.authGreen : _bear;
    final priceY = yOf(currentPrice);
    final dashPaint = Paint()
      ..color = liveColor.withValues(alpha: 0.75)
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;
    _drawDashedLine(canvas, Offset(chartRect.left, priceY), Offset(chartRect.right, priceY), dashPaint);

    final labelPaint = TextPainter(textDirection: TextDirection.ltr);
    for (var i = 0; i <= 4; i++) {
      final price = maxY - range * i / 4;
      labelPaint.text = TextSpan(
        text: price.toStringAsFixed(2),
        style: TextStyle(color: AppColors.authMuted.withValues(alpha: 0.65), fontSize: 9),
      );
      labelPaint.layout();
      labelPaint.paint(
        canvas,
        Offset(chartRect.right + 6, chartRect.top + chartRect.height * i / 4 - labelPaint.height / 2),
      );
    }

    final badgeH = 18.0;
    final badgeRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(chartRect.right + 4, priceY - badgeH / 2, axisWidth - 6, badgeH),
      const Radius.circular(3),
    );
    canvas.drawRRect(badgeRect, Paint()..color = liveColor);
    labelPaint.text = TextSpan(
      text: currentPrice.toStringAsFixed(2),
      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700),
    );
    labelPaint.layout();
    labelPaint.paint(
      canvas,
      Offset(
        badgeRect.left + (badgeRect.width - labelPaint.width) / 2,
        badgeRect.top + (badgeRect.height - labelPaint.height) / 2,
      ),
    );
  }

  void _drawDashedLine(Canvas canvas, Offset start, Offset end, Paint paint) {
    const dash = 5.0;
    const gap = 4.0;
    final dx = end.dx - start.dx;
    final dy = end.dy - start.dy;
    final len = math.sqrt(dx * dx + dy * dy);
    final ux = dx / len;
    final uy = dy / len;
    var dist = 0.0;
    while (dist < len) {
      final s = dist;
      final e = math.min(dist + dash, len);
      canvas.drawLine(
        Offset(start.dx + ux * s, start.dy + uy * s),
        Offset(start.dx + ux * e, start.dy + uy * e),
        paint,
      );
      dist += dash + gap;
    }
  }

  @override
  bool shouldRepaint(covariant _TerminalCandlePainter old) =>
      old.candles != candles || old.currentPrice != currentPrice || old.priceUp != priceUp;
}

class _TapeLiveBar extends StatelessWidget {
  const _TapeLiveBar({required this.line, required this.isLive});

  final String line;
  final bool isLive;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFF0A0E10),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.7)),
      ),
      child: Row(
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: isLive ? AppColors.authGreen : AppColors.authMuted,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            isLive ? 'TAPE LIVE' : 'TAPE PAUSED',
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
              color: isLive ? AppColors.authGreen : AppColors.authMuted,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              line,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10,
                fontFamily: 'monospace',
                color: Colors.white.withValues(alpha: 0.82),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OrdersPnlBar extends StatelessWidget {
  const _OrdersPnlBar({
    required this.orderCount,
    required this.floatingPnl,
    required this.isLive,
  });

  final int orderCount;
  final double floatingPnl;
  final bool isLive;

  @override
  Widget build(BuildContext context) {
    final pnlUp = floatingPnl >= 0;
    final pnlColor = pnlUp ? AppColors.authGreen : AppColors.sell;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authInputBorder),
      ),
      child: Row(
        children: [
          Icon(Icons.bolt_rounded, size: 16, color: AppColors.authGreen.withValues(alpha: 0.9)),
          const SizedBox(width: 6),
          Text(
            isLive && orderCount > 0 ? '$orderCount ORDERS' : 'TRADE FEED',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
          const Spacer(),
          if (isLive && orderCount > 0)
            Text(
              'live P/L ${pnlUp ? '+' : ''}\$${floatingPnl.toStringAsFixed(2)}',
              style: TextStyle(
                color: pnlColor,
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            )
          else
            Text(
              'No open orders',
              style: TextStyle(
                fontSize: 11,
                color: AppColors.authMuted.withValues(alpha: 0.75),
              ),
            ),
        ],
      ),
    );
  }
}

class _LiveTapeFeed extends StatefulWidget {
  const _LiveTapeFeed({
    required this.isLive,
    required this.currentPrice,
    required this.tapeCount,
  });

  final bool isLive;
  final double currentPrice;
  final int tapeCount;

  @override
  State<_LiveTapeFeed> createState() => _LiveTapeFeedState();
}

class _LiveTapeFeedState extends State<_LiveTapeFeed> with SingleTickerProviderStateMixin {
  static const _rowHeight = BotTerminalDemo.tapeRowHeight;
  static const _tapeAccent = Color(0xFF5EB8FF);
  static const _rowsPer10Sec = BotTerminalDemo.tapeRowsPer10Seconds;
  static const _scrollPxPerMs = _rowHeight * _rowsPer10Sec / 10000;

  late final List<BotTerminalTapeEntry> _entries;
  late final Ticker _scrollTicker;
  Duration _lastTick = Duration.zero;
  double _scrollOffset = 0;
  final _rng = math.Random();

  @override
  void initState() {
    super.initState();
    _entries = List<BotTerminalTapeEntry>.from(BotTerminalDemo.tapeSeed);
    _scrollTicker = createTicker(_onScrollTick)..start();
  }

  @override
  void dispose() {
    _scrollTicker.dispose();
    super.dispose();
  }

  void _onScrollTick(Duration elapsed) {
    if (!widget.isLive) {
      _lastTick = elapsed;
      return;
    }

    final delta = elapsed - _lastTick;
    _lastTick = elapsed;
    if (delta <= Duration.zero) return;

    _scrollOffset += delta.inMilliseconds * _scrollPxPerMs;

    while (_scrollOffset >= _rowHeight) {
      _scrollOffset -= _rowHeight;
      _entries.removeLast();
      _entries.insert(0, _randomEntry());
    }

    if (mounted) setState(() {});
  }

  BotTerminalTapeEntry _randomEntry() {
    final now = DateTime.now();
    final isBuy = _rng.nextBool();
    final qty = 0.01 + _rng.nextDouble() * 0.05;
    final price = widget.currentPrice + (_rng.nextDouble() - 0.5) * 1.2;
    final h = now.hour.toString().padLeft(2, '0');
    final m = now.minute.toString().padLeft(2, '0');
    final s = now.second.toString().padLeft(2, '0');
    return BotTerminalTapeEntry(
      time: '$h:$m:$s',
      side: isBuy ? 'BUY' : 'SELL',
      qty: qty,
      price: price,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            _LiveDot(active: widget.isLive),
            const SizedBox(width: 6),
            Text(
              widget.isLive ? 'LIVE TAPE' : 'TAPE PAUSED',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
                color: widget.isLive ? AppColors.authGreen : AppColors.authMuted,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'XAU/USD',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.authMuted.withValues(alpha: 0.85),
              ),
            ),
            const Spacer(),
            Text(
              '${widget.tapeCount > 0 ? widget.tapeCount : _entries.length}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: _tapeAccent,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final viewportRows = math.max(1, (constraints.maxHeight / _rowHeight).floor());

              return ClipRect(
                child: SizedBox(
                  height: constraints.maxHeight,
                  width: constraints.maxWidth,
                  child: Transform.translate(
                    offset: Offset(0, _scrollOffset),
                    child: ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      padding: EdgeInsets.zero,
                      itemExtent: _rowHeight,
                      itemCount: viewportRows + 1,
                      itemBuilder: (context, index) {
                        final entry = _entries[index % _entries.length];
                        return _TapeRow(entry: entry);
                      },
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _TapeRow extends StatelessWidget {
  const _TapeRow({required this.entry});

  final BotTerminalTapeEntry entry;

  static const _buy = AppColors.authGreen;
  static const _sell = Color(0xFFFF6B8A);

  @override
  Widget build(BuildContext context) {
    final sideColor = entry.isBuy ? _buy : _sell;
    final muted = AppColors.authMuted.withValues(alpha: 0.82);

    return SizedBox(
      height: _LiveTapeFeedState._rowHeight,
      child: Row(
        children: [
          SizedBox(
            width: 58,
            child: Text(
              entry.time,
              style: TextStyle(
                fontSize: 11,
                fontFeatures: const [FontFeature.tabularFigures()],
                color: muted,
              ),
            ),
          ),
          SizedBox(
            width: 38,
            child: Text(
              entry.side,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.3,
                color: sideColor,
              ),
            ),
          ),
          Expanded(
            child: Text(
              entry.qty.toStringAsFixed(3),
              style: TextStyle(
                fontSize: 11,
                fontFeatures: const [FontFeature.tabularFigures()],
                color: muted,
              ),
            ),
          ),
          Text(
            entry.price.toStringAsFixed(2),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
              color: sideColor,
            ),
          ),
        ],
      ),
    );
  }
}
