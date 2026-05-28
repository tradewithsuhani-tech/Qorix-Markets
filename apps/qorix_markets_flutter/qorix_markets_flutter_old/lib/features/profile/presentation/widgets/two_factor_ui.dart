import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';

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
  static const red = Color(0xFFEF4444);

  static const gradient = LinearGradient(
    colors: [Color(0xFF3B82F6), Color(0xFF6366F1), Color(0xFF818CF8)],
  );
}

class TwoFactorAppBar extends StatelessWidget {
  const TwoFactorAppBar({required this.onBack, super.key});

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
            'Two-Factor Auth',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class TwoFactorStatusCard extends StatelessWidget {
  const TwoFactorStatusCard({required this.enabled, super.key});

  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: enabled
              ? [_C.green.withValues(alpha: 0.16), const Color(0xFF0D2818), _C.card]
              : [_C.blue.withValues(alpha: 0.18), const Color(0xFF141B2E), _C.card],
        ),
        border: Border.all(color: (enabled ? _C.green : _C.blue).withValues(alpha: 0.24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: (enabled ? _C.green : _C.blue).withValues(alpha: 0.12),
                  border: Border.all(color: (enabled ? _C.green : _C.blue).withValues(alpha: 0.28)),
                ),
                child: Icon(Icons.shield_outlined, size: 22, color: enabled ? _C.green : _C.blue),
              ),
              const Spacer(),
              _StatusBadge(enabled: enabled),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            enabled ? '2FA is active on your account' : 'Add extra login protection',
            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            enabled
                ? 'A 6-digit code is required each sign-in and for large withdrawals.'
                : 'Require a 6-digit code from your authenticator app each sign-in.',
            style: TextStyle(fontSize: 11, color: _C.muted, height: 1.4),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.enabled});

  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final color = enabled ? _C.green : _C.gold;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(
            enabled ? 'ENABLED' : 'DISABLED',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color, letterSpacing: 0.6),
          ),
        ],
      ),
    );
  }
}

class TwoFactorSectionLabel extends StatelessWidget {
  const TwoFactorSectionLabel(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 2, bottom: 8),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _C.faint, letterSpacing: 1.1),
      ),
    );
  }
}

class TwoFactorBenefitRow extends StatelessWidget {
  const TwoFactorBenefitRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    super.key,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: iconColor.withValues(alpha: 0.12),
              border: Border.all(color: iconColor.withValues(alpha: 0.25)),
            ),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(subtitle, style: TextStyle(fontSize: 11, color: _C.muted, height: 1.35)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class TwoFactorWhyEnableCard extends StatelessWidget {
  const TwoFactorWhyEnableCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 2),
      decoration: BoxDecoration(
        color: _C.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _C.border),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TwoFactorBenefitRow(
            icon: Icons.shield_outlined,
            iconColor: _C.purple,
            title: 'Account hijack protection',
            subtitle: "Even if your password leaks, attackers can't sign in without your phone",
          ),
          TwoFactorBenefitRow(
            icon: Icons.lock_outline_rounded,
            iconColor: _C.pink,
            title: 'Required for large withdrawals',
            subtitle: 'Withdrawals above ₹1,00,000/day need 2FA',
          ),
          TwoFactorBenefitRow(
            icon: Icons.bolt_rounded,
            iconColor: _C.blue,
            title: 'Takes 30 seconds',
            subtitle: 'One-time setup, faster than Aadhaar OTP',
          ),
        ],
      ),
    );
  }
}

class TwoFactorMethodTile extends StatelessWidget {
  const TwoFactorMethodTile({
    required this.selected,
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.recommended = false,
    super.key,
  });

  final bool selected;
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool recommended;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: _C.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: selected ? _C.purple.withValues(alpha: 0.65) : _C.border, width: selected ? 1.5 : 1),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(11),
                  color: iconColor.withValues(alpha: 0.14),
                  border: Border.all(color: iconColor.withValues(alpha: 0.28)),
                ),
                child: Icon(icon, size: 20, color: iconColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(title, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
                        ),
                        if (recommended) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: _C.green.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: _C.green.withValues(alpha: 0.35)),
                            ),
                            child: const Text(
                              'RECOMMENDED',
                              style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: _C.green, letterSpacing: 0.4),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(subtitle, style: TextStyle(fontSize: 11, color: _C.muted)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _RadioDot(selected: selected),
            ],
          ),
        ),
      ),
    );
  }
}

class _RadioDot extends StatelessWidget {
  const _RadioDot({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 20,
      height: 20,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: selected ? _C.purple : _C.faint, width: 2),
      ),
      child: selected
          ? Center(
              child: Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(color: _C.purple, shape: BoxShape.circle),
              ),
            )
          : null,
    );
  }
}

class TwoFactorErrorBanner extends StatelessWidget {
  const TwoFactorErrorBanner({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _C.red.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _C.red.withValues(alpha: 0.35)),
      ),
      child: Text(message, style: TextStyle(fontSize: 12, color: _C.red.withValues(alpha: 0.95), height: 1.35)),
    );
  }
}

class TwoFactorQrImage extends StatelessWidget {
  const TwoFactorQrImage({this.qrDataUrl, super.key});

  final String? qrDataUrl;

  Uint8List? _decode() {
    final url = qrDataUrl;
    if (url == null || url.isEmpty) return null;
    final base64Part = url.contains(',') ? url.split(',').last : url;
    try {
      return base64Decode(base64Part);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final bytes = _decode();
    if (bytes == null) return const TwoFactorQrPlaceholder();
    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _C.purple.withValues(alpha: 0.45)),
        ),
        padding: const EdgeInsets.all(12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.memory(bytes, fit: BoxFit.contain),
        ),
      ),
    );
  }
}

class TwoFactorQrPlaceholder extends StatelessWidget {
  const TwoFactorQrPlaceholder({super.key});

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        decoration: BoxDecoration(
          color: _C.field,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _C.purple.withValues(alpha: 0.45)),
        ),
        child: CustomPaint(
          painter: _DemoQrPainter(),
          child: Center(
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: _C.bg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: _C.purple.withValues(alpha: 0.35)),
              ),
              child: Icon(Icons.qr_code_2_rounded, size: 28, color: _C.purple.withValues(alpha: 0.85)),
            ),
          ),
        ),
      ),
    );
  }
}

class _DemoQrPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.08);
    const cell = 8.0;
    for (var y = 0.0; y < size.height; y += cell) {
      for (var x = 0.0; x < size.width; x += cell) {
        if (((x / cell).floor() + (y / cell).floor()) % 3 == 0) {
          canvas.drawRect(Rect.fromLTWH(x + 1, y + 1, cell - 2, cell - 2), paint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class TwoFactorSecretKeyCard extends StatelessWidget {
  const TwoFactorSecretKeyCard({required this.secret, required this.onCopy, super.key});

  final String secret;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _C.field,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _C.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('SECRET KEY', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: _C.faint, letterSpacing: 0.8)),
                const SizedBox(height: 4),
                Text(
                  secret,
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 1.2),
                ),
              ],
            ),
          ),
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                Clipboard.setData(ClipboardData(text: secret));
                HapticFeedback.mediumImpact();
                onCopy();
              },
              borderRadius: BorderRadius.circular(10),
              child: Ink(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: _C.purple.withValues(alpha: 0.14),
                  border: Border.all(color: _C.purple.withValues(alpha: 0.35)),
                ),
                child: const Icon(Icons.copy_rounded, size: 18, color: _C.purple),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class TwoFactorSetupCard extends StatelessWidget {
  const TwoFactorSetupCard({
    required this.qrDataUrl,
    required this.manualCode,
    this.accountName,
    required this.otpKey,
    required this.codeError,
    this.errorMessage,
    required this.onCodeChanged,
    required this.onCodeCompleted,
    super.key,
  });

  final String? qrDataUrl;
  final String manualCode;
  final String? accountName;
  final GlobalKey<AuthOtpInputState> otpKey;
  final bool codeError;
  final String? errorMessage;
  final ValueChanged<String> onCodeChanged;
  final ValueChanged<String> onCodeCompleted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const TwoFactorSectionLabel('STEP 1 — ADD TO APP'),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: _C.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _C.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                accountName != null
                    ? 'Scan the QR in Google Authenticator, Authy, or 1Password for $accountName.'
                    : 'Open your authenticator app and scan the QR code or enter the secret key manually.',
                style: TextStyle(fontSize: 11, color: _C.muted, height: 1.4),
              ),
              const SizedBox(height: 14),
              TwoFactorQrImage(qrDataUrl: qrDataUrl),
              if (manualCode.isNotEmpty) ...[
                const SizedBox(height: 12),
                TwoFactorSecretKeyCard(
                  secret: manualCode,
                  onCopy: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Secret key copied'),
                        behavior: SnackBarBehavior.floating,
                        duration: Duration(seconds: 1),
                      ),
                    );
                  },
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        const TwoFactorSectionLabel('STEP 2 — ENTER CODE'),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: _C.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _C.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AuthOtpInput(
                key: otpKey,
                hasError: codeError,
                onChanged: onCodeChanged,
                onCompleted: onCodeCompleted,
              ),
              if (codeError) ...[
                const SizedBox(height: 8),
                Text(
                  errorMessage ?? 'Invalid code — check your authenticator app and try again',
                  style: TextStyle(fontSize: 10, color: _C.red.withValues(alpha: 0.9)),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class TwoFactorEnabledDetailsCard extends StatelessWidget {
  const TwoFactorEnabledDetailsCard({
    required this.enabledAt,
    super.key,
  });

  final DateTime? enabledAt;

  @override
  Widget build(BuildContext context) {
    final since = enabledAt != null ? DateFormat('d MMM yyyy').format(enabledAt!) : 'Active';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _C.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _C.border),
      ),
      child: Column(
        children: [
          const _EnabledDetailRow(
            icon: Icons.smartphone_rounded,
            iconColor: _C.purple,
            title: 'Active method',
            value: 'Authenticator app',
            subtitle: 'Google Authenticator, Authy, 1Password',
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1, color: _C.border),
          ),
          _EnabledDetailRow(
            icon: Icons.schedule_rounded,
            iconColor: _C.blue,
            title: 'Enabled since',
            value: since,
          ),
        ],
      ),
    );
  }
}

class _EnabledDetailRow extends StatelessWidget {
  const _EnabledDetailRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.value,
    this.subtitle,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String value;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            color: iconColor.withValues(alpha: 0.12),
            border: Border.all(color: iconColor.withValues(alpha: 0.25)),
          ),
          child: Icon(icon, size: 18, color: iconColor),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _C.faint)),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(subtitle!, style: TextStyle(fontSize: 11, color: _C.muted)),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class TwoFactorDisableCard extends StatelessWidget {
  const TwoFactorDisableCard({
    required this.passwordController,
    required this.hidePassword,
    required this.onTogglePasswordVisibility,
    required this.otpKey,
    required this.codeError,
    this.errorMessage,
    required this.onCodeChanged,
    super.key,
  });

  final TextEditingController passwordController;
  final bool hidePassword;
  final VoidCallback onTogglePasswordVisibility;
  final GlobalKey<AuthOtpInputState> otpKey;
  final bool codeError;
  final String? errorMessage;
  final ValueChanged<String> onCodeChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _C.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _C.red.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded, size: 18, color: _C.gold),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Confirm disable',
                  style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Enter your account password and current authenticator code to turn off 2FA.',
            style: TextStyle(fontSize: 11, color: _C.muted, height: 1.4),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: passwordController,
            obscureText: hidePassword,
            style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              hintText: 'Account password',
              hintStyle: TextStyle(color: _C.faint, fontSize: 13),
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
                borderSide: BorderSide(color: _C.red.withValues(alpha: 0.45)),
              ),
              suffixIcon: IconButton(
                onPressed: onTogglePasswordVisibility,
                icon: Icon(
                  hidePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                  size: 20,
                  color: _C.muted,
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          AuthOtpInput(
            key: otpKey,
            hasError: codeError,
            onChanged: onCodeChanged,
            onCompleted: (_) {},
          ),
          if (codeError) ...[
            const SizedBox(height: 8),
            Text(
              errorMessage ?? 'Invalid password or code — try again',
              style: TextStyle(fontSize: 10, color: _C.red.withValues(alpha: 0.9)),
            ),
          ],
        ],
      ),
    );
  }
}

class TwoFactorBackupCodesDialog extends StatelessWidget {
  const TwoFactorBackupCodesDialog({required this.codes, super.key});

  final List<String> codes;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: _C.card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: _C.border)),
      title: const Text('Save backup codes', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Store these codes safely. Each can be used once if you lose access to your authenticator.',
              style: TextStyle(fontSize: 12, color: _C.muted, height: 1.4),
            ),
            const SizedBox(height: 12),
            ...codes.map(
              (code) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  code,
                  style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700, letterSpacing: 1),
                ),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () {
            Clipboard.setData(ClipboardData(text: codes.join('\n')));
            HapticFeedback.mediumImpact();
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Backup codes copied'), behavior: SnackBarBehavior.floating),
            );
          },
          child: const Text('Copy all', style: TextStyle(color: _C.purple, fontWeight: FontWeight.w700)),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Done', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
        ),
      ],
    );
  }
}

class TwoFactorGradientButton extends StatelessWidget {
  const TwoFactorGradientButton({
    required this.label,
    required this.icon,
    required this.enabled,
    required this.loading,
    required this.onTap,
    super.key,
  });

  final String label;
  final IconData icon;
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
            gradient: enabled ? _C.gradient : null,
            color: enabled ? null : _C.card,
            border: Border.all(color: enabled ? Colors.transparent : _C.border),
            boxShadow: enabled
                ? [BoxShadow(color: _C.purple.withValues(alpha: 0.25), blurRadius: 14, offset: const Offset(0, 5))]
                : null,
          ),
          child: Center(
            child: loading
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(icon, size: 20, color: enabled ? Colors.white : _C.faint),
                      const SizedBox(width: 8),
                      Text(
                        label,
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: enabled ? Colors.white : _C.faint),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class TwoFactorOutlineButton extends StatelessWidget {
  const TwoFactorOutlineButton({
    required this.label,
    required this.onTap,
    this.loading = false,
    this.destructive = false,
    super.key,
  });

  final String label;
  final VoidCallback onTap;
  final bool loading;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive ? _C.red : _C.muted;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: loading
            ? null
            : () {
                HapticFeedback.mediumImpact();
                onTap();
              },
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          height: 48,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: destructive ? _C.red.withValues(alpha: 0.08) : _C.card,
            border: Border.all(color: destructive ? _C.red.withValues(alpha: 0.45) : _C.border),
          ),
          child: Center(
            child: loading
                ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: color))
                : Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: color)),
          ),
        ),
      ),
    );
  }
}
