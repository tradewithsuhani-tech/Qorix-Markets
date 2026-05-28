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

/// Second leg after POST /api/auth/login returns requires2FA.
class LoginTwoFactorScreen extends ConsumerStatefulWidget {
  const LoginTwoFactorScreen({super.key});

  @override
  ConsumerState<LoginTwoFactorScreen> createState() => _LoginTwoFactorScreenState();
}

class _LoginTwoFactorScreenState extends ConsumerState<LoginTwoFactorScreen> {
  final _codeController = TextEditingController();
  bool _verifying = false;
  bool _error = false;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  void _goBack() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(RoutePaths.login);
    }
  }

  Future<void> _verify() async {
    final code = _codeController.text.trim();
    if (code.length < 6 || _verifying) return;
    setState(() {
      _verifying = true;
      _error = false;
    });

    final ok = await ref.read(authControllerProvider.notifier).complete2faLogin(code);
    if (!mounted) return;
    setState(() => _verifying = false);

    if (!ok) {
      setState(() => _error = true);
      final err = ref.read(authControllerProvider).error;
      if (err != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.authCardBg,
            content: Text(ErrorMessage.from(err), style: const TextStyle(color: Colors.white, fontSize: 13)),
          ),
        );
      }
      return;
    }

    context.go(RoutePaths.home);
  }

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).height < 820;

    return Scaffold(
      backgroundColor: AppDesk.bg,
      body: AuthBackground(
        child: AuthFormPageShell(
          onBack: _goBack,
          showLogo: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
              const AuthSectionTitle(
                title: 'Two-factor',
                highlight: 'authentication',
                subtitle: 'Enter the 6-digit code from your authenticator app\nor an 8-character backup code.',
                alignStart: true,
                leadingInset: 4,
              ),
              SizedBox(height: compact ? AppSpacing.xxxl : AppSpacing.giant),
              AuthCleanField(
                controller: _codeController,
                hint: 'Authenticator or backup code',
                icon: Icons.shield_outlined,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _verify(),
              ),
              if (_error) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Invalid code. Try again.',
                  style: TextStyle(color: AppColors.sell.withValues(alpha: 0.95), fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ],
              SizedBox(height: compact ? AppSpacing.xxl : AppSpacing.xxl),
              AuthCleanPrimaryButton(
                label: 'Verify & Sign In',
                loading: _verifying,
                onPressed: _codeController.text.trim().length >= 6 && !_verifying ? _verify : null,
              ),
              const SizedBox(height: AppSpacing.xxl),
              const AuthCleanSecurityFooter(),
            ],
          ),
        ),
      ),
    );
  }
}
