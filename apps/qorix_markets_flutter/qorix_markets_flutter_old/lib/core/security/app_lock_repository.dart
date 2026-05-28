import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/app_constants.dart';
import 'package:qorix_markets_flutter/services/storage/secure_storage_service.dart';

final appLockRepositoryProvider = Provider<AppLockRepository>((ref) {
  return AppLockRepository(ref.watch(secureStorageProvider));
});

class AppLockSettings {
  const AppLockSettings({
    required this.enabled,
    required this.biometricEnabled,
    required this.hasPin,
  });

  final bool enabled;
  final bool biometricEnabled;
  final bool hasPin;
}

class AppLockRepository {
  AppLockRepository(this._storage);

  final SecureStorageService _storage;

  Future<AppLockSettings> readSettings() async {
    final enabled = await _storage.read(AppConstants.storageAppLockEnabled);
    final biometric = await _storage.read(AppConstants.storageAppLockBiometric);
    final hash = await _storage.read(AppConstants.storageAppLockPinHash);
    return AppLockSettings(
      enabled: enabled == '1',
      biometricEnabled: biometric == '1',
      hasPin: hash != null && hash.isNotEmpty,
    );
  }

  Future<void> savePin(String pin) async {
    final salt = _randomSalt();
    final hash = _hashPin(pin, salt);
    await _storage.write(AppConstants.storageAppLockPinSalt, salt);
    await _storage.write(AppConstants.storageAppLockPinHash, hash);
    await _storage.write(AppConstants.storageAppLockEnabled, '1');
  }

  Future<bool> verifyPin(String pin) async {
    final hash = await _storage.read(AppConstants.storageAppLockPinHash);
    final salt = await _storage.read(AppConstants.storageAppLockPinSalt);
    if (hash == null || salt == null) return false;
    return hash == _hashPin(pin, salt);
  }

  Future<void> setBiometricEnabled(bool enabled) async {
    await _storage.write(AppConstants.storageAppLockBiometric, enabled ? '1' : '0');
  }

  Future<void> disableLock() async {
    await _storage.delete(AppConstants.storageAppLockEnabled);
    await _storage.delete(AppConstants.storageAppLockBiometric);
    await _storage.delete(AppConstants.storageAppLockPinHash);
    await _storage.delete(AppConstants.storageAppLockPinSalt);
  }

  String _hashPin(String pin, String salt) {
    final bytes = utf8.encode('$salt:$pin');
    return sha256.convert(bytes).toString();
  }

  String _randomSalt() {
    final rng = Random.secure();
    final values = List<int>.generate(16, (_) => rng.nextInt(256));
    return base64Url.encode(values);
  }
}
