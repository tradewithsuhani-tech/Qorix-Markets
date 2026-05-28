import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/infrastructure/device_fingerprint_service.dart';
import 'package:qorix_markets_flutter/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:qorix_markets_flutter/features/auth/dev/dev_auth.dart';
import 'package:qorix_markets_flutter/features/auth/domain/entities/user_entity.dart';
import 'package:qorix_markets_flutter/features/auth/domain/repositories/auth_repository.dart';
import 'package:qorix_markets_flutter/services/storage/secure_storage_service.dart';

class AuthSessionState {
  const AuthSessionState({
    this.isLoading = true,
    this.isAuthenticated = false,
    this.user,
    this.bootstrapError,
  });

  final bool isLoading;
  final bool isAuthenticated;
  final UserEntity? user;
  final String? bootstrapError;

  AuthSessionState copyWith({
    bool? isLoading,
    bool? isAuthenticated,
    UserEntity? user,
    String? bootstrapError,
    bool clearUser = false,
    bool clearError = false,
  }) =>
      AuthSessionState(
        isLoading: isLoading ?? this.isLoading,
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
        user: clearUser ? null : (user ?? this.user),
        bootstrapError: clearError ? null : (bootstrapError ?? this.bootstrapError),
      );
}

final authSessionProvider =
    StateNotifierProvider<AuthSessionNotifier, AuthSessionState>((ref) {
  return AuthSessionNotifier(
    ref.watch(secureStorageProvider),
    ref.watch(authRepositoryProvider),
    ref.watch(deviceFingerprintProvider),
  );
});

class AuthSessionNotifier extends StateNotifier<AuthSessionState> {
  AuthSessionNotifier(this._storage, this._auth, this._fingerprint)
      : super(
          UiDemoMode.isActive
              ? const AuthSessionState(isLoading: false, isAuthenticated: false)
              : const AuthSessionState(),
        ) {
    if (UiDemoMode.isActive) {
      DevAuth.isActive = false;
    } else {
      _bootstrap();
    }
  }

  final SecureStorageService _storage;
  final AuthRepository _auth;
  final DeviceFingerprintService _fingerprint;

  Future<void> _bootstrap() async {
    await _fingerprint.getDeviceId();
    try {
      if (DevAuth.bypassEnabled && await _storage.read(DevAuth.storageKey) == '1') {
        DevAuth.isActive = true;
        state = AuthSessionState(
          isLoading: false,
          isAuthenticated: true,
          user: DevAuth.mockUser(),
        );
        return;
      }

      final user = await _auth.restoreSession();
      final hasSession = user != null || await _storage.hasSession();
      state = AuthSessionState(
        isLoading: false,
        isAuthenticated: hasSession && user != null,
        user: user,
      );
    } catch (_) {
      state = const AuthSessionState(
        isLoading: false,
        isAuthenticated: false,
        bootstrapError: 'Session restore failed',
      );
    }
  }

  Future<void> refreshProfile() async {
    if (UiDemoMode.isActive) return;
    try {
      final user = await _auth.restoreSession();
      if (user != null) {
        state = state.copyWith(isAuthenticated: true, user: user, clearError: true);
      }
    } catch (_) {}
  }

  Future<void> setAuthenticated(UserEntity user) async {
    state = state.copyWith(isAuthenticated: true, user: user, clearError: true);
  }

  /// Dev-only — mock session, no API tokens.
  Future<void> signInDevMock({String? email}) async {
    if (!DevAuth.bypassEnabled) return;
    DevAuth.isActive = true;
    if (!UiDemoMode.isActive) {
      await _storage.write(DevAuth.storageKey, '1');
    }
    state = AuthSessionState(
      isLoading: false,
      isAuthenticated: true,
      user: DevAuth.mockUser(email: email),
    );
  }

  Future<void> signOut() async {
    if (UiDemoMode.isActive) {
      DevAuth.isActive = false;
      state = state.copyWith(isAuthenticated: false, clearUser: true);
      return;
    }
    DevAuth.isActive = false;
    await _storage.delete(DevAuth.storageKey);
    await _auth.logout();
    state = state.copyWith(isAuthenticated: false, clearUser: true);
  }

  /// JWT refresh failed — tokens already cleared by interceptor.
  void handleSessionExpired() {
    DevAuth.isActive = false;
    state = const AuthSessionState(
      isLoading: false,
      isAuthenticated: false,
      bootstrapError: null,
    );
  }
}
