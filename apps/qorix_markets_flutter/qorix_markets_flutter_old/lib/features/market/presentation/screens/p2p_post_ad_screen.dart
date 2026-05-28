import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/features/market/application/p2p_flow_provider.dart';
import 'package:qorix_markets_flutter/features/market/infrastructure/p2p_repository_impl.dart';

class P2pPostAdScreen extends ConsumerStatefulWidget {
  const P2pPostAdScreen({super.key});

  @override
  ConsumerState<P2pPostAdScreen> createState() => _P2pPostAdScreenState();
}

class _P2pPostAdScreenState extends ConsumerState<P2pPostAdScreen> {
  bool _isSell = false;
  final _selectedMethods = <String>{'UPI'};
  final _price = TextEditingController(text: '83.50');
  final _total = TextEditingController(text: '5000');
  final _min = TextEditingController(text: '500');
  final _max = TextEditingController(text: '50000');
  bool _submitting = false;

  static const _allMethods = ['UPI', 'BANK', 'IMPS', 'NEFT', 'RTGS', 'PHONEPE', 'GPAY', 'PAYTM'];

  @override
  void dispose() {
    _price.dispose();
    _total.dispose();
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting || _selectedMethods.isEmpty) return;
    final price = double.tryParse(_price.text.trim());
    final quantity = double.tryParse(_total.text.trim());
    final minLimit = double.tryParse(_min.text.trim());
    final maxLimit = double.tryParse(_max.text.trim());
    if (price == null || quantity == null || minLimit == null || maxLimit == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter valid numbers for all fields'), behavior: SnackBarBehavior.floating),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await ref.read(p2pRepositoryProvider).createAd(
            isSell: _isSell,
            price: price,
            quantity: quantity,
            minLimit: minLimit,
            maxLimit: maxLimit,
            paymentMethods: _selectedMethods.toList(),
          );
      await ref.read(p2pFlowProvider.notifier).refreshAll();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ad posted successfully'), behavior: SnackBarBehavior.floating),
      );
      safePop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorMessage.brief(e)), behavior: SnackBarBehavior.floating),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: BackButton(onPressed: () => safePop(context), color: Colors.white),
        title: const Text('Post Ad', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(child: _SideBtn(label: 'I want to Buy', active: !_isSell, color: AppColors.authGreen, onTap: () => setState(() => _isSell = false))),
              const SizedBox(width: 10),
              Expanded(child: _SideBtn(label: 'I want to Sell', active: _isSell, color: const Color(0xFFFF6B8A), onTap: () => setState(() => _isSell = true))),
            ],
          ),
          const SizedBox(height: 20),
          _Field(label: 'Fixed Price (INR/USDT)', controller: _price),
          _Field(label: 'Total Amount (USDT)', controller: _total),
          _Field(label: 'Min Limit (INR)', controller: _min),
          _Field(label: 'Max Limit (INR)', controller: _max),
          const SizedBox(height: 12),
          Text('Payment Methods', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white.withValues(alpha: 0.6))),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _allMethods.map((m) {
              final sel = _selectedMethods.contains(m);
              return FilterChip(
                label: Text(m),
                selected: sel,
                onSelected: (v) => setState(() {
                  if (v) {
                    _selectedMethods.add(m);
                  } else if (_selectedMethods.length > 1) {
                    _selectedMethods.remove(m);
                  }
                }),
                selectedColor: AppColors.authGreen.withValues(alpha: 0.2),
                labelStyle: TextStyle(color: sel ? AppColors.authGreen : Colors.white54, fontWeight: FontWeight.w700, fontSize: 11),
                side: BorderSide(color: sel ? AppColors.authGreen.withValues(alpha: 0.5) : Colors.white24),
                backgroundColor: const Color(0xFF12171C),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 48,
            child: FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(backgroundColor: AppColors.authGreen, foregroundColor: const Color(0xFF0A0E12)),
              child: _submitting
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Post Ad', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ),
        ],
      ),
    );
  }
}

class _SideBtn extends StatelessWidget {
  const _SideBtn({required this.label, required this.active, required this.color, required this.onTap});
  final String label;
  final bool active;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Ink(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: active ? color.withValues(alpha: 0.12) : const Color(0xFF12171C),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: active ? color.withValues(alpha: 0.5) : Colors.white.withValues(alpha: 0.08)),
          ),
          child: Center(child: Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: active ? color : Colors.white54, fontSize: 12))),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.controller});
  final String label;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.45))),
          const SizedBox(height: 6),
          TextField(
            controller: controller,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
            decoration: InputDecoration(
              filled: true,
              fillColor: const Color(0xFF12171C),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: AppColors.authGreen.withValues(alpha: 0.5))),
            ),
          ),
        ],
      ),
    );
  }
}
