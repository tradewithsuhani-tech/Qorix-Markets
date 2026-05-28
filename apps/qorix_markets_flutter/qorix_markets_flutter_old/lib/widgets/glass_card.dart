import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';

enum GlassCardVariant { standard, elevated, outline, glow, hero }

class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    this.child,
    this.padding,
    this.variant = GlassCardVariant.standard,
    this.animateEntrance = false,
    this.glowColor,
    this.onTap,
  });

  final Widget? child;
  final EdgeInsetsGeometry? padding;
  final GlassCardVariant variant;
  final bool animateEntrance;
  final Color? glowColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final content = Container(
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card(isDark).withValues(alpha: variant == GlassCardVariant.elevated ? 0.95 : 0.82),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: AppColors.border(isDark).withValues(alpha: 0.35)),
        boxShadow: glowColor != null
            ? [BoxShadow(color: glowColor!.withValues(alpha: 0.2), blurRadius: 20)]
            : null,
      ),
      child: child,
    );

    if (onTap == null) return content;
    return Material(
      color: Colors.transparent,
      child: InkWell(onTap: onTap, borderRadius: AppRadius.lgAll, child: content),
    );
  }
}
