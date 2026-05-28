import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/env_config.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_theme.dart';
import 'package:qorix_markets_flutter/core/theme/theme_mode_provider.dart';
import 'package:qorix_markets_flutter/routes/app_router.dart';
import 'package:qorix_markets_flutter/widgets/app_lock_gate.dart';

class QorixMarketsApp extends ConsumerWidget {
  const QorixMarketsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: EnvConfig.appDisplayName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      routerConfig: router,
      builder: (context, child) {
        // Clamp text scale for layout stability on accessibility settings.
        final mq = MediaQuery.of(context);
        final clamped = mq.copyWith(
          textScaler: mq.textScaler.clamp(minScaleFactor: 0.9, maxScaleFactor: 1.12),
        );

        SystemChrome.setSystemUIOverlayStyle(
          SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness:
                themeMode == ThemeMode.light ? Brightness.dark : Brightness.light,
            systemNavigationBarColor: AppColors.darkBg.withValues(alpha: 0.92),
            systemNavigationBarIconBrightness: Brightness.light,
          ),
        );

        return MediaQuery(
          data: clamped,
          child: AppLockGate(child: child ?? const SizedBox.shrink()),
        );
      },
    );
  }
}
