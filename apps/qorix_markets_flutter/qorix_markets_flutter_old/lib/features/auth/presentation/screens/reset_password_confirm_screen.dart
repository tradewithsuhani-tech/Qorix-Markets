import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_controller.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

/// New password after reset OTP verified — POST /api/auth/reset-password.
class ResetPasswordConfirmScreen extends ConsumerStatefulWidget {
  const ResetPasswordConfirmScreen({
    super.key,
    required this.email,
    required this.resetOtp,
  });

  final String email;
  final String resetOtp;

  @override
  ConsumerState<ResetPasswordConfirmScreen> createState() =>
      _ResetPasswordConfirmScreenState();
}

class _ResetPasswordConfirmScreenState extends ConsumerState<ResetPasswordConfirmScreen> {
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  String? _errorMessage;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  bool get _canSubmit {
    final p = _password.text;
    final c = _confirm.text;
    return p.length >= 8 && p.length <= 128 && p == c;
  }

  void _goBack() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(RoutePaths.forgotPassword);
    }
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    HapticFeedback.mediumImpact();
    setState(() => _errorMessage = null);

    final ok = await ref.read(authControllerProvider.notifier).resetPassword(
          email: widget.email,
          resetOtp: widget.resetOtp,
          newPassword: _password.text,
        );
    if (!mounted) return;

    if (!ok) {
      final err = ref.read(authControllerProvider).error;
      setState(() => _errorMessage = err != null ? ErrorMessage.from(err) : 'Could not reset password.');
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.authCardBg,
        content: const Text(
          'Password reset successful. Sign in with your new password.',
          style: TextStyle(color: Colors.white, fontSize: 13),
        ),
      ),
    );
    context.go(RoutePaths.login);
  }

  @override
  Widget build(BuildContext context) {
    final loading = ref.watch(authControllerProvider).isLoading;
    final compact = MediaQuery.sizeOf(context).height < 820;

    ref.listen(authControllerProvider, (prev, next) {
      next.whenOrNull(
        error: (error, _) {
          if (!mounted) return;
          setState(() => _errorMessage = ErrorMessage.from(error));
        },
      );
    });

    return Scaffold(
      backgroundColor: AppDesk.bg,
      resizeToAvoidBottomInset: true,
      body: AuthBackground(
        child: AuthFormPageShell(
          onBack: _goBack,
          showLogo: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
              const AuthSectionTitle(
                title: 'Create',
                highlight: 'new password',
                subtitle: 'Use at least 8 characters. Withdrawals may be locked briefly after reset.',
                alignStart: true,
                leadingInset: 4,
              ),
              SizedBox(height: compact ? AppSpacing.xxxl : AppSpacing.giant),
              AuthCleanField(
                controller: _password,
                hint: 'New password',
                icon: Icons.lock_outline_rounded,
                obscureText: _obscurePassword,
                textInputAction: TextInputAction.next,
                suffix: IconButton(
                  splashRadius: 20,
                  icon: Icon(
                    _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                    color: AppDesk.textTertiary,
                    size: 20,
                  ),
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              AuthCleanField(
                controller: _confirm,
                hint: 'Confirm password',
                icon: Icons.lock_outline_rounded,
                obscureText: _obscureConfirm,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _canSubmit && !loading ? _submit() : null,
                suffix: IconButton(
                  splashRadius: 20,
                  icon: Icon(
                    _obscureConfirm ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                    color: AppDesk.textTertiary,
                    size: 20,
                  ),
                  onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                ),
              ),
              SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xl),
              if (_errorMessage != null) ...[
                AuthInlineError(message: _errorMessage!),
                SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
              ],
              AuthCleanPrimaryButton(
                label: 'Update Password',
                loading: loading,
                onPressed: _canSubmit && !loading ? _submit : null,
              ),
              SizedBox(height: compact ? AppSpacing.xxl : AppSpacing.xxxl),
              const AuthCleanSecurityFooter(),
            ],
          ),
        ),
      ),
    );
  }
}
