import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_insights_entities.dart';

abstract final class _I {
  static const bg = Color(0xFF0A0E12);
  static const card = Color(0xFF12171C);
  static const cardBorder = Color(0xFF1E2630);

  static Color get muted => Colors.white.withValues(alpha: 0.42);
  static Color get text2 => Colors.white.withValues(alpha: 0.78);

  static const green = AppColors.authGreen;
  static const high = Color(0xFFFF4D6A);
  static const medium = Color(0xFFFBBF24);
  static const low = Color(0xFF60A5FA);

  static Color impactColor(EventImpact i) => switch (i) {
        EventImpact.high => high,
        EventImpact.medium => medium,
        EventImpact.low => low,
      };

  static String impactLabel(EventImpact i) => switch (i) {
        EventImpact.high => 'HIGH',
        EventImpact.medium => 'MED',
        EventImpact.low => 'LOW',
      };
}

// ─── App bar ──────────────────────────────────────────────────────────────────

class InsightsAppBar extends StatelessWidget {
  const InsightsAppBar({required this.onBack, super.key});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Colors.white.withValues(alpha: 0.88)),
            style: IconButton.styleFrom(
              backgroundColor: Colors.white.withValues(alpha: 0.06),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const Expanded(
            child: Text(
              'Market Insights',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: -0.3),
            ),
          ),
          const SizedBox(width: 48),
        ],
      ),
    );
  }
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

class InsightsHero extends StatelessWidget {
  const InsightsHero({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_I.green.withValues(alpha: 0.12), _I.card, _I.card],
        ),
        border: Border.all(color: _I.green.withValues(alpha: 0.24)),
        boxShadow: [BoxShadow(color: _I.green.withValues(alpha: 0.06), blurRadius: 24, offset: const Offset(0, 8))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _I.green.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _I.green.withValues(alpha: 0.28)),
                ),
                child: const Text(
                  'FX MACRO DESK',
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 0.7, color: _I.green),
                ),
              ),
              const Spacer(),
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(colors: [_I.green.withValues(alpha: 0.22), _I.green.withValues(alpha: 0.06)]),
                  border: Border.all(color: _I.green.withValues(alpha: 0.32)),
                ),
                child: Icon(Icons.public_rounded, size: 20, color: _I.green.withValues(alpha: 0.95)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Text(
            'Global economic calendar',
            style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -0.4, height: 1.15),
          ),
          const SizedBox(height: 6),
          Text(
            'Institutional-grade macro events · filtered for FX & gold desk exposure',
            style: TextStyle(fontSize: 12, height: 1.45, color: _I.muted, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}

// ─── Stat cards ───────────────────────────────────────────────────────────────

class InsightsStatCards extends StatelessWidget {
  const InsightsStatCards({
    required this.highImpactWeek,
    required this.upcomingHigh,
    required this.eventsToday,
    super.key,
  });

  final int highImpactWeek;
  final int upcomingHigh;
  final int eventsToday;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _I.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _I.cardBorder),
      ),
      child: Row(
        children: [
          Expanded(child: _StatTile(icon: Icons.warning_amber_rounded, color: _I.high, label: 'High-impact week', value: '$highImpactWeek')),
          Container(width: 1, height: 44, color: Colors.white.withValues(alpha: 0.06)),
          Expanded(child: _StatTile(icon: Icons.schedule_rounded, color: _I.medium, label: 'Upcoming high', value: '$upcomingHigh')),
          Container(width: 1, height: 44, color: Colors.white.withValues(alpha: 0.06)),
          Expanded(child: _StatTile(icon: Icons.calendar_today_rounded, color: _I.green, label: 'Events today', value: '$eventsToday')),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.icon, required this.color, required this.label, required this.value});

  final IconData icon;
  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, size: 16, color: color.withValues(alpha: 0.9)),
        const SizedBox(height: 6),
        Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: color, height: 1)),
        const SizedBox(height: 3),
        Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: _I.muted, height: 1.2)),
      ],
    );
  }
}

// ─── Filters ──────────────────────────────────────────────────────────────────

class InsightsFilterPanel extends StatelessWidget {
  const InsightsFilterPanel({
    required this.currencies,
    required this.selectedCurrency,
    required this.selectedImpact,
    required this.onCurrency,
    required this.onImpact,
    super.key,
  });

  final List<String> currencies;
  final String selectedCurrency;
  final String selectedImpact;
  final ValueChanged<String> onCurrency;
  final ValueChanged<String> onImpact;

  static const impacts = [
    ('All', null),
    ('High', EventImpact.high),
    ('Medium', EventImpact.medium),
    ('Low', EventImpact.low),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _I.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _I.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.tune_rounded, size: 16, color: _I.green.withValues(alpha: 0.85)),
              const SizedBox(width: 8),
              Text('Desk filters', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: _I.text2)),
            ],
          ),
          const SizedBox(height: 14),
          Text('CURRENCY PAIR', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: _I.muted)),
          const SizedBox(height: 8),
          SizedBox(
            height: 34,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: currencies.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) => _FilterChip(
                label: currencies[i],
                active: currencies[i] == selectedCurrency,
                onTap: () {
                  HapticFeedback.selectionClick();
                  onCurrency(currencies[i]);
                },
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text('IMPACT LEVEL', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: _I.muted)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: impacts.map((e) {
              final dot = e.$2;
              return _FilterChip(
                label: e.$1,
                active: e.$1 == selectedImpact,
                dotColor: dot != null ? _I.impactColor(dot) : null,
                onTap: () {
                  HapticFeedback.selectionClick();
                  onImpact(e.$1);
                },
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.active, required this.onTap, this.dotColor});

  final String label;
  final bool active;
  final VoidCallback onTap;
  final Color? dotColor;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: active ? _I.green.withValues(alpha: 0.14) : Colors.white.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: active ? _I.green.withValues(alpha: 0.4) : Colors.white.withValues(alpha: 0.1)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (dotColor != null) ...[
                Container(width: 6, height: 6, decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle)),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: active ? _I.green : _I.text2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Day section ──────────────────────────────────────────────────────────────

class InsightsDayHeader extends StatelessWidget {
  const InsightsDayHeader({
    required this.title,
    required this.highCount,
    required this.totalCount,
    super.key,
  });

  final String title;
  final int highCount;
  final int totalCount;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 10),
      child: Row(
        children: [
          Container(
            width: 3,
            height: 28,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(99),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [_I.green, _I.green.withValues(alpha: 0.2)],
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
                Text('$totalCount macro releases', style: TextStyle(fontSize: 10, color: _I.muted, fontWeight: FontWeight.w500)),
              ],
            ),
          ),
          if (highCount > 0)
            Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: _I.high.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _I.high.withValues(alpha: 0.28)),
              ),
              child: Text('$highCount high', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _I.high)),
            ),
        ],
      ),
    );
  }
}

// ─── Event row ────────────────────────────────────────────────────────────────

class InsightsEventRow extends StatelessWidget {
  const InsightsEventRow({required this.event, super.key});

  final EconomicEvent event;

  @override
  Widget build(BuildContext context) {
    final impact = _I.impactColor(event.impact);
    final released = event.countdown.isNegative;
    final upcoming = !released;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: _I.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: event.impact == EventImpact.high
              ? impact.withValues(alpha: upcoming ? 0.32 : 0.18)
              : _I.cardBorder,
        ),
        boxShadow: event.impact == EventImpact.high && upcoming
            ? [BoxShadow(color: impact.withValues(alpha: 0.06), blurRadius: 16, offset: const Offset(0, 4))]
            : null,
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 3, color: impact.withValues(alpha: upcoming ? 0.9 : 0.45)),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 46,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                event.timeLabel,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                  fontFeatures: const [FontFeature.tabularFigures()],
                                ),
                              ),
                              const SizedBox(height: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: released ? Colors.white.withValues(alpha: 0.06) : _I.green.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(
                                    color: released ? Colors.white.withValues(alpha: 0.08) : _I.green.withValues(alpha: 0.25),
                                  ),
                                ),
                                child: Text(
                                  event.countdownLabel,
                                  style: TextStyle(
                                    fontSize: 8,
                                    fontWeight: FontWeight.w800,
                                    color: released ? _I.muted : _I.green,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.05),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(event.flag, style: const TextStyle(fontSize: 12)),
                                        const SizedBox(width: 4),
                                        Text(
                                          event.currency,
                                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _I.text2, letterSpacing: 0.4),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const Spacer(),
                                  _ImpactBadge(impact: event.impact),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                event.title,
                                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700, height: 1.25),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (event.forecast != '—') ...[
                      const SizedBox(height: 10),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: _I.bg,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
                        ),
                        child: Row(
                          children: [
                            _DataCell(label: 'Forecast', value: event.forecast, accent: _I.green),
                            _DataDivider(),
                            _DataCell(label: 'Previous', value: event.previous, accent: _I.text2),
                            if (released) ...[
                              _DataDivider(),
                              _DataCell(label: 'Status', value: 'Out', accent: _I.muted),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ImpactBadge extends StatelessWidget {
  const _ImpactBadge({required this.impact});

  final EventImpact impact;

  @override
  Widget build(BuildContext context) {
    final color = _I.impactColor(impact);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        _I.impactLabel(impact),
        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: color, letterSpacing: 0.4),
      ),
    );
  }
}

class _DataCell extends StatelessWidget {
  const _DataCell({required this.label, required this.value, required this.accent});

  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, letterSpacing: 0.4, color: _I.muted)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: accent)),
        ],
      ),
    );
  }
}

class _DataDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 28,
      margin: const EdgeInsets.symmetric(horizontal: 10),
      color: Colors.white.withValues(alpha: 0.06),
    );
  }
}

class InsightsEmptyState extends StatelessWidget {
  const InsightsEmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 24),
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 24),
      decoration: BoxDecoration(
        color: _I.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _I.cardBorder),
      ),
      child: Column(
        children: [
          Icon(Icons.event_busy_rounded, size: 32, color: _I.muted),
          const SizedBox(height: 12),
          Text('No events match filters', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: _I.text2)),
          const SizedBox(height: 4),
          Text('Try a different currency or impact level', style: TextStyle(fontSize: 11, color: _I.muted)),
        ],
      ),
    );
  }
}
