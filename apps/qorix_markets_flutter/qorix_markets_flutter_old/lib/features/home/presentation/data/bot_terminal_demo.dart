import 'package:flutter/material.dart';

/// UI-demo data for the XAUUSD auto bot terminal on the home dashboard.
abstract final class BotTerminalDemo {
  static const pair = 'XAUUSD';
  static const pairLabel = 'Gold / US Dollar';
  static const livePrice = 4523.20;
  static const spreadPips = 25;
  static const maxBars = 90;
  static const openLots = 0.05;
  static const openEntry = 4522.45;
  static const floatingPnl = 108.20;

  static const openOrderCount = 5;

  static const openPositions = [
    BotTerminalOpenPosition(side: 'LONG', lots: 0.05, entry: 4522.45, pnl: 37.50),
    BotTerminalOpenPosition(side: 'LONG', lots: 0.03, entry: 4521.80, pnl: 22.10),
    BotTerminalOpenPosition(side: 'SHORT', lots: 0.02, entry: 4524.10, pnl: -8.40),
    BotTerminalOpenPosition(side: 'LONG', lots: 0.04, entry: 4520.95, pnl: 41.20),
    BotTerminalOpenPosition(side: 'SHORT', lots: 0.05, entry: 4525.30, pnl: 15.80),
  ];

  static double get totalFloatingPnl =>
      openPositions.fold(0, (sum, p) => sum + p.pnl);
  static const todayTrades = 25;
  static const todayWins = 18;
  static const longWins = 12;
  static const longLosses = 3;
  static const shortWins = 6;
  static const shortLosses = 4;
  static const aiConfidence = 0.72;
  static const sessionUptime = '14h 22m';

  static const tapeRowsPer10Seconds = 6;
  static const tapeRowHeight = 28.0;

  static const tapeSeed = [
    BotTerminalTapeEntry(time: '04:13:52', side: 'BUY', qty: 0.025, price: 4523.24),
    BotTerminalTapeEntry(time: '04:13:51', side: 'SELL', qty: 0.018, price: 4523.08),
    BotTerminalTapeEntry(time: '04:13:50', side: 'BUY', qty: 0.042, price: 4523.31),
    BotTerminalTapeEntry(time: '04:13:49', side: 'BUY', qty: 0.015, price: 4522.95),
    BotTerminalTapeEntry(time: '04:13:48', side: 'SELL', qty: 0.030, price: 4522.88),
    BotTerminalTapeEntry(time: '04:13:47', side: 'BUY', qty: 0.050, price: 4523.12),
    BotTerminalTapeEntry(time: '04:13:46', side: 'SELL', qty: 0.022, price: 4522.76),
    BotTerminalTapeEntry(time: '04:13:45', side: 'BUY', qty: 0.033, price: 4523.05),
    BotTerminalTapeEntry(time: '04:13:44', side: 'SELL', qty: 0.011, price: 4522.69),
    BotTerminalTapeEntry(time: '04:13:43', side: 'BUY', qty: 0.027, price: 4523.18),
    BotTerminalTapeEntry(time: '04:13:42', side: 'BUY', qty: 0.019, price: 4522.99),
    BotTerminalTapeEntry(time: '04:13:41', side: 'SELL', qty: 0.036, price: 4522.82),
  ];

  static const tapeStatusLines = [
    'XAU/USD 4523.20 ▲ bot micro-fill 0.05 lot',
    'XAU/USD 4522.88 ▼ spread check OK · autopilot',
    'XAU/USD 4523.05 ▲ RSI neutral · holding long',
    'XAU/USD 4522.60 ▲ scan complete · edge detected',
    'XAU/USD 4523.40 ▲ trailing stop adjusted +0.8p',
  ];

  static List<BotTerminalLog> logs = [
    BotTerminalLog(
      time: '14:38:12',
      tag: 'TP',
      message: 'XAU/USD · 0.05 lot closed @ 4523.10',
      detail: '+\$18.40',
      type: BotLogType.profit,
    ),
    BotTerminalLog(
      time: '14:32:45',
      tag: 'BUY',
      message: 'XAU/USD · 0.05 lot @ 4522.45',
      detail: 'Auto entry',
      type: BotLogType.buy,
    ),
    BotTerminalLog(
      time: '14:32:01',
      tag: 'SCAN',
      message: 'RSI oversold · momentum shift detected',
      detail: 'XAU/USD',
      type: BotLogType.scan,
    ),
  ];
}

enum BotLogType { buy, profit, scan, info }

class BotTerminalTapeEntry {
  const BotTerminalTapeEntry({
    required this.time,
    required this.side,
    required this.qty,
    required this.price,
  });

  final String time;
  final String side;
  final double qty;
  final double price;

  bool get isBuy => side == 'BUY';
}

class BotTerminalOpenPosition {
  const BotTerminalOpenPosition({
    required this.side,
    required this.lots,
    required this.entry,
    required this.pnl,
  });

  final String side;
  final double lots;
  final double entry;
  final double pnl;
}

class BotTerminalLog {
  const BotTerminalLog({
    required this.time,
    required this.tag,
    required this.message,
    required this.detail,
    required this.type,
  });

  final String time;
  final String tag;
  final String message;
  final String detail;
  final BotLogType type;
}

IconData iconForLogType(BotLogType type) {
  switch (type) {
    case BotLogType.buy:
      return Icons.north_east_rounded;
    case BotLogType.profit:
      return Icons.check_circle_outline_rounded;
    case BotLogType.scan:
      return Icons.radar_rounded;
    case BotLogType.info:
      return Icons.psychology_alt_outlined;
  }
}
