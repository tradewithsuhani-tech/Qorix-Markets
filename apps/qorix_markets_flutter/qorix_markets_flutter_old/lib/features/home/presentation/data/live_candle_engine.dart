import 'dart:math' as math;

import 'package:qorix_markets_flutter/features/market/domain/entities/candle.dart';

/// Generates and animates XAUUSD candles for the bot terminal demo.
class LiveCandleEngine {
  LiveCandleEngine({this.basePrice = 4523.20, this.maxCandles = 48});

  final double basePrice;
  final int maxCandles;
  final _rng = math.Random(7);

  late List<Candle> candles;
  late double currentPrice;
  late bool priceUp;
  int _tickCount = 0;

  void seed() {
    candles = _buildSeed();
    currentPrice = candles.last.close;
    priceUp = candles.last.close >= candles.last.open;
  }

  List<Candle> _buildSeed() {
    var price = basePrice - 3.5;
    final now = DateTime.now();
    final list = <Candle>[];

    for (var i = 0; i < maxCandles; i++) {
      final open = price;
      final bias = _rng.nextDouble() > 0.46 ? 1 : -1;
      final move = bias * (_rng.nextDouble() * 0.85 + 0.15);
      final close = open + move;
      final high = math.max(open, close) + _rng.nextDouble() * 0.55;
      final low = math.min(open, close) - _rng.nextDouble() * 0.55;
      list.add(
        Candle(
          open: _round(open),
          high: _round(high),
          low: _round(low),
          close: _round(close),
          timestamp: now.subtract(Duration(seconds: (maxCandles - i) * 5)),
        ),
      );
      price = close;
    }
    return list;
  }

  /// Advance one tick — wiggle live candle, roll new bar periodically.
  void tick() {
    _tickCount++;
    final last = candles.last;
    final prevClose = last.close;
    final delta = (_rng.nextDouble() - 0.47) * 0.35;
    var close = _round(last.close + delta);
    var high = _round(math.max(last.high, close + _rng.nextDouble() * 0.12));
    var low = _round(math.min(last.low, close - _rng.nextDouble() * 0.12));

    candles[candles.length - 1] = Candle(
      open: last.open,
      high: high,
      low: low,
      close: close,
      timestamp: last.timestamp,
    );
    currentPrice = close;
    priceUp = close >= prevClose;

    if (_tickCount % 5 == 0) {
      _appendCandle();
    }
  }

  void _appendCandle() {
    final prev = candles.last;
    final open = prev.close;
    final bias = _rng.nextDouble() > 0.5 ? 1 : -1;
    final close = _round(open + bias * (_rng.nextDouble() * 0.9 + 0.2));
    final high = _round(math.max(open, close) + _rng.nextDouble() * 0.5);
    final low = _round(math.min(open, close) - _rng.nextDouble() * 0.5);

    candles.add(
      Candle(
        open: open,
        high: high,
        low: low,
        close: close,
        timestamp: DateTime.now(),
      ),
    );
    if (candles.length > maxCandles) {
      candles.removeAt(0);
    }
    currentPrice = close;
    priceUp = close >= open;
  }

  double sessionChangePct() {
    if (candles.length < 2) return 0;
    final first = candles.first.open;
    return ((currentPrice - first) / first) * 100;
  }

  double _round(double v) => double.parse(v.toStringAsFixed(2));
}
