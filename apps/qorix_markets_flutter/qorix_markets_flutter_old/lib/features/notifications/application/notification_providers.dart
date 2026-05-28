import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/notifications/domain/entities/notification_entity.dart';
import 'package:qorix_markets_flutter/features/notifications/infrastructure/notification_repository_impl.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';

final notificationsProvider =
    AsyncNotifierProvider<NotificationsNotifier, List<NotificationEntity>>(NotificationsNotifier.new);

final unreadNotificationsCountProvider = Provider<int>((ref) {
  final list = ref.watch(notificationsProvider).valueOrNull;
  if (list == null) return 0;
  return list.where((n) => !n.isRead).length;
});

class NotificationsNotifier extends AsyncNotifier<List<NotificationEntity>>
    with CachedAsyncMixin<List<NotificationEntity>> {
  @override
  Future<List<NotificationEntity>> build() async {
    ref.keepAlive();
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.notifications();
      cacheValue(data);
      return data;
    }
    final data = await ref.read(notificationRepositoryProvider).getNotifications();
    cacheValue(data);
    return data;
  }

  Future<void> refresh() {
    if (UiDemoMode.isActive) {
      final data = UiDemoFixtures.notifications();
      cacheValue(data);
      state = AsyncData(data);
      return Future.value();
    }
    return softRefresh(() => ref.read(notificationRepositoryProvider).getNotifications());
  }

  Future<void> markAllRead() async {
    if (UiDemoMode.isActive || UiDemoMode.blocksWriteApi) {
      final current = cachedValue ?? state.valueOrNull ?? UiDemoFixtures.notifications();
      final updated = current
          .map((n) => NotificationEntity(
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                isRead: true,
                createdAt: n.createdAt,
              ))
          .toList();
      cacheValue(updated);
      state = AsyncData(updated);
      return;
    }
    await ref.read(notificationRepositoryProvider).markAllRead();
    final current = cachedValue ?? [];
    cacheValue(current.map((n) => NotificationEntity(
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          isRead: true,
          createdAt: n.createdAt,
        )).toList());
    state = AsyncData(cachedValue!);
  }
}
