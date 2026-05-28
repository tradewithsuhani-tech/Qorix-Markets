import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/services/api/p2p_api_service.dart';

final p2pOrderSseServiceProvider = Provider<P2pOrderSseService>((ref) {
  final service = P2pOrderSseService(
    ref.watch(legacyApiClientProvider),
    ref.watch(p2pApiServiceProvider),
  );
  ref.onDispose(service.disposeAll);
  return service;
});

class P2pOrderSseEvent {
  const P2pOrderSseEvent({required this.event, this.data});

  final String event;
  final Map<String, dynamic>? data;

  bool get isOrderUpdate =>
      event == 'order.paid' || event == 'order.completed' || event == 'order.cancelled';

  bool get isChatMessage => event == 'chat.message';
}

class P2pOrderSseService {
  P2pOrderSseService(this._client, this._api);

  final ApiClient _client;
  final P2pApiService _api;
  final Map<int, _SseConnection> _connections = {};

  Stream<P2pOrderSseEvent> connect(int orderId) {
    if (UiDemoMode.isActive) return const Stream.empty();

    final existing = _connections[orderId];
    if (existing != null) return existing.events.stream;

    final conn = _SseConnection();
    _connections[orderId] = conn;
    unawaited(_runConnection(orderId, conn));
    return conn.events.stream;
  }

  void disconnect(int orderId) {
    _connections.remove(orderId)?.close();
  }

  void disposeAll() {
    for (final conn in _connections.values) {
      conn.close();
    }
    _connections.clear();
  }

  Future<void> _runConnection(int orderId, _SseConnection conn) async {
    while (!conn.isClosed) {
      try {
        final tokenModel = await _api.getStreamToken(orderId);
        if (conn.isClosed || tokenModel.token.isEmpty) return;

        final response = await _client.dio.get<ResponseBody>(
          ApiEndpoints.p2pOrderStream(orderId),
          queryParameters: {'token': tokenModel.token},
          options: Options(
            responseType: ResponseType.stream,
            headers: const {'Accept': 'text/event-stream'},
            receiveTimeout: Duration(seconds: tokenModel.expiresIn + 30),
          ),
        );

        final body = response.data;
        if (body == null || conn.isClosed) return;

        final renewIn = Duration(seconds: (tokenModel.expiresIn - 30).clamp(60, tokenModel.expiresIn));
        conn.renewTimer?.cancel();
        final done = Completer<void>();
        conn.renewTimer = Timer(renewIn, () {
          conn.cancelStream();
          if (!done.isCompleted) done.complete();
        });

        var buffer = '';
        conn._streamSub = body.stream.listen(
          (bytes) {
            if (conn.isClosed) return;
            buffer += utf8.decode(bytes);
            while (true) {
              final sep = buffer.indexOf('\n\n');
              if (sep < 0) break;
              final block = buffer.substring(0, sep);
              buffer = buffer.substring(sep + 2);
              final event = _parseBlock(block);
              if (event != null && !conn.events.isClosed) {
                conn.events.add(event);
              }
            }
          },
          onDone: () {
            if (!done.isCompleted) done.complete();
          },
          onError: (_) {
            if (!done.isCompleted) done.complete();
          },
          cancelOnError: true,
        );

        await done.future;
        conn.cancelStream();
      } catch (_) {
        if (conn.isClosed) return;
        await Future<void>.delayed(const Duration(seconds: 3));
      }
    }
  }

  P2pOrderSseEvent? _parseBlock(String block) {
    String? eventName;
    final dataLines = <String>[];

    for (final raw in block.split('\n')) {
      final line = raw.trimRight();
      if (line.isEmpty || line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        eventName = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.add(line.substring(5).trim());
      }
    }

    if (eventName == null) return null;
    Map<String, dynamic>? data;
    if (dataLines.isNotEmpty) {
      try {
        final decoded = jsonDecode(dataLines.join('\n'));
        if (decoded is Map) {
          data = Map<String, dynamic>.from(decoded);
        }
      } catch (_) {}
    }
    return P2pOrderSseEvent(event: eventName, data: data);
  }
}

class _SseConnection {
  final events = StreamController<P2pOrderSseEvent>.broadcast();
  StreamSubscription<List<int>>? _streamSub;
  Timer? renewTimer;
  bool isClosed = false;

  void cancelStream() {
    _streamSub?.cancel();
    _streamSub = null;
  }

  void close() {
    if (isClosed) return;
    isClosed = true;
    renewTimer?.cancel();
    cancelStream();
    events.close();
  }
}
