import 'package:equatable/equatable.dart';

class Candle extends Equatable {
  Candle({
    required this.open,
    required this.high,
    required this.low,
    required this.close,
    DateTime? timestamp,
    DateTime? time,
  }) : timestamp = timestamp ?? time ?? DateTime.now();

  final double open;
  final double high;
  final double low;
  final double close;
  final DateTime timestamp;

  DateTime get time => timestamp;

  @override
  List<Object?> get props => [open, high, low, close, timestamp];
}
