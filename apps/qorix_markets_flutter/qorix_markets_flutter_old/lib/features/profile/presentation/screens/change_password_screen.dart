import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';

import 'package:qorix_markets_flutter/core/errors/exceptions.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/profile/application/security_providers.dart';
import 'package:qorix_markets_flutter/features/profile/infrastructure/security_repository_impl.dart';
import 'package:qorix_markets_flutter/features/profile/presentation/widgets/change_password_ui.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirm = TextEditingController();

  bool _hideCurrent = true;
  bool _hideNew = true;
  bool _hideConfirm = true;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    for (final c in [_current, _newPassword, _confirm]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    _current.dispose();
    _newPassword.dispose();
    _confirm.dispose();
    super.dispose();
  }

  bool get _canSubmit {
    final current = _current.text.trim();
    final next = _newPassword.text.trim();
    final confirm = _confirm.text.trim();
    return current.length >= 6 && next.length >= 8 && next == confirm;
  }

  Future<void> _submit() async {
    if (!_canSubmit || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final result = await ref.read(securityRepositoryProvider).changePassword(
            currentPassword: _current.text.trim(),
            newPassword: _newPassword.text.trim(),
          );
      await ref.read(securityStatusProvider.notifier).refresh();
      if (!mounted) return;

      final lockHours = result.withdrawalLockHours ?? 24;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.message ??
                'Password updated. Withdrawals locked for $lockHours hours — deposits and trading continue.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
      safePop(context);
    } on ServerException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } on ValidationException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not update password. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      body: SafeArea(
        bottom: false,
        child: Responsive.constrained(
          context,
          ListView(
            physics: AppScroll.page,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              ChangePasswordAppBar(onBack: () => safePop(context)),
              const SizedBox(height: 16),
              const ChangePasswordHeroCard(),
              const SizedBox(height: 14),
              ChangePasswordFieldCard(
                label: 'Current Password',
                hint: 'Enter current password',
                icon: Icons.lock_outline_rounded,
                iconColor: ChangePasswordFieldColors.current,
                controller: _current,
                obscure: _hideCurrent,
                onToggleVisibility: () => setState(() => _hideCurrent = !_hideCurrent),
                onSubmitted: (_) => setState(() {}),
              ),
              const SizedBox(height: 10),
              ChangePasswordFieldCard(
                label: 'New Password',
                hint: 'Create strong password',
                icon: Icons.lock_outline_rounded,
                iconColor: ChangePasswordFieldColors.newPassword,
                controller: _newPassword,
                obscure: _hideNew,
                onToggleVisibility: () => setState(() => _hideNew = !_hideNew),
                onSubmitted: (_) => setState(() {}),
              ),
              const SizedBox(height: 10),
              ChangePasswordFieldCard(
                label: 'Confirm New Password',
                hint: 'Re-enter new password',
                icon: Icons.lock_outline_rounded,
                iconColor: ChangePasswordFieldColors.confirm,
                controller: _confirm,
                obscure: _hideConfirm,
                onToggleVisibility: () => setState(() => _hideConfirm = !_hideConfirm),
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                ChangePasswordErrorBanner(message: _error!),
              ],
              const SizedBox(height: 14),
              const ChangePasswordTipBox(),
              const SizedBox(height: 22),
              ChangePasswordSubmitButton(
                enabled: _canSubmit,
                loading: _loading,
                onTap: _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
