import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';

/// Institutional bottom sheet — consistent timing, barrier, and shape.
Future<T?> showDeskBottomSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool isScrollControlled = true,
  bool useRootNavigator = false,
  bool isDismissible = true,
  bool enableDrag = true,
  Color? backgroundColor,
  bool showDragHandle = false,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    useRootNavigator: useRootNavigator,
    isDismissible: isDismissible,
    enableDrag: enableDrag,
    showDragHandle: showDragHandle,
    backgroundColor: backgroundColor ?? AppDesk.surface,
    barrierColor: Colors.black.withValues(alpha: 0.52),
    elevation: 0,
    sheetAnimationStyle: AnimationStyle(
      duration: MotionTokens.sheetEnter,
      reverseDuration: MotionTokens.sheetExit,
      curve: MotionTokens.enter,
      reverseCurve: MotionTokens.exit,
    ),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
    ),
    builder: builder,
  );
}

/// Institutional dialog — consistent barrier fade and surface timing.
Future<T?> showDeskDialog<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool barrierDismissible = true,
  String? barrierLabel,
  bool useRootNavigator = true,
}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    barrierLabel: barrierLabel ?? 'Dialog',
    useRootNavigator: useRootNavigator,
    barrierColor: Colors.black.withValues(alpha: 0.52),
    transitionDuration: MotionTokens.dialogEnter,
    transitionBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: MotionTokens.enter,
        reverseCurve: MotionTokens.exit,
      );
      return FadeTransition(
        opacity: curved,
        child: child,
      );
    },
    pageBuilder: (context, animation, secondaryAnimation) => builder(context),
  );
}
