import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/candle.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/markets_demo.dart';

abstract final class _M {
  static const input = AppDesk.field;

  static Color get line => AppDesk.border;
  static Color get text2 => AppDesk.textSecondary;
  static Color get text3 => AppDesk.textTertiary;

  static const buy = AppColors.authGreen;
  static const sell = Color(0xFFFF6B8A);

  static final _inr = NumberFormat('#,##0.00', 'en_IN');
  static final _usdt4 = NumberFormat('#,##0.0000');
  static final _usdt = NumberFormat('#,##0.##');

  static String inr(double v) => '₹${_inr.format(v)}';
  static String inrPlain(double v) => _inr.format(v);
  static String usdt4(double v) => _usdt4.format(v);
  static String usdt(double v) => _usdt.format(v);
}

// ─── Top bar + stats (reference layout) ───────────────────────────────────────

class MarketsTopBar extends StatelessWidget {
  const MarketsTopBar({
    required this.price,
    required this.high,
    required this.low,
    super.key,
  });

  final double price;
  final double high;
  final double low;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 5,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'USDT / INR',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800, letterSpacing: -0.2, height: 1.1),
              ),
              const SizedBox(height: 4),
              Text(
                'Qorix Markets',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.2, color: _M.text2),
              ),
            ],
          ),
        ),
        _StatCol(label: 'LAST PRICE', value: _M.inrPlain(price), color: Colors.white),
        const SizedBox(width: 8),
        _StatCol(label: '24H HIGH', value: _M.inrPlain(high), color: _M.buy),
        const SizedBox(width: 8),
        _StatCol(label: '24H LOW', value: _M.inrPlain(low), color: _M.sell),
      ],
    );
  }
}

class _StatCol extends StatelessWidget {
  const _StatCol({required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      flex: 4,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, letterSpacing: 0.4, color: _M.text3)),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: color,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Chart ────────────────────────────────────────────────────────────────────

class MarketsChartPanel extends StatelessWidget {
  const MarketsChartPanel({
    required this.candles,
    required this.currentPrice,
    required this.timeframe,
    required this.onTimeframe,
    super.key,
  });

  final List<Candle> candles;
  final double currentPrice;
  final String timeframe;
  final ValueChanged<String> onTimeframe;

  static const _tfs = ['1m', '5m', '15m', '1h', '1d'];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text('USDT/INR', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: _M.text2)),
            const Spacer(),
            ..._tfs.map((tf) {
              final sel = tf == timeframe;
              return Padding(
                padding: const EdgeInsets.only(left: 4),
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    onTimeframe(tf);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: sel ? const Color(0xFF252A30) : Colors.transparent,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      tf,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: sel ? FontWeight.w700 : FontWeight.w500,
                        color: sel ? Colors.white : _M.text3,
                      ),
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          height: 200,
          decoration: BoxDecoration(
            color: Colors.black,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: _M.line),
          ),
          clipBehavior: Clip.antiAlias,
          child: CustomPaint(
            painter: _MarketsCandlePainter(candles: candles, currentPrice: currentPrice),
            child: const SizedBox.expand(),
          ),
        ),
      ],
    );
  }
}

// ─── Full-width trade panel (easy buy/sell) ───────────────────────────────────

class MarketsTradePanel extends StatelessWidget {
  const MarketsTradePanel({
    required this.isBuy,
    required this.isLimit,
    required this.price,
    required this.amountCtrl,
    required this.priceCtrl,
    required this.availableUsdt,
    required this.availableInr,
    required this.onSideChanged,
    required this.onTypeChanged,
    required this.onSubmit,
    this.onAddFunds,
    super.key,
  });

  final bool isBuy;
  final bool isLimit;
  final double price;
  final TextEditingController amountCtrl;
  final TextEditingController priceCtrl;
  final double availableUsdt;
  final double availableInr;
  final ValueChanged<bool> onSideChanged;
  final ValueChanged<bool> onTypeChanged;
  final VoidCallback onSubmit;
  final VoidCallback? onAddFunds;

  double get _amount => double.tryParse(amountCtrl.text) ?? 0;

  double get _estTotal {
    if (_amount <= 0) return 0;
    if (isLimit) {
      final p = double.tryParse(priceCtrl.text) ?? price;
      return p * _amount;
    }
    return price * _amount;
  }

  double get _effectivePrice {
    if (isLimit) return double.tryParse(priceCtrl.text) ?? price;
    return price;
  }

  double get _maxUsdtQuantity {
    if (_effectivePrice <= 0) return 0;
    if (isBuy) return availableInr / _effectivePrice;
    return availableUsdt;
  }

  @override
  Widget build(BuildContext context) {
    final accent = isBuy ? _M.buy : _M.sell;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _BuySellTabs(isBuy: isBuy, onChanged: onSideChanged),
        const SizedBox(height: 14),
        _MarketLimitPills(isLimit: isLimit, accent: accent, onChanged: onTypeChanged),
        const SizedBox(height: 16),
        Row(
          children: [
            Text('Avbl', style: TextStyle(fontSize: 13, color: _M.text2)),
            const Spacer(),
            Text(
              isBuy ? _M.inr(availableInr) : '${_M.usdt4(availableUsdt)} USDT',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: isBuy ? _M.buy : _M.sell),
            ),
            if (onAddFunds != null) ...[
              const SizedBox(width: 6),
              GestureDetector(
                onTap: onAddFunds,
                child: Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: _M.buy.withValues(alpha: 0.5)),
                  ),
                  child: const Icon(Icons.add, size: 14, color: _M.buy),
                ),
              ),
            ],
          ],
        ),
        if (isLimit) ...[
          const SizedBox(height: 14),
          Text('PRICE (INR)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: _M.text3)),
          const SizedBox(height: 6),
          _AmountField(controller: priceCtrl, hint: '0.00'),
        ],
        const SizedBox(height: 14),
        Text('AMOUNT (USDT)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: _M.text3)),
        const SizedBox(height: 6),
        _AmountField(controller: amountCtrl, hint: '0.0000'),
        const SizedBox(height: 12),
        _PctShortcuts(
          accent: accent,
          onPick: (pct) {
            final maxQty = _maxUsdtQuantity;
            if (maxQty <= 0) return;
            if (pct >= 100) {
              amountCtrl.text = _M.usdt4(maxQty);
            } else {
              amountCtrl.text = _M.usdt4(maxQty * pct / 100);
            }
          },
        ),
        const SizedBox(height: 14),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Est. Total', style: TextStyle(fontSize: 13, color: _M.text2)),
            Text(
              _estTotal > 0 ? _M.inr(_estTotal) : '—',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _ActionBtn(isBuy: isBuy, onTap: onSubmit),
      ],
    );
  }
}

class _BuySellTabs extends StatelessWidget {
  const _BuySellTabs({required this.isBuy, required this.onChanged});

  final bool isBuy;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _SideTab(label: 'BUY', selected: isBuy, color: _M.buy, onTap: () => onChanged(true))),
        Expanded(child: _SideTab(label: 'SELL', selected: !isBuy, color: _M.sell, onTap: () => onChanged(false))),
      ],
    );
  }
}

class _SideTab extends StatelessWidget {
  const _SideTab({required this.label, required this.selected, required this.color, required this.onTap});

  final String label;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      behavior: HitTestBehavior.opaque,
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
              color: selected ? color : _M.text3,
            ),
          ),
          const SizedBox(height: 8),
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            height: 3,
            decoration: BoxDecoration(
              color: selected ? color : Colors.transparent,
              borderRadius: BorderRadius.circular(99),
              boxShadow: selected ? [BoxShadow(color: color.withValues(alpha: 0.5), blurRadius: 8)] : null,
            ),
          ),
        ],
      ),
    );
  }
}

class _MarketLimitPills extends StatelessWidget {
  const _MarketLimitPills({required this.isLimit, required this.accent, required this.onChanged});

  final bool isLimit;
  final Color accent;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _Pill(label: 'MARKET', selected: !isLimit, accent: accent, onTap: () => onChanged(false)),
        const SizedBox(width: 8),
        _Pill(label: 'LIMIT', selected: isLimit, accent: accent, onTap: () => onChanged(true)),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.selected, required this.accent, required this.onTap});

  final String label;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: selected ? accent : _M.line, width: selected ? 1.2 : 1),
          color: selected ? accent.withValues(alpha: 0.08) : Colors.transparent,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.4,
            color: selected ? accent : _M.text3,
          ),
        ),
      ),
    );
  }
}

class _AmountField extends StatelessWidget {
  const _AmountField({required this.controller, required this.hint});

  final TextEditingController controller;
  final String hint;

  static ThemeData _theme(BuildContext context) => Theme.of(context).copyWith(
        splashFactory: NoSplash.splashFactory,
        highlightColor: Colors.transparent,
        splashColor: Colors.transparent,
        colorScheme: Theme.of(context).colorScheme.copyWith(primary: _M.buy),
        textSelectionTheme: TextSelectionThemeData(
          cursorColor: _M.buy,
          selectionColor: _M.buy.withValues(alpha: 0.28),
          selectionHandleColor: _M.buy,
        ),
        inputDecorationTheme: const InputDecorationTheme(
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          filled: false,
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: _theme(context),
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: _M.input,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _M.line),
        ),
        alignment: Alignment.centerLeft,
        child: TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600, fontFeatures: [FontFeature.tabularFigures()]),
          cursorColor: _M.buy,
          decoration: InputDecoration(
            isDense: true,
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            hintText: hint,
            hintStyle: TextStyle(color: _M.text3.withValues(alpha: 0.6), fontSize: 16),
          ),
        ),
      ),
    );
  }
}

class _PctShortcuts extends StatelessWidget {
  const _PctShortcuts({required this.accent, required this.onPick});

  final Color accent;
  final ValueChanged<double> onPick;

  @override
  Widget build(BuildContext context) {
    final items = [('25%', 25.0), ('50%', 50.0), ('75%', 75.0), ('MAX', 100.0)];
    return Row(
      children: items.map((e) {
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: e.$2 == 100.0 ? 0 : 8),
            child: GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                onPick(e.$2);
              },
              child: Container(
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: accent.withValues(alpha: 0.45)),
                ),
                child: Text(
                  e.$1,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: accent),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({required this.isBuy, required this.onTap});

  final bool isBuy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.mediumImpact();
          onTap();
        },
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          height: AppSpacing.buttonHeight,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.md),
            gradient: LinearGradient(
              colors: isBuy
                  ? [AppColors.authGreenDark, _M.buy, AppColors.authGreenLight.withValues(alpha: 0.92)]
                  : [_M.sell.withValues(alpha: 0.85), _M.sell],
            ),
            boxShadow: AppDesk.accentGlow(isBuy ? _M.buy : _M.sell, alpha: 0.1),
          ),
          child: Center(
            child: Text(
              isBuy ? 'BUY USDT' : 'SELL USDT',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 0.6),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Order book + orders tabs ─────────────────────────────────────────────────

enum MarketsOrdersTab { orderBook, openOrders, orderHistory }

class MarketsOrdersPanel extends StatelessWidget {
  const MarketsOrdersPanel({
    required this.tab,
    required this.onTabChanged,
    required this.midPrice,
    required this.asks,
    required this.bids,
    required this.openOrders,
    required this.orderHistory,
    required this.onCancelOrder,
    super.key,
  });

  final MarketsOrdersTab tab;
  final ValueChanged<MarketsOrdersTab> onTabChanged;
  final double midPrice;
  final List<OrderBookRow> asks;
  final List<OrderBookRow> bids;
  final List<SpotOrder> openOrders;
  final List<SpotOrder> orderHistory;
  final ValueChanged<String> onCancelOrder;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _OrdersTabBar(tab: tab, openCount: openOrders.length, onChanged: onTabChanged),
        const SizedBox(height: 14),
        switch (tab) {
          MarketsOrdersTab.orderBook => MarketsOrderBook(midPrice: midPrice, asks: asks, bids: bids),
          MarketsOrdersTab.openOrders => MarketsOpenOrdersList(orders: openOrders, onCancel: onCancelOrder),
          MarketsOrdersTab.orderHistory => MarketsOrderHistoryList(orders: orderHistory),
        },
      ],
    );
  }
}

class _OrdersTabBar extends StatelessWidget {
  const _OrdersTabBar({
    required this.tab,
    required this.openCount,
    required this.onChanged,
  });

  final MarketsOrdersTab tab;
  final int openCount;
  final ValueChanged<MarketsOrdersTab> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _TabChip(
          label: 'Order Book',
          selected: tab == MarketsOrdersTab.orderBook,
          onTap: () => onChanged(MarketsOrdersTab.orderBook),
        ),
        const SizedBox(width: 8),
        _TabChip(
          label: 'Open Orders',
          selected: tab == MarketsOrdersTab.openOrders,
          badge: openCount > 0 ? '$openCount' : null,
          onTap: () => onChanged(MarketsOrdersTab.openOrders),
        ),
        const SizedBox(width: 8),
        _TabChip(
          label: 'History',
          selected: tab == MarketsOrdersTab.orderHistory,
          onTap: () => onChanged(MarketsOrdersTab.orderHistory),
        ),
      ],
    );
  }
}

class _TabChip extends StatelessWidget {
  const _TabChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge,
  });

  final String label;
  final bool selected;
  final String? badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: selected ? _M.buy : _M.line, width: selected ? 1.2 : 1),
          color: selected ? _M.buy.withValues(alpha: 0.1) : Colors.transparent,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: selected ? _M.buy : _M.text3,
              ),
            ),
            if (badge != null) ...[
              const SizedBox(width: 5),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: _M.buy.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(badge!, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: _M.buy)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class MarketsOpenOrdersList extends StatelessWidget {
  const MarketsOpenOrdersList({
    required this.orders,
    required this.onCancel,
    super.key,
  });

  final List<SpotOrder> orders;
  final ValueChanged<String> onCancel;

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return _OrdersEmptyState(
        icon: Icons.pending_actions_outlined,
        title: 'No open orders',
        subtitle: 'Limit orders you place will appear here',
      );
    }

    return Column(
      children: [
        _OrdersTableHeader(cols: const ['Pair', 'Side', 'Price', 'Amount', '']),
        ...orders.map((o) => _OpenOrderRow(order: o, onCancel: () => onCancel(o.id))),
      ],
    );
  }
}

class MarketsOrderHistoryList extends StatelessWidget {
  const MarketsOrderHistoryList({required this.orders, super.key});

  final List<SpotOrder> orders;

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return _OrdersEmptyState(
        icon: Icons.history_rounded,
        title: 'No order history',
        subtitle: 'Filled and cancelled orders show here',
      );
    }

    return Column(
      children: [
        _OrdersTableHeader(cols: const ['Time', 'Side', 'Price', 'Amount', 'Status']),
        ...orders.map((o) => _HistoryOrderRow(order: o)),
      ],
    );
  }
}

class _OrdersTableHeader extends StatelessWidget {
  const _OrdersTableHeader({required this.cols});

  final List<String> cols;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          for (var i = 0; i < cols.length; i++)
            Expanded(
              flex: i == cols.length - 1 ? 2 : 3,
              child: Text(
                cols[i],
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.3, color: _M.text3),
              ),
            ),
        ],
      ),
    );
  }
}

class _OpenOrderRow extends StatelessWidget {
  const _OpenOrderRow({required this.order, required this.onCancel});

  final SpotOrder order;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final sideColor = order.isBuy ? _M.buy : _M.sell;

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: _M.input,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _M.line),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('USDT/INR', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                Text(order.typeLabel, style: TextStyle(fontSize: 9, color: _M.text3)),
              ],
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              order.sideLabel,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: sideColor),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              order.price.toStringAsFixed(2),
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white, fontFeatures: [FontFeature.tabularFigures()]),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              _M.usdt(order.amount),
              style: TextStyle(fontSize: 11, color: _M.text2, fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ),
          Expanded(
            flex: 2,
            child: Align(
              alignment: Alignment.centerRight,
              child: GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  onCancel();
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: _M.sell.withValues(alpha: 0.45)),
                  ),
                  child: Text('Cancel', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: _M.sell.withValues(alpha: 0.95))),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryOrderRow extends StatelessWidget {
  const _HistoryOrderRow({required this.order});

  final SpotOrder order;

  @override
  Widget build(BuildContext context) {
    final sideColor = order.isBuy ? _M.buy : _M.sell;
    final statusColor = switch (order.status) {
      SpotOrderStatus.filled => _M.buy,
      SpotOrderStatus.cancelled => _M.text3,
      SpotOrderStatus.partial => const Color(0xFFFFB74D),
      SpotOrderStatus.open => _M.buy,
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: _M.input,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _M.line),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(order.timeLabel ?? '—', style: TextStyle(fontSize: 10, color: _M.text2)),
          ),
          Expanded(
            flex: 3,
            child: Text(order.sideLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: sideColor)),
          ),
          Expanded(
            flex: 3,
            child: Text(
              (order.filledPrice ?? order.price).toStringAsFixed(2),
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white, fontFeatures: [FontFeature.tabularFigures()]),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              _M.usdt(order.amount),
              style: TextStyle(fontSize: 11, color: _M.text2, fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ),
          Expanded(
            flex: 2,
            child: Align(
              alignment: Alignment.centerRight,
              child: Text(
                order.statusLabel,
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: statusColor),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OrdersEmptyState extends StatelessWidget {
  const _OrdersEmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: Column(
        children: [
          Icon(icon, size: 32, color: _M.text3.withValues(alpha: 0.5)),
          const SizedBox(height: 10),
          Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: _M.text2)),
          const SizedBox(height: 4),
          Text(subtitle, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: _M.text3)),
        ],
      ),
    );
  }
}

// ─── Order book (bottom, full width) ──────────────────────────────────────────

class MarketsOrderBook extends StatelessWidget {
  const MarketsOrderBook({
    required this.midPrice,
    required this.asks,
    required this.bids,
    super.key,
  });

  final double midPrice;
  final List<OrderBookRow> asks;
  final List<OrderBookRow> bids;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text('ORDER BOOK', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: _M.text2)),
            const Spacer(),
            Text('PRICE ₹', style: TextStyle(fontSize: 10, color: _M.text3)),
            const SizedBox(width: 24),
            Text('QTY USDT', style: TextStyle(fontSize: 10, color: _M.text3)),
          ],
        ),
        const SizedBox(height: 12),
        if (asks.isEmpty)
          _EmptySide(label: 'No sell orders')
        else
          ...asks.reversed.map((r) => _BookLine(row: r)),
        _MidDivider(price: midPrice),
        if (bids.isEmpty)
          _EmptySide(label: 'No buy orders')
        else
          ...bids.map((r) => _BookLine(row: r)),
      ],
    );
  }
}

class _EmptySide extends StatelessWidget {
  const _EmptySide({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Center(
        child: Text(label, style: TextStyle(fontSize: 13, color: _M.text3.withValues(alpha: 0.45))),
      ),
    );
  }
}

class _MidDivider extends StatelessWidget {
  const _MidDivider({required this.price});

  final double price;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Text('—', style: TextStyle(fontSize: 14, color: _M.text3)),
          Expanded(
            child: Center(
              child: Text(
                _M.inr(price),
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: _M.buy),
              ),
            ),
          ),
          Text('MID', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _M.text3)),
        ],
      ),
    );
  }
}

class _BookLine extends StatelessWidget {
  const _BookLine({required this.row});

  final OrderBookRow row;

  @override
  Widget build(BuildContext context) {
    final isAsk = row.side == BookSide.ask;
    final color = isAsk ? _M.sell : _M.buy;

    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: SizedBox(
        height: 24,
        child: Stack(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: FractionallySizedBox(
                widthFactor: row.depth * 0.85,
                child: Container(
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: Text(
                    row.price.toStringAsFixed(2),
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color, fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                ),
                Text(
                  _M.usdt(row.amount),
                  style: TextStyle(fontSize: 12, color: _M.text2, fontFeatures: const [FontFeature.tabularFigures()]),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Candle painter ───────────────────────────────────────────────────────────

class _MarketsCandlePainter extends CustomPainter {
  _MarketsCandlePainter({required this.candles, required this.currentPrice});

  final List<Candle> candles;
  final double currentPrice;

  @override
  void paint(Canvas canvas, Size size) {
    if (candles.isEmpty) return;

    const axisW = 54.0;
    const bottomPad = 18.0;
    final chartRect = Rect.fromLTWH(6, 8, size.width - axisW - 10, size.height - bottomPad - 8);

    final maxY = candles.map((c) => c.high).reduce(math.max);
    final minY = candles.map((c) => c.low).reduce(math.min);
    final pad = (maxY - minY) * 0.12;
    final hi = maxY + pad;
    final lo = minY - pad;
    final range = hi - lo;

    double yOf(double p) => chartRect.bottom - ((p - lo) / range) * chartRect.height;

    // Grid + Y-axis price labels
    final gridPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.06)
      ..strokeWidth = 0.5;
    final labelStyle = TextStyle(color: _M.text3, fontSize: 9, fontWeight: FontWeight.w500);
    final tp = TextPainter(textDirection: ui.TextDirection.ltr);

    for (var i = 0; i <= 4; i++) {
      final y = chartRect.top + chartRect.height * i / 4;
      canvas.drawLine(Offset(chartRect.left, y), Offset(chartRect.right, y), gridPaint);

      final price = hi - range * i / 4;
      tp.text = TextSpan(text: price.toStringAsFixed(2), style: labelStyle);
      tp.layout();
      tp.paint(canvas, Offset(chartRect.right + 6, y - tp.height / 2));
    }

    // Candles
    final gap = chartRect.width / candles.length;
    final bodyW = gap * 0.55;

    for (var i = 0; i < candles.length; i++) {
      final c = candles[i];
      final x = chartRect.left + gap * i + gap / 2;
      final bull = c.close >= c.open;
      final color = bull ? _M.buy : _M.sell;

      canvas.drawLine(
        Offset(x, yOf(c.high)),
        Offset(x, yOf(c.low)),
        Paint()..color = color.withValues(alpha: 0.9)..strokeWidth = 1.1,
      );
      final top = yOf(bull ? c.close : c.open);
      final bot = yOf(bull ? c.open : c.close);
      final h = (bot - top).abs().clamp(2.0, chartRect.height);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset(x, (top + bot) / 2), width: bodyW, height: h),
          const Radius.circular(1.2),
        ),
        Paint()..color = color,
      );
    }

    // Live price line + badge on axis
    final priceY = yOf(currentPrice).clamp(chartRect.top, chartRect.bottom);
    final dashPaint = Paint()
      ..color = _M.buy.withValues(alpha: 0.7)
      ..strokeWidth = 1;
    _drawDashedLine(canvas, Offset(chartRect.left, priceY), Offset(chartRect.right, priceY), dashPaint);

    final badgeRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(chartRect.right + 2, priceY - 9, axisW - 4, 18),
      const Radius.circular(3),
    );
    canvas.drawRRect(badgeRect, Paint()..color = _M.buy);
    tp.text = TextSpan(
      text: currentPrice.toStringAsFixed(2),
      style: const TextStyle(color: Colors.black, fontSize: 9, fontWeight: FontWeight.w800),
    );
    tp.layout();
    tp.paint(
      canvas,
      Offset(badgeRect.left + (badgeRect.width - tp.width) / 2, badgeRect.top + (badgeRect.height - tp.height) / 2),
    );

    // X-axis time labels (first, mid, last)
    if (candles.length >= 2) {
      final timeStyle = TextStyle(color: _M.text3.withValues(alpha: 0.7), fontSize: 8);
      final indices = [0, candles.length ~/ 2, candles.length - 1];
      for (final i in indices) {
        final x = chartRect.left + gap * i + gap / 2;
        final t = candles[i].timestamp;
        final label = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
        tp.text = TextSpan(text: label, style: timeStyle);
        tp.layout();
        tp.paint(canvas, Offset(x - tp.width / 2, chartRect.bottom + 4));
      }
    }
  }

  void _drawDashedLine(Canvas canvas, Offset start, Offset end, Paint paint) {
    const dash = 4.0;
    const gap = 3.0;
    final dx = end.dx - start.dx;
    final dy = end.dy - start.dy;
    final len = math.sqrt(dx * dx + dy * dy);
    if (len == 0) return;
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
  bool shouldRepaint(covariant _MarketsCandlePainter old) =>
      old.candles != candles || old.currentPrice != currentPrice;
}
