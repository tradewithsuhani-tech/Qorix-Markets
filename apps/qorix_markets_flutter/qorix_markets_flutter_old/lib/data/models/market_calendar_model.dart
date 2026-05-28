import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_insights_entities.dart';
import 'package:qorix_markets_flutter/features/market/domain/market_calendar_mapper.dart';

class MarketCalendarEventModel {
  const MarketCalendarEventModel({
    required this.id,
    required this.timeLabel,
    required this.eventAt,
    required this.currency,
    required this.flag,
    required this.title,
    required this.forecast,
    required this.previous,
    required this.impact,
  });

  factory MarketCalendarEventModel.fromJson(Map<String, dynamic> json) {
    final eventAtRaw = json['eventAt'] as String? ?? json['time'] as String? ?? '';
    final parsed = DateTime.tryParse(eventAtRaw);
    final eventAtUtc = parsed != null ? parsed.toUtc() : DateTime.now().toUtc();
    final currency = (json['currency'] as String? ?? 'USD').toUpperCase();
    return MarketCalendarEventModel(
      id: json['id']?.toString() ?? '',
      timeLabel: MarketCalendarMapper.timeLabel(eventAtUtc),
      eventAt: eventAtUtc,
      currency: currency,
      flag: json['flag'] as String? ?? MarketCalendarMapper.flagFor(currency),
      title: json['title'] as String? ?? json['event'] as String? ?? '',
      forecast: json['forecast'] as String? ?? '—',
      previous: json['previous'] as String? ?? '—',
      impact: MarketCalendarMapper.parseImpact(json['impact'] as String?),
    );
  }

  final String id;
  final String timeLabel;
  final DateTime eventAt;
  final String currency;
  final String flag;
  final String title;
  final String forecast;
  final String previous;
  final EventImpact impact;

  EconomicEvent toEntity() {
    final local = eventAt.toLocal();
    return EconomicEvent(
      id: id,
      timeLabel: MarketCalendarMapper.timeLabel(eventAt),
      eventAt: local,
      currency: currency,
      flag: flag,
      title: title,
      forecast: forecast,
      previous: previous,
      impact: impact,
    );
  }
}

class MarketCalendarSummaryModel {
  const MarketCalendarSummaryModel({
    this.highImpactWeek = 0,
    this.upcomingHigh = 0,
    this.eventsToday = 0,
  });

  factory MarketCalendarSummaryModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const MarketCalendarSummaryModel();
    return MarketCalendarSummaryModel(
      highImpactWeek: _asInt(json['highImpactWeek']),
      upcomingHigh: _asInt(json['upcomingHigh']),
      eventsToday: _asInt(json['eventsToday']),
    );
  }

  factory MarketCalendarSummaryModel.fromEvents(List<EconomicEvent> events) {
    final now = DateTime.now();
    final weekEnd = now.add(const Duration(days: 7));
    final todayKey = DateTime(now.year, now.month, now.day);
    var weekHigh = 0;
    var upcomingHigh = 0;
    var today = 0;
    for (final e in events) {
      if (e.impact == EventImpact.high && !e.eventAt.isBefore(now) && e.eventAt.isBefore(weekEnd)) {
        weekHigh++;
      }
      if (e.impact == EventImpact.high && !e.eventAt.isBefore(now)) {
        upcomingHigh++;
      }
      if (e.dayKey == todayKey) today++;
    }
    return MarketCalendarSummaryModel(
      highImpactWeek: weekHigh,
      upcomingHigh: upcomingHigh,
      eventsToday: today,
    );
  }

  final int highImpactWeek;
  final int upcomingHigh;
  final int eventsToday;

  bool get hasCounts => highImpactWeek > 0 || upcomingHigh > 0 || eventsToday > 0;
}

class MarketCalendarModel {
  factory MarketCalendarModel.fromJson(dynamic raw) {
    final data = ApiJson.object(raw);
    final summaryJson = data['summary'] is Map ? Map<String, dynamic>.from(data['summary'] as Map) : data;
    final eventsRaw = data['events'] ?? data['items'];
    final events = eventsRaw is List
        ? eventsRaw
            .whereType<Map>()
            .map((e) => MarketCalendarEventModel.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <MarketCalendarEventModel>[];
    final currenciesRaw = data['currencies'];
    final currencies = currenciesRaw is List
        ? currenciesRaw.map((e) => '$e'.toUpperCase()).toList()
        : MarketCalendarMapper.defaultCurrencies;
    return MarketCalendarModel(
      summary: MarketCalendarSummaryModel.fromJson(summaryJson),
      currencies: currencies,
      events: events,
    );
  }

  const MarketCalendarModel({
    required this.summary,
    required this.currencies,
    required this.events,
  });

  final MarketCalendarSummaryModel summary;
  final List<String> currencies;
  final List<MarketCalendarEventModel> events;

  MarketInsightsSnapshot toSnapshot() {
    final entities = events.map((e) => e.toEntity()).toList()
      ..sort((a, b) => a.eventAt.compareTo(b.eventAt));
    final resolvedSummary =
        summary.hasCounts ? summary : MarketCalendarSummaryModel.fromEvents(entities);
    return MarketInsightsSnapshot(
      highImpactWeek: resolvedSummary.highImpactWeek,
      upcomingHigh: resolvedSummary.upcomingHigh,
      eventsToday: resolvedSummary.eventsToday,
      currencies: ['All', ...currencies.where((c) => c != 'All')],
      events: entities,
    );
  }
}

int _asInt(dynamic v, {int fallback = 0}) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse('$v') ?? fallback;
}
