class AppConstants {
  AppConstants._();

  static const String appName = 'Qorix Markets';
  static const String appTagline = 'Managed FX & Gold · Institutional Desk';
  static const String storageAccessToken = 'access_token';
  static const String storageRefreshToken = 'refresh_token';
  static const String storageDeviceId = 'device_id';
  static const String storageThemeMode = 'theme_mode';
  static const String storageAppLockEnabled = 'app_lock_enabled';
  static const String storageAppLockBiometric = 'app_lock_biometric';
  static const String storageAppLockPinHash = 'app_lock_pin_hash';
  static const String storageAppLockPinSalt = 'app_lock_pin_salt';

  static const Duration apiTimeout = Duration(seconds: 30);
  static const Duration wsReconnectDelay = Duration(seconds: 3);
}
