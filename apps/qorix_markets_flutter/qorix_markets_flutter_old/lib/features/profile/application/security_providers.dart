import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/application/cached_async_mixin.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/data/models/security_models.dart';
import 'package:qorix_markets_flutter/features/auth/dev/dev_auth.dart';
import 'package:qorix_markets_flutter/features/profile/infrastructure/security_repository_impl.dart';

class SecurityStatus {
  const SecurityStatus({
    this.kycApproved = false,
    this.emailVerified = true,
    this.twoFactorEnabled = false,
    this.passwordChangedAt,
  });

  final bool kycApproved;
  final bool emailVerified;
  final bool twoFactorEnabled;
  final DateTime? passwordChangedAt;

  factory SecurityStatus.fromModel(SecurityStatusModel model) => SecurityStatus(
        kycApproved: model.kycApproved,
        emailVerified: model.emailVerified,
        twoFactorEnabled: model.twoFactorEnabled,
        passwordChangedAt: model.passwordChangedDate,
      );
}

final securityStatusProvider =
    AsyncNotifierProvider<SecurityStatusNotifier, SecurityStatus?>(SecurityStatusNotifier.new);

class SecurityStatusNotifier extends AsyncNotifier<SecurityStatus?> with CachedAsyncMixin<SecurityStatus?> {
  @override
  Future<SecurityStatus?> build() async {
    if (UiDemoMode.isActive) {
      final demo = SecurityStatus(
        emailVerified: DevAuth.mockUser().emailVerified,
        twoFactorEnabled: DevAuth.mockUser().twoFactorEnabled,
      );
      cacheValue(demo);
      return demo;
    }
    try {
      final model = await ref.read(securityRepositoryProvider).getSecurityStatus();
      final status = SecurityStatus.fromModel(model);
      cacheValue(status);
      return status;
    } catch (_) {
      return cachedValue;
    }
  }

  Future<void> refresh() => softRefresh(() async {
        final model = await ref.read(securityRepositoryProvider).getSecurityStatus();
        final status = SecurityStatus.fromModel(model);
        cacheValue(status);
        return status;
      });
}

String formatPasswordChangedFromSecurity(SecurityStatus? security) {
  final at = security?.passwordChangedAt;
  if (at == null) return 'Never';
  return DateFormat('dd MMM yyyy').format(at);
}
