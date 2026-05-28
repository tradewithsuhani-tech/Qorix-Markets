import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

final appLockBiometricServiceProvider = Provider<AppLockBiometricService>((ref) {
  return AppLockBiometricService(LocalAuthentication());
});

class BiometricCapability {
  const BiometricCapability({
    required this.canCheck,
    required this.isDeviceSupported,
    required this.hasBiometrics,
    required this.availableTypes,
  });

  final bool canCheck;
  final bool isDeviceSupported;
  final bool hasBiometrics;
  final List<BiometricType> availableTypes;

  bool get supportsFace => availableTypes.contains(BiometricType.face);
  bool get supportsFingerprint => availableTypes.contains(BiometricType.fingerprint);

  String get label {
    if (supportsFace && supportsFingerprint) return 'Face ID or fingerprint';
    if (supportsFace) return 'Face ID';
    if (supportsFingerprint) return 'Fingerprint';
    return 'Biometric unlock';
  }
}

class AppLockBiometricService {
  AppLockBiometricService(this._auth);

  final LocalAuthentication _auth;

  Future<BiometricCapability> capability() async {
    try {
      final canCheck = await _auth.canCheckBiometrics;
      final supported = await _auth.isDeviceSupported();
      final types = await _auth.getAvailableBiometrics();
      return BiometricCapability(
        canCheck: canCheck,
        isDeviceSupported: supported,
        hasBiometrics: types.isNotEmpty,
        availableTypes: types,
      );
    } on PlatformException {
      return const BiometricCapability(
        canCheck: false,
        isDeviceSupported: false,
        hasBiometrics: false,
        availableTypes: [],
      );
    }
  }

  Future<bool> authenticate({required String reason}) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false,
          useErrorDialogs: true,
        ),
      );
    } on PlatformException {
      return false;
    }
  }
}
