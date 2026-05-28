import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/ui/components/floating_glow_orbs.dart';

class AppBackground extends StatefulWidget {
  const AppBackground({required this.child, super.key, this.glowIntensity = 1.0});

  final Widget child;
  final double glowIntensity;

  @override
  State<AppBackground> createState() => _AppBackgroundState();
}

class _AppBackgroundState extends State<AppBackground> with SingleTickerProviderStateMixin {
  late final AnimationController _drift;

  @override
  void initState() {
    super.initState();
    _drift = AnimationController(vsync: this, duration: const Duration(seconds: 20))..repeat();
  }

  @override
  void dispose() {
    _drift.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Stack(
      fit: StackFit.expand,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: isDark
                ? const LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [AppDesk.bg, Color(0xFF0B1015), AppDesk.bg],
                  )
                : const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      AppColors.lightSurface,
                      AppColors.lightBg,
                      AppColors.lightBgSecondary,
                    ],
                  ),
          ),
        ),
        if (isDark && widget.glowIntensity > 0) FloatingGlowOrbs(intensity: widget.glowIntensity),
        if (isDark)
          AnimatedBuilder(
            animation: _drift,
            builder: (_, __) => IgnorePointer(
              child: CustomPaint(
                painter: _GridPainter(
                  color: AppColors.darkBorder.withValues(alpha: 0.035 + _drift.value * 0.015),
                  offset: _drift.value * 20,
                ),
              ),
            ),
          ),
        widget.child,
      ],
    );
  }
}

class _GridPainter extends CustomPainter {
  _GridPainter({required this.color, this.offset = 0});

  final Color color;
  final double offset;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 0.5;

    const spacing = 44.0;
    for (var x = -spacing + offset; x < size.width + spacing; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (var y = offset; y < size.height + spacing; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _GridPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.offset != offset;
}
