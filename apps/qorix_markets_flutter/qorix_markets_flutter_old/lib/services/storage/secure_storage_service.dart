import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:qorix_markets_flutter/core/constants/app_constants.dart';

final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService(const FlutterSecureStorage());
});

class SecureStorageService {
  SecureStorageService(this._storage);
  final FlutterSecureStorage _storage;

  Future<String?> read(String key) => _storage.read(key: key);
  Future<void> write(String key, String value) => _storage.write(key: key, value: value);
  Future<void> delete(String key) => _storage.delete(key: key);

  Future<String?> getAccessToken() => read(AppConstants.storageAccessToken);
  Future<String?> getRefreshToken() => read(AppConstants.storageRefreshToken);

  Future<void> saveTokens({required String access, required String refresh}) async {
    await write(AppConstants.storageAccessToken, access);
    await write(AppConstants.storageRefreshToken, refresh);
  }

  Future<bool> hasSession() async {
    final t = await getAccessToken();
    return t != null && t.isNotEmpty;
  }

  Future<void> clearSession() async {
    await delete(AppConstants.storageAccessToken);
    await delete(AppConstants.storageRefreshToken);
  }
}
