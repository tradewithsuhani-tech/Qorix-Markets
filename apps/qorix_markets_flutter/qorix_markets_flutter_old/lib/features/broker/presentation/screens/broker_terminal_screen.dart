import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/data/models/broker_models.dart';
import 'package:qorix_markets_flutter/features/broker/application/broker_providers.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';
import 'package:qorix_markets_flutter/widgets/desk_scroll.dart';

abstract final class _B {
  static const bg = Color(0xFF0A0E12);
  static const card = Color(0xFF12171C);
  static const border = Color(0xFF1E2630);
  static const green = AppColors.authGreen;
  static const red = Color(0xFFFF6B8A);

  static final _inr = NumberFormat('#,##0.00', 'en_IN');
  static String inr(num v) => '₹${_inr.format(v)}';
}

class BrokerTerminalScreen extends ConsumerStatefulWidget {
  const BrokerTerminalScreen({super.key});

  @override
  ConsumerState<BrokerTerminalScreen> createState() => _BrokerTerminalScreenState();
}

class _BrokerTerminalScreenState extends ConsumerState<BrokerTerminalScreen> {
  final _symbolCtrl = TextEditingController(text: 'RELIANCE');
  final _qtyCtrl = TextEditingController(text: '1');
  int _tab = 0;

  @override
  void dispose() {
    _symbolCtrl.dispose();
    _qtyCtrl.dispose();
    super.dispose();
  }

  Future<void> _trade(String side) async {
    final symbol = _symbolCtrl.text.trim().toUpperCase();
    final qty = int.tryParse(_qtyCtrl.text.trim()) ?? 0;
    if (symbol.isEmpty || qty <= 0) return;
    try {
      await ref.read(brokerTerminalProvider.notifier).placeDemoOrder(
            symbol: symbol.contains(':') ? symbol : 'NSE:$symbol',
            side: side,
            quantity: qty,
          );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Demo $side filled · $qty × $symbol')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final terminalAsync = ref.watch(brokerTerminalProvider);

    return Scaffold(
      backgroundColor: _B.bg,
      appBar: AppBar(
        backgroundColor: _B.bg,
        elevation: 0,
        title: const Text('Broker terminal'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(brokerTerminalProvider.notifier).refresh(),
          ),
        ],
      ),
      body: CinematicAsyncContent<BrokerTerminalSnapshot>(
        value: terminalAsync,
        onRetry: () => ref.read(brokerTerminalProvider.notifier).refresh(),
        builder: (snap, {required isRefreshing}) {
          final isDemo = snap.status.mode == BrokerTradingMode.demo;
          return RefreshIndicator(
            color: _B.green,
            onRefresh: () => ref.read(brokerTerminalProvider.notifier).refresh(),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                _HeaderBar(profile: snap.profile, isDemo: isDemo),
                const SizedBox(height: AppSpacing.lg),
                _FundsCard(funds: snap.funds),
                const SizedBox(height: AppSpacing.lg),
                _TabRow(
                  index: _tab,
                  onChanged: (i) => setState(() => _tab = i),
                ),
                const SizedBox(height: AppSpacing.md),
                if (_tab == 0) ...[
                  ...snap.holdings.map((h) => _HoldingRow(h: h)),
                  if (snap.holdings.isEmpty)
                    _EmptyHint(isDemo ? 'No demo holdings — place a simulated buy below' : 'No holdings'),
                ] else if (_tab == 1) ...[
                  ...snap.positions.map((p) => _PositionRow(p: p)),
                  if (snap.positions.isEmpty) const _EmptyHint('No open positions'),
                ] else ...[
                  ...snap.quotes.map((q) => _QuoteRow(q: q)),
                ],
                if (isDemo) ...[
                  const SizedBox(height: AppSpacing.xl),
                  _DemoTradeCard(
                    symbolCtrl: _symbolCtrl,
                    qtyCtrl: _qtyCtrl,
                    onBuy: () => _trade('buy'),
                    onSell: () => _trade('sell'),
                    onReset: () => ref.read(brokerTerminalProvider.notifier).resetDemo(),
                  ),
                ] else ...[
                  const SizedBox(height: AppSpacing.lg),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: _B.card,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(color: _B.border),
                    ),
                    child: Text(
                      'Live mode is read-only in Phase 1. Order placement will arrive in a later phase.',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.65), fontSize: 13),
                    ),
                  ),
                ],
                const NavScrollSpacer(),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _HeaderBar extends StatelessWidget {
  const _HeaderBar({required this.profile, required this.isDemo});

  final BrokerProfileModel profile;
  final bool isDemo;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(profile.userName, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
              Text(
                '${isDemo ? 'Demo' : 'Live'} · ${profile.broker.toUpperCase()}',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 13),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: (isDemo ? _B.green : const Color(0xFF387ED1)).withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            isDemo ? 'DEMO' : 'LIVE',
            style: TextStyle(
              color: isDemo ? _B.green : const Color(0xFF387ED1),
              fontWeight: FontWeight.w700,
              fontSize: 11,
            ),
          ),
        ),
      ],
    );
  }
}

class _FundsCard extends StatelessWidget {
  const _FundsCard({required this.funds});

  final BrokerFundsModel funds;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: _B.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: _B.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Available funds', style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 13)),
          const SizedBox(height: 6),
          Text(_B.inr(funds.available), style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700)),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              _FundStat(label: 'Used', value: _B.inr(funds.used)),
              const SizedBox(width: AppSpacing.lg),
              _FundStat(label: 'Total', value: _B.inr(funds.total)),
            ],
          ),
        ],
      ),
    );
  }
}

class _FundStat extends StatelessWidget {
  const _FundStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 12)),
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

class _TabRow extends StatelessWidget {
  const _TabRow({required this.index, required this.onChanged});

  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    const labels = ['Holdings', 'Positions', 'Quotes'];
    return Row(
      children: List.generate(labels.length, (i) {
        final active = i == index;
        return Padding(
          padding: EdgeInsets.only(right: i < labels.length - 1 ? 8 : 0),
          child: ChoiceChip(
            label: Text(labels[i]),
            selected: active,
            onSelected: (_) => onChanged(i),
            selectedColor: _B.green.withValues(alpha: 0.2),
            labelStyle: TextStyle(color: active ? _B.green : Colors.white70),
            backgroundColor: _B.card,
            side: BorderSide(color: active ? _B.green.withValues(alpha: 0.5) : _B.border),
          ),
        );
      }),
    );
  }
}

class _HoldingRow extends StatelessWidget {
  const _HoldingRow({required this.h});

  final BrokerHoldingModel h;

  @override
  Widget build(BuildContext context) {
    final up = h.pnl >= 0;
    return _ListTile(
      title: h.tradingsymbol,
      subtitle: '${h.quantity} @ ${_B.inr(h.averagePrice)}',
      trailing: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(_B.inr(h.lastPrice), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          Text(
            '${up ? '+' : ''}${_B.inr(h.pnl)}',
            style: TextStyle(color: up ? _B.green : _B.red, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _PositionRow extends StatelessWidget {
  const _PositionRow({required this.p});

  final BrokerPositionModel p;

  @override
  Widget build(BuildContext context) {
    return _ListTile(
      title: '${p.tradingsymbol} · ${p.product}',
      subtitle: 'Qty ${p.quantity}',
      trailing: Text(
        _B.inr(p.pnl),
        style: TextStyle(color: p.pnl >= 0 ? _B.green : _B.red, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _QuoteRow extends StatelessWidget {
  const _QuoteRow({required this.q});

  final BrokerQuoteModel q;

  @override
  Widget build(BuildContext context) {
    final up = q.change >= 0;
    return _ListTile(
      title: q.tradingsymbol,
      subtitle: q.exchange,
      trailing: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(_B.inr(q.lastPrice), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          Text(
            '${up ? '+' : ''}${q.changePct.toStringAsFixed(2)}%',
            style: TextStyle(color: up ? _B.green : _B.red, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _ListTile extends StatelessWidget {
  const _ListTile({required this.title, required this.subtitle, required this.trailing});

  final String title;
  final String subtitle;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 12),
      decoration: BoxDecoration(
        color: _B.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: _B.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                Text(subtitle, style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 12)),
              ],
            ),
          ),
          trailing,
        ],
      ),
    );
  }
}

class _EmptyHint extends StatelessWidget {
  const _EmptyHint(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: Text(text, style: TextStyle(color: Colors.white.withValues(alpha: 0.45))),
      ),
    );
  }
}

class _DemoTradeCard extends StatelessWidget {
  const _DemoTradeCard({
    required this.symbolCtrl,
    required this.qtyCtrl,
    required this.onBuy,
    required this.onSell,
    required this.onReset,
  });

  final TextEditingController symbolCtrl;
  final TextEditingController qtyCtrl;
  final VoidCallback onBuy;
  final VoidCallback onSell;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: _B.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: _B.green.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Simulated trade', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(
            'Virtual orders only — no real broker execution',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 12),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: symbolCtrl,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              labelText: 'Symbol (e.g. RELIANCE)',
              labelStyle: TextStyle(color: Colors.white.withValues(alpha: 0.5)),
              filled: true,
              fillColor: _B.bg,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: qtyCtrl,
            keyboardType: TextInputType.number,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              labelText: 'Quantity',
              labelStyle: TextStyle(color: Colors.white.withValues(alpha: 0.5)),
              filled: true,
              fillColor: _B.bg,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: onBuy,
                  style: FilledButton.styleFrom(backgroundColor: _B.green),
                  child: const Text('Buy'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton(
                  onPressed: onSell,
                  style: FilledButton.styleFrom(backgroundColor: _B.red),
                  child: const Text('Sell'),
                ),
              ),
            ],
          ),
          TextButton(onPressed: onReset, child: const Text('Reset demo portfolio')),
        ],
      ),
    );
  }
}
