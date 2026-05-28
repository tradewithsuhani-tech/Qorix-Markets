import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

class QorixLogo extends StatelessWidget {
  const QorixLogo({
    this.size = 48,
    this.showWordmark = false,
    this.useAuthGreen = false,
    this.glow = false,
    super.key,
  });

  final double size;
  final bool showWordmark;
  final bool useAuthGreen;
  final bool glow;

  @override
  Widget build(BuildContext context) {
    final gradient = useAuthGreen
        ? const LinearGradient(colors: [AppColors.authGreen, Color(0xFF00C853)])
        : AppColors.brandGradient;

    final mark = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(size * 0.28),
        boxShadow: glow
            ? [BoxShadow(color: AppColors.authGreen.withValues(alpha: 0.35), blurRadius: 24)]
            : null,
      ),
      child: Text(
        'Q',
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.45,
          fontWeight: FontWeight.w800,
        ),
      ),
    );

    if (!showWordmark) return mark;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        const SizedBox(width: 10),
        Text(
          'Qorix',
          style: TextStyle(
            color: Colors.white,
            fontSize: size * 0.32,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
          ),
        ),
      ],
    );
  }
}
