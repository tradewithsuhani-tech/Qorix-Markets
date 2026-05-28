import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_controller.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

/// Sign up — flat layout, no card, matches login.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _fullName = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirmPassword = TextEditingController();
  final _referral = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  String? _errorMessage;

  @override
  void dispose() {
    _fullName.dispose();
    _email.dispose();
    _password.dispose();
    _confirmPassword.dispose();
    _referral.dispose();
    super.dispose();
  }

  Future<void> _signInWithGoogle() async {
    HapticFeedback.mediumImpact();
    setState(() => _errorMessage = null);
    final ok = await ref.read(authControllerProvider.notifier).signInWithGoogle();
    if (!mounted) return;
    if (ok) context.go(RoutePaths.home);
  }

  void _goBack() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(RoutePaths.login);
    }
  }

  void _setError(String message, {bool snackbar = false}) {
    setState(() => _errorMessage = message);
    if (snackbar) showAuthSnackBar(context, message);
  }

  Future<void> _createAccount() async {
    HapticFeedback.mediumImpact();
    setState(() => _errorMessage = null);

    final email = _email.text.trim();
    final password = _password.text;
    final confirm = _confirmPassword.text;
    final fullName = _fullName.text.trim();

    if (fullName.isEmpty) {
      _setError('Enter your full name');
      return;
    }
    if (email.isEmpty || !email.contains('@')) {
      _setError('Enter a valid email address');
      return;
    }
    if (password.length < 8) {
      _setError('Password must be at least 8 characters');
      return;
    }
    if (password != confirm) {
      _setError('Passwords do not match');
      return;
    }

    final ok = await ref.read(authControllerProvider.notifier).register(
          email: email,
          password: password,
          fullName: fullName,
          referralCode: _referral.text.trim().isEmpty ? null : _referral.text.trim(),
        );
    if (!mounted) return;
    if (ok) {
      context.go('${RoutePaths.otp}?email=${Uri.encodeComponent(email)}');
    }
  }

  Widget _visibilityToggle({required bool obscure, required VoidCallback onToggle}) {
    return IconButton(
      splashRadius: 20,
      icon: Icon(
        obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
        color: AppDesk.textTertiary,
        size: 20,
      ),
      onPressed: onToggle,
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
          _setError(ErrorMessage.from(error));
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
                highlight: 'account',
                subtitle: 'Start your automated trading journey',
                alignStart: true,
                leadingInset: 4,
              ),
              SizedBox(height: compact ? AppSpacing.xxl : AppSpacing.xxxl),
              AuthCleanField(
                controller: _fullName,
                hint: 'Full name',
                icon: Icons.person_outline_rounded,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: AppSpacing.md),
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
                obscureText: _obscurePassword,
                textInputAction: TextInputAction.next,
                suffix: _visibilityToggle(
                  obscure: _obscurePassword,
                  onToggle: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              AuthCleanField(
                controller: _confirmPassword,
                hint: 'Confirm password',
                icon: Icons.lock_outline_rounded,
                obscureText: _obscureConfirm,
                textInputAction: TextInputAction.next,
                suffix: _visibilityToggle(
                  obscure: _obscureConfirm,
                  onToggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              AuthCleanField(
                controller: _referral,
                hint: 'Referral code (optional)',
                icon: Icons.card_giftcard_outlined,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _createAccount(),
              ),
              if (_errorMessage != null) ...[
                SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
                AuthInlineError(message: _errorMessage!),
              ],
              SizedBox(height: compact ? AppSpacing.xl : AppSpacing.xxl),
              AuthCleanPrimaryButton(
                label: 'Create Account',
                loading: loading,
                onPressed: _createAccount,
              ),
              SizedBox(height: compact ? AppSpacing.xxl : AppSpacing.xxxl),
              const AuthDivider(),
              SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xl),
              AuthGoogleButton(
                onPressed: loading ? null : _signInWithGoogle,
              ),
              SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xl),
              AuthFooterLink(
                prefix: 'Already have an account?',
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
