enum EventImpact { high, medium, low }

class EconomicEvent {
  const EconomicEvent({
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

  final String id;
  final String timeLabel;
  final DateTime eventAt;
  final String currency;
  final String flag;
  final String title;
  final String forecast;
  final String previous;
  final EventImpact impact;

  Duration get countdown => eventAt.difference(DateTime.now());

  String get countdownLabel {
    final d = countdown;
    if (d.isNegative) return 'Released';
    if (d.inDays > 0) return '${d.inDays}d ${d.inHours.remainder(24)}h';
    if (d.inHours > 0) return '${d.inHours}h ${d.inMinutes.remainder(60)}m';
    return '${d.inMinutes}m';
  }

  DateTime get dayKey => DateTime(eventAt.year, eventAt.month, eventAt.day);
}

class MarketInsightsSnapshot {
  const MarketInsightsSnapshot({
    required this.highImpactWeek,
    required this.upcomingHigh,
    required this.eventsToday,
    required this.currencies,
    required this.events,
  });

  final int highImpactWeek;
  final int upcomingHigh;
  final int eventsToday;
  final List<String> currencies;
  final List<EconomicEvent> events;
}
