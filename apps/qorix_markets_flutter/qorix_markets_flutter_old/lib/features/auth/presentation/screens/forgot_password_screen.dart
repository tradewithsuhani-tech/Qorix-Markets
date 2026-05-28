import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_controller.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

/// Forgot password — POST /api/auth/forgot-password.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  String? _errorMessage;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  void _goBack() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(RoutePaths.login);
    }
  }

  Future<void> _sendResetCode() async {
    final email = _email.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _errorMessage = 'Enter a valid email address.');
      return;
    }

    HapticFeedback.mediumImpact();
    setState(() => _errorMessage = null);

    final ok = await ref.read(authControllerProvider.notifier).forgotPassword(email);
    if (!mounted) return;

    if (!ok) {
      final err = ref.read(authControllerProvider).error;
      setState(() => _errorMessage = err != null ? ErrorMessage.from(err) : 'Could not send reset code.');
      return;
    }

    context.push(
      '${RoutePaths.otp}?email=${Uri.encodeComponent(email)}&flow=reset',
    );
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
                title: 'Forgot',
                highlight: 'password',
                subtitle: "Enter your registered email.\nWe'll send a 6-digit reset code.",
                alignStart: true,
                leadingInset: 4,
              ),
              SizedBox(height: compact ? AppSpacing.xxxl : AppSpacing.giant),
              AuthCleanField(
                controller: _email,
                hint: 'Email address',
                icon: Icons.mail_outline_rounded,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _sendResetCode(),
              ),
              SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xl),
              if (_errorMessage != null) ...[
                AuthInlineError(message: _errorMessage!),
                SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
              ],
              AuthCleanPrimaryButton(
                label: 'Send Reset Code',
                loading: loading,
                onPressed: loading ? null : _sendResetCode,
              ),
              SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xl),
              AuthFooterLink(
                prefix: 'Remember your password?',
                action: 'Sign in',
                onTap: _goBack,
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
