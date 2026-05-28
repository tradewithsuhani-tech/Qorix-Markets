import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/security/app_lock_repository.dart';
import 'package:qorix_markets_flutter/core/security/app_lock_service.dart';

class AppLockState {
  const AppLockState({
    this.initialized = false,
    this.isLocked = false,
    this.enabled = false,
    this.biometricEnabled = false,
    this.hasPin = false,
    this.biometricAvailable = false,
    this.biometricLabel = 'Biometric unlock',
    this.errorMessage,
    this.failedAttempts = 0,
  });

  final bool initialized;
  final bool isLocked;
  final bool enabled;
  final bool biometricEnabled;
  final bool hasPin;
  final bool biometricAvailable;
  final String biometricLabel;
  final String? errorMessage;
  final int failedAttempts;

  bool get isActive => enabled && hasPin;

  AppLockState copyWith({
    bool? initialized,
    bool? isLocked,
    bool? enabled,
    bool? biometricEnabled,
    bool? hasPin,
    bool? biometricAvailable,
    String? biometricLabel,
    String? errorMessage,
    int? failedAttempts,
    bool clearError = false,
  }) {
    return AppLockState(
      initialized: initialized ?? this.initialized,
      isLocked: isLocked ?? this.isLocked,
      enabled: enabled ?? this.enabled,
      biometricEnabled: biometricEnabled ?? this.biometricEnabled,
      hasPin: hasPin ?? this.hasPin,
      biometricAvailable: biometricAvailable ?? this.biometricAvailable,
      biometricLabel: biometricLabel ?? this.biometricLabel,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      failedAttempts: failedAttempts ?? this.failedAttempts,
    );
  }
}

final appLockProvider = StateNotifierProvider<AppLockNotifier, AppLockState>((ref) {
  return AppLockNotifier(
    ref.watch(appLockRepositoryProvider),
    ref.watch(appLockBiometricServiceProvider),
  );
});

class AppLockNotifier extends StateNotifier<AppLockState> {
  AppLockNotifier(this._repo, this._biometric) : super(const AppLockState()) {
    initialize();
  }

  final AppLockRepository _repo;
  final AppLockBiometricService _biometric;

  static const maxAttempts = 5;

  Future<void> initialize() async {
    final settings = await _repo.readSettings();
    final capability = await _biometric.capability();
    final bioAvailable = capability.hasBiometrics && capability.canCheck;

    state = state.copyWith(
      initialized: true,
      enabled: settings.enabled,
      biometricEnabled: settings.biometricEnabled && bioAvailable,
      hasPin: settings.hasPin,
      biometricAvailable: bioAvailable,
      biometricLabel: capability.label,
      isLocked: settings.enabled && settings.hasPin,
      clearError: true,
    );

    if (state.isActive && state.biometricEnabled) {
      await unlockWithBiometric(silent: true);
    }
  }

  void lockIfActive() {
    if (!state.isActive) return;
    state = state.copyWith(isLocked: true, clearError: true, failedAttempts: 0);
  }

  void unlockSession() {
    state = state.copyWith(isLocked: false, clearError: true, failedAttempts: 0);
  }

  Future<bool> unlockWithPin(String pin) async {
    if (pin.length != 6) {
      state = state.copyWith(errorMessage: 'Enter your 6-digit PIN');
      return false;
    }

    final ok = await _repo.verifyPin(pin);
    if (ok) {
      state = state.copyWith(isLocked: false, clearError: true, failedAttempts: 0);
      return true;
    }

    final attempts = state.failedAttempts + 1;
    state = state.copyWith(
      failedAttempts: attempts,
      errorMessage: attempts >= maxAttempts
          ? 'Too many attempts. Sign in again.'
          : 'Incorrect PIN · ${maxAttempts - attempts} tries left',
    );
    return false;
  }

  Future<bool> unlockWithBiometric({bool silent = false}) async {
    if (!state.biometricEnabled || !state.biometricAvailable) return false;

    final ok = await _biometric.authenticate(
      reason: 'Unlock Qorix Markets to access your portfolio',
    );
    if (ok) {
      state = state.copyWith(isLocked: false, clearError: true, failedAttempts: 0);
      return true;
    }
    if (!silent) {
      state = state.copyWith(errorMessage: 'Biometric verification failed');
    }
    return false;
  }

  Future<void> enableLock({
    required String pin,
    required String confirmPin,
    bool biometric = false,
  }) async {
    if (pin.length != 6) {
      throw AppLockException('PIN must be 6 digits');
    }
    if (pin != confirmPin) {
      throw AppLockException('PINs do not match');
    }

    await _repo.savePin(pin);
    if (biometric) {
      await _repo.setBiometricEnabled(true);
    }

    final capability = await _biometric.capability();
    final bioAvailable = capability.hasBiometrics && capability.canCheck;

    state = state.copyWith(
      enabled: true,
      hasPin: true,
      biometricEnabled: biometric && bioAvailable,
      biometricAvailable: bioAvailable,
      biometricLabel: capability.label,
      isLocked: false,
      clearError: true,
      failedAttempts: 0,
    );
  }

  Future<void> changePin({
    required String currentPin,
    required String newPin,
    required String confirmPin,
  }) async {
    if (!await _repo.verifyPin(currentPin)) {
      throw AppLockException('Current PIN is incorrect');
    }
    if (newPin.length != 6) {
      throw AppLockException('New PIN must be 6 digits');
    }
    if (newPin != confirmPin) {
      throw AppLockException('PINs do not match');
    }
    await _repo.savePin(newPin);
    state = state.copyWith(hasPin: true, enabled: true, clearError: true);
  }

  Future<void> setBiometricEnabled(bool enabled) async {
    if (enabled) {
      final ok = await _biometric.authenticate(reason: 'Confirm identity to enable biometric unlock');
      if (!ok) throw AppLockException('Biometric verification failed');
    }
    await _repo.setBiometricEnabled(enabled);
    state = state.copyWith(biometricEnabled: enabled && state.biometricAvailable);
  }

  Future<void> disableLock(String pin) async {
    if (!await _repo.verifyPin(pin)) {
      throw AppLockException('Incorrect PIN');
    }
    await _repo.disableLock();
    state = state.copyWith(
      enabled: false,
      hasPin: false,
      biometricEnabled: false,
      isLocked: false,
      clearError: true,
      failedAttempts: 0,
    );
  }
}

class AppLockException implements Exception {
  AppLockException(this.message);
  final String message;

  @override
  String toString() => message;
}
