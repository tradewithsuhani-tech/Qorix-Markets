import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/motion/desk_sheets.dart';
import 'package:qorix_markets_flutter/core/config/feature_flags.dart';
import 'package:qorix_markets_flutter/core/observability/analytics_events.dart';
import 'package:qorix_markets_flutter/core/observability/analytics_service.dart';
import 'package:qorix_markets_flutter/core/qa/ux_copy.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/widgets/primary_button.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Biometric preparation — vault-grade messaging, no actual biometric API yet.
Future<void> showBiometricPrepSheet(BuildContext context, WidgetRef ref) async {
  if (!FeatureFlags.enableBiometricPrep) return;

  ref.read(analyticsServiceProvider).track(
        AnalyticsEvent.biometricPrepViewed,
      );

  await showDeskBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: AppColors.card(Theme.of(ctx).brightness == Brightness.dark).withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.brand.withValues(alpha: 0.25)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.fingerprint_rounded, size: 48, color: AppColors.brand),
            AppSpacing.gapLg(),
            Text(UxCopy.biometricPrepTitle, style: Theme.of(ctx).textTheme.titleLarge),
            AppSpacing.gapSm(),
            Text(
              UxCopy.biometricPrepMessage,
              textAlign: TextAlign.center,
              style: Theme.of(ctx).textTheme.bodyMedium,
            ),
            AppSpacing.gapXxl(),
            PrimaryButton(
              label: 'Enable when available',
              onPressed: () => Navigator.pop(ctx),
            ),
            AppSpacing.gapSm(),
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Not now'),
            ),
          ],
        ),
      ),
    ),
  );
}
