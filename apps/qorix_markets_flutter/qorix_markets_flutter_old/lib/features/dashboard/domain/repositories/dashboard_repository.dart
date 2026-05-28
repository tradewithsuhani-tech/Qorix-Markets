import 'package:qorix_markets_flutter/features/dashboard/domain/entities/dashboard_snapshot.dart';

abstract interface class DashboardRepository {
  Future<DashboardSnapshot> getSnapshot();
}
