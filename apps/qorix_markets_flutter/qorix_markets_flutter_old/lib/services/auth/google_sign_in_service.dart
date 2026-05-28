import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'package:qorix_markets_flutter/core/config/google_auth_config.dart';

final googleSignInServiceProvider = Provider<GoogleSignInService>((ref) {
  return GoogleSignInService();
});

/// Native Google Sign-In → idToken for POST /api/auth/google/mobile.
class GoogleSignInService {
  GoogleSignInService()
      : _googleSignIn = GoogleSignIn(
          scopes: const ['email', 'profile'],
          serverClientId: GoogleAuthConfig.effectiveServerClientId,
        );

  final GoogleSignIn _googleSignIn;

  Future<String?> signInAndGetIdToken() async {
    try {
      final account = await _googleSignIn.signIn();
      if (account == null) return null;
      final auth = await account.authentication;
      final token = auth.idToken;
      if (token == null || token.isEmpty) {
        throw StateError(
          'Google did not return an id token. Rebuild with GOOGLE_SERVER_CLIENT_ID '
          'or add Android OAuth SHA-1 for this APK signature.',
        );
      }
      return token;
    } on PlatformException catch (e) {
      throw StateError(_mapPlatformError(e));
    }
  }

  static String _mapPlatformError(PlatformException e) {
    final code = '${e.code} ${e.message ?? ''}';
    if (code.contains('10') || code.contains('DEVELOPER_ERROR')) {
      return 'Google Sign-In: add SHA-1 for this build in Google Cloud Console '
          '(package ${GoogleAuthConfig.androidPackageId}). '
          'Debug and release APKs use different certificates.';
    }
    if (code.contains('12500') || code.contains('SIGN_IN_CANCELLED')) {
      return 'Google sign-in was cancelled.';
    }
    return e.message ?? e.code;
  }

  Future<void> signOut() => _googleSignIn.signOut();
}
