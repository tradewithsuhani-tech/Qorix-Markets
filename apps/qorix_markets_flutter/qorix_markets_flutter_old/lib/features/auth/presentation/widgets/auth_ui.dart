import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:flutter/services.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/ui/components/qorix_logo.dart';
import 'package:qorix_markets_flutter/widgets/app_background.dart';
import 'package:qorix_markets_flutter/widgets/desk_widgets.dart';

/// Matte desk backdrop — same language as main shell, subtle ambient glow.
class AuthBackground extends StatelessWidget {
  const AuthBackground({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AppBackground(glowIntensity: 0.22, child: child);
  }
}

bool _authCompact(BuildContext context) => MediaQuery.sizeOf(context).height < 820;

/// Tighter layout only when explicitly enabled via [AuthLayoutScope].
bool _authFormDense(BuildContext context) {
  return AuthLayoutScope.maybeOf(context)?.formDense ?? false;
}

/// Strips Material default focus ring (blue primary) from nested text fields.
ThemeData _authFieldTheme(BuildContext context) {
  return Theme.of(context).copyWith(
    splashColor: Colors.transparent,
    highlightColor: Colors.transparent,
    hoverColor: Colors.transparent,
    focusColor: Colors.transparent,
    colorScheme: Theme.of(context).colorScheme.copyWith(
      primary: AppColors.authGreen,
      secondary: AppColors.authGreen,
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: AppColors.authGreen,
      selectionColor: AppColors.authGreen.withValues(alpha: 0.25),
      selectionHandleColor: AppColors.authGreen,
    ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: false,
      fillColor: Colors.transparent,
      border: InputBorder.none,
      enabledBorder: InputBorder.none,
      focusedBorder: InputBorder.none,
      errorBorder: InputBorder.none,
      focusedErrorBorder: InputBorder.none,
      disabledBorder: InputBorder.none,
      contentPadding: EdgeInsets.zero,
      isDense: true,
      focusColor: Colors.transparent,
      hoverColor: Colors.transparent,
    ),
  );
}

InputDecoration _authFieldDecoration({required String hint}) {
  return InputDecoration(
    isCollapsed: true,
    hintText: hint,
    hintStyle: TextStyle(
      color: AppDesk.textTertiary,
      fontSize: 15,
      fontWeight: FontWeight.w400,
    ),
    border: InputBorder.none,
    enabledBorder: InputBorder.none,
    focusedBorder: InputBorder.none,
    disabledBorder: InputBorder.none,
    errorBorder: InputBorder.none,
    focusedErrorBorder: InputBorder.none,
    contentPadding: EdgeInsets.zero,
  );
}

class AuthLayoutScope extends InheritedWidget {
  const AuthLayoutScope({
    required this.formDense,
    required super.child,
    super.key,
  });

  final bool formDense;

  static AuthLayoutScope? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<AuthLayoutScope>();
  }

  @override
  bool updateShouldNotify(AuthLayoutScope oldWidget) => formDense != oldWidget.formDense;
}

// ── Clean auth (flat login) ─────────────────────────────────────────────────

class AuthCleanMark extends StatelessWidget {
  const AuthCleanMark({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: AppDesk.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppDesk.borderLine),
      ),
      child: Icon(Icons.show_chart_rounded, color: AppColors.authGreen, size: 22),
    );
  }
}

class AuthCleanField extends StatefulWidget {
  const AuthCleanField({
    required this.controller,
    required this.hint,
    required this.icon,
    super.key,
    this.obscureText = false,
    this.keyboardType,
    this.suffix,
    this.textInputAction,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool obscureText;
  final TextInputType? keyboardType;
  final Widget? suffix;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  State<AuthCleanField> createState() => _AuthCleanFieldState();
}

class _AuthCleanFieldState extends State<AuthCleanField> {
  final _focus = FocusNode();
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() => _focused = _focus.hasFocus));
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      curve: Curves.easeOut,
      height: 52,
      decoration: BoxDecoration(
        color: AppDesk.field,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: _focused ? AppColors.authGreen.withValues(alpha: 0.45) : AppDesk.borderLine,
          width: 1,
        ),
      ),
      child: Row(
        children: [
          const SizedBox(width: 16),
          Icon(
            widget.icon,
            size: 20,
            color: _focused ? AppColors.authGreen : AppDesk.textTertiary,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Theme(
              data: _authFieldTheme(context),
              child: Material(
                type: MaterialType.transparency,
                child: TextField(
                  controller: widget.controller,
                  focusNode: _focus,
                  obscureText: widget.obscureText,
                  keyboardType: widget.keyboardType,
                  textInputAction: widget.textInputAction,
                  onSubmitted: widget.onSubmitted,
                  style: TextStyle(
                    color: AppDesk.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                  cursorColor: AppColors.authGreen,
                  decoration: _authFieldDecoration(hint: widget.hint),
                ),
              ),
            ),
          ),
          if (widget.suffix != null) widget.suffix!,
          const SizedBox(width: 8),
        ],
      ),
    );
  }
}

class AuthCleanPrimaryButton extends StatelessWidget {
  const AuthCleanPrimaryButton({
    required this.label,
    required this.onPressed,
    super.key,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: Material(
        color: enabled ? AppColors.authGreen : AppColors.authGreen.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: InkWell(
          onTap: enabled ? onPressed : null,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Center(
            child: loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black87),
                  )
                : Text(
                    label,
                    style: const TextStyle(
                      color: Color(0xFF0A1A0F),
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.1,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

class AuthCleanOutlineButton extends StatelessWidget {
  const AuthCleanOutlineButton({
    required this.label,
    required this.onPressed,
    super.key,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.4)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 18, color: AppColors.authGreen),
                  const SizedBox(width: 8),
                ],
                Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.authGreen,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
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

class AuthCleanNotice extends StatelessWidget {
  const AuthCleanNotice(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppDesk.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppDesk.borderLine),
      ),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 12,
          height: 1.4,
          color: AppDesk.textTertiary,
        ),
      ),
    );
  }
}

class AuthCleanSecurityFooter extends StatelessWidget {
  const AuthCleanSecurityFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppDesk.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.shield_outlined, size: 16, color: AppColors.authGreen.withValues(alpha: 0.88)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              '256-bit encrypted · JWT secured · 2FA enabled',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                height: 1.35,
                color: AppDesk.textTertiary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class AuthBrandHeader extends StatelessWidget {
  const AuthBrandHeader({this.minimal = false, super.key});

  /// Compact single-row header for register / long forms.
  final bool minimal;

  @override
  Widget build(BuildContext context) {
    if (minimal) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const QorixLogo(size: 34, useAuthGreen: true),
          const SizedBox(width: 10),
          RichText(
            text: TextSpan(
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.6,
                height: 1.05,
              ),
              children: const [
                TextSpan(text: 'Qorix ', style: TextStyle(color: Colors.white)),
                TextSpan(text: 'Markets', style: TextStyle(color: AppColors.authGreen)),
              ],
            ),
          ),
        ],
      );
    }

    final compact = _authCompact(context);
    final logoSize = compact ? 58.0 : 68.0;

    return Column(
      children: [
        Container(
          decoration: BoxDecoration(
            boxShadow: [
              BoxShadow(
                color: AppColors.authGreen.withValues(alpha: compact ? 0.28 : 0.35),
                blurRadius: compact ? 28 : 36,
                spreadRadius: -8,
              ),
            ],
          ),
          child: QorixLogo(size: logoSize, useAuthGreen: true),
        ),
        SizedBox(height: compact ? 10 : 14),
        RichText(
          text: TextSpan(
            style: TextStyle(
              fontSize: compact ? 24 : 28,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.8,
              height: 1.05,
            ),
            children: const [
              TextSpan(text: 'Qorix ', style: TextStyle(color: Colors.white)),
              TextSpan(text: 'Markets', style: TextStyle(color: AppColors.authGreen)),
            ],
          ),
        ),
        SizedBox(height: compact ? 6 : 8),
        Text(
          'TRADE. INVEST. GROW.',
          style: TextStyle(
            fontSize: compact ? 9.5 : 10,
            letterSpacing: compact ? 2.6 : 3,
            fontWeight: FontWeight.w600,
            color: AppColors.authMuted.withValues(alpha: 0.75),
          ),
        ),
      ],
    );
  }
}

/// Frosted glass card with green edge glow. Set [showCard] false to render flat on background.
class AuthFormCard extends StatelessWidget {
  const AuthFormCard({required this.child, super.key, this.showCard = true});

  final Widget child;
  final bool showCard;

  @override
  Widget build(BuildContext context) {
    final compact = _authCompact(context);
    final formDense = _authFormDense(context);

    if (!showCard) {
      return Padding(
        padding: EdgeInsets.symmetric(vertical: formDense ? 8 : (compact ? 12 : 16)),
        child: child,
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(formDense ? 22 : (compact ? 24 : 28)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.fromLTRB(
            20,
            formDense ? 18 : (compact ? 22 : 26),
            20,
            formDense ? 16 : (compact ? 18 : 22),
          ),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                const Color(0xFF0F1C20).withValues(alpha: 0.88),
                const Color(0xFF0A1418).withValues(alpha: 0.94),
              ],
            ),
            borderRadius: BorderRadius.circular(formDense ? 22 : (compact ? 24 : 28)),
            border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.28)),
            boxShadow: [
              BoxShadow(
                color: AppColors.authGreen.withValues(alpha: 0.06),
                blurRadius: 40,
                spreadRadius: -6,
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.5),
                blurRadius: 32,
                offset: const Offset(0, 16),
              ),
            ],
          ),
          child: Stack(
            children: [
              Positioned(
                top: 0,
                left: 24,
                right: 24,
                child: Container(
                  height: 1,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.transparent,
                        AppColors.authGreen.withValues(alpha: 0.55),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

class AuthCardIcon extends StatelessWidget {
  const AuthCardIcon({required this.icon, this.small = false, super.key});

  final IconData icon;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final formDense = _authFormDense(context);
    final size = small || formDense ? 40.0 : 48.0;
    final iconSize = small || formDense ? 18.0 : 22.0;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.authGreen.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: AppColors.authGreen.withValues(alpha: 0.12),
            blurRadius: 12,
          ),
        ],
      ),
      child: Icon(icon, color: AppColors.authGreen, size: iconSize),
    );
  }
}

class AuthInputField extends StatefulWidget {
  const AuthInputField({
    required this.controller,
    required this.hint,
    required this.icon,
    super.key,
    this.obscureText = false,
    this.keyboardType,
    this.suffix,
    this.textInputAction,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool obscureText;
  final TextInputType? keyboardType;
  final Widget? suffix;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  State<AuthInputField> createState() => _AuthInputFieldState();
}

class _AuthInputFieldState extends State<AuthInputField> {
  final _focusNode = FocusNode();
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() => setState(() => _focused = _focusNode.hasFocus));
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final compact = _authCompact(context);
    final formDense = _authFormDense(context);
    final fieldHeight = formDense ? 46.0 : (compact ? 50.0 : 54.0);
    final iconBox = formDense ? 34.0 : 38.0;
    final borderColor = _focused
        ? AppColors.authGreen.withValues(alpha: 0.55)
        : AppColors.authInputBorder;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      height: fieldHeight,
      decoration: BoxDecoration(
        color: AppColors.authInputBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor, width: _focused ? 1.5 : 1),
        boxShadow: _focused
            ? [
                BoxShadow(
                  color: AppColors.authGreen.withValues(alpha: 0.12),
                  blurRadius: 14,
                  spreadRadius: -2,
                ),
              ]
            : null,
      ),
      child: Row(
        children: [
          const SizedBox(width: 8),
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: iconBox,
            height: iconBox,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: _focused
                    ? AppColors.authGreen.withValues(alpha: 0.5)
                    : AppColors.authGreen.withValues(alpha: 0.28),
              ),
              color: AppColors.authGreen.withValues(alpha: _focused ? 0.1 : 0.05),
            ),
            child: Icon(widget.icon, color: AppColors.authGreen, size: formDense ? 16 : 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Align(
              alignment: Alignment.centerLeft,
              child: Theme(
                data: _authFieldTheme(context),
                child: Material(
                  type: MaterialType.transparency,
                  child: TextField(
                    controller: widget.controller,
                    focusNode: _focusNode,
                    obscureText: widget.obscureText,
                    keyboardType: widget.keyboardType,
                    textInputAction: widget.textInputAction,
                    onSubmitted: widget.onSubmitted,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.1,
                    ),
                    cursorColor: AppColors.authGreen,
                    decoration: _authFieldDecoration(hint: widget.hint).copyWith(
                      hintStyle: TextStyle(
                        color: AppColors.authMuted.withValues(alpha: 0.7),
                        fontSize: 15,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (widget.suffix != null) widget.suffix!,
          const SizedBox(width: 6),
        ],
      ),
    );
  }
}

class AuthPrimaryButton extends StatelessWidget {
  const AuthPrimaryButton({
    required this.label,
    required this.onPressed,
    super.key,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: DeskPrimaryCta(label: label, onTap: onPressed, loading: loading),
    );
  }
}

class _ButtonDotPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.black;
    const gap = 7.0;
    for (var y = 0.0; y < size.height; y += gap) {
      for (var x = 0.0; x < size.width; x += gap) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class AuthGoogleButton extends StatelessWidget {
  const AuthGoogleButton({required this.onPressed, super.key});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            width: double.infinity,
            height: 50,
            decoration: BoxDecoration(
              color: const Color(0xFF0C1316),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.9)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
              Container(
                width: 24,
                height: 24,
                decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                alignment: Alignment.center,
                child: ShaderMask(
                  shaderCallback: (bounds) => const LinearGradient(
                    colors: [Color(0xFF4285F4), Color(0xFFEA4335), Color(0xFFFBBC05), Color(0xFF34A853)],
                  ).createShader(bounds),
                  child: const Text(
                    'G',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              const Text(
                'Continue with Google',
                style: TextStyle(
                  color: Color(0xFFE8ECEE),
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.1,
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

class AuthDivider extends StatelessWidget {
  const AuthDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _fadeLine(Alignment.centerLeft)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            'OR CONTINUE WITH',
            style: TextStyle(
              fontSize: 9.5,
              letterSpacing: 1.6,
              fontWeight: FontWeight.w700,
              color: AppColors.authMuted.withValues(alpha: 0.8),
            ),
          ),
        ),
        Expanded(child: _fadeLine(Alignment.centerRight)),
      ],
    );
  }

  Widget _fadeLine(Alignment alignment) {
    return Container(
      height: 1,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: alignment == Alignment.centerLeft ? Alignment.centerLeft : Alignment.centerRight,
          end: alignment == Alignment.centerLeft ? Alignment.centerRight : Alignment.centerLeft,
          colors: [
            AppColors.authGreen.withValues(alpha: 0.45),
            AppColors.authInputBorder.withValues(alpha: 0.3),
            Colors.transparent,
          ],
        ),
      ),
    );
  }
}

class AuthFooterLink extends StatelessWidget {
  const AuthFooterLink({
    required this.prefix,
    required this.action,
    required this.onTap,
    super.key,
  });

  final String prefix;
  final String action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final formDense = _authFormDense(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: EdgeInsets.symmetric(
            vertical: formDense ? 6 : 10,
            horizontal: 8,
          ),
          child: RichText(
            textAlign: TextAlign.center,
            text: TextSpan(
              style: TextStyle(
                fontSize: 14,
                color: AppColors.authMuted.withValues(alpha: 0.9),
                height: 1.4,
              ),
              children: [
                TextSpan(text: '$prefix '),
                TextSpan(
                  text: action,
                  style: const TextStyle(
                    color: AppColors.authGreen,
                    fontWeight: FontWeight.w700,
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

class AuthBackBar extends StatelessWidget {
  const AuthBackBar({required this.onBack, this.showLogo = true, super.key});

  final VoidCallback onBack;
  final bool showLogo;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
      child: Row(
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                HapticFeedback.lightImpact();
                onBack();
              },
              borderRadius: BorderRadius.circular(12),
              child: Ink(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.8)),
                ),
                child: Icon(
                  Icons.arrow_back_ios_new_rounded,
                  size: 18,
                  color: Colors.white.withValues(alpha: 0.92),
                ),
              ),
            ),
          ),
          if (showLogo) ...[
            const Spacer(),
            const QorixLogo(size: 34, useAuthGreen: true, glow: false),
            const Spacer(),
            const SizedBox(width: 44),
          ],
        ],
      ),
    );
  }
}

/// Scrollable auth layout — fits small screens without cutting the card.
class AuthPageShell extends StatelessWidget {
  const AuthPageShell({
    required this.child,
    this.formDense = false,
    super.key,
  });

  final Widget child;
  final bool formDense;

  @override
  Widget build(BuildContext context) {
    final padding = MediaQuery.paddingOf(context);
    final compact = _authCompact(context);
    final dense = formDense || compact;

    return AuthLayoutScope(
      formDense: dense,
      child: SafeArea(
        bottom: true,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: AppScroll.page,
          ),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: EdgeInsets.fromLTRB(
            20,
            compact ? 2 : 6,
            20,
            padding.bottom + 20,
          ),
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

/// Long-form auth screens: back bar + scrollable form (single scroll view).
class AuthFormPageShell extends StatelessWidget {
  const AuthFormPageShell({
    required this.onBack,
    required this.child,
    this.showLogo = true,
    super.key,
  });

  final VoidCallback onBack;
  final Widget child;
  final bool showLogo;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;

    return SafeArea(
      bottom: false,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: AppScroll.page,
        ),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: EdgeInsets.fromLTRB(16, 4, 16, bottom + 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AuthBackBar(onBack: onBack, showLogo: showLogo),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: child,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AuthSectionTitle extends StatelessWidget {
  const AuthSectionTitle({
    required this.title,
    required this.highlight,
    required this.subtitle,
    super.key,
    this.alignStart = false,
    this.leadingInset = 0,
  });

  final String title;
  final String highlight;
  final String subtitle;
  final bool alignStart;
  /// Nudge start edge to line up with adjacent field boxes.
  final double leadingInset;

  @override
  Widget build(BuildContext context) {
    final compact = _authCompact(context);
    final formDense = _authFormDense(context);
    final align = alignStart ? TextAlign.start : TextAlign.center;

    return Padding(
      padding: EdgeInsets.only(left: leadingInset),
      child: SizedBox(
        width: double.infinity,
        child: Column(
          crossAxisAlignment: alignStart ? CrossAxisAlignment.start : CrossAxisAlignment.center,
          children: [
            RichText(
              textAlign: align,
              text: TextSpan(
            style: TextStyle(
              fontSize: formDense ? 21 : (compact ? 23 : 26),
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.5,
              height: 1.15,
            ),
            children: [
              TextSpan(text: '$title '),
              TextSpan(text: highlight, style: const TextStyle(color: AppColors.authGreen)),
            ],
          ),
        ),
        SizedBox(height: formDense ? 4 : (compact ? 6 : 8)),
        Text(
          subtitle,
          textAlign: align,
          style: TextStyle(
            fontSize: formDense ? 12 : (compact ? 13 : 14),
            height: 1.35,
            color: AppColors.authMuted.withValues(alpha: 0.88),
          ),
        ),
          ],
        ),
      ),
    );
  }
}

/// Mask email for OTP subtitle — e.g. t***@qorixmarkets.com
String maskAuthEmail(String email) {
  final parts = email.split('@');
  if (parts.length != 2 || parts[0].isEmpty) return email;
  final local = parts[0];
  final masked = local.length == 1
      ? '$local***'
      : '${local[0]}${'*' * (local.length - 1).clamp(2, 5)}';
  return '$masked@${parts[1]}';
}

/// Six-digit OTP boxes — auth green theme, auto-advance.
class AuthOtpInput extends StatefulWidget {
  const AuthOtpInput({
    required this.onCompleted,
    super.key,
    this.length = 6,
    this.enabled = true,
    this.hasError = false,
    this.onChanged,
  });

  final int length;
  final ValueChanged<String> onCompleted;
  final bool enabled;
  final bool hasError;
  final ValueChanged<String>? onChanged;

  @override
  State<AuthOtpInput> createState() => AuthOtpInputState();
}

class AuthOtpInputState extends State<AuthOtpInput> {
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _focusNodes;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(widget.length, (_) => TextEditingController());
    _focusNodes = List.generate(widget.length, (_) => FocusNode()..addListener(_onFocusChange));
  }

  void _onFocusChange() {
    if (mounted) setState(() {});
  }

  @override
  void didUpdateWidget(covariant AuthOtpInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.hasError && !widget.hasError) {
      clear();
    }
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  void clear() {
    for (final c in _controllers) {
      c.clear();
    }
    _focusNodes.first.requestFocus();
    widget.onChanged?.call('');
  }

  String get code => _controllers.map((c) => c.text).join();

  void _notifyChanged() {
    widget.onChanged?.call(code);
    if (code.length == widget.length) {
      HapticFeedback.mediumImpact();
      widget.onCompleted(code);
    }
  }

  void _onChanged(int index, String value) {
    if (value.length > 1) {
      _controllers[index].text = value.substring(value.length - 1);
    }
    if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    } else if (value.isNotEmpty && index < widget.length - 1) {
      HapticFeedback.selectionClick();
      _focusNodes[index + 1].requestFocus();
    }
    _notifyChanged();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(widget.length, (index) {
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(left: index == 0 ? 0 : 5),
            child: _OtpBox(
              controller: _controllers[index],
              focusNode: _focusNodes[index],
              enabled: widget.enabled,
              hasError: widget.hasError,
              onChanged: (value) => _onChanged(index, value),
            ),
          ),
        );
      }),
    );
  }
}

class _OtpBox extends StatelessWidget {
  const _OtpBox({
    required this.controller,
    required this.focusNode,
    required this.enabled,
    required this.hasError,
    required this.onChanged,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;
  final bool hasError;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final focused = focusNode.hasFocus;
    final filled = controller.text.isNotEmpty;
    final borderColor = hasError
        ? AppColors.sell.withValues(alpha: 0.7)
        : focused || filled
            ? AppColors.authGreen.withValues(alpha: 0.55)
            : AppColors.authInputBorder;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      height: 54,
      decoration: BoxDecoration(
        color: AppColors.authInputBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: borderColor,
          width: focused || hasError ? 1.5 : 1,
        ),
        boxShadow: focused && !hasError
            ? [
                BoxShadow(
                  color: AppColors.authGreen.withValues(alpha: 0.12),
                  blurRadius: 12,
                  spreadRadius: -2,
                ),
              ]
            : null,
      ),
      child: Theme(
        data: Theme.of(context).copyWith(
          inputDecorationTheme: const InputDecorationTheme(
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
          ),
        ),
        child: TextField(
          controller: controller,
          focusNode: focusNode,
          enabled: enabled,
          textAlign: TextAlign.center,
          keyboardType: TextInputType.number,
          maxLength: 1,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 22,
            fontWeight: FontWeight.w700,
            letterSpacing: 0,
          ),
          cursorColor: AppColors.authGreen,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: const InputDecoration(
            counterText: '',
            border: InputBorder.none,
            contentPadding: EdgeInsets.zero,
          ),
          onChanged: onChanged,
          onTap: () => HapticFeedback.selectionClick(),
        ),
      ),
    );
  }
}

class AuthResendRow extends StatelessWidget {
  const AuthResendRow({
    required this.secondsLeft,
    required this.onResend,
    super.key,
  });

  final int secondsLeft;
  final VoidCallback onResend;

  @override
  Widget build(BuildContext context) {
    final canResend = secondsLeft <= 0;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          "Didn't receive the code?",
          style: TextStyle(
            fontSize: 13,
            color: AppColors.authMuted.withValues(alpha: 0.88),
          ),
        ),
        TextButton(
          onPressed: canResend
              ? () {
                  HapticFeedback.lightImpact();
                  onResend();
                }
              : null,
          style: TextButton.styleFrom(
            foregroundColor: AppColors.authGreen,
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Text(
            canResend ? 'Resend' : 'Resend in ${secondsLeft}s',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: canResend
                  ? AppColors.authGreen
                  : AppColors.authMuted.withValues(alpha: 0.55),
            ),
          ),
        ),
      ],
    );
  }
}

/// Visible auth error — above buttons (snackbars were unreadable on dark theme).
class AuthInlineError extends StatelessWidget {
  const AuthInlineError({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.sell.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.sell.withValues(alpha: 0.45)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error_outline_rounded, color: AppColors.sell.withValues(alpha: 0.95), size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.95),
                fontSize: 13,
                height: 1.35,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

void showAuthSnackBar(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
        ),
        behavior: SnackBarBehavior.floating,
        backgroundColor: const Color(0xFF1A2830),
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        duration: const Duration(seconds: 5),
      ),
    );
}
