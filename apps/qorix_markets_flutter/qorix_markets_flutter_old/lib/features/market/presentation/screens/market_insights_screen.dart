import 'dart:async';

import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';

import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_insights_entities.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/market_insights_demo.dart';
import 'package:qorix_markets_flutter/features/market/presentation/widgets/market_insights_ui.dart';

class MarketInsightsScreen extends StatefulWidget {
  const MarketInsightsScreen({super.key});

  @override
  State<MarketInsightsScreen> createState() => _MarketInsightsScreenState();
}

class _MarketInsightsScreenState extends State<MarketInsightsScreen> {
  String _currency = 'All';
  String _impact = 'All';
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  List<EconomicEvent> get _filtered {
    var list = MarketInsightsDemo.allEvents;
    if (_currency != 'All') {
      list = list.where((e) => e.currency == _currency).toList();
    }
    if (_impact != 'All') {
      final impact = switch (_impact) {
        'High' => EventImpact.high,
        'Medium' => EventImpact.medium,
        'Low' => EventImpact.low,
        _ => null,
      };
      if (impact != null) list = list.where((e) => e.impact == impact).toList();
    }
    list = List<EconomicEvent>.from(list)..sort((a, b) => a.eventAt.compareTo(b.eventAt));
    return list;
  }

  Map<DateTime, List<EconomicEvent>> get _grouped {
    final map = <DateTime, List<EconomicEvent>>{};
    for (final e in _filtered) {
      map.putIfAbsent(e.dayKey, () => []).add(e);
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final grouped = _grouped;
    final days = grouped.keys.toList()..sort();

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
              child: InsightsAppBar(onBack: () => safePop(context)),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, Responsive.bottomNavClearance),
                children: [
                  const InsightsHero(),
                  const SizedBox(height: 16),
                  InsightsStatCards(
                    highImpactWeek: MarketInsightsDemo.weekHighImpact,
                    upcomingHigh: MarketInsightsDemo.upcomingHigh,
                    eventsToday: MarketInsightsDemo.eventsToday,
                  ),
                  const SizedBox(height: 14),
                  InsightsFilterPanel(
                    currencies: MarketInsightsDemo.currencies,
                    selectedCurrency: _currency,
                    selectedImpact: _impact,
                    onCurrency: (c) => setState(() => _currency = c),
                    onImpact: (i) => setState(() => _impact = i),
                  ),
                  const SizedBox(height: 8),
                  if (days.isEmpty)
                    const InsightsEmptyState()
                  else
                    for (final day in days) ...[
                      InsightsDayHeader(
                        title: MarketInsightsDemo.dayHeader(day),
                        highCount: grouped[day]!.where((e) => e.impact == EventImpact.high).length,
                        totalCount: grouped[day]!.length,
                      ),
                      ...grouped[day]!.map((e) => InsightsEventRow(event: e)),
                    ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
