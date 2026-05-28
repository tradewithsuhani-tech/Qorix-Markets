import 'package:qorix_markets_flutter/features/auth/domain/entities/user_entity.dart';

abstract interface class ProfileRepository {
  Future<UserEntity> getProfile();
}
