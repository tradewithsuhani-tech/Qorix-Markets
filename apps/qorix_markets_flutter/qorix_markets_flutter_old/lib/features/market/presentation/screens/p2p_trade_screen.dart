import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';

import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/market/application/p2p_flow_provider.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/p2p_demo.dart';
import 'package:qorix_markets_flutter/features/market/presentation/widgets/p2p_filter_sheets.dart';
import 'package:qorix_markets_flutter/features/market/presentation/widgets/p2p_place_order_sheet.dart';
import 'package:qorix_markets_flutter/features/market/presentation/widgets/p2p_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

class P2pTradeScreen extends ConsumerWidget {
  const P2pTradeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final flow = ref.watch(p2pFlowProvider);
    final filter = flow.filter;
    final offers = flow.filteredOffers;
    final processingCount = flow.processingCount;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      floatingActionButton: P2pChatFab(
        onTap: () => context.push(RoutePaths.p2pOrders),
        badge: processingCount > 0 ? processingCount : null,
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
              child: P2pAppBar(
                onBack: () => safePop(context),
                onOrders: () => context.push(RoutePaths.p2pOrders),
                pendingOrders: processingCount,
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: P2pBalanceRow(
                usdtBalance: flow.walletBalance,
                onRefresh: () => ref.read(p2pFlowProvider.notifier).refreshAll(),
                onPostAd: () => context.push(RoutePaths.p2pPostAd),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: P2pQuickLinks(
                onOrders: () => context.push(RoutePaths.p2pOrders),
                onUserCenter: () => context.push(RoutePaths.p2pUserCenter),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: P2pBuySellTabs(
                isBuy: filter.isBuy,
                onChanged: ref.read(p2pFlowProvider.notifier).setBuySide,
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: P2pPaymentFilters(
                filters: P2pDemo.paymentFilters,
                selected: filter.payment,
                onSelected: ref.read(p2pFlowProvider.notifier).setPaymentFilter,
                onFilterTap: () async {
                  final amt = await showP2pAmountFilterSheet(context, current: filter.amountInr);
                  if (amt == null) return;
                  if (amt < 0) {
                    ref.read(p2pFlowProvider.notifier).setAmountFilter(null);
                  } else {
                    ref.read(p2pFlowProvider.notifier).setAmountFilter(amt);
                  }
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: P2pMarketToolbar(
                offerCount: offers.length,
                sortLabel: P2pDemo.sortLabels[filter.sort]!,
                amountFilter: filter.amountInr,
                onSort: () async {
                  final sort = await showP2pSortSheet(context, current: filter.sort);
                  if (sort != null) ref.read(p2pFlowProvider.notifier).setSort(sort);
                },
                onAmount: () async {
                  final amt = await showP2pAmountFilterSheet(context, current: filter.amountInr);
                  if (amt == null) return;
                  if (amt < 0) {
                    ref.read(p2pFlowProvider.notifier).setAmountFilter(null);
                  } else {
                    ref.read(p2pFlowProvider.notifier).setAmountFilter(amt);
                  }
                },
                onClearAmount: filter.amountInr != null
                    ? () => ref.read(p2pFlowProvider.notifier).setAmountFilter(null)
                    : null,
              ),
            ),
            const SizedBox(height: 4),
            Expanded(
              child: flow.isLoading && offers.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : offers.isEmpty
                  ? Center(
                      child: Text(
                        'No ads match your filters',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.45), fontSize: 13),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, Responsive.bottomNavClearance),
                      itemCount: offers.length,
                      separatorBuilder: (_, __) => Divider(height: 1, thickness: 1, color: Colors.white.withValues(alpha: 0.06)),
                      itemBuilder: (_, i) => P2pOfferRow(
                        offer: offers[i],
                        isBuy: filter.isBuy,
                        onTrade: () => showP2pPlaceOrderSheet(context, offer: offers[i], isBuy: filter.isBuy),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
