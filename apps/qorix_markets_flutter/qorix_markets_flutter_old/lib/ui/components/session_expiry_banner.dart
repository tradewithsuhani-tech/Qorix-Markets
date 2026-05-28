import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/session_cleanup.dart';
import 'package:qorix_markets_flutter/core/qa/ux_copy.dart';
import 'package:qorix_markets_flutter/core/security/session_guard.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_session_provider.dart';

/// Premium session expiry — calm, secure, no raw errors.
class SessionExpiryBanner extends ConsumerWidget {
  const SessionExpiryBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final expired = ref.watch(sessionExpiredProvider);
    if (!expired) return const SizedBox.shrink();

    return Positioned(
      top: MediaQuery.paddingOf(context).top + 8,
      left: 16,
      right: 16,
      child: Material(
        color: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: AppColors.card(Theme.of(context).brightness == Brightness.dark)
                .withValues(alpha: 0.96),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.brand.withValues(alpha: 0.35)),
            boxShadow: [
              BoxShadow(color: AppColors.brandGlow(0.15), blurRadius: 24),
            ],
          ),
          child: Row(
            children: [
              const Icon(Icons.lock_clock_outlined, color: AppColors.brand, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      UxCopy.capitalProtected,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    Text(
                      UxCopy.sessionExpired,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: () async {
                  ref.read(sessionExpiredProvider.notifier).dismiss();
                  SessionCleanup.onLogout(ProviderScope.containerOf(context));
                  await ref.read(authSessionProvider.notifier).signOut();
                  // Router redirect handles navigation — no context.go (overlay may sit above GoRouter).
                },
                child: const Text('Sign in'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
