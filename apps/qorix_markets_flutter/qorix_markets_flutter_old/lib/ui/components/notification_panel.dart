import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/motion/haptics.dart';
import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/features/notifications/application/notification_providers.dart';
import 'package:qorix_markets_flutter/features/notifications/domain/entities/notification_entity.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_mock_data.dart';
import 'package:qorix_markets_flutter/widgets/skeleton_loader.dart';

Future<void> showNotificationPanel(BuildContext context) {
  AppHaptics.light();
  return showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Notifications',
    barrierColor: Colors.black.withValues(alpha: 0.52),
    transitionDuration: MotionTokens.dialogEnter,
    pageBuilder: (_, __, ___) => const _NotificationPanel(),
    transitionBuilder: (_, anim, __, child) {
      final curved = CurvedAnimation(parent: anim, curve: MotionTokens.enter, reverseCurve: MotionTokens.exit);
      return SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, -0.04), end: Offset.zero).animate(curved),
        child: FadeTransition(opacity: curved, child: child),
      );
    },
  );
}

class _NotificationPanel extends ConsumerWidget {
  const _NotificationPanel();

  List<NotificationEntity> _fallback() => UiMockNotifications.list
      .map(
        (n) => NotificationEntity(
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          isRead: n.isRead,
          createdAt: n.createdAt,
        ),
      )
      .toList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final async = ref.watch(notificationsProvider);
    final notifications = async.valueOrNull ?? (async.hasError ? _fallback() : const <NotificationEntity>[]);
    final fmt = DateFormat('MMM d · HH:mm');

    return Align(
      alignment: Alignment.topCenter,
      child: Padding(
        padding: EdgeInsets.only(
          top: MediaQuery.paddingOf(context).top + 8,
          left: AppSpacing.lg,
          right: AppSpacing.lg,
        ),
        child: Material(
          color: Colors.transparent,
          child: ClipRRect(
            borderRadius: AppRadius.xxlAll,
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
              child: Container(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(context).height * 0.65,
                ),
                decoration: BoxDecoration(
                  color: AppColors.card(isDark).withValues(alpha: 0.95),
                  borderRadius: AppRadius.xxlAll,
                  border: Border.all(color: AppColors.border(isDark).withValues(alpha: 0.45)),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.emeraldGlowShadow(0.12),
                      blurRadius: 32,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: Row(
                        children: [
                          Text('Notifications', style: Theme.of(context).textTheme.titleLarge),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.brand.withValues(alpha: 0.15),
                              borderRadius: AppRadius.pillAll,
                            ),
                            child: Text(
                              '${notifications.where((n) => !n.isRead).length} new',
                              style: const TextStyle(
                                color: AppColors.brand,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          IconButton(
                            onPressed: () => Navigator.pop(context),
                            icon: const Icon(Icons.close_rounded, size: 20),
                          ),
                        ],
                      ),
                    ),
                    Flexible(
                      child: async.isLoading && notifications.isEmpty
                          ? const Padding(
                              padding: EdgeInsets.all(AppSpacing.lg),
                              child: SkeletonMarketList(count: 4),
                            )
                          : ListView(
                        shrinkWrap: true,
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          0,
                          AppSpacing.lg,
                          AppSpacing.lg,
                        ),
                        children: [
                          _SectionLabel(title: 'Wealth growth', icon: Icons.trending_up_rounded),
                          ...notifications
                              .where((n) => n.type == 'daily_profit' || n.type == 'monthly_payout')
                              .map((n) => Padding(
                                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                                    child: _NotificationTile(
                                      title: n.title,
                                      message: n.message,
                                      time: fmt.format(n.createdAt),
                                      type: n.type,
                                      isRead: n.isRead,
                                    ),
                                  )),
                          AppSpacing.gapMd(),
                          _SectionLabel(title: 'Capital & protection', icon: Icons.shield_outlined),
                          ...notifications
                              .where((n) => n.type == 'deposit' || n.type == 'drawdown_alert')
                              .map((n) => Padding(
                                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                                    child: _NotificationTile(
                                      title: n.title,
                                      message: n.message,
                                      time: fmt.format(n.createdAt),
                                      type: n.type,
                                      isRead: n.isRead,
                                    ),
                                  )),
                          AppSpacing.gapMd(),
                          _SectionLabel(title: 'Desk updates', icon: Icons.psychology_outlined),
                          ...notifications
                              .where((n) => n.type != 'daily_profit' && n.type != 'monthly_payout' && n.type != 'deposit' && n.type != 'drawdown_alert')
                              .map((n) => Padding(
                                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                                    child: _NotificationTile(
                                      title: n.title,
                                      message: n.message,
                                      time: fmt.format(n.createdAt),
                                      type: n.type,
                                      isRead: n.isRead,
                                    ),
                                  )),
                        ],
                      ),
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

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.title, required this.icon});

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm, top: AppSpacing.xs),
      child: Row(
        children: [
          Icon(icon, size: 14, color: AppColors.brand),
          const SizedBox(width: 6),
          Text(
            title.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
              color: AppColors.muted(Theme.of(context).brightness == Brightness.dark),
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.title,
    required this.message,
    required this.time,
    required this.type,
    required this.isRead,
  });

  final String title;
  final String message;
  final String time;
  final String type;
  final bool isRead;

  Color get _color => switch (type) {
        'daily_profit' => AppColors.buy,
        'deposit' => AppColors.brand,
        'drawdown_alert' => AppColors.sell,
        _ => AppColors.emerald,
      };

  IconData get _icon => switch (type) {
        'daily_profit' => Icons.trending_up_rounded,
        'deposit' => Icons.arrow_downward_rounded,
        'monthly_payout' => Icons.calendar_today_outlined,
        'drawdown_alert' => Icons.shield_outlined,
        _ => Icons.notifications_outlined,
      };

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isRead
            ? Colors.transparent
            : _color.withValues(alpha: 0.06),
        borderRadius: AppRadius.mdAll,
        border: Border.all(
          color: isRead
              ? AppColors.border(isDark).withValues(alpha: 0.2)
              : _color.withValues(alpha: 0.2),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: _color.withValues(alpha: 0.12),
              borderRadius: AppRadius.smAll,
            ),
            child: Icon(_icon, color: _color, size: 18),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                Text(message, style: Theme.of(context).textTheme.bodySmall),
                Text(time, style: Theme.of(context).textTheme.labelSmall),
              ],
            ),
          ),
          if (!isRead)
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(shape: BoxShape.circle, color: _color),
            ),
        ],
      ),
    );
  }
}
