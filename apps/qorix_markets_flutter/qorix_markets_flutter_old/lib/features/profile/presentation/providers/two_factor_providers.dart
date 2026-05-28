import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/errors/exceptions.dart';
import 'package:qorix_markets_flutter/features/profile/application/profile_providers.dart';
import 'package:qorix_markets_flutter/features/profile/application/security_providers.dart';
import 'package:qorix_markets_flutter/features/profile/domain/repositories/security_repository.dart';
import 'package:qorix_markets_flutter/features/profile/infrastructure/security_repository_impl.dart';

enum TwoFactorPhase { intro, setup, enabled, disableConfirm }

class TwoFactorState {
  const TwoFactorState({
    this.enabled = false,
    this.phase = TwoFactorPhase.intro,
    this.isLoading = true,
    this.isSubmitting = false,
    this.codeError = false,
    this.errorMessage,
    this.enabledAt,
    this.qrDataUrl,
    this.manualCode,
    this.accountName,
  });

  final bool enabled;
  final TwoFactorPhase phase;
  final bool isLoading;
  final bool isSubmitting;
  final bool codeError;
  final String? errorMessage;
  final DateTime? enabledAt;
  final String? qrDataUrl;
  final String? manualCode;
  final String? accountName;

  TwoFactorState copyWith({
    bool? enabled,
    TwoFactorPhase? phase,
    bool? isLoading,
    bool? isSubmitting,
    bool? codeError,
    String? errorMessage,
    DateTime? enabledAt,
    String? qrDataUrl,
    String? manualCode,
    String? accountName,
    bool clearErrorMessage = false,
    bool clearEnabledAt = false,
    bool clearSetup = false,
  }) {
    return TwoFactorState(
      enabled: enabled ?? this.enabled,
      phase: phase ?? this.phase,
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      codeError: codeError ?? this.codeError,
      errorMessage: clearErrorMessage ? null : (errorMessage ?? this.errorMessage),
      enabledAt: clearEnabledAt ? null : (enabledAt ?? this.enabledAt),
      qrDataUrl: clearSetup ? null : (qrDataUrl ?? this.qrDataUrl),
      manualCode: clearSetup ? null : (manualCode ?? this.manualCode),
      accountName: clearSetup ? null : (accountName ?? this.accountName),
    );
  }
}

final twoFactorProvider = NotifierProvider<TwoFactorNotifier, TwoFactorState>(TwoFactorNotifier.new);

/// Settings tile — profile first, then security-status, then live 2FA screen state.
final twoFactorEnabledProvider = Provider<bool>((ref) {
  final profile = ref.watch(profileUserProvider).valueOrNull;
  if (profile != null) return profile.twoFactorEnabled;

  final security = ref.watch(securityStatusProvider).valueOrNull;
  if (security != null) return security.twoFactorEnabled;

  return ref.watch(twoFactorProvider).enabled;
});

class TwoFactorNotifier extends Notifier<TwoFactorState> {
  @override
  TwoFactorState build() {
    Future.microtask(loadStatus);
    return const TwoFactorState();
  }

  SecurityRepository get _repo => ref.read(securityRepositoryProvider);

  TwoFactorPhase get _entryPhase =>
      state.enabled ? TwoFactorPhase.enabled : TwoFactorPhase.intro;

  Future<void> loadStatus() async {
    state = state.copyWith(isLoading: true, clearErrorMessage: true);
    try {
      final status = await _repo.get2faStatus();
      state = TwoFactorState(
        enabled: status.enabled,
        phase: status.enabled ? TwoFactorPhase.enabled : TwoFactorPhase.intro,
        enabledAt: status.enabledDate,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: _message(e));
    }
  }

  void resetToEntry() {
    state = state.copyWith(
      phase: _entryPhase,
      isSubmitting: false,
      codeError: false,
      clearErrorMessage: true,
    );
  }

  Future<void> startEnable() async {
    if (state.enabled || state.isSubmitting) return;
    state = state.copyWith(isSubmitting: true, codeError: false, clearErrorMessage: true);
    try {
      final setup = await _repo.setup2fa();
      state = state.copyWith(
        phase: TwoFactorPhase.setup,
        isSubmitting: false,
        qrDataUrl: setup.qrDataUrl,
        manualCode: setup.manualCode,
        accountName: setup.accountName,
      );
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: _message(e),
      );
    }
  }

  void goToIntro() {
    state = state.copyWith(
      phase: TwoFactorPhase.intro,
      codeError: false,
      clearSetup: true,
      clearErrorMessage: true,
    );
  }

  void startDisable() {
    state = state.copyWith(phase: TwoFactorPhase.disableConfirm, codeError: false, clearErrorMessage: true);
  }

  void cancelDisable() {
    state = state.copyWith(phase: TwoFactorPhase.enabled, codeError: false, clearErrorMessage: true);
  }

  Future<List<String>?> verifyEnable(String code) async {
    if (state.isSubmitting) return null;
    state = state.copyWith(isSubmitting: true, codeError: false, clearErrorMessage: true);
    try {
      final result = await _repo.verify2faSetup(code);
      state = TwoFactorState(
        enabled: true,
        phase: TwoFactorPhase.enabled,
        enabledAt: DateTime.now(),
      );
      ref.invalidate(securityStatusProvider);
      ref.invalidate(profileUserProvider);
      return result.backupCodes;
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        codeError: true,
        errorMessage: _message(e),
      );
      return null;
    }
  }

  Future<bool> verifyDisable({required String password, required String code}) async {
    if (state.isSubmitting) return false;
    state = state.copyWith(isSubmitting: true, codeError: false, clearErrorMessage: true);
    try {
      await _repo.disable2fa(password: password, code: code);
      state = const TwoFactorState(enabled: false, phase: TwoFactorPhase.intro);
      ref.invalidate(securityStatusProvider);
      ref.invalidate(profileUserProvider);
      return true;
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        codeError: true,
        errorMessage: _message(e),
      );
      return false;
    }
  }

  void clearCodeError() {
    if (state.codeError) {
      state = state.copyWith(codeError: false, clearErrorMessage: true);
    }
  }

  String _message(Object e) {
    if (e is ServerException) return e.message;
    if (e is ValidationException) return e.message;
    if (e is AuthException) return e.message;
    return 'Something went wrong. Please try again.';
  }
}
