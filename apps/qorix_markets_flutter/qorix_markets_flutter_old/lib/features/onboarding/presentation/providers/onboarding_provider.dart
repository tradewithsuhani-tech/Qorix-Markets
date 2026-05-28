import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final onboardingCompleteProvider = FutureProvider<bool>((ref) async {
  const storage = FlutterSecureStorage();
  final v = await storage.read(key: 'onboarding_complete');
  return v == '1';
});

Future<void> setOnboardingComplete() async {
  const storage = FlutterSecureStorage();
  await storage.write(key: 'onboarding_complete', value: '1');
}
