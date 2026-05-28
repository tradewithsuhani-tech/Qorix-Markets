import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/session_cleanup.dart';
import 'package:qorix_markets_flutter/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_controller.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_session_provider.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/pending_auth_flow_provider.dart';

enum LoginApprovalPhase { waiting, otpEntry, approved, failed }

class LoginApprovalState {
  const LoginApprovalState({
    this.phase = LoginApprovalPhase.waiting,
    this.message,
    this.canRequestEmailOtp = false,
    this.otpRequested = false,
    this.secondsUntilOtp = 0,
    this.secondsUntilExpiry,
    this.isPolling = true,
  });

  final LoginApprovalPhase phase;
  final String? message;
  final bool canRequestEmailOtp;
  final bool otpRequested;
  final int secondsUntilOtp;
  final int? secondsUntilExpiry;
  final bool isPolling;

  LoginApprovalState copyWith({
    LoginApprovalPhase? phase,
    String? message,
    bool? canRequestEmailOtp,
    bool? otpRequested,
    int? secondsUntilOtp,
    int? secondsUntilExpiry,
    bool? isPolling,
  }) {
    return LoginApprovalState(
      phase: phase ?? this.phase,
      message: message ?? this.message,
      canRequestEmailOtp: canRequestEmailOtp ?? this.canRequestEmailOtp,
      otpRequested: otpRequested ?? this.otpRequested,
      secondsUntilOtp: secondsUntilOtp ?? this.secondsUntilOtp,
      secondsUntilExpiry: secondsUntilExpiry ?? this.secondsUntilExpiry,
      isPolling: isPolling ?? this.isPolling,
    );
  }
}

final loginApprovalProvider =
    StateNotifierProvider.autoDispose<LoginApprovalNotifier, LoginApprovalState>((ref) {
  return LoginApprovalNotifier(ref);
});

class LoginApprovalNotifier extends StateNotifier<LoginApprovalState> {
  LoginApprovalNotifier(this._ref) : super(const LoginApprovalState()) {
    _start();
  }

  final Ref _ref;
  Timer? _pollTimer;
  Timer? _countdownTimer;
  DateTime? _startedAt;
  DateTime? _expiresAt;

  PendingLoginApproval? get _pending => _ref.read(pendingLoginApprovalProvider);

  void _start() {
    final pending = _pending;
    if (pending == null) {
      state = const LoginApprovalState(
        phase: LoginApprovalPhase.failed,
        message: 'Login approval session missing. Sign in again.',
        isPolling: false,
      );
      return;
    }

    _startedAt = DateTime.now();
    _expiresAt = pending.expiresAtDate ?? _startedAt!.add(const Duration(minutes: 10));
    _tickCountdown();
    _pollOnce();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) => _pollOnce());
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) => _tickCountdown());
  }

  void _tickCountdown() {
    final pending = _pending;
    if (pending == null || _startedAt == null) return;
    final now = DateTime.now();
    final otpFallbackMs = pending.otpFallbackAfterMs > 0 ? pending.otpFallbackAfterMs : 120000;
    final elapsedMs = now.difference(_startedAt!).inMilliseconds;
    final untilOtp = ((otpFallbackMs - elapsedMs) / 1000).ceil();
    final untilExpiry = _expiresAt != null ? _expiresAt!.difference(now).inSeconds : null;

    state = state.copyWith(
      canRequestEmailOtp: untilOtp <= 0,
      secondsUntilOtp: untilOtp > 0 ? untilOtp : 0,
      secondsUntilExpiry: untilExpiry,
    );

    if (untilExpiry != null && untilExpiry <= 0 && state.phase == LoginApprovalPhase.waiting) {
      _stopPolling();
      state = state.copyWith(
        phase: LoginApprovalPhase.failed,
        message: 'Approval window expired. Sign in again.',
        isPolling: false,
      );
    }
  }

  Future<void> _pollOnce() async {
    final pending = _pending;
    if (pending == null || state.phase != LoginApprovalPhase.waiting) return;

    try {
      final status = await _ref.read(authRepositoryProvider).pollLoginAttemptStatus(
            attemptId: pending.attemptId,
            pollToken: pending.pollToken,
          );

      if (status.isApproved && status.auth != null) {
        _stopPolling();
        final ok = await _ref.read(authControllerProvider.notifier).completeLoginFromToken(status.auth!);
        if (!mounted) return;
        state = LoginApprovalState(
          phase: ok ? LoginApprovalPhase.approved : LoginApprovalPhase.failed,
          message: ok ? null : 'Could not save session.',
          isPolling: false,
        );
        return;
      }

      if (status.isTerminal) {
        _stopPolling();
        final msg = switch (status.status) {
          'denied' => 'Login was denied on your other device.',
          'expired' => 'Approval request expired.',
          'consumed' => 'This approval link was already used.',
          _ => 'Login approval failed.',
        };
        state = LoginApprovalState(
          phase: LoginApprovalPhase.failed,
          message: msg,
          isPolling: false,
        );
      }
    } catch (e) {
      // Keep polling — transient network blips are common.
    }
  }

  Future<void> requestEmailOtp() async {
    final pending = _pending;
    if (pending == null || !state.canRequestEmailOtp) return;
    try {
      await _ref.read(authRepositoryProvider).requestLoginAttemptOtp(
            attemptId: pending.attemptId,
            pollToken: pending.pollToken,
          );
      state = state.copyWith(otpRequested: true, phase: LoginApprovalPhase.otpEntry);
    } catch (e) {
      state = state.copyWith(message: 'Could not send email code. Try again shortly.');
    }
  }

  Future<bool> verifyEmailOtp(String otp) async {
    final pending = _pending;
    if (pending == null || otp.length < 6) return false;
    _stopPolling();
    try {
      final user = await _ref.read(authRepositoryProvider).verifyLoginAttemptOtp(
            attemptId: pending.attemptId,
            pollToken: pending.pollToken,
            otp: otp,
          );
      await _ref.read(authSessionProvider.notifier).setAuthenticated(user);
      _ref.read(pendingLoginApprovalProvider.notifier).state = null;
      SessionCleanup.onLogin(_ref.container);
      if (!mounted) return true;
      state = const LoginApprovalState(phase: LoginApprovalPhase.approved, isPolling: false);
      return true;
    } catch (e) {
      if (!mounted) return false;
      state = LoginApprovalState(
        phase: LoginApprovalPhase.otpEntry,
        message: 'Invalid or expired code.',
        isPolling: false,
      );
      return false;
    }
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _countdownTimer?.cancel();
    _pollTimer = null;
    _countdownTimer = null;
  }

  @override
  void dispose() {
    _stopPolling();
    super.dispose();
  }
}
