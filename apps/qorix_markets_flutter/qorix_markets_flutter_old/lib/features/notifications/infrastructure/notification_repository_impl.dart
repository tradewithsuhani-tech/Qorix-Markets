import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/features/notifications/domain/entities/notification_entity.dart';
import 'package:qorix_markets_flutter/features/notifications/domain/repositories/notification_repository.dart';
import 'package:qorix_markets_flutter/services/api/notifications_api_service.dart';

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  return NotificationRepositoryImpl(ref.watch(notificationsApiServiceProvider));
});

class NotificationRepositoryImpl implements NotificationRepository {
  NotificationRepositoryImpl(this._api);
  final NotificationsApiService _api;

  @override
  Future<List<NotificationEntity>> fetch() => getNotifications();

  @override
  Future<List<NotificationEntity>> getNotifications() async {
    try {
      final result = await _api.getNotifications();
      return result.notifications.map((m) => m.toEntity()).toList();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> markAllRead() async {
    try {
      await _api.markAllRead();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }
}
