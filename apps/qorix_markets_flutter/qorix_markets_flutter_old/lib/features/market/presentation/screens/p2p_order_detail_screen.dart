import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/widgets/desk_widgets.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/features/market/application/p2p_flow_provider.dart';
import 'package:qorix_markets_flutter/features/market/application/p2p_order_live_provider.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/p2p_entities.dart';
import 'package:qorix_markets_flutter/features/market/presentation/widgets/p2p_order_chat_sheet.dart';
import 'package:qorix_markets_flutter/features/market/presentation/widgets/p2p_order_rating_card.dart';

class P2pOrderDetailScreen extends ConsumerStatefulWidget {
  const P2pOrderDetailScreen({required this.orderId, super.key});

  final String orderId;

  @override
  ConsumerState<P2pOrderDetailScreen> createState() => _P2pOrderDetailScreenState();
}

class _P2pOrderDetailScreenState extends ConsumerState<P2pOrderDetailScreen> {
  Timer? _tickTimer;
  P2pOrder? _order;
  bool _loading = true;
  bool _actionBusy = false;
  String? _error;

  int? get _orderId => int.tryParse(widget.orderId);
  bool get _isBuyer => _order?.role == 'buyer';

  @override
  void initState() {
    super.initState();
    _loadOrder();
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  Future<void> _loadOrder({bool silent = false}) async {
    final id = _orderId;
    if (id == null) {
      setState(() {
        _loading = false;
        _error = 'Invalid order id';
      });
      return;
    }
    if (!silent) setState(() => _loading = true);
    try {
      final cached = ref.read(p2pFlowProvider).orderById(widget.orderId);
      final order = cached ?? await ref.read(p2pFlowProvider.notifier).refreshOrder(id);
      if (!mounted) return;
      setState(() {
        _order = order;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = ErrorMessage.brief(e);
      });
    }
  }

  @override
  void dispose() {
    _tickTimer?.cancel();
    super.dispose();
  }

  Future<void> _runAction(Future<void> Function() action) async {
    if (_actionBusy) return;
    setState(() => _actionBusy = true);
    try {
      await action();
      await _loadOrder(silent: true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorMessage.brief(e)), behavior: SnackBarBehavior.floating),
      );
    } finally {
      if (mounted) setState(() => _actionBusy = false);
    }
  }

  void _copy(String label, String value) {
    Clipboard.setData(ClipboardData(text: value));
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$label copied'), behavior: SnackBarBehavior.floating, duration: const Duration(seconds: 1)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final orderId = _orderId;
    if (orderId != null) {
      ref.watch(p2pOrderLiveProvider(orderId));
      ref.listen(p2pOrderLiveProvider(orderId), (prev, next) {
        if (next.lastEvent?.isOrderUpdate == true) {
          final updated = ref.read(p2pFlowProvider).orderById(widget.orderId);
          if (updated != null && mounted) setState(() => _order = updated);
        }
      });
      ref.listen(p2pFlowProvider, (prev, next) {
        final updated = next.orderById(widget.orderId);
        if (updated != null && mounted && updated != _order) {
          setState(() => _order = updated);
        }
      });
    }

    if (_loading && _order == null) {
      return Scaffold(
        backgroundColor: AppDesk.bg,
        appBar: AppBar(backgroundColor: Colors.transparent, leading: BackButton(onPressed: () => safePop(context))),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final order = _order ?? ref.watch(p2pFlowProvider).orderById(widget.orderId);
    if (order == null) {
      return Scaffold(
        backgroundColor: AppDesk.bg,
        appBar: AppBar(backgroundColor: Colors.transparent, leading: BackButton(onPressed: () => safePop(context))),
        body: Center(child: Text(_error ?? 'Order not found', style: const TextStyle(color: Colors.white54))),
      );
    }

    final inrFmt = NumberFormat('#,##0.00', 'en_IN');
    final accent = order.isBuy ? AppColors.authGreen : const Color(0xFFFF6B8A);
    final remaining = order.remaining;
    final showTimer = order.status == P2pOrderStatus.pending && remaining.isNegative == false;

    return Scaffold(
      backgroundColor: AppDesk.bg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: BackButton(onPressed: () => safePop(context), color: AppDesk.textPrimary),
        title: Text('Order ${order.id}', style: AppDesk.sectionTitle.copyWith(fontSize: 15)),
        actions: [
          IconButton(
            onPressed: () => showP2pOrderChatSheet(context, orderId: widget.orderId),
            icon: Icon(Icons.chat_bubble_outline_rounded, color: Colors.white.withValues(alpha: 0.8)),
          ),
        ],
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
          Responsive.pagePadding(context).left,
          0,
          Responsive.pagePadding(context).right,
          AppSpacing.xxl,
        ),
        physics: AppScroll.page,
        children: [
          _StatusHeader(order: order, accent: accent, timer: showTimer ? _formatDuration(remaining) : null),
          AppSpacing.gapSection(),
          _StepIndicator(status: order.status, isBuy: order.isBuy),
          const SizedBox(height: 20),
          if (order.status == P2pOrderStatus.pending && order.isBuy) ...[
            _PaySection(order: order, inrFmt: inrFmt, onCopy: _copy),
            const SizedBox(height: 16),
            _WarningBox(),
          ],
          if (order.status == P2pOrderStatus.paid) ...[
            _InfoCard(
              title: _isBuyer ? 'Payment submitted' : 'Confirm payment received',
              body: _isBuyer
                  ? 'Waiting for ${order.offer.merchantName} to release ${order.amountUsdt.toStringAsFixed(2)} USDT to your wallet.'
                  : 'Buyer marked payment as sent. Verify your bank/UPI receipt, then release ${order.amountUsdt.toStringAsFixed(2)} USDT.',
            ),
          ],
          if (order.status == P2pOrderStatus.completed) ...[
            _InfoCard(
              title: 'Order completed',
              body: _isBuyer
                  ? '${order.amountUsdt.toStringAsFixed(2)} USDT has been credited to your Funding Wallet.'
                  : '${order.amountUsdt.toStringAsFixed(2)} USDT released to buyer.',
              color: AppColors.authGreen,
            ),
            const SizedBox(height: 16),
            if (orderId != null)
              P2pOrderRatingCard(orderId: orderId, counterpartyName: order.offer.merchantName),
          ],
          if (order.status == P2pOrderStatus.cancelled) ...[
            _InfoCard(title: 'Order cancelled', body: 'This order was cancelled.', color: Colors.white54),
          ],
          if (order.status == P2pOrderStatus.disputed) ...[
            _InfoCard(
              title: 'Dispute raised',
              body: 'Support is reviewing this order. Please use chat to share evidence.',
              color: const Color(0xFFF59E0B),
            ),
          ],
          const SizedBox(height: 16),
          _OrderSummary(order: order, inrFmt: inrFmt),
        ],
      ),
      bottomNavigationBar: _buildActions(context, order, accent),
    );
  }

  Widget? _buildActions(BuildContext context, P2pOrder order, Color accent) {
    if (_actionBusy) {
      return const SafeArea(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    if (order.status == P2pOrderStatus.pending) {
      return SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            Responsive.pagePadding(context).left,
            AppSpacing.sm,
            Responsive.pagePadding(context).right,
            AppSpacing.md,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_isBuyer)
                DeskPrimaryCta(
                  label: 'Transferred, Notify Seller',
                  onTap: () => _runAction(() async {
                    await ref.read(p2pFlowProvider.notifier).markPaid(order.id);
                    HapticFeedback.mediumImpact();
                  }),
                ),
              TextButton(
                onPressed: () => _runAction(() async {
                  await ref.read(p2pFlowProvider.notifier).cancelOrder(order.id);
                  if (!mounted) return;
                  safePop(context);
                }),
                child: Text('Cancel Order', style: TextStyle(color: Colors.white.withValues(alpha: 0.45))),
              ),
            ],
          ),
        ),
      );
    }

    if (order.status == P2pOrderStatus.paid) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!_isBuyer)
                DeskPrimaryCta(
                  label: 'Release USDT',
                  onTap: () => _runAction(() async {
                    await ref.read(p2pFlowProvider.notifier).confirmOrder(order.id);
                    HapticFeedback.mediumImpact();
                  }),
                ),
              OutlinedButton(
                onPressed: () => _showDisputeSheet(context, order),
                child: const Text('Raise Dispute'),
              ),
            ],
          ),
        ),
      );
    }
    return null;
  }

  void _showDisputeSheet(BuildContext context, P2pOrder order) {
    final reasonCtrl = TextEditingController();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF12171C),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(ctx).bottom + 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Raise Dispute', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 12),
              TextField(
                controller: reasonCtrl,
                maxLength: 60,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Reason (3–60 characters)',
                  hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.35)),
                  filled: true,
                  fillColor: const Color(0xFF0A0E12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () {
                  final reason = reasonCtrl.text.trim();
                  if (reason.length < 3) return;
                  Navigator.pop(ctx);
                  _runAction(() => ref.read(p2pFlowProvider.notifier).disputeOrder(order.id, reason: reason));
                },
                child: const Text('Submit Dispute'),
              ),
            ],
          ),
        );
      },
    );
  }

  String _formatDuration(Duration d) {
    if (d.isNegative) return '00:00';
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }
}

class _StatusHeader extends StatelessWidget {
  const _StatusHeader({required this.order, required this.accent, this.timer});
  final P2pOrder order;
  final Color accent;
  final String? timer;

  @override
  Widget build(BuildContext context) {
    final label = switch (order.status) {
      P2pOrderStatus.pending => order.role == 'buyer' ? 'Pending Payment' : 'Pending Transfer',
      P2pOrderStatus.paid => 'Pending Release',
      P2pOrderStatus.completed => 'Completed',
      P2pOrderStatus.cancelled => 'Cancelled',
      P2pOrderStatus.disputed => 'Disputed',
    };

    return Container(
      padding: AppDesk.densePadding,
      decoration: AppDesk.card(accent: accent),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: AppDesk.sectionTitle.copyWith(fontSize: 15, color: accent)),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  order.isBuy ? 'Pay seller within time limit' : 'Release USDT after receiving INR',
                  style: AppDesk.sectionCaption,
                ),
              ],
            ),
          ),
          if (timer != null)
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(timer!, style: AppDesk.amountHero.copyWith(fontSize: 20, color: accent)),
                Text('remaining', style: AppDesk.overline),
              ],
            ),
        ],
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({required this.status, required this.isBuy});
  final P2pOrderStatus status;
  final bool isBuy;

  @override
  Widget build(BuildContext context) {
    final step = switch (status) {
      P2pOrderStatus.pending => 0,
      P2pOrderStatus.paid => 1,
      P2pOrderStatus.completed => 2,
      P2pOrderStatus.cancelled => -1,
      P2pOrderStatus.disputed => 1,
    };

    final labels = isBuy
        ? ['Transfer Payment', 'Pending Release', 'Completed']
        : ['Confirm Order', 'Buyer Pays', 'Completed'];

    if (step < 0) return const SizedBox.shrink();

    return Row(
      children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0) Expanded(child: Container(height: 2, color: i <= step ? AppColors.authGreen.withValues(alpha: 0.5) : Colors.white.withValues(alpha: 0.08))),
          _StepDot(active: i <= step, current: i == step, label: labels[i]),
        ],
      ],
    );
  }
}

class _StepDot extends StatelessWidget {
  const _StepDot({required this.active, required this.current, required this.label});
  final bool active;
  final bool current;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: current ? 14 : 10,
          height: current ? 14 : 10,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: active ? AppColors.authGreen : Colors.white.withValues(alpha: 0.15),
            border: current ? Border.all(color: AppColors.authGreen, width: 2) : null,
          ),
        ),
        const SizedBox(height: 4),
        SizedBox(
          width: 72,
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 8, fontWeight: current ? FontWeight.w700 : FontWeight.w500, color: active ? Colors.white.withValues(alpha: 0.7) : Colors.white.withValues(alpha: 0.35)),
          ),
        ),
      ],
    );
  }
}

class _PaySection extends StatelessWidget {
  const _PaySection({required this.order, required this.inrFmt, required this.onCopy});
  final P2pOrder order;
  final NumberFormat inrFmt;
  final void Function(String, String) onCopy;

  @override
  Widget build(BuildContext context) {
    final d = order.paymentDetail;
    return Container(
      padding: AppDesk.densePadding,
      decoration: AppDesk.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Pay the seller', style: AppDesk.sectionTitle.copyWith(fontSize: 13)),
          const SizedBox(height: AppSpacing.md),
          _CopyRow(label: 'Amount', value: '₹${inrFmt.format(order.amountInr)}', onCopy: () => onCopy('Amount', order.amountInr.toStringAsFixed(2)), highlight: true),
          _CopyRow(label: 'Payment Method', value: d.method, onCopy: () {}),
          _CopyRow(label: 'Account Name', value: d.accountName, onCopy: () => onCopy('Name', d.accountName)),
          _CopyRow(label: d.method == 'UPI' ? 'UPI ID' : 'Account No.', value: d.accountValue, onCopy: () => onCopy('Account', d.accountValue)),
          if (d.bankName != null) _CopyRow(label: 'Bank', value: d.bankName!, onCopy: () => onCopy('Bank', d.bankName!)),
          if (d.ifsc != null) _CopyRow(label: 'IFSC', value: d.ifsc!, onCopy: () => onCopy('IFSC', d.ifsc!)),
        ],
      ),
    );
  }
}

class _CopyRow extends StatelessWidget {
  const _CopyRow({required this.label, required this.value, required this.onCopy, this.highlight = false});
  final String label;
  final String value;
  final VoidCallback onCopy;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 100, child: Text(label, style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.4)))),
          Expanded(
            child: Text(
              value,
              style: highlight
                  ? AppDesk.amountHero.copyWith(fontSize: 20, color: AppColors.authGreen)
                  : AppDesk.amountDisplay.copyWith(fontSize: 13, fontWeight: FontWeight.w600, color: AppDesk.textPrimary),
            ),
          ),
          if (!highlight)
            GestureDetector(
              onTap: onCopy,
              child: Icon(Icons.copy_rounded, size: 16, color: Colors.white.withValues(alpha: 0.35)),
            ),
        ],
      ),
    );
  }
}

class _WarningBox extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFF6B8A).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFF6B8A).withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Important', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: const Color(0xFFFF6B8A).withValues(alpha: 0.9))),
          const SizedBox(height: 6),
          Text(
            '• Transfer from your own verified account only\n• Do NOT mention USDT/crypto in payment remarks\n• Click "Notify Seller" only after successful transfer',
            style: TextStyle(fontSize: 11, height: 1.5, color: Colors.white.withValues(alpha: 0.55)),
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.title, required this.body, this.color});
  final String title;
  final String body;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: AppDesk.densePadding,
      decoration: AppDesk.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppDesk.sectionTitle.copyWith(fontSize: 14, color: color ?? AppDesk.textPrimary)),
          const SizedBox(height: AppSpacing.sm),
          Text(body, style: AppDesk.sectionCaption),
        ],
      ),
    );
  }
}

class _OrderSummary extends StatelessWidget {
  const _OrderSummary({required this.order, required this.inrFmt});
  final P2pOrder order;
  final NumberFormat inrFmt;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: AppDesk.densePadding,
      decoration: AppDesk.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Order Info', style: AppDesk.sectionTitle.copyWith(fontSize: 13)),
          const SizedBox(height: AppSpacing.md),
          _Row('Counterparty', order.offer.merchantName),
          _Row('Unit Price', '₹${order.offer.priceInr.toStringAsFixed(2)}'),
          _Row('Quantity', '${order.amountUsdt.toStringAsFixed(2)} USDT'),
          _Row('Total', '₹${inrFmt.format(order.amountInr)}', highlight: true),
          _Row('Payment', order.paymentMethod),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.k, this.v, {this.highlight = false});
  final String k;
  final String v;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Text(k, style: AppDesk.sectionCaption.copyWith(fontSize: 11)),
          const Spacer(),
          Flexible(
            child: Text(
              v,
              style: highlight
                  ? AppDesk.amountDisplay.copyWith(color: AppColors.authGreen)
                  : AppDesk.amountDisplay.copyWith(fontSize: 12, fontWeight: FontWeight.w600),
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}
