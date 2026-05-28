import 'package:intl/intl.dart';

abstract final class CurrencyFormatter {
  static final _usd = NumberFormat.currency(symbol: r'$', decimalDigits: 2);
  static final _inr = NumberFormat.currency(symbol: '₹', decimalDigits: 0);

  static String usd(num value) => _usd.format(value);
  static String inr(num value) => _inr.format(value);
  static String format(num value, {String? symbol}) {
    if (symbol == '₹' || symbol == 'INR') return inr(value);
    return usd(value);
  }

  static String compact(num value) {
    if (value.abs() >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
    if (value.abs() >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
    return value.toStringAsFixed(2);
  }
}
