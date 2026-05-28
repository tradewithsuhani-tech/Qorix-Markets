import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/login_approval_provider.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/pending_auth_flow_provider.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

/// New-device gate — poll GET /api/auth/login-attempts/:id/status.
class LoginApprovalScreen extends ConsumerStatefulWidget {
  const LoginApprovalScreen({super.key});

  @override
  ConsumerState<LoginApprovalScreen> createState() => _LoginApprovalScreenState();
}

class _LoginApprovalScreenState extends ConsumerState<LoginApprovalScreen> {
  final _otp = TextEditingController();

  @override
  void dispose() {
    _otp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pending = ref.watch(pendingLoginApprovalProvider);
    final approval = ref.watch(loginApprovalProvider);

    ref.listen(loginApprovalProvider, (prev, next) {
      if (next.phase == LoginApprovalPhase.approved) {
        context.go(RoutePaths.home);
      }
    });

    final compact = MediaQuery.sizeOf(context).height < 820;
    final deviceLabel = pending?.deviceLabel ?? 'New device';

    return Scaffold(
      backgroundColor: AppDesk.bg,
      body: AuthBackground(
        child: AuthFormPageShell(
          onBack: () => context.go(RoutePaths.login),
          showLogo: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
              AuthSectionTitle(
                title: 'Approve',
                highlight: 'login',
                subtitle: approval.phase == LoginApprovalPhase.otpEntry
                    ? 'Enter the 6-digit code sent to your registered email.'
                    : 'Open Qorix Markets on your signed-in device and approve this login.\n\n$deviceLabel',
                alignStart: true,
                leadingInset: 4,
              ),
              if (approval.isPolling) ...[
                SizedBox(height: compact ? AppSpacing.xxl : AppSpacing.xxxl),
                const Center(
                  child: SizedBox(
                    width: 36,
                    height: 36,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.authGreen),
                  ),
                ),
              ],
              if (approval.secondsUntilExpiry != null && approval.phase == LoginApprovalPhase.waiting) ...[
                const SizedBox(height: AppSpacing.lg),
                Text(
                  'Expires in ${approval.secondsUntilExpiry}s',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppDesk.textTertiary, fontSize: 12),
                ),
              ],
              if (approval.message != null) ...[
                const SizedBox(height: AppSpacing.md),
                AuthInlineError(message: approval.message!),
              ],
              if (approval.phase == LoginApprovalPhase.otpEntry) ...[
                SizedBox(height: compact ? AppSpacing.xxl : AppSpacing.xxxl),
                AuthCleanField(
                  controller: _otp,
                  hint: 'Email verification code',
                  icon: Icons.mail_outline_rounded,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _submitOtp(),
                ),
                const SizedBox(height: AppSpacing.lg),
                AuthCleanPrimaryButton(
                  label: 'Verify & Sign In',
                  onPressed: _otp.text.trim().length >= 6 ? _submitOtp : null,
                ),
              ] else if (approval.phase == LoginApprovalPhase.waiting) ...[
                SizedBox(height: compact ? AppSpacing.xxl : AppSpacing.xxxl),
                AuthCleanPrimaryButton(
                  label: approval.canRequestEmailOtp
                      ? 'Email me a code instead'
                      : 'Email code in ${approval.secondsUntilOtp}s',
                  onPressed: approval.canRequestEmailOtp
                      ? () => ref.read(loginApprovalProvider.notifier).requestEmailOtp()
                      : null,
                ),
              ],
              if (approval.phase == LoginApprovalPhase.failed) ...[
                SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xl),
                AuthCleanPrimaryButton(
                  label: 'Back to Sign In',
                  onPressed: () => context.go(RoutePaths.login),
                ),
              ],
              const SizedBox(height: AppSpacing.xxl),
              const AuthCleanSecurityFooter(),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submitOtp() async {
    await ref.read(loginApprovalProvider.notifier).verifyEmailOtp(_otp.text.trim());
  }
}
