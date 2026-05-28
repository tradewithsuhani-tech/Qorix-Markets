import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/login_attempt_responder_provider.dart';

/// Shown on the signed-in device when another device requests login approval.
class LoginApprovalRequestOverlay extends ConsumerWidget {
  const LoginApprovalRequestOverlay({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final responder = ref.watch(loginAttemptResponderProvider);
    final attempt = responder.active;
    if (attempt == null) return const SizedBox.shrink();

    final expiresIn = attempt.expiresAt.difference(DateTime.now()).inSeconds;

    return Positioned.fill(
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.55),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Material(
              color: Colors.transparent,
              child: Container(
                constraints: const BoxConstraints(maxWidth: 400),
                padding: const EdgeInsets.all(AppSpacing.xl),
                decoration: BoxDecoration(
                  color: AppColors.card(Theme.of(context).brightness == Brightness.dark),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.brand.withValues(alpha: 0.35)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.phonelink_lock_outlined, color: AppColors.brand),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'New login request',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      attempt.deviceLabel,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    if (attempt.locationHint != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        attempt.locationHint!,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      expiresIn > 0
                          ? 'Expires in ${expiresIn}s. Approving signs you out here (one device at a time).'
                          : 'Request is about to expire.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (responder.error != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        responder.error!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context).colorScheme.error,
                            ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.xl),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: responder.isResponding
                                ? null
                                : () => ref.read(loginAttemptResponderProvider.notifier).deny(),
                            child: const Text('Deny'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton(
                            onPressed: responder.isResponding
                                ? null
                                : () => ref.read(loginAttemptResponderProvider.notifier).approve(),
                            child: responder.isResponding
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Text('Approve'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
