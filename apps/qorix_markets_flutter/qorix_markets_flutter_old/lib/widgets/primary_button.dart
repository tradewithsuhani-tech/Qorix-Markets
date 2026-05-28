import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

enum PrimaryButtonVariant { primary, secondary, danger, outlined, buy }

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    required this.label,
    this.onPressed,
    this.expand = true,
    this.variant = PrimaryButtonVariant.primary,
    this.loading = false,
    this.icon,
    this.outlined = false,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool expand;
  final PrimaryButtonVariant variant;
  final bool loading;
  final IconData? icon;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    final effectiveVariant = outlined ? PrimaryButtonVariant.outlined : variant;
    final color = switch (effectiveVariant) {
      PrimaryButtonVariant.primary => AppColors.brand,
      PrimaryButtonVariant.buy => AppColors.buy,
      PrimaryButtonVariant.secondary => AppColors.authMuted,
      PrimaryButtonVariant.danger => AppColors.sell,
      PrimaryButtonVariant.outlined => Colors.transparent,
    };

    final child = loading
        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: 8)],
              Text(label),
            ],
          );

    final Widget btn;
    if (effectiveVariant == PrimaryButtonVariant.outlined) {
      btn = OutlinedButton(
        onPressed: loading ? null : onPressed,
        style: OutlinedButton.styleFrom(minimumSize: const Size(0, 52)),
        child: child,
      );
    } else {
      btn = FilledButton(
        onPressed: loading ? null : onPressed,
        style: FilledButton.styleFrom(backgroundColor: color, minimumSize: const Size(0, 52)),
        child: child,
      );
    }

    return expand ? SizedBox(width: double.infinity, child: btn) : btn;
  }
}
