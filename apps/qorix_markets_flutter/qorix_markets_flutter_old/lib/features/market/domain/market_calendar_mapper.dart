import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/features/market/domain/entities/market_insights_entities.dart';

abstract final class MarketCalendarMapper {
  static const defaultCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'NZD'];

  static const _flags = {
    'USD': '🇺🇸',
    'EUR': '🇪🇺',
    'GBP': '🇬🇧',
    'JPY': '🇯🇵',
    'CAD': '🇨🇦',
    'AUD': '🇦🇺',
    'CHF': '🇨🇭',
    'NZD': '🇳🇿',
    'CNY': '🇨🇳',
    'INR': '🇮🇳',
  };

  static String flagFor(String currency) => _flags[currency.toUpperCase()] ?? '🌐';

  static EventImpact parseImpact(String? raw) => switch (raw?.toLowerCase()) {
        'high' => EventImpact.high,
        'medium' || 'med' => EventImpact.medium,
        _ => EventImpact.low,
      };

  static String timeLabel(DateTime eventAt) => DateFormat('HH:mm').format(eventAt.toLocal());

  static String dayHeader(DateTime date) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = today.add(const Duration(days: 1));
    final key = DateTime(date.year, date.month, date.day);
    final label = switch (key) {
      _ when key == today => 'Today',
      _ when key == tomorrow => 'Tomorrow',
      _ => days[date.weekday - 1],
    };
    return '$label · ${days[date.weekday - 1]} ${date.day} ${months[date.month - 1]}';
  }
}
