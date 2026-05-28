import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/utils/app_nav.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/market/application/p2p_flow_provider.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/p2p_entities.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

class P2pOrdersScreen extends ConsumerStatefulWidget {
  const P2pOrdersScreen({super.key});

  @override
  ConsumerState<P2pOrdersScreen> createState() => _P2pOrdersScreenState();
}

class _P2pOrdersScreenState extends ConsumerState<P2pOrdersScreen> with SingleTickerProviderStateMixin {
  late final _tab = TabController(length: 4, vsync: this);

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  List<P2pOrder> _filter(List<P2pOrder> all, int index) => switch (index) {
        0 => all.where((o) => o.status.isProcessing).toList(),
        1 => all,
        2 => all.where((o) => o.status == P2pOrderStatus.completed).toList(),
        3 => all.where((o) => o.status == P2pOrderStatus.cancelled).toList(),
        _ => all,
      };

  @override
  Widget build(BuildContext context) {
    final orders = ref.watch(p2pFlowProvider).orders;
    final inrFmt = NumberFormat('#,##0.00', 'en_IN');

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: BackButton(onPressed: () => safePop(context), color: Colors.white),
        title: const Text('P2P Orders', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        bottom: TabBar(
          controller: _tab,
          isScrollable: true,
          indicatorColor: AppColors.authGreen,
          labelColor: AppColors.authGreen,
          unselectedLabelColor: Colors.white54,
          tabs: const [
            Tab(text: 'Processing'),
            Tab(text: 'All'),
            Tab(text: 'Completed'),
            Tab(text: 'Cancelled'),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(p2pFlowProvider.notifier).refreshAll(),
        color: AppColors.authGreen,
        child: TabBarView(
          controller: _tab,
          children: List.generate(4, (i) {
            final list = _filter(orders, i);
            if (list.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(height: MediaQuery.sizeOf(context).height * 0.25),
                  Center(child: Text('No orders', style: TextStyle(color: Colors.white.withValues(alpha: 0.4)))),
                ],
              );
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, idx) {
              final o = list[idx];
              final accent = o.isBuy ? AppColors.authGreen : const Color(0xFFFF6B8A);
              final statusLabel = o.status.label;
              return Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => context.push('${RoutePaths.p2pOrder}?id=${o.id}'),
                  borderRadius: BorderRadius.circular(12),
                  child: Ink(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF12171C),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 4,
                          height: 44,
                          decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(2)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${o.isBuy ? 'Buy' : 'Sell'} USDT · ${o.offer.merchantName}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                              const SizedBox(height: 4),
                              Text('₹${inrFmt.format(o.amountInr)} · ${o.amountUsdt.toStringAsFixed(2)} USDT', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.5))),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(statusLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: accent)),
                            Text(o.paymentMethod, style: TextStyle(fontSize: 10, color: Colors.white.withValues(alpha: 0.35))),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        }),
        ),
      ),
    );
  }
}
