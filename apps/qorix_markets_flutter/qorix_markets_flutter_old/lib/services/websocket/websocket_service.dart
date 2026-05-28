import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:qorix_markets_flutter/core/config/env_config.dart';

enum WsConnectionState { connecting, connected, disconnected, error }

final webSocketServiceProvider = Provider<WebSocketService>((ref) => WebSocketService());

class WebSocketService {
  WebSocketChannel? _channel;
  final _state = StreamController<WsConnectionState>.broadcast();
  final _messages = StreamController<Map<String, dynamic>>.broadcast();

  Stream<WsConnectionState> get connectionState => _state.stream;
  Stream<Map<String, dynamic>> get messages => _messages.stream;

  void connect() {
    _state.add(WsConnectionState.connecting);
    try {
      _channel = WebSocketChannel.connect(Uri.parse(EnvConfig.wsBaseUrl));
      _state.add(WsConnectionState.connected);
      _channel!.stream.listen(
        (data) {
          if (data is Map<String, dynamic>) _messages.add(data);
        },
        onError: (_) => _state.add(WsConnectionState.error),
        onDone: () => _state.add(WsConnectionState.disconnected),
      );
    } catch (_) {
      _state.add(WsConnectionState.error);
    }
  }

  void disconnect() {
    _channel?.sink.close();
    _channel = null;
    _state.add(WsConnectionState.disconnected);
  }
}
