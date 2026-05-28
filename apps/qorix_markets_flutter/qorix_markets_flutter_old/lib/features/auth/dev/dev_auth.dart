import 'package:qorix_markets_flutter/features/auth/domain/entities/user_entity.dart';

abstract final class DevAuth {
  static const storageKey = 'dev_auth_bypass';
  static bool isActive = false;
  static bool bypassEnabled = false;

  static UserEntity mockUser({String? email}) => UserEntity(
        id: 'dev-user',
        email: email ?? 'demo@qorixmarkets.com',
        fullName: 'Demo Investor',
        kycVerified: true,
        emailVerified: true,
      );
}
