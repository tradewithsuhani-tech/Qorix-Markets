import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/app_lifecycle.dart';
import 'package:qorix_markets_flutter/core/application/refresh_gate.dart';
import 'package:qorix_markets_flutter/core/config/env_config.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/login_attempt_responder_provider.dart';
import 'package:qorix_markets_flutter/ui/components/login_approval_request_overlay.dart';
import 'package:qorix_markets_flutter/ui/components/offline_recovery_banner.dart';
import 'package:qorix_markets_flutter/ui/components/session_expiry_banner.dart';
import 'package:qorix_markets_flutter/core/security/session_guard.dart';
import 'package:qorix_markets_flutter/core/connectivity/connectivity_service.dart';
import 'package:qorix_markets_flutter/features/activity/application/live_activity_providers.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_session_expiry_sync.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_session_provider.dart';
import 'package:qorix_markets_flutter/features/dashboard/application/dashboard_providers.dart';
import 'package:qorix_markets_flutter/features/invest/application/ai_desk_providers.dart';
import 'package:qorix_markets_flutter/features/invest/application/investment_providers.dart';
import 'package:qorix_markets_flutter/features/notifications/application/notification_providers.dart';
import 'package:qorix_markets_flutter/features/wallet/application/deposit_flow_provider.dart';
import 'package:qorix_markets_flutter/features/wallet/application/wallet_providers.dart';
import 'package:qorix_markets_flutter/services/websocket/websocket_service.dart';

/// Cached live desk connection state — silent reconnect UX.
enum LiveDeskStatus { connecting, live, reconnecting, polling, stale, offline }

class LiveDeskSnapshot {
  const LiveDeskSnapshot({
    this.status = LiveDeskStatus.connecting,
    this.lastEventAt,
    this.isSilentReconnect = false,
    this.pendingEventCount = 0,
  });

  final LiveDeskStatus status;
  final DateTime? lastEventAt;
  final bool isSilentReconnect;
  final int pendingEventCount;

  bool get isLive =>
      status == LiveDeskStatus.live || status == LiveDeskStatus.polling;

  LiveDeskSnapshot copyWith({
    LiveDeskStatus? status,
    DateTime? lastEventAt,
    bool? isSilentReconnect,
    int? pendingEventCount,
  }) =>
      LiveDeskSnapshot(
        status: status ?? this.status,
        lastEventAt: lastEventAt ?? this.lastEventAt,
        isSilentReconnect: isSilentReconnect ?? this.isSilentReconnect,
        pendingEventCount: pendingEventCount ?? this.pendingEventCount,
      );
}

final liveDeskHubProvider =
    NotifierProvider<LiveDeskHub, LiveDeskSnapshot>(LiveDeskHub.new);

final liveDeskBootstrapProvider = Provider<void>((ref) {
  if (UiDemoMode.isActive) return;
  ref.listen(authSessionProvider, (prev, next) {
    if (next.isAuthenticated) {
      ref.read(liveDeskHubProvider.notifier).start();
    } else {
      ref.read(liveDeskHubProvider.notifier).stop();
    }
  }, fireImmediately: true);
});

class LiveDeskHub extends Notifier<LiveDeskSnapshot> {
  StreamSubscription<Map<String, dynamic>>? _msgSub;
  StreamSubscription<WsConnectionState>? _connSub;
  Timer? _pollTimer;
  Timer? _staleTimer;
  Timer? _batchTimer;
  bool _started = false;
  bool _offline = false;
  final _pendingWsEvents = <({String type, Map<String, dynamic> payload})>[];
  final _resumeGate = RefreshGate(cooldown: const Duration(seconds: 3));
  final _pollGate = RefreshGate(cooldown: const Duration(seconds: 8));

  static const _staleThreshold = Duration(seconds: 45);
  static const _pollInterval = Duration(seconds: 10);
  static const _batchDelay = Duration(milliseconds: 400);

  @override
  LiveDeskSnapshot build() => const LiveDeskSnapshot();

  void start() {
    if (UiDemoMode.isActive) return;
    if (_started) return;
    _started = true;
    _offline = false;
    final ws = ref.read(webSocketServiceProvider);

    _connSub = ws.connectionState.listen((conn) {
      switch (conn) {
        case WsConnectionState.connected:
          state = state.copyWith(
            status: _offline ? LiveDeskStatus.offline : LiveDeskStatus.live,
            isSilentReconnect: state.status == LiveDeskStatus.reconnecting,
          );
          if (!_offline) _stopPolling();
          _flushPendingBatch();
        case WsConnectionState.connecting:
          state = state.copyWith(
            status: state.status == LiveDeskStatus.live
                ? LiveDeskStatus.reconnecting
                : LiveDeskStatus.connecting,
          );
        case WsConnectionState.disconnected:
        case WsConnectionState.error:
          if (!_offline) {
            state = state.copyWith(status: LiveDeskStatus.reconnecting);
            _startPolling();
          }
      }
    });

    _msgSub = ws.messages.listen(_queueMessage, onError: (_) => _startPolling());
    ws.connect();
    _startStaleWatch();
    ref.read(liveActivityProvider.notifier).refresh();
  }

  void stop() {
    _started = false;
    _msgSub?.cancel();
    _connSub?.cancel();
    _pollTimer?.cancel();
    _staleTimer?.cancel();
    _batchTimer?.cancel();
    _pendingWsEvents.clear();
    ref.read(webSocketServiceProvider).disconnect();
    state = const LiveDeskSnapshot();
  }

  /// Called when app resumes from background — silent reconcile (debounced).
  Future<void> onAppResumed() async {
    if (!_started) return;
    _offline = false;
    await _resumeGate.run(() async {
      state = state.copyWith(isSilentReconnect: true);
      await _softPoll(includeActivity: true);
      ref.read(webSocketServiceProvider).connect();
      state = state.copyWith(isSilentReconnect: false, status: LiveDeskStatus.live);
    });
  }

  void onAppPaused() {
    _offline = true;
    _stopPolling();
    state = state.copyWith(status: LiveDeskStatus.offline);
  }

  /// Airplane mode off / connectivity restored.
  Future<void> onNetworkRecovered() async {
    if (!_started) return;
    if (ref.read(appForegroundProvider.notifier).isForeground == false) return;
    _offline = false;
    await _resumeGate.run(() => _softPoll(includeActivity: true));
    ref.read(webSocketServiceProvider).connect();
    state = state.copyWith(status: LiveDeskStatus.live, lastEventAt: DateTime.now());
  }

  void _queueMessage(Map<String, dynamic> msg) {
    final type = msg['type'] as String? ?? '';
    if (type == 'heartbeat' || type == 'ping') {
      state = state.copyWith(lastEventAt: DateTime.now());
      return;
    }
    final payload = msg['payload'];
    if (payload is! Map<String, dynamic>) return;

    _pendingWsEvents.add((type: type, payload: payload));
    state = state.copyWith(
      lastEventAt: DateTime.now(),
      status: LiveDeskStatus.live,
      pendingEventCount: _pendingWsEvents.length,
    );
    _batchTimer ??= Timer(_batchDelay, _flushPendingBatch);
  }

  void _flushPendingBatch() {
    _batchTimer?.cancel();
    _batchTimer = null;
    if (_pendingWsEvents.isEmpty) return;

    final batch = List<({String type, Map<String, dynamic> payload})>.from(_pendingWsEvents);
    _pendingWsEvents.clear();
    state = state.copyWith(pendingEventCount: 0);

    for (final event in batch) {
      _applyEvent(event.type, event.payload);
      ref.read(liveActivityProvider.notifier).ingestWsEvent(event.type, event.payload);
    }
  }

  void _applyEvent(String type, Map<String, dynamic> payload) {
    switch (type) {
      case 'trade_executed':
        ref.read(deskTradesProvider.notifier).prependTrade(payload);
      case 'daily_profit':
        ref.read(dashboardProvider.notifier).refresh();
        ref.read(investmentProvider.notifier).refresh();
      case 'drawdown_alert':
        ref.read(investmentProvider.notifier).applyDrawdownAlert(
              drawdownPercent: (payload['drawdownPercent'] as num?)?.toDouble() ?? 0,
              isPaused: payload['isPaused'] as bool? ?? false,
            );
      case 'deposit_confirmed':
        ref.read(depositFlowProvider.notifier).onDepositConfirmed(
              amount: (payload['amount'] as num?)?.toDouble(),
            );
        ref.read(walletProvider.notifier).reconcile();
      case 'withdrawal_status':
        ref.read(walletProvider.notifier).reconcile();
      case 'notification':
        ref.invalidate(notificationsProvider);
        ref.read(liveActivityProvider.notifier).refresh();
      case 'ticker_update':
        break;
    }
  }

  void _startPolling() {
    if (_pollTimer?.isActive == true || _offline) return;
    state = state.copyWith(status: LiveDeskStatus.polling);
    _pollTimer = Timer.periodic(_pollInterval, (_) => _softPoll());
    _softPoll();
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _softPoll({bool includeActivity = false}) async {
    await _pollGate.run(() async {
      if (kDebugMode && EnvConfig.enableLogging) {
        debugPrint('[LiveDesk] silent sync');
      }
      await Future.wait([
        ref.read(dashboardProvider.notifier).refresh(),
        ref.read(investmentProvider.notifier).refresh(),
        ref.read(deskTradesProvider.notifier).refresh(),
        if (includeActivity) ref.read(liveActivityProvider.notifier).refresh(),
      ]);
      state = state.copyWith(lastEventAt: DateTime.now());
    });
  }

  void _startStaleWatch() {
    _staleTimer?.cancel();
    _staleTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (_offline) return;
      final last = state.lastEventAt;
      if (last == null) return;
      if (DateTime.now().difference(last) > _staleThreshold) {
        state = state.copyWith(status: LiveDeskStatus.stale);
        _startPolling();
      }
    });
  }
}

/// Bootstrap: WS hub + app lifecycle + session guard overlay.
class LiveDeskBootstrap extends ConsumerStatefulWidget {
  const LiveDeskBootstrap({required this.child, super.key});
  final Widget child;

  @override
  ConsumerState<LiveDeskBootstrap> createState() => _LiveDeskBootstrapState();
}

class _LiveDeskBootstrapState extends ConsumerState<LiveDeskBootstrap>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final hub = ref.read(liveDeskHubProvider.notifier);
    final lifecycle = ref.read(appForegroundProvider.notifier);
    switch (state) {
      case AppLifecycleState.resumed:
        lifecycle.setForeground();
        hub.onAppResumed();
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
        lifecycle.setBackground();
        hub.onAppPaused();
      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (UiDemoMode.isActive) return widget.child;

    ref.watch(liveDeskBootstrapProvider);
    ref.watch(loginAttemptResponderBootstrapProvider);
    ref.watch(sessionGuardProvider);
    ref.watch(authSessionExpirySyncProvider);

    ref.listen(isOnlineProvider, (prev, next) {
      final wasOffline = prev?.value == false;
      final nowOnline = next.value == true;
      if (wasOffline && nowOnline) {
        ref.read(liveDeskHubProvider.notifier).onNetworkRecovered();
      }
    });

    return Stack(
      children: [
        widget.child,
        const SessionExpiryBanner(),
        const OfflineRecoveryBanner(),
        const LoginApprovalRequestOverlay(),
      ],
    );
  }
}
