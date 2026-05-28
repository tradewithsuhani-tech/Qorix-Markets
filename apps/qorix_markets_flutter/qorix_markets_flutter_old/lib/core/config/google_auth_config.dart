/// Google Sign-In for Android/iOS.
///
/// Set via `--dart-define=GOOGLE_SERVER_CLIENT_ID=...` or `dart_defines.json`
/// (see [dart_defines.example.json]).
///
/// Use the **Web application** OAuth client ID from Google Cloud Console
/// (same value as server `GOOGLE_CLIENT_ID` for token verification).
abstract final class GoogleAuthConfig {
  /// Production Web client ID (same as server `GOOGLE_CLIENT_ID`).
  /// Baked in so APK builds without `--dart-define-from-file` still return an idToken
  /// (old Play APK behaved this way).
  static const productionWebClientId =
      '905039735320-lc7nauggottuubm9v03k8f64dvqpl57k.apps.googleusercontent.com';

  /// Android OAuth client (Google Cloud → Qorix Markets Android).
  static const androidOAuthClientId =
      '905039735320-msqms64vvmemodqp0nk4s0moufsrapps.apps.googleusercontent.com';

  static const serverClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue: productionWebClientId,
  );

  static const androidPackageId = 'com.qorixmarkets.app';
  static const iosBundleId = 'com.qorixmarkets.app';

  static bool get isConfigured => serverClientId.isNotEmpty;

  /// Passed to [GoogleSignIn] as `serverClientId` (required on Android for idToken).
  static String get effectiveServerClientId =>
      serverClientId.isNotEmpty ? serverClientId : productionWebClientId;
}
