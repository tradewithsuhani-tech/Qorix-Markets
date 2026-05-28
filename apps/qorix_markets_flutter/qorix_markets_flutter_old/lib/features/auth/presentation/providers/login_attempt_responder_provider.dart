import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/session_cleanup.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/data/models/pending_login_attempt_item_model.dart';
import 'package:qorix_markets_flutter/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_session_provider.dart';

class LoginAttemptResponderState {
  const LoginAttemptResponderState({
    this.queue = const [],
    this.active,
    this.isResponding = false,
    this.error,
  });

  final List<PendingLoginAttemptItemModel> queue;
  final PendingLoginAttemptItemModel? active;
  final bool isResponding;
  final String? error;

  bool get hasPrompt => active != null;

  LoginAttemptResponderState copyWith({
    List<PendingLoginAttemptItemModel>? queue,
    PendingLoginAttemptItemModel? active,
    bool clearActive = false,
    bool? isResponding,
    String? error,
    bool clearError = false,
  }) {
    return LoginAttemptResponderState(
      queue: queue ?? this.queue,
      active: clearActive ? null : (active ?? this.active),
      isResponding: isResponding ?? this.isResponding,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

final loginAttemptResponderProvider =
    NotifierProvider<LoginAttemptResponderNotifier, LoginAttemptResponderState>(
  LoginAttemptResponderNotifier.new,
);

/// Poll pending login attempts while the user is signed in.
final loginAttemptResponderBootstrapProvider = Provider<void>((ref) {
  if (UiDemoMode.isActive) return;
  ref.listen(authSessionProvider, (prev, next) {
    final notifier = ref.read(loginAttemptResponderProvider.notifier);
    if (next.isAuthenticated) {
      notifier.start();
    } else {
      notifier.stop();
    }
  }, fireImmediately: true);
});

class LoginAttemptResponderNotifier extends Notifier<LoginAttemptResponderState> {
  Timer? _pollTimer;
  bool _started = false;

  @override
  LoginAttemptResponderState build() => const LoginAttemptResponderState();

  void start() {
    if (UiDemoMode.isActive || _started) return;
    _started = true;
    _pollOnce();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _pollOnce());
  }

  void stop() {
    _started = false;
    _pollTimer?.cancel();
    _pollTimer = null;
    state = const LoginAttemptResponderState();
  }

  Future<void> _pollOnce() async {
    if (!ref.read(authSessionProvider).isAuthenticated) return;
    try {
      final attempts = await ref.read(authRepositoryProvider).fetchPendingLoginAttempts();
      final active = state.active;
      final stillActive = active != null && attempts.any((a) => a.id == active.id);
      state = LoginAttemptResponderState(
        queue: attempts,
        active: stillActive
            ? active
            : (attempts.isNotEmpty ? attempts.first : null),
        error: null,
      );
    } catch (_) {
      // Transient network — keep last prompt.
    }
  }

  Future<void> approve() => _respond('approve');

  Future<void> deny() => _respond('deny');

  Future<void> _respond(String decision) async {
    final active = state.active;
    if (active == null || state.isResponding) return;

    state = state.copyWith(isResponding: true, clearError: true);
    try {
      await ref.read(authRepositoryProvider).respondToLoginAttempt(
            attemptId: active.id,
            decision: decision,
          );

      final remaining = state.queue.where((a) => a.id != active.id).toList();
      state = LoginAttemptResponderState(
        queue: remaining,
        active: remaining.isNotEmpty ? remaining.first : null,
      );

      if (decision == 'approve') {
        SessionCleanup.onLogout(ref.container);
        await ref.read(authSessionProvider.notifier).signOut();
      }
    } catch (e) {
      state = state.copyWith(
        isResponding: false,
        error: 'Could not update login request. Try again.',
      );
      return;
    }
    state = state.copyWith(isResponding: false);
  }
}
