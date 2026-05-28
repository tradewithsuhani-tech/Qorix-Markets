import 'package:equatable/equatable.dart';

enum KycStatus { notStarted, pending, verified, rejected }

class KycState extends Equatable {
  const KycState({required this.status, this.detail});
  final KycStatus status;
  final Object? detail;
  @override
  List<Object?> get props => [status, detail];
}
