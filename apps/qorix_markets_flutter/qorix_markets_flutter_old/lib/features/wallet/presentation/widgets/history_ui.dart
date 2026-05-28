import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/motion/desk_sheets.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_entity.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/wallet_history_demo.dart';
import 'package:qorix_markets_flutter/widgets/desk_widgets.dart';

final _historyInrFmt = NumberFormat('#,##0.###', 'en_IN');
final _historyDateFmt = DateFormat('d MMM yyyy');

String _formatHistoryInr(num value, {bool signed = false}) {
  final sign = signed && value > 0 ? '+' : (signed && value < 0 ? '-' : '');
  return '$sign₹${_historyInrFmt.format(value.abs())}';
}

class HistoryAppBar extends StatelessWidget {
  const HistoryAppBar({
    required this.onBack,
    required this.visibleCount,
    required this.totalCount,
    required this.onFilter,
    super.key,
  });

  final VoidCallback onBack;
  final int visibleCount;
  final int totalCount;
  final VoidCallback onFilter;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DeskBackButton(onTap: onBack),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Transaction History', style: AppDesk.sectionTitle.copyWith(fontSize: 18)),
              const SizedBox(height: AppSpacing.xxs),
              Text('$visibleCount of $totalCount records', style: AppDesk.sectionCaption),
            ],
          ),
        ),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              HapticFeedback.selectionClick();
              onFilter();
            },
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: Ink(
              width: 40,
              height: 40,
              decoration: AppDesk.outlineButton(),
              child: Icon(Icons.filter_list_rounded, size: AppDesk.iconMd, color: AppDesk.textSecondary),
            ),
          ),
        ),
      ],
    );
  }
}

class HistorySearchField extends StatelessWidget {
  const HistorySearchField({
    required this.controller,
    required this.onChanged,
    super.key,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      style: TextStyle(color: AppDesk.textPrimary, fontSize: 14),
      cursorColor: AppColors.authGreen,
      decoration: InputDecoration(
        hintText: 'Search by description',
        hintStyle: TextStyle(color: AppDesk.textTertiary, fontSize: 14),
        prefixIcon: Icon(Icons.search_rounded, size: AppDesk.iconMd, color: AppDesk.textTertiary),
        filled: true,
        fillColor: AppDesk.field,
        contentPadding: const EdgeInsets.symmetric(vertical: 13),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadius.md), borderSide: BorderSide(color: AppDesk.borderLine)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadius.md), borderSide: BorderSide(color: AppDesk.borderLine)),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: AppColors.authGreen.withValues(alpha: 0.38)),
        ),
      ),
    );
  }
}

class HistorySummaryCard extends StatelessWidget {
  const HistorySummaryCard({
    required this.totalIn,
    required this.totalOut,
    required this.net,
    super.key,
  });

  final double totalIn;
  final double totalOut;
  final double net;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: AppDesk.densePadding,
      decoration: AppDesk.card(),
      child: Row(
        children: [
          Expanded(child: _SummaryCol(label: 'IN', value: _formatHistoryInr(totalIn, signed: true), color: AppColors.authGreen)),
          Container(width: 1, height: 32, color: AppDesk.borderLine.withValues(alpha: 0.65)),
          Expanded(child: _SummaryCol(label: 'OUT', value: '-₹${_historyInrFmt.format(totalOut)}', color: AppColors.sell)),
          Container(width: 1, height: 32, color: AppDesk.borderLine.withValues(alpha: 0.65)),
          Expanded(child: _SummaryCol(label: 'NET', value: _formatHistoryInr(net, signed: true), color: net >= 0 ? AppColors.authGreen : AppColors.sell)),
        ],
      ),
    );
  }
}

class _SummaryCol extends StatelessWidget {
  const _SummaryCol({required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: AppDesk.overline),
        const SizedBox(height: AppSpacing.xs),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(value, style: AppDesk.amountDisplay.copyWith(fontSize: 13, color: color)),
        ),
      ],
    );
  }
}

class HistoryListContainer extends StatelessWidget {
  const HistoryListContainer({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: AppDesk.card(),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }
}

class HistoryTransactionRow extends StatelessWidget {
  const HistoryTransactionRow({required this.tx, super.key});

  final TransactionEntity tx;

  bool get _pending => tx.status.toLowerCase() == 'pending';
  bool get _credit => tx.amount > 0;

  IconData get _icon {
    if (_pending) return Icons.schedule_rounded;
    return switch (tx.type.toLowerCase()) {
      'deposit' => Icons.south_west_rounded,
      'withdrawal' => Icons.north_east_rounded,
      'profit' => Icons.trending_up_rounded,
      'deploy' => Icons.rocket_launch_outlined,
      'transfer' => Icons.swap_horiz_rounded,
      'referral' => Icons.group_outlined,
      _ => _credit ? Icons.south_west_rounded : Icons.north_east_rounded,
    };
  }

  String get _title => WalletHistoryDemo.displayTitle(tx);

  String get _amountStr {
    final inr = WalletHistoryDemo.toInr(tx);
    final sign = _credit ? '+' : '-';
    return '$sign₹${NumberFormat('#,##0.###', 'en_IN').format(inr)}';
  }

  Color get _amountColor {
    if (_pending) return AppColors.warning;
    return _credit ? AppColors.authGreen : AppColors.sell;
  }

  String get _statusLabel {
    if (_pending) return 'Pending';
    return _credit ? 'Credit' : 'Debit';
  }

  Color get _statusColor {
    if (_pending) return AppColors.warning;
    return _credit ? AppColors.authGreen : AppDesk.textTertiary;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 32,
            child: Icon(_icon, size: AppDesk.iconSm, color: AppDesk.textTertiary),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppDesk.sectionTitle.copyWith(fontSize: 14),
                ),
                const SizedBox(height: 2),
                Text(_historyDateFmt.format(tx.createdAt), style: AppDesk.sectionCaption.copyWith(fontSize: 11)),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _amountStr,
                style: AppDesk.amountDisplay.copyWith(color: _amountColor),
              ),
              const SizedBox(height: 3),
              Text(
                _statusLabel,
                style: AppDesk.overline.copyWith(fontSize: 9, color: _statusColor, letterSpacing: 0.3),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

Future<String?> showHistoryFilterSheet(
  BuildContext context, {
  required List<String> filters,
  required String selected,
}) {
  return showDeskBottomSheet<String>(
    context: context,
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          Responsive.pagePadding(ctx).left,
          AppSpacing.md,
          Responsive.pagePadding(ctx).right,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Filter transactions', style: AppDesk.sectionTitle.copyWith(fontSize: 16)),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: filters.map((f) {
                final active = f == selected;
                return Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => Navigator.pop(ctx, f),
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    child: Ink(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
                      decoration: active
                          ? AppDesk.liveBadge()
                          : AppDesk.outlineButton(),
                      child: Text(
                        f,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: active ? AppColors.authGreen : AppDesk.textPrimary,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    ),
  );
}

class HistoryTotals {
  const HistoryTotals({required this.totalIn, required this.totalOut, required this.net});

  final double totalIn;
  final double totalOut;
  final double net;

  static HistoryTotals from(List<TransactionEntity> items) {
    var totalIn = 0.0;
    var totalOut = 0.0;
    for (final tx in items) {
      final inr = WalletHistoryDemo.toInr(tx);
      if (tx.amount > 0) {
        totalIn += inr;
      } else {
        totalOut += inr;
      }
    }
    return HistoryTotals(totalIn: totalIn, totalOut: totalOut, net: totalIn - totalOut);
  }
}
