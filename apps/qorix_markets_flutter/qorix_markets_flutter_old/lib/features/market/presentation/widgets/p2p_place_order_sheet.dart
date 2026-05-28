import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/motion/desk_sheets.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/market/application/p2p_flow_provider.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/p2p_entities.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

Future<void> showP2pPlaceOrderSheet(
  BuildContext context, {
  required P2POffer offer,
  required bool isBuy,
}) {
  return showDeskBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (_) => _PlaceOrderSheet(offer: offer, isBuy: isBuy),
  );
}

class _PlaceOrderSheet extends ConsumerStatefulWidget {
  const _PlaceOrderSheet({required this.offer, required this.isBuy});

  final P2POffer offer;
  final bool isBuy;

  @override
  ConsumerState<_PlaceOrderSheet> createState() => _PlaceOrderSheetState();
}

class _PlaceOrderSheetState extends ConsumerState<_PlaceOrderSheet> {
  final _fiatCtrl = TextEditingController();
  final _cryptoCtrl = TextEditingController();
  P2pInputMode _mode = P2pInputMode.byFiat;
  late String _payment;
  bool _termsExpanded = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _payment = widget.offer.paymentMethods.first;
    if (widget.isBuy) {
      _mode = P2pInputMode.byFiat;
      _fiatCtrl.text = widget.offer.minLimitInr.toStringAsFixed(0);
      _syncFromFiat();
    } else {
      _mode = P2pInputMode.byCrypto;
      final minUsdt = widget.offer.minLimitInr / widget.offer.priceInr;
      _cryptoCtrl.text = minUsdt.toStringAsFixed(2);
      _syncFromCrypto();
    }
  }

  @override
  void dispose() {
    _fiatCtrl.dispose();
    _cryptoCtrl.dispose();
    super.dispose();
  }

  void _syncFromFiat() {
    final fiat = double.tryParse(_fiatCtrl.text) ?? 0;
    final usdt = fiat / widget.offer.priceInr;
    _cryptoCtrl.text = usdt.toStringAsFixed(2);
  }

  void _syncFromCrypto() {
    final usdt = double.tryParse(_cryptoCtrl.text) ?? 0;
    final fiat = usdt * widget.offer.priceInr;
    _fiatCtrl.text = fiat.toStringAsFixed(2);
  }

  double get _fiat => double.tryParse(_fiatCtrl.text) ?? 0;
  double get _usdt => double.tryParse(_cryptoCtrl.text) ?? 0;

  bool get _valid =>
      _fiat >= widget.offer.minLimitInr &&
      _fiat <= widget.offer.maxLimitInr &&
      _usdt <= widget.offer.availableUsdt &&
      _fiat > 0;

  Future<void> _place() async {
    if (!_valid || _submitting) return;
    setState(() => _submitting = true);
    HapticFeedback.mediumImpact();
    try {
      final order = await ref.read(p2pFlowProvider.notifier).placeOrder(
            offer: widget.offer,
            isBuy: widget.isBuy,
            amountInr: _fiat,
            amountUsdt: _usdt,
            paymentMethod: _payment,
          );
      if (!mounted) return;
      Navigator.pop(context);
      context.push('${RoutePaths.p2pOrder}?id=${order.id}');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e'), behavior: SnackBarBehavior.floating),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.offer;
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final accent = widget.isBuy ? AppColors.authGreen : const Color(0xFFFF6B8A);
    final inrFmt = NumberFormat('#,##0.00', 'en_IN');

    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.92),
        decoration: BoxDecoration(
          color: const Color(0xFF12171C),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 8, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.isBuy ? 'Buy USDT' : 'Sell USDT',
                            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
                          ),
                          Text(o.merchantName, style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.5))),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: Icon(Icons.close_rounded, color: Colors.white.withValues(alpha: 0.7)),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                  shrinkWrap: true,
                  children: [
                    Row(
                      children: [
                        _ModeChip(
                          label: widget.isBuy ? 'Pay in INR' : 'Sell USDT',
                          active: widget.isBuy
                              ? _mode == P2pInputMode.byFiat
                              : _mode == P2pInputMode.byCrypto,
                          onTap: () => setState(
                            () => _mode = widget.isBuy ? P2pInputMode.byFiat : P2pInputMode.byCrypto,
                          ),
                        ),
                        const SizedBox(width: 8),
                        _ModeChip(
                          label: widget.isBuy ? 'Buy X USDT' : 'Receive INR',
                          active: widget.isBuy
                              ? _mode == P2pInputMode.byCrypto
                              : _mode == P2pInputMode.byFiat,
                          onTap: () => setState(
                            () => _mode = widget.isBuy ? P2pInputMode.byCrypto : P2pInputMode.byFiat,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    if (widget.isBuy && _mode == P2pInputMode.byFiat) ...[
                      _AmountField(
                        label: 'I will pay',
                        suffix: 'INR',
                        controller: _fiatCtrl,
                        onChanged: (_) => setState(_syncFromFiat),
                      ),
                      const SizedBox(height: 12),
                      _ReadonlyField(label: 'I will receive', value: '${_cryptoCtrl.text} USDT'),
                    ] else if (widget.isBuy && _mode == P2pInputMode.byCrypto) ...[
                      _AmountField(
                        label: 'I want to buy',
                        suffix: 'USDT',
                        controller: _cryptoCtrl,
                        onChanged: (_) => setState(_syncFromCrypto),
                      ),
                      const SizedBox(height: 12),
                      _ReadonlyField(label: 'I will pay', value: '₹${inrFmt.format(_fiat)}'),
                    ] else if (!widget.isBuy && _mode == P2pInputMode.byCrypto) ...[
                      _AmountField(
                        label: 'I will sell',
                        suffix: 'USDT',
                        controller: _cryptoCtrl,
                        onChanged: (_) => setState(_syncFromCrypto),
                      ),
                      const SizedBox(height: 12),
                      _ReadonlyField(label: 'I will receive', value: '₹${inrFmt.format(_fiat)}'),
                    ] else ...[
                      _AmountField(
                        label: 'I want to receive',
                        suffix: 'INR',
                        controller: _fiatCtrl,
                        onChanged: (_) => setState(_syncFromFiat),
                      ),
                      const SizedBox(height: 12),
                      _ReadonlyField(label: 'I will sell', value: '${_cryptoCtrl.text} USDT'),
                    ],
                    const SizedBox(height: 8),
                    Text(
                      'Limit ₹${inrFmt.format(o.minLimitInr)} – ₹${inrFmt.format(o.maxLimitInr)} · Available ${o.availableUsdt.toStringAsFixed(2)} USDT',
                      style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.45)),
                    ),
                    if (!_valid && _fiat > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          'Amount out of limit or exceeds available USDT',
                          style: TextStyle(fontSize: 11, color: accent.withValues(alpha: 0.9)),
                        ),
                      ),
                    const SizedBox(height: 20),
                    Text('Payment Method', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white.withValues(alpha: 0.7))),
                    const SizedBox(height: 8),
                    ...o.paymentMethods.map(
                      (m) => _PaymentTile(
                        method: m,
                        selected: _payment == m,
                        onTap: () => setState(() => _payment = m),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _SummaryRow(label: 'Unit Price', value: '₹${o.priceInr.toStringAsFixed(2)} / USDT'),
                    _SummaryRow(label: 'Quantity', value: '${_usdt.toStringAsFixed(2)} USDT'),
                    _SummaryRow(label: 'Total', value: '₹${inrFmt.format(_fiat)}', bold: true),
                    if (o.terms.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      InkWell(
                        onTap: () => setState(() => _termsExpanded = !_termsExpanded),
                        child: Row(
                          children: [
                            Text('Advertiser Terms', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white.withValues(alpha: 0.7))),
                            Icon(_termsExpanded ? Icons.expand_less : Icons.expand_more, size: 18, color: Colors.white.withValues(alpha: 0.5)),
                          ],
                        ),
                      ),
                      if (_termsExpanded)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(o.terms, style: TextStyle(fontSize: 11, height: 1.4, color: Colors.white.withValues(alpha: 0.5))),
                        ),
                    ],
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: FilledButton(
                    onPressed: _valid && !_submitting ? _place : null,
                    style: FilledButton.styleFrom(
                      backgroundColor: accent,
                      disabledBackgroundColor: accent.withValues(alpha: 0.25),
                      foregroundColor: const Color(0xFF0A0E12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: Text(
                      _submitting ? 'Placing…' : (widget.isBuy ? 'Buy USDT' : 'Sell USDT'),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: active ? AppColors.authGreen.withValues(alpha: 0.15) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: active ? AppColors.authGreen.withValues(alpha: 0.5) : Colors.white.withValues(alpha: 0.12)),
          ),
          child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: active ? AppColors.authGreen : Colors.white.withValues(alpha: 0.5))),
        ),
      ),
    );
  }
}

class _AmountField extends StatelessWidget {
  const _AmountField({required this.label, required this.suffix, required this.controller, required this.onChanged});
  final String label;
  final String suffix;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.45))),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          onChanged: onChanged,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
          decoration: InputDecoration(
            suffixText: suffix,
            suffixStyle: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontWeight: FontWeight.w600),
            filled: true,
            fillColor: const Color(0xFF0A0E12),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: AppColors.authGreen.withValues(alpha: 0.6))),
          ),
        ),
      ],
    );
  }
}

class _ReadonlyField extends StatelessWidget {
  const _ReadonlyField({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.45))),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.03),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
          ),
          child: Text(value, style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 16, fontWeight: FontWeight.w700)),
        ),
      ],
    );
  }
}

class _PaymentTile extends StatelessWidget {
  const _PaymentTile({required this.method, required this.selected, required this.onTap});
  final String method;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off, size: 20, color: selected ? AppColors.authGreen : Colors.white.withValues(alpha: 0.35)),
              const SizedBox(width: 10),
              Text(method, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.85))),
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value, this.bold = false});
  final String label;
  final String value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.45))),
          const Spacer(),
          Text(value, style: TextStyle(fontSize: 12, fontWeight: bold ? FontWeight.w800 : FontWeight.w600, color: Colors.white.withValues(alpha: bold ? 1 : 0.75))),
        ],
      ),
    );
  }
}
