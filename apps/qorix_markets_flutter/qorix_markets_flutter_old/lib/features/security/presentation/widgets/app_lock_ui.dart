import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/ui/components/qorix_logo.dart';

abstract final class _L {
  static const bg = Color(0xFF0A0E12);
  static Color get muted => AppColors.authMuted.withValues(alpha: 0.72);
}

class AppLockOverlay extends StatelessWidget {
  const AppLockOverlay({
    required this.pin,
    required this.onDigit,
    required this.onBackspace,
    required this.onBiometric,
    required this.biometricEnabled,
    required this.biometricLabel,
    required this.errorMessage,
    required this.failedAttempts,
    required this.onForgotPin,
    super.key,
  });

  final String pin;
  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;
  final VoidCallback onBiometric;
  final bool biometricEnabled;
  final String biometricLabel;
  final String? errorMessage;
  final int failedAttempts;
  final VoidCallback onForgotPin;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _L.bg,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 36),
              const QorixLogo(size: 56, useAuthGreen: true, glow: true),
              const SizedBox(height: 20),
              const Text(
                'Unlock Qorix Markets',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white),
              ),
              const SizedBox(height: 6),
              Text(
                'Enter PIN or use biometrics to continue',
                style: TextStyle(fontSize: 12, color: _L.muted),
              ),
              const SizedBox(height: 28),
              _PinDots(length: pin.length, max: 6),
              const SizedBox(height: 12),
              SizedBox(
                height: 18,
                child: Text(
                  errorMessage ?? '',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.sell.withValues(alpha: 0.9)),
                ),
              ),
              const Spacer(),
              if (biometricEnabled) ...[
                Material(
                  color: AppColors.authGreen.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      onBiometric();
                    },
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.fingerprint_rounded, color: AppColors.authGreen, size: 22),
                          const SizedBox(width: 8),
                          Text(biometricLabel, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.authGreen)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
              ],
              _PinKeypad(onDigit: onDigit, onBackspace: onBackspace),
              const SizedBox(height: 16),
              TextButton(
                onPressed: failedAttempts >= 5 ? onForgotPin : null,
                child: Text(
                  failedAttempts >= 5 ? 'Sign in again' : 'Forgot PIN? Sign in again',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _L.muted),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}

class _PinDots extends StatelessWidget {
  const _PinDots({required this.length, required this.max});

  final int length;
  final int max;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(max, (i) {
        final filled = i < length;
        return Container(
          width: 12,
          height: 12,
          margin: const EdgeInsets.symmetric(horizontal: 8),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: filled ? AppColors.authGreen : Colors.transparent,
            border: Border.all(color: filled ? AppColors.authGreen : Colors.white.withValues(alpha: 0.18), width: 1.5),
          ),
        );
      }),
    );
  }
}

class _PinKeypad extends StatelessWidget {
  const _PinKeypad({required this.onDigit, required this.onBackspace});

  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;

  @override
  Widget build(BuildContext context) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.45,
      ),
      itemCount: keys.length,
      itemBuilder: (context, i) {
        final key = keys[i];
        if (key.isEmpty) return const SizedBox.shrink();
        final isBack = key == '⌫';
        return Material(
          color: Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            onTap: () {
              HapticFeedback.selectionClick();
              if (isBack) {
                onBackspace();
              } else {
                onDigit(key);
              }
            },
            borderRadius: BorderRadius.circular(14),
            child: Center(
              child: isBack
                  ? Icon(Icons.backspace_outlined, color: Colors.white.withValues(alpha: 0.75), size: 20)
                  : Text(key, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Colors.white)),
            ),
          ),
        );
      },
    );
  }
}

class AppLockPinField extends StatelessWidget {
  const AppLockPinField({required this.length, required this.label, super.key});

  final int length;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontSize: 12, color: _L.muted, fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        _PinDots(length: length, max: 6),
      ],
    );
  }
}

class AppLockSetupKeypad extends StatelessWidget {
  const AppLockSetupKeypad({
    required this.onDigit,
    required this.onBackspace,
    super.key,
  });

  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;

  @override
  Widget build(BuildContext context) {
    return _PinKeypad(onDigit: onDigit, onBackspace: onBackspace);
  }
}
