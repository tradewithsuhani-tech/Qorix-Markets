/// Live demo feed for the MomentumBot FOMO console.
abstract final class MomentumBotLiveDemo {
  static const botName = 'MomentumBot v2.1';
  static const pair = 'XAU/USD';
  static const basePrice = 4523.20;

  static const statusLines = [
    'Cross-referencing volatility surfaces...',
    'Scanning institutional order flow on XAU/USD...',
    'Edge detected · micro-lot entry queued',
    'RSI neutral zone · trailing stop armed',
    'Liquidity sweep complete · spread OK',
    'Neural model confidence rising · holding long',
    'Gold session momentum · autopilot engaged',
  ];

  static const socialProofLines = [
    '1,284 desks earned profit in the last hour',
    '847 traders locked gains this session',
    'Gold desk volume +18% vs yesterday',
    'MomentumBot v2.1 · 94.2% win rate today',
  ];

  static const tapeTemplates = [
    (tag: 'BUY', text: 'XAU/USD · 0.05 lot @ market', pnl: null),
    (tag: 'TP', text: 'XAU/USD · take-profit filled', pnl: '+\$2.14'),
    (tag: 'BUY', text: 'XAU/USD · 0.03 lot scale-in', pnl: null),
    (tag: 'SCAN', text: 'Volatility compression · watch', pnl: null),
    (tag: 'TP', text: 'XAU/USD · scalp exit', pnl: '+\$1.08'),
    (tag: 'BUY', text: 'XAU/USD · 0.04 lot @ 4523.10', pnl: null),
    (tag: 'TP', text: 'XAU/USD · partial close 50%', pnl: '+\$3.42'),
    (tag: 'EDGE', text: 'Breakout confirmed · long bias', pnl: null),
  ];
}

class MomentumTapeEntry {
  const MomentumTapeEntry({
    required this.time,
    required this.tag,
    required this.text,
    this.pnl,
  });

  final String time;
  final String tag;
  final String text;
  final String? pnl;

  bool get isProfit => pnl != null;
}
