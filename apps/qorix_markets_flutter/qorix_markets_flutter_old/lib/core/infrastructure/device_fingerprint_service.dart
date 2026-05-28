import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:qorix_markets_flutter/core/config/env_config.dart';
import 'package:qorix_markets_flutter/core/constants/app_constants.dart';

final deviceFingerprintProvider = Provider<DeviceFingerprintService>((ref) {
  return DeviceFingerprintService(const FlutterSecureStorage());
});

class DeviceFingerprintService {
  DeviceFingerprintService(this._storage);
  final FlutterSecureStorage _storage;

  Future<String> getDeviceId() async {
    var id = await _storage.read(key: AppConstants.storageDeviceId);
    if (id != null && id.isNotEmpty) return id;
    id = '${Platform.operatingSystem}-${DateTime.now().millisecondsSinceEpoch}';
    await _storage.write(key: AppConstants.storageDeviceId, value: id);
    return id;
  }

  Future<Map<String, String>> headers() async {
    final platform = EnvConfig.platformHeader;
    return {
      'X-Device-Id': await getDeviceId(),
      // Backend captcha + single-device flows expect these (see captcha-service.ts).
      'X-App-Platform': platform,
      'X-Platform': Platform.operatingSystem,
    };
  }
}
