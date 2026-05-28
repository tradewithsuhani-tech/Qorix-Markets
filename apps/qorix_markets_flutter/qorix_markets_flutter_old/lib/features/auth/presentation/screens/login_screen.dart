import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_controller.dart'
    show LoginRoute, authControllerProvider;
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/ui/components/qorix_logo.dart';

/// Login — flat professional layout, Q mark, no card.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  String? _errorMessage;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _signInWithGoogle() async {
    HapticFeedback.mediumImpact();
    setState(() => _errorMessage = null);
    final ok = await ref.read(authControllerProvider.notifier).signInWithGoogle();
    if (!mounted) return;
    if (ok) context.go(RoutePaths.home);
  }

  Future<void> _signIn() async {
    HapticFeedback.mediumImpact();
    setState(() => _errorMessage = null);
    final email = _email.text.trim().isEmpty ? 'trader@qorixmarkets.com' : _email.text.trim();
    final password = _password.text.isEmpty ? 'password123' : _password.text;
    final route = await ref.read(authControllerProvider.notifier).login(email, password);
    if (!mounted) return;
    switch (route) {
      case LoginRoute.success:
        context.go(RoutePaths.home);
      case LoginRoute.twoFactor:
        context.push(RoutePaths.loginTwoFactor);
      case LoginRoute.verifyEmail:
        context.push('${RoutePaths.otp}?email=${Uri.encodeComponent(email)}');
      case LoginRoute.deviceApproval:
        context.push(RoutePaths.loginApproval);
      case LoginRoute.cancelled:
        break;
    }
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
        child: AuthPageShell(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: compact ? AppSpacing.xxl : AppSpacing.xxxl),
              Center(
                child: QorixLogo(
                  size: compact ? 48 : 52,
                  useAuthGreen: true,
                  glow: false,
                ),
              ),
              SizedBox(height: compact ? AppSpacing.xl : AppSpacing.xxl),
              const AuthSectionTitle(
                title: 'Welcome',
                highlight: 'back',
                subtitle: 'Sign in to your trading account',
              ),
              SizedBox(height: compact ? AppSpacing.xxl : AppSpacing.xxxl),
              AuthCleanField(
                controller: _email,
                hint: 'Email address',
                icon: Icons.mail_outline_rounded,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: AppSpacing.md),
              AuthCleanField(
                controller: _password,
                hint: 'Password',
                icon: Icons.lock_outline_rounded,
                obscureText: _obscure,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _signIn(),
                suffix: IconButton(
                  splashRadius: 20,
                  icon: Icon(
                    _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                    color: AppDesk.textTertiary,
                    size: 20,
                  ),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => context.push(RoutePaths.forgotPassword),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.authGreen,
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text(
                    'Forgot password?',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xl),
              if (_errorMessage != null) ...[
                AuthInlineError(message: _errorMessage!),
                SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
              ],
              AuthCleanPrimaryButton(
                label: 'Sign In',
                loading: loading,
                onPressed: _signIn,
              ),
              SizedBox(height: compact ? AppSpacing.xxl : AppSpacing.xxxl),
              const AuthDivider(),
              SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xl),
              AuthGoogleButton(
                onPressed: loading ? null : _signInWithGoogle,
              ),
              SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
              AuthFooterLink(
                prefix: "Don't have an account?",
                action: 'Create one',
                onTap: () => context.push(RoutePaths.register),
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
