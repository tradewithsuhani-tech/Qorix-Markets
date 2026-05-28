import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/auth/domain/entities/user_entity.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_session_provider.dart';
import 'package:qorix_markets_flutter/features/auth/dev/dev_auth.dart';
import 'package:qorix_markets_flutter/features/profile/infrastructure/profile_repository_impl.dart';

/// Live profile — `/user/profile` with session cache fallback.
final profileUserProvider = AsyncNotifierProvider<ProfileUserNotifier, UserEntity?>(ProfileUserNotifier.new);

class ProfileUserNotifier extends AsyncNotifier<UserEntity?> with CachedAsyncMixin<UserEntity?> {
  @override
  Future<UserEntity?> build() async {
    ref.keepAlive();
    if (UiDemoMode.isActive) {
      return DevAuth.mockUser();
    }

    final sessionUser = ref.watch(authSessionProvider).user;
    if (sessionUser != null) {
      cacheValue(sessionUser);
      return sessionUser;
    }

    final user = await ref.read(profileRepositoryProvider).getProfile();
    cacheValue(user);
    return user;
  }

  Future<void> refresh() {
    if (UiDemoMode.isActive) {
      final user = DevAuth.mockUser();
      cacheValue(user);
      state = AsyncData(user);
      return Future.value();
    }
    return softRefresh(() async {
      final user = await ref.read(profileRepositoryProvider).getProfile();
      await ref.read(authSessionProvider.notifier).setAuthenticated(user);
      return user;
    });
  }
}
