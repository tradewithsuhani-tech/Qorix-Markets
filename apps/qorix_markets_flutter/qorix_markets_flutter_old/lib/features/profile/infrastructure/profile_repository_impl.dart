import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/features/auth/domain/entities/user_entity.dart';
import 'package:qorix_markets_flutter/features/profile/domain/repositories/profile_repository.dart';
import 'package:qorix_markets_flutter/services/api/auth_api_service.dart';
import 'package:qorix_markets_flutter/services/api/user_api_service.dart';

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepositoryImpl(
    ref.watch(userApiServiceProvider),
    ref.watch(authApiServiceProvider),
  );
});

class ProfileRepositoryImpl implements ProfileRepository {
  ProfileRepositoryImpl(this._userApi, this._authApi);

  final UserApiService _userApi;
  final AuthApiService _authApi;

  @override
  Future<UserEntity> getProfile() async {
    try {
      final profile = await _userApi.getProfile();
      return profile.toEntity();
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        final user = await _authApi.getCurrentUser();
        return user.toEntity();
      }
      throw mapDioExceptionToException(e);
    }
  }
}
