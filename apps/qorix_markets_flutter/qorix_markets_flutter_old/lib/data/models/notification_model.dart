import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/notifications/domain/entities/notification_entity.dart';

class NotificationModel {
  const NotificationModel({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    final created = root['createdAt'] as String? ?? '';
    return NotificationModel(
      id: '${ApiJson.asInt(root['id'])}',
      type: root['type'] as String? ?? 'general',
      title: root['title'] as String? ?? '',
      message: root['message'] as String? ?? '',
      isRead: root['isRead'] == true,
      createdAt: DateTime.tryParse(created) ?? DateTime.now(),
    );
  }

  final String id;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final DateTime createdAt;

  NotificationEntity toEntity() => NotificationEntity(
        id: id,
        type: type,
        title: title,
        message: message,
        isRead: isRead,
        createdAt: createdAt,
      );
}
