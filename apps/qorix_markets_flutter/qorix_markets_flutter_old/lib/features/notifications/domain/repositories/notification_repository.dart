import 'package:qorix_markets_flutter/features/notifications/domain/entities/notification_entity.dart';

abstract interface class NotificationRepository {
  Future<List<NotificationEntity>> fetch();
  Future<List<NotificationEntity>> getNotifications();
  Future<void> markAllRead();
}
