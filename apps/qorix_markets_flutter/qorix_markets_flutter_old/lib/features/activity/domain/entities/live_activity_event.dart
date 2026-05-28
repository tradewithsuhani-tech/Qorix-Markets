import 'package:equatable/equatable.dart';

enum LiveActivityKind { profit, capital, deployment, platform }

class LiveActivityEvent extends Equatable {
  const LiveActivityEvent({
    required this.id,
    required this.kind,
    required this.headline,
    required this.detail,
    required this.occurredAt,
    this.amount,
  });

  final String id;
  final LiveActivityKind kind;
  final String headline;
  final String detail;
  final DateTime occurredAt;
  final double? amount;

  @override
  List<Object?> get props => [id, kind, headline, detail, occurredAt, amount];
}
