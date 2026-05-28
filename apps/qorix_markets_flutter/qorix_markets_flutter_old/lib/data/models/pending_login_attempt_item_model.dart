import 'package:qorix_markets_flutter/core/network/api_json.dart';

/// Row from GET /api/auth/login-attempts/pending.
class PendingLoginAttemptItemModel {
  const PendingLoginAttemptItemModel({
    required this.id,
    this.ip,
    this.browser,
    this.os,
    required this.createdAt,
    required this.expiresAt,
  });

  factory PendingLoginAttemptItemModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return PendingLoginAttemptItemModel(
      id: ApiJson.asInt(root['id']),
      ip: root['ip'] as String?,
      browser: root['browser'] as String?,
      os: root['os'] as String?,
      createdAt: DateTime.tryParse(root['createdAt'] as String? ?? '') ?? DateTime.now(),
      expiresAt: DateTime.tryParse(root['expiresAt'] as String? ?? '') ?? DateTime.now(),
    );
  }

  final int id;
  final String? ip;
  final String? browser;
  final String? os;
  final DateTime createdAt;
  final DateTime expiresAt;

  String get deviceLabel {
    final parts = <String>[
      if (browser != null && browser!.isNotEmpty) browser!,
      if (os != null && os!.isNotEmpty) os!,
    ];
    if (parts.isEmpty) return 'Unknown device';
    return parts.join(' · ');
  }

  String? get locationHint {
    if (ip == null || ip!.isEmpty) return null;
    return 'IP $ip';
  }
}
