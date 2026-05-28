import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/features/referral/domain/entities/referral_info.dart';
import 'package:qorix_markets_flutter/services/api/referral_api_service.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';

final _demoReferredUsers = <ReferredUser>[
  ReferredUser(
    id: 1,
    fullName: 'Alex M.',
    email: 'a***@email.com',
    investmentAmount: 2500,
    isActive: true,
    joinedAt: DateTime(2025, 6, 12),
  ),
];

final referralProvider = AsyncNotifierProvider<ReferralNotifier, ReferralInfo>(ReferralNotifier.new);

class ReferralNotifier extends AsyncNotifier<ReferralInfo> with CachedAsyncMixin<ReferralInfo> {
  @override
  Future<ReferralInfo> build() async {
    if (UiDemoMode.isActive) {
      final info = UiDemoFixtures.referral();
      cacheValue(info);
      return info;
    }
    try {
      final model = await ref.read(referralApiServiceProvider).getSummary();
      final info = model.toEntity();
      cacheValue(info);
      return info;
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  Future<void> refresh() => softRefresh(() async {
        if (UiDemoMode.isActive) return UiDemoFixtures.referral();
        final model = await ref.read(referralApiServiceProvider).getSummary();
        return model.toEntity();
      });
}

final referredUsersProvider =
    AsyncNotifierProvider<ReferredUsersNotifier, List<ReferredUser>>(ReferredUsersNotifier.new);

class ReferredUsersNotifier extends AsyncNotifier<List<ReferredUser>> {
  @override
  Future<List<ReferredUser>> build() async {
    if (UiDemoMode.isActive) return _demoReferredUsers;
    try {
      final rows = await ref.read(referralApiServiceProvider).getReferredUsers();
      return rows.map((m) => m.toEntity()).toList();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      if (UiDemoMode.isActive) return _demoReferredUsers;
      final rows = await ref.read(referralApiServiceProvider).getReferredUsers();
      return rows.map((m) => m.toEntity()).toList();
    });
  }
}
