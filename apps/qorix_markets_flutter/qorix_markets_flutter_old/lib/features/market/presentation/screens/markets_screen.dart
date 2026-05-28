import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/live_candle_engine.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/features/market/application/markets_balance_provider.dart';
import 'package:qorix_markets_flutter/features/market/application/spot_orders_provider.dart';
import 'package:qorix_markets_flutter/features/market/application/markets_read_providers.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/markets_demo.dart';
import 'package:qorix_markets_flutter/features/market/presentation/widgets/markets_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/widgets/desk_scroll.dart';

/// USDT/INR internal market — easy buy/sell first layout.
class MarketsScreen extends ConsumerStatefulWidget {
  const MarketsScreen({super.key});

  @override
  ConsumerState<MarketsScreen> createState() => _MarketsScreenState();
}

class _MarketsScreenState extends ConsumerState<MarketsScreen> with SingleTickerProviderStateMixin {
  late final LiveCandleEngine _engine;
  Ticker? _ticker;
  Duration _elapsed = Duration.zero;

  late final TextEditingController _priceCtrl;
  late final TextEditingController _amountCtrl;

  bool _isBuy = true;
  bool _isLimit = false;
  String _timeframe = '1m';
  MarketsOrdersTab _ordersTab = MarketsOrdersTab.orderBook;

  static const _tickEvery = Duration(milliseconds: 800);
  static const _bg = AppDesk.bg;
  static const _scrollPhysics = AppScroll.page;

  @override
  void initState() {
    super.initState();
    _engine = LiveCandleEngine(basePrice: MarketsDemo.baseInr, maxCandles: 36)..seed();
    _priceCtrl = TextEditingController(text: _engine.currentPrice.toStringAsFixed(2));
    _amountCtrl = TextEditingController();
    if (UiDemoMode.isActive) {
      _ticker = createTicker(_onTick)..start();
    }
  }

  void _onTick(Duration elapsed) {
    if (elapsed - _elapsed < _tickEvery) return;
    _elapsed = elapsed;
    setState(() {
      _engine.tick();
      if (_isLimit) {
        _priceCtrl.text = _engine.currentPrice.toStringAsFixed(2);
      }
    });
  }

  @override
  void dispose() {
    _ticker?.dispose();
    _priceCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitOrder() async {
    final amt = double.tryParse(_amountCtrl.text) ?? 0;
    if (amt < 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Minimum order is 1 USDT'), behavior: SnackBarBehavior.floating),
      );
      return;
    }

    final livePrice = UiDemoMode.isActive ? _engine.currentPrice : ref.read(marketsStableTickerPriceProvider);
    final price = _isLimit ? (double.tryParse(_priceCtrl.text) ?? livePrice) : livePrice;
    final side = _isBuy ? 'Buy' : 'Sell';

    try {
      await ref.read(spotOrdersProvider.notifier).placeOrder(
            isBuy: _isBuy,
            isLimit: _isLimit,
            quantity: amt,
            price: price,
          );
      if (!mounted) return;
      setState(() {
        _ordersTab = _isLimit ? MarketsOrdersTab.openOrders : MarketsOrdersTab.orderHistory;
        _amountCtrl.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isLimit ? '$side limit order placed' : '$side $amt USDT filled'),
          backgroundColor: AppColors.authCardBg,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorMessage.brief(e)), behavior: SnackBarBehavior.floating),
      );
    }
  }

  Future<void> _cancelOrder(String id) async {
    try {
      await ref.read(spotOrdersProvider.notifier).cancelOrder(id);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorMessage.brief(e)), behavior: SnackBarBehavior.floating),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final displayPrice = UiDemoMode.isActive ? _engine.currentPrice : ref.watch(marketsStableTickerPriceProvider);
    final balanceAsync = ref.watch(marketsBalanceProvider);
    final balance = balanceAsync.valueOrNull ?? marketsBalanceFallback(displayPrice);
    final high24h = ref.watch(marketsTickerHighProvider);
    final low24h = ref.watch(marketsTickerLowProvider);
    final orderBookAsync = ref.watch(marketsOrderBookProvider);
    final liveBook = orderBookAsync.valueOrNull ?? buildSyntheticOrderBook(displayPrice);
    final spotOrders = ref.watch(spotOrdersProvider);

    final price = UiDemoMode.isActive ? _engine.currentPrice : displayPrice;
    final chartPrice = price;
    final asks = UiDemoMode.isActive
        ? MarketsDemo.asks(price)
        : marketsOrderBookRows(liveBook.asks, BookSide.ask);
    final bids = UiDemoMode.isActive
        ? MarketsDemo.bids(price)
        : marketsOrderBookRows(liveBook.bids, BookSide.bid);

    return Theme(
      data: Theme.of(context).copyWith(
        splashFactory: NoSplash.splashFactory,
        highlightColor: Colors.transparent,
        colorScheme: Theme.of(context).colorScheme.copyWith(primary: AppColors.authGreen),
        textSelectionTheme: TextSelectionThemeData(
          cursorColor: AppColors.authGreen,
          selectionColor: AppColors.authGreen.withValues(alpha: 0.28),
          selectionHandleColor: AppColors.authGreen,
        ),
      ),
      child: ColoredBox(
        color: _bg,
        child: SafeArea(
          bottom: false,
          child: Responsive.constrained(
            context,
            ListView(
              physics: _scrollPhysics,
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: Responsive.scrollPage(context),
              children: [
                RepaintBoundary(
                  child: MarketsTopBar(
                    price: price,
                    high: UiDemoMode.isActive ? MarketsDemo.high24h : high24h,
                    low: UiDemoMode.isActive ? MarketsDemo.low24h : low24h,
                  ),
                ),
                const SizedBox(height: AppSpacing.sectionGap),
                MarketsChartPanel(
                  candles: _engine.candles,
                  currentPrice: chartPrice,
                  timeframe: _timeframe,
                  onTimeframe: (tf) => setState(() => _timeframe = tf),
                ),
                const SizedBox(height: AppSpacing.sectionGap),
                MarketsTradePanel(
                  isBuy: _isBuy,
                  isLimit: _isLimit,
                  price: price,
                  amountCtrl: _amountCtrl,
                  priceCtrl: _priceCtrl,
                  availableUsdt: balance.usdtBalance,
                  availableInr: balance.inrBalance,
                  onSideChanged: (v) => setState(() => _isBuy = v),
                  onTypeChanged: (v) => setState(() => _isLimit = v),
                  onSubmit: _submitOrder,
                  onAddFunds: () => context.push(RoutePaths.deposit),
                ),
                const SizedBox(height: AppSpacing.sectionGap),
                MarketsOrdersPanel(
                  tab: _ordersTab,
                  onTabChanged: (t) => setState(() => _ordersTab = t),
                  midPrice: price,
                  asks: asks,
                  bids: bids,
                  openOrders: spotOrders.openOrders,
                  orderHistory: spotOrders.orderHistory,
                  onCancelOrder: _cancelOrder,
                ),
                const NavScrollSpacer(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
