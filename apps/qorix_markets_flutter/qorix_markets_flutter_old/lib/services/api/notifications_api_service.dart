import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/notification_model.dart';

final notificationsApiServiceProvider = Provider<NotificationsApiService>((ref) {
  return NotificationsApiService(ref.watch(legacyApiClientProvider));
});

/// GET/PATCH `/api/notifications/*`
class NotificationsApiService {
  const NotificationsApiService(this._client);
  final ApiClient _client;

  Future<NotificationsListResult> getNotifications({int limit = 50}) async {
    final res = await _client.get<Map<String, dynamic>>(
      ApiEndpoints.notifications,
      queryParameters: {'limit': limit.clamp(1, 50)},
    );
    final root = ApiJson.object(res.data);
    final raw = root['notifications'];
    final items = raw is List
        ? raw
            .whereType<Map>()
            .map((e) => NotificationModel.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <NotificationModel>[];
    return NotificationsListResult(
      notifications: items,
      unreadCount: ApiJson.asInt(root['unreadCount']),
    );
  }

  Future<void> markAllRead() async {
    await _client.patch(ApiEndpoints.notificationsReadAll);
  }

  Future<void> markRead(int id) async {
    await _client.patch(ApiEndpoints.notificationRead(id));
  }
}

class NotificationsListResult {
  const NotificationsListResult({
    required this.notifications,
    required this.unreadCount,
  });

  final List<NotificationModel> notifications;
  final int unreadCount;
}
