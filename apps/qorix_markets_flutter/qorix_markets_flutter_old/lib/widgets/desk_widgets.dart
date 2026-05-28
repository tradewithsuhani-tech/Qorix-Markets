import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/ui/components/pressable_scale.dart';

/// Shared institutional UI primitives — deposit, bot, overlay flows.
class DeskBackButton extends StatelessWidget {
  const DeskBackButton({required this.onTap, super.key});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Ink(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: AppDesk.borderLine),
          ),
          child: Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: AppDesk.textPrimary),
        ),
      ),
    );
  }
}

class DeskPageTitle extends StatelessWidget {
  const DeskPageTitle({
    required this.title,
    this.subtitle,
    super.key,
  });

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: AppDesk.pageTitle),
        if (subtitle != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(subtitle!, style: AppDesk.pageSubtitle),
        ],
      ],
    );
  }
}

class DeskSectionLabel extends StatelessWidget {
  const DeskSectionLabel(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Text(label.toUpperCase(), style: AppDesk.overline),
    );
  }
}

class DeskIconBox extends StatelessWidget {
  const DeskIconBox({
    required this.icon,
    this.size = 40,
    this.iconSize = 20,
    super.key,
  });

  final IconData icon;
  final double size;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.md),
        color: AppColors.authGreen.withValues(alpha: 0.1),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.18)),
      ),
      child: Icon(icon, size: iconSize, color: AppColors.authGreen.withValues(alpha: 0.92)),
    );
  }
}

class DeskPrimaryCta extends StatelessWidget {
  const DeskPrimaryCta({
    required this.label,
    required this.onTap,
    this.loading = false,
    this.trailing,
    super.key,
  });

  final String label;
  final VoidCallback? onTap;
  final bool loading;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null && !loading;
    return PressableScale(
      onTap: enabled ? onTap : null,
      scale: MotionTokens.pressScale,
      enableHaptics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: null,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Ink(
            width: double.infinity,
            height: AppSpacing.deskButtonHeight,
            decoration: enabled ? AppDesk.primaryButton() : AppDesk.outlineButton(),
            child: Center(
              child: loading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppDesk.bg),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          label,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: enabled ? AppDesk.bg : AppDesk.textTertiary,
                            letterSpacing: 0.15,
                          ),
                        ),
                        if (trailing != null) ...[const SizedBox(width: 8), trailing!],
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
