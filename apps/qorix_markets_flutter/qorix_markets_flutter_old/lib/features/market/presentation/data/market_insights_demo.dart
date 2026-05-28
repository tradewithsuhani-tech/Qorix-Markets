import 'package:qorix_markets_flutter/features/market/domain/entities/market_insights_entities.dart';
import 'package:qorix_markets_flutter/features/market/domain/market_calendar_mapper.dart';

/// Demo economic calendar data (UI preview).
abstract final class MarketInsightsDemo {
  static const currencies = ['All', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'NZD'];

  static const weekHighImpact = 11;
  static const upcomingHigh = 11;
  static const eventsToday = 8;

  static MarketInsightsSnapshot snapshot() => MarketInsightsSnapshot(
        highImpactWeek: weekHighImpact,
        upcomingHigh: upcomingHigh,
        eventsToday: eventsToday,
        currencies: currencies,
        events: allEvents,
      );

  static List<EconomicEvent> get allEvents => [
        ...todayEvents,
        ...tomorrowEvents,
      ];

  static final todayEvents = [
    EconomicEvent(
      id: 'e1',
      timeLabel: '08:30',
      eventAt: _todayAt(8, 30),
      currency: 'USD',
      flag: '🇺🇸',
      title: 'Core CPI (MoM)',
      forecast: '0.3%',
      previous: '0.4%',
      impact: EventImpact.high,
    ),
    EconomicEvent(
      id: 'e2',
      timeLabel: '08:30',
      eventAt: _todayAt(8, 30),
      currency: 'USD',
      flag: '🇺🇸',
      title: 'Philadelphia Fed Manufacturing Index',
      forecast: '20.0',
      previous: '20.8',
      impact: EventImpact.medium,
    ),
    EconomicEvent(
      id: 'e3',
      timeLabel: '09:00',
      eventAt: _todayAt(9, 0),
      currency: 'USD',
      flag: '🇺🇸',
      title: 'Initial Jobless Claims',
      forecast: '218K',
      previous: '215K',
      impact: EventImpact.high,
    ),
    EconomicEvent(
      id: 'e4',
      timeLabel: '10:00',
      eventAt: _todayAt(10, 0),
      currency: 'USD',
      flag: '🇺🇸',
      title: 'Existing Home Sales',
      forecast: '4100K',
      previous: '4000K',
      impact: EventImpact.medium,
    ),
    EconomicEvent(
      id: 'e5',
      timeLabel: '11:45',
      eventAt: _todayAt(11, 45),
      currency: 'EUR',
      flag: '🇪🇺',
      title: 'ECB Interest Rate Decision',
      forecast: '4.50%',
      previous: '4.25%',
      impact: EventImpact.high,
    ),
    EconomicEvent(
      id: 'e6',
      timeLabel: '12:30',
      eventAt: _todayAt(12, 30),
      currency: 'EUR',
      flag: '🇪🇺',
      title: 'ECB Press Conference',
      forecast: '—',
      previous: '—',
      impact: EventImpact.high,
    ),
    EconomicEvent(
      id: 'e7',
      timeLabel: '14:00',
      eventAt: _todayAt(14, 0),
      currency: 'USD',
      flag: '🇺🇸',
      title: 'CB Consumer Confidence',
      forecast: '102.0',
      previous: '100.1',
      impact: EventImpact.low,
    ),
    EconomicEvent(
      id: 'e8',
      timeLabel: '15:30',
      eventAt: _todayAt(15, 30),
      currency: 'USD',
      flag: '🇺🇸',
      title: 'Crude Oil Inventories',
      forecast: '-2.5M',
      previous: '-3.8M',
      impact: EventImpact.low,
    ),
  ];

  static final tomorrowEvents = [
    EconomicEvent(
      id: 'e9',
      timeLabel: '07:00',
      eventAt: _tomorrowAt(7, 0),
      currency: 'GBP',
      flag: '🇬🇧',
      title: 'Retail Sales (MoM)',
      forecast: '0.2%',
      previous: '-0.4%',
      impact: EventImpact.high,
    ),
    EconomicEvent(
      id: 'e10',
      timeLabel: '09:30',
      eventAt: _tomorrowAt(9, 30),
      currency: 'USD',
      flag: '🇺🇸',
      title: 'GDP (QoQ) Advance',
      forecast: '2.1%',
      previous: '1.9%',
      impact: EventImpact.high,
    ),
    EconomicEvent(
      id: 'e11',
      timeLabel: '13:30',
      eventAt: _tomorrowAt(13, 30),
      currency: 'CAD',
      flag: '🇨🇦',
      title: 'BoC Rate Statement',
      forecast: '4.75%',
      previous: '4.75%',
      impact: EventImpact.medium,
    ),
  ];

  static DateTime _todayAt(int h, int m) {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day, h, m);
  }

  static DateTime _tomorrowAt(int h, int m) {
    final t = DateTime.now().add(const Duration(days: 1));
    return DateTime(t.year, t.month, t.day, h, m);
  }

  static String dayHeader(DateTime date) => MarketCalendarMapper.dayHeader(date);
}
