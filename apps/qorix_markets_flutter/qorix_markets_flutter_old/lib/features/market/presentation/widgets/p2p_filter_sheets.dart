import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:qorix_markets_flutter/core/motion/desk_sheets.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/p2p_entities.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/p2p_demo.dart';

Future<double?> showP2pAmountFilterSheet(BuildContext context, {double? current}) {
  return showDeskBottomSheet<double?>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _AmountFilterSheet(initial: current),
  );
}

Future<P2pSortOption?> showP2pSortSheet(BuildContext context, {required P2pSortOption current}) {
  return showDeskBottomSheet<P2pSortOption?>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _SortSheet(current: current),
  );
}

class _AmountFilterSheet extends StatefulWidget {
  const _AmountFilterSheet({this.initial});
  final double? initial;

  @override
  State<_AmountFilterSheet> createState() => _AmountFilterSheetState();
}

class _AmountFilterSheetState extends State<_AmountFilterSheet> {
  late final _ctrl = TextEditingController(text: widget.initial?.toStringAsFixed(0) ?? '');

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SheetShell(
      title: 'Filter by Amount',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Enter transaction amount (INR)', style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.5))),
          const SizedBox(height: 10),
          TextField(
            controller: _ctrl,
            keyboardType: TextInputType.number,
            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
            decoration: InputDecoration(
              prefixText: '₹ ',
              prefixStyle: TextStyle(color: Colors.white.withValues(alpha: 0.5)),
              filled: true,
              fillColor: const Color(0xFF0A0E12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context, -1.0),
                  child: const Text('Clear'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    final v = double.tryParse(_ctrl.text);
                    Navigator.pop(context, v);
                  },
                  style: FilledButton.styleFrom(backgroundColor: AppColors.authGreen, foregroundColor: const Color(0xFF0A0E12)),
                  child: const Text('Apply'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SortSheet extends StatelessWidget {
  const _SortSheet({required this.current});
  final P2pSortOption current;

  @override
  Widget build(BuildContext context) {
    return _SheetShell(
      title: 'Sort By',
      child: Column(
        children: P2pSortOption.values.map((opt) {
          final selected = opt == current;
          return Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                HapticFeedback.selectionClick();
                Navigator.pop(context, opt);
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Row(
                  children: [
                    Expanded(child: Text(P2pDemo.sortLabels[opt]!, style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontWeight: FontWeight.w600))),
                    if (selected) Icon(Icons.check_rounded, color: AppColors.authGreen, size: 20),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _SheetShell extends StatelessWidget {
  const _SheetShell({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
      decoration: BoxDecoration(
        color: const Color(0xFF12171C),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}
