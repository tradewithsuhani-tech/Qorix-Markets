import 'package:qorix_markets_flutter/core/network/api_json.dart';

class SupportFaqModel {
  const SupportFaqModel({
    required this.id,
    required this.question,
    required this.answer,
    this.category,
  });

  factory SupportFaqModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return SupportFaqModel(
      id: '${root['id'] ?? root['slug'] ?? ''}',
      question: root['question'] as String? ?? root['title'] as String? ?? '',
      answer: root['answer'] as String? ?? root['body'] as String? ?? '',
      category: root['category'] as String?,
    );
  }

  final String id;
  final String question;
  final String answer;
  final String? category;
}

class SupportContactModel {
  const SupportContactModel({
    this.email = 'support@qorixmarkets.com',
    this.supportHours = '9 AM – 6 PM (Mon–Sat)',
    this.chatEnabled = true,
  });

  factory SupportContactModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return SupportContactModel(
      email: root['email'] as String? ?? 'support@qorixmarkets.com',
      supportHours: root['supportHours'] as String? ?? root['hours'] as String? ?? '9 AM – 6 PM (Mon–Sat)',
      chatEnabled: root['chatEnabled'] as bool? ?? true,
    );
  }

  final String email;
  final String supportHours;
  final bool chatEnabled;
}

class SupportTicketResult {
  const SupportTicketResult({this.id, this.message = 'Ticket submitted'});

  factory SupportTicketResult.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return SupportTicketResult(
      id: root['ticketId']?.toString() ?? root['id']?.toString(),
      message: root['message'] as String? ?? 'Ticket submitted',
    );
  }

  final String? id;
  final String message;
}

class ChatSessionModel {
  const ChatSessionModel({
    required this.id,
    required this.status,
    this.expertRequested = false,
  });

  factory ChatSessionModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    final session = root['session'] is Map ? ApiJson.object(root['session']) : root;
    return ChatSessionModel(
      id: _int(session['id']),
      status: session['status'] as String? ?? 'active',
      expertRequested: session['expertRequested'] as bool? ?? session['status'] == 'expert_requested',
    );
  }

  final int id;
  final String status;
  final bool expertRequested;
}

class ChatMessageModel {
  const ChatMessageModel({
    required this.id,
    required this.senderType,
    required this.content,
    this.createdAt,
  });

  factory ChatMessageModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    final message = root['message'] is Map ? ApiJson.object(root['message']) : root;
    return ChatMessageModel(
      id: _int(message['id']),
      senderType: message['senderType'] as String? ?? 'bot',
      content: message['content'] as String? ?? '',
      createdAt: message['createdAt'] as String?,
    );
  }

  final int id;
  final String senderType;
  final String content;
  final String? createdAt;
}

List<SupportFaqModel> parseSupportFaqsList(dynamic raw) {
  if (raw is List) {
    return raw
        .whereType<Map>()
        .map((e) => SupportFaqModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
  if (raw is Map) {
    final map = Map<String, dynamic>.from(raw);
    final data = map['data'];
    if (data is Map && data['items'] is List) {
      return (data['items'] as List)
          .whereType<Map>()
          .map((e) => SupportFaqModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => SupportFaqModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    final items = map['items'] ?? map['faqs'];
    if (items is List) {
      return items
          .whereType<Map>()
          .map((e) => SupportFaqModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
  }
  return const [];
}

int _int(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse('$v') ?? 0;
}
