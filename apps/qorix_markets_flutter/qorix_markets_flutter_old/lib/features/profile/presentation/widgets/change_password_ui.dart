import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

abstract final class _C {
  static const bg = Color(0xFF0A0E12);
  static const card = Color(0xFF12171C);
  static const field = Color(0xFF0E1217);
  static const border = Color(0xFF1E2630);

  static Color get muted => AppColors.authMuted.withValues(alpha: 0.72);
  static Color get faint => AppColors.authMuted.withValues(alpha: 0.48);

  static const green = AppColors.authGreen;
  static const blue = Color(0xFF60A5FA);
  static const purple = Color(0xFF818CF8);
  static const pink = Color(0xFFFF6B8A);
  static const gold = Color(0xFFF59E0B);
}

class ChangePasswordAppBar extends StatelessWidget {
  const ChangePasswordAppBar({required this.onBack, super.key});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onBack,
                borderRadius: BorderRadius.circular(12),
                child: Ink(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.75)),
                  ),
                  child: Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: Colors.white.withValues(alpha: 0.9)),
                ),
              ),
            ),
          ),
          const Text(
            'Change Password',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class ChangePasswordHeroCard extends StatelessWidget {
  const ChangePasswordHeroCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _C.green.withValues(alpha: 0.18),
            const Color(0xFF0D2818),
            _C.card,
          ],
        ),
        border: Border.all(color: _C.green.withValues(alpha: 0.22)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: _C.green.withValues(alpha: 0.12),
              border: Border.all(color: _C.green.withValues(alpha: 0.28)),
            ),
            child: Icon(Icons.shield_outlined, size: 22, color: _C.green),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Update password', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(
                  "You'll be signed out of all other devices after a successful change.",
                  style: TextStyle(fontSize: 11, color: _C.muted, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ChangePasswordFieldCard extends StatelessWidget {
  const ChangePasswordFieldCard({
    required this.label,
    required this.hint,
    required this.icon,
    required this.iconColor,
    required this.controller,
    required this.obscure,
    required this.onToggleVisibility,
    this.textInputAction = TextInputAction.next,
    this.onSubmitted,
    super.key,
  });

  final String label;
  final String hint;
  final IconData icon;
  final Color iconColor;
  final TextEditingController controller;
  final bool obscure;
  final VoidCallback onToggleVisibility;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: BoxDecoration(
        color: _C.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _C.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(9),
                  color: iconColor.withValues(alpha: 0.12),
                  border: Border.all(color: iconColor.withValues(alpha: 0.22)),
                ),
                child: Icon(icon, size: 16, color: iconColor),
              ),
              const SizedBox(width: 10),
              Text(label, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: controller,
            obscureText: obscure,
            textInputAction: textInputAction,
            onSubmitted: onSubmitted,
            style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: TextStyle(color: _C.faint, fontSize: 13, fontWeight: FontWeight.w500),
              filled: true,
              fillColor: _C.field,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: _C.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: _C.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: _C.green.withValues(alpha: 0.45)),
              ),
              suffixIcon: IconButton(
                onPressed: onToggleVisibility,
                icon: Icon(
                  obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                  size: 20,
                  color: _C.muted,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ChangePasswordTipBox extends StatelessWidget {
  const ChangePasswordTipBox({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _C.gold.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _C.gold.withValues(alpha: 0.22)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.warning_amber_rounded, size: 18, color: _C.gold.withValues(alpha: 0.9)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              "Use a unique password you don't reuse anywhere else. Avoid your name, DOB, or PAN.",
              style: TextStyle(fontSize: 11, color: _C.gold.withValues(alpha: 0.85), height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

class ChangePasswordSubmitButton extends StatelessWidget {
  const ChangePasswordSubmitButton({
    required this.enabled,
    required this.loading,
    required this.onTap,
    super.key,
  });

  final bool enabled;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled && !loading
            ? () {
                HapticFeedback.mediumImpact();
                onTap();
              }
            : null,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          height: 52,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: enabled
                ? LinearGradient(colors: [_C.green, _C.green.withValues(alpha: 0.78), const Color(0xFF059669)])
                : null,
            color: enabled ? null : _C.card,
            border: Border.all(color: enabled ? _C.green.withValues(alpha: 0.35) : _C.border),
            boxShadow: enabled
                ? [BoxShadow(color: _C.green.withValues(alpha: 0.2), blurRadius: 14, offset: const Offset(0, 5))]
                : null,
          ),
          child: Center(
            child: loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2, color: _C.bg),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle_outline_rounded, size: 20, color: enabled ? _C.bg : _C.faint),
                      const SizedBox(width: 8),
                      Text(
                        'Update password',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: enabled ? _C.bg : _C.faint,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class ChangePasswordErrorBanner extends StatelessWidget {
  const ChangePasswordErrorBanner({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _C.pink.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _C.pink.withValues(alpha: 0.35)),
      ),
      child: Text(message, style: const TextStyle(color: _C.pink, fontSize: 13, fontWeight: FontWeight.w600)),
    );
  }
}

/// Field accent colors matching reference layout.
abstract final class ChangePasswordFieldColors {
  static const current = _C.blue;
  static const newPassword = _C.green;
  static const confirm = _C.purple;
}
