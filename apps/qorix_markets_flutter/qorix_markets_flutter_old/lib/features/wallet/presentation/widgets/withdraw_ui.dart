import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/motion/desk_sheets.dart';
import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/features/wallet/application/withdraw_flow_provider.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_inr_options.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_demo.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_inr_options.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/widgets/deposit_ui.dart';
import 'package:qorix_markets_flutter/widgets/desk_widgets.dart';
import 'package:qorix_markets_flutter/ui/components/magnetic_press.dart';

ThemeData _withdrawFieldTheme(BuildContext context) => Theme.of(context).copyWith(
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      hoverColor: Colors.transparent,
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
      ),
    );

Widget _withdrawThemedField(BuildContext context, Widget field) => Material(
      color: Colors.transparent,
      child: Theme(data: _withdrawFieldTheme(context), child: field),
    );

class WithdrawPageHeader extends StatelessWidget {
  const WithdrawPageHeader({
    required this.subtitle,
    this.title = 'Withdraw Funds',
    super.key,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 26,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            height: 1.15,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          subtitle,
          style: TextStyle(
            fontSize: 13,
            height: 1.45,
            color: AppColors.authMuted.withValues(alpha: 0.85),
          ),
        ),
      ],
    );
  }
}

class WithdrawAvailableCard extends StatelessWidget {
  const WithdrawAvailableCard({
    required this.available,
    required this.feeRate,
    required this.isUsdt,
    super.key,
  });

  final double available;
  final double feeRate;
  final bool isUsdt;

  @override
  Widget build(BuildContext context) {
    final display = isUsdt
        ? '${available.toStringAsFixed(2)} USDT'
        : '₹${NumberFormat('#,##,##0').format((available * 83.5).round())}';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.75),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authInputBorder),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.authGreen.withValues(alpha: 0.12),
                  border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
                ),
                child: const Icon(Icons.account_balance_wallet_outlined, color: AppColors.authGreen, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Available to withdraw',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.authMuted.withValues(alpha: 0.8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      display,
                      style: const TextStyle(
                        color: AppColors.authGreen,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.authInputBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.8)),
            ),
            child: Text(
              'Profit balance only · Fee ${(feeRate * 100).toStringAsFixed(1)}% · OTP required',
              style: TextStyle(
                fontSize: 10.5,
                height: 1.4,
                color: AppColors.authMuted.withValues(alpha: 0.78),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class WithdrawMethodPill extends StatelessWidget {
  const WithdrawMethodPill({
    required this.method,
    required this.onChanged,
    super.key,
  });

  final WithdrawMethod method;
  final ValueChanged<WithdrawMethod> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 34,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.authInputBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.authInputBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _MethodTab(
            label: '₮ USDT',
            selected: method == WithdrawMethod.usdt,
            onTap: () => onChanged(WithdrawMethod.usdt),
          ),
          _MethodTab(
            label: '₹ INR',
            selected: method == WithdrawMethod.inr,
            onTap: () => onChanged(WithdrawMethod.inr),
          ),
        ],
      ),
    );
  }
}

class _MethodTab extends StatelessWidget {
  const _MethodTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: BorderRadius.circular(8),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: selected ? AppColors.authGreen.withValues(alpha: 0.15) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: selected ? Border.all(color: AppColors.authGreen.withValues(alpha: 0.55)) : null,
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: selected ? AppColors.authGreen : AppColors.authMuted,
            ),
          ),
        ),
      ),
    );
  }
}

class WithdrawFormSectionLabel extends StatelessWidget {
  const WithdrawFormSectionLabel(this.text, {this.trailing, super.key});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          text,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.authMuted.withValues(alpha: 0.85),
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 4), trailing!],
      ],
    );
  }
}

class WithdrawInfoIcon extends StatelessWidget {
  const WithdrawInfoIcon({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: AppColors.authCardBg,
            behavior: SnackBarBehavior.floating,
          ),
        );
      },
      child: Icon(Icons.info_outline_rounded, size: 14, color: AppColors.authMuted.withValues(alpha: 0.65)),
    );
  }
}

/// USDT profit balance → INR display rate for withdrawal limits.
const withdrawInrRate = 83.5;

/// Returns inline validation copy when [amount] is invalid; null when OK or empty.
String? withdrawAmountValidationError({
  required double amount,
  required bool isUsdt,
  required double availableUsdt,
}) {
  if (amount <= 0) return null;

  final min = isUsdt ? WithdrawDemo.usdtMin : WithdrawDemo.inrMin;
  if (amount < min) {
    return isUsdt
        ? 'Minimum ${min.toStringAsFixed(0)} USDT required'
        : 'Minimum ₹${min.toStringAsFixed(0)} required';
  }

  final max = isUsdt ? availableUsdt : availableUsdt * withdrawInrRate;
  if (amount > max) {
    if (isUsdt) {
      return 'Maximum ${max.toStringAsFixed(2)} USDT available';
    }
    return 'Maximum ₹${NumberFormat('#,##,##0', 'en_IN').format(max.round())} available';
  }

  return null;
}

/// Amount input with Max + available balance row (exchange-style concept).
class WithdrawAmountField extends StatelessWidget {
  const WithdrawAmountField({
    required this.controller,
    required this.available,
    required this.isUsdt,
    required this.onMax,
    this.errorText,
    super.key,
  });

  final TextEditingController controller;
  final double available;
  final bool isUsdt;
  final VoidCallback onMax;
  final String? errorText;

  static const _inrRate = withdrawInrRate;

  @override
  Widget build(BuildContext context) {
    final unit = isUsdt ? 'USDT' : 'INR';
    final availableLabel = isUsdt
        ? '${available.toStringAsFixed(5)} USDT'
        : '₹${NumberFormat('#,##,##0.00', 'en_IN').format(available * _inrRate)}';
    final minLabel = isUsdt
        ? 'Minimum ${WithdrawDemo.usdtMin.toStringAsFixed(0)}'
        : 'Minimum ₹${WithdrawDemo.inrMin.toStringAsFixed(0)}';
    final hasError = errorText != null && errorText!.isNotEmpty;
    final borderColor = hasError
        ? AppColors.sell.withValues(alpha: 0.65)
        : AppColors.authInputBorder.withValues(alpha: 0.9);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        WithdrawFormSectionLabel(
          'Withdrawal Amount',
          trailing: WithdrawInfoIcon(
            message: isUsdt
                ? 'Profit balance only. Fee deducted before payout.'
                : 'INR withdrawals from profit balance. Fee applies.',
          ),
        ),
        const SizedBox(height: 10),
        Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: AppColors.authInputBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: borderColor),
          ),
          clipBehavior: Clip.antiAlias,
          child: Material(
            color: Colors.transparent,
            child: Row(
              children: [
                Expanded(
                  child: _withdrawThemedField(
                    context,
                    TextField(
                    controller: controller,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                    ],
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                    cursorColor: AppColors.authGreen,
                    decoration: InputDecoration(
                      hintText: minLabel,
                      hintStyle: TextStyle(
                        color: AppColors.authMuted.withValues(alpha: 0.5),
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                      border: InputBorder.none,
                      isDense: true,
                    ),
                  ),
                ),
              ),
              Text(
                unit,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.authMuted.withValues(alpha: 0.75),
                ),
              ),
              const SizedBox(width: 10),
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    onMax();
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    child: Text(
                      'Max',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: AppColors.authGreen.withValues(alpha: 0.95),
                      ),
                    ),
                  ),
                ),
              ),
            ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Text(
              'Available',
              style: TextStyle(fontSize: 11.5, color: AppColors.authMuted.withValues(alpha: 0.68)),
            ),
            const Spacer(),
            Text(
              availableLabel,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: Colors.white.withValues(alpha: 0.82),
              ),
            ),
          ],
        ),
        if (hasError) ...[
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.error_outline_rounded, size: 14, color: AppColors.sell.withValues(alpha: 0.95)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  errorText!,
                  style: TextStyle(
                    fontSize: 11.5,
                    height: 1.35,
                    fontWeight: FontWeight.w600,
                    color: AppColors.sell.withValues(alpha: 0.92),
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// Sticky bottom bar for INR amount step — error + Continue always visible.
class WithdrawInrContinueBar extends StatelessWidget {
  const WithdrawInrContinueBar({
    required this.amount,
    required this.availableUsdt,
    required this.onContinue,
    super.key,
  });

  final double amount;
  final double availableUsdt;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final error = withdrawAmountValidationError(
      amount: amount,
      isUsdt: false,
      availableUsdt: availableUsdt,
    );

    return Container(
      padding: EdgeInsets.fromLTRB(20, 14, 20, 14 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(
        color: AppColors.authPageBg,
        border: Border(top: BorderSide(color: AppColors.authInputBorder.withValues(alpha: 0.7))),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 20,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline_rounded, size: 16, color: AppColors.sell.withValues(alpha: 0.95)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      error,
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.35,
                        fontWeight: FontWeight.w600,
                        color: AppColors.sell.withValues(alpha: 0.92),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          AuthPrimaryButton(
            label: 'Continue',
            onPressed: amount > 0 ? onContinue : null,
          ),
        ],
      ),
    );
  }
}

/// Network selector row — TRC20 / INR rail (read-only in demo).
class WithdrawNetworkField extends StatelessWidget {
  const WithdrawNetworkField({required this.isUsdt, super.key});

  final bool isUsdt;

  @override
  Widget build(BuildContext context) {
    final label = isUsdt ? 'TRC20 · Tron network' : 'IMPS / UPI · INR payout';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        WithdrawFormSectionLabel(
          'Network',
          trailing: WithdrawInfoIcon(
            message: isUsdt
                ? 'Only TRC20 USDT withdrawals supported. Wrong network = lost funds.'
                : 'INR sent to verified bank or UPI only.',
          ),
        ),
        const SizedBox(height: 10),
        Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: AppColors.authInputBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.9)),
          ),
          clipBehavior: Clip.antiAlias,
          child: Material(
            color: Colors.transparent,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                ),
                Icon(Icons.expand_more_rounded, color: AppColors.authMuted.withValues(alpha: 0.65)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Premium 3D withdraw CTA — enabled/disabled states, magnetic press.
class WithdrawCtaButton extends StatelessWidget {
  const WithdrawCtaButton({
    required this.label,
    required this.onPressed,
    super.key,
    this.loading = false,
    this.enabled = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool enabled;

  bool get _active => enabled && !loading && onPressed != null;

  @override
  Widget build(BuildContext context) {
    return MagneticPress(
      onPressed: _active ? onPressed : null,
      glowColor: AppColors.authGreen,
      borderRadius: BorderRadius.circular(16),
      scale: 0.975,
      child: SizedBox(
        width: double.infinity,
        height: 54,
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: _active
                ? const LinearGradient(
                    begin: Alignment(-0.7, -1),
                    end: Alignment(0.8, 1.2),
                    colors: [Color(0xFF7CFFB2), Color(0xFF00E676), Color(0xFF00A844)],
                    stops: [0.0, 0.45, 1.0],
                  )
                : null,
            color: _active ? null : AppColors.authInputBg,
            border: Border.all(
              color: _active
                  ? Colors.white.withValues(alpha: 0.22)
                  : AppColors.authInputBorder,
            ),
            boxShadow: _active
                ? [
                    BoxShadow(
                      color: AppColors.authGreen.withValues(alpha: 0.32),
                      blurRadius: 18,
                      offset: const Offset(0, 6),
                    ),
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.25),
                      blurRadius: 0,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(15),
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (_active)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 22,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.white.withValues(alpha: 0.28),
                            Colors.white.withValues(alpha: 0),
                          ],
                        ),
                      ),
                    ),
                  ),
                if (loading)
                  const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.2, color: Color(0xFF0A1A0F)),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            label,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: _active
                                  ? const Color(0xFF041208)
                                  : AppColors.authMuted.withValues(alpha: 0.55),
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ),
                        if (_active)
                          Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.black.withValues(alpha: 0.16),
                              border: Border.all(color: Colors.black.withValues(alpha: 0.1)),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.white.withValues(alpha: 0.2),
                                  blurRadius: 0,
                                  offset: const Offset(0, -0.5),
                                ),
                              ],
                            ),
                            child: const Icon(
                              Icons.arrow_forward_rounded,
                              color: Color(0xFF041208),
                              size: 18,
                            ),
                          ),
                      ],
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

/// Sticky bottom — receive amount, fee, CTA (exchange-style concept).
class WithdrawSubmitBar extends StatelessWidget {
  const WithdrawSubmitBar({
    required this.amount,
    required this.feeRate,
    required this.isUsdt,
    required this.submitting,
    required this.onSubmit,
    super.key,
  });

  final double amount;
  final double feeRate;
  final bool isUsdt;
  final bool submitting;
  final VoidCallback onSubmit;

  String _fmt(double value) {
    if (isUsdt) return '${value.toStringAsFixed(2)} USDT';
    return '₹${NumberFormat('#,##,###.##').format(value)}';
  }

  @override
  Widget build(BuildContext context) {
    final fee = amount > 0 ? amount * feeRate : 0.0;
    final receive = amount > 0 ? amount - fee : 0.0;
    final enabled = amount > 0 && !submitting;

    return Container(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 14 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(
        color: AppColors.authPageBg,
        border: Border(top: BorderSide(color: AppColors.authInputBorder.withValues(alpha: 0.7))),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 20,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _SubmitLine(label: 'Receive amount', value: _fmt(receive), highlight: true),
          const SizedBox(height: 8),
          _SubmitLine(label: isUsdt ? 'Network fee' : 'Platform fee', value: _fmt(fee)),
          const SizedBox(height: 16),
          WithdrawCtaButton(
            label: submitting ? 'Sending OTP…' : 'Withdraw',
            loading: submitting,
            enabled: enabled,
            onPressed: onSubmit,
          ),
        ],
      ),
    );
  }
}

class _SubmitLine extends StatelessWidget {
  const _SubmitLine({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: highlight ? 13 : 12,
            fontWeight: highlight ? FontWeight.w600 : FontWeight.w500,
            color: AppColors.authMuted.withValues(alpha: highlight ? 0.85 : 0.72),
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: TextStyle(
            fontSize: highlight ? 16 : 12,
            fontWeight: FontWeight.w800,
            color: highlight ? Colors.white : AppColors.authMuted.withValues(alpha: 0.85),
          ),
        ),
      ],
    );
  }
}

class WithdrawFormNotices extends StatelessWidget {
  const WithdrawFormNotices({required this.isUsdt, super.key});

  final bool isUsdt;

  @override
  Widget build(BuildContext context) {
    final lines = isUsdt
        ? [
            'Do not withdraw to ICO or crowdfunding addresses.',
            'Ensure the address supports TRC20 USDT only.',
          ]
        : [
            'Withdrawals go to your verified bank or UPI only.',
            'Processing may take up to 24 hours after OTP approval.',
          ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: lines
          .map(
            (line) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('•  ', style: TextStyle(color: AppColors.authMuted.withValues(alpha: 0.55), fontSize: 12)),
                  Expanded(
                    child: Text(
                      line,
                      style: TextStyle(
                        fontSize: 11,
                        height: 1.45,
                        color: AppColors.authMuted.withValues(alpha: 0.72),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class WithdrawFeeCard extends StatelessWidget {
  const WithdrawFeeCard({
    required this.amount,
    required this.feeRate,
    required this.isUsdt,
    super.key,
  });

  final double amount;
  final double feeRate;
  final bool isUsdt;

  @override
  Widget build(BuildContext context) {
    final fee = amount * feeRate;
    final net = amount - fee;
    final unit = isUsdt ? 'USDT' : 'INR';
    final fmt = isUsdt
        ? (double v) => '${v.toStringAsFixed(2)} $unit'
        : (double v) => '₹${NumberFormat('#,##,###').format(v.round())}';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.85)),
      ),
      child: Column(
        children: [
          _FeeRow(label: 'Withdraw amount', value: fmt(amount)),
          const SizedBox(height: 8),
          _FeeRow(label: isUsdt ? 'Processing fee' : 'Platform fee', value: '- ${fmt(fee)}', muted: true),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Divider(height: 1, color: AppColors.authInputBorder),
          ),
          _FeeRow(label: 'You receive', value: fmt(net), highlight: true),
        ],
      ),
    );
  }
}

class _FeeRow extends StatelessWidget {
  const _FeeRow({
    required this.label,
    required this.value,
    this.highlight = false,
    this.muted = false,
  });

  final String label;
  final String value;
  final bool highlight;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: AppColors.authMuted.withValues(alpha: muted ? 0.65 : 0.8),
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: TextStyle(
            fontSize: highlight ? 14 : 12,
            fontWeight: highlight ? FontWeight.w800 : FontWeight.w600,
            color: highlight ? AppColors.authGreen : Colors.white.withValues(alpha: 0.88),
          ),
        ),
      ],
    );
  }
}

class WithdrawOtpSummaryCard extends StatelessWidget {
  const WithdrawOtpSummaryCard({
    required this.flow,
    required this.feeRate,
    super.key,
  });

  final WithdrawFlowState flow;
  final double feeRate;

  String _mask(String value) {
    if (value.length <= 8) return value;
    return '${value.substring(0, 4)}···${value.substring(value.length - 4)}';
  }

  @override
  Widget build(BuildContext context) {
    final amount = flow.amount ?? 0;
    final fee = amount * feeRate;
    final net = amount - fee;
    final isUsdt = flow.isUsdt;
    final amountLabel = isUsdt
        ? '${net.toStringAsFixed(2)} USDT'
        : '₹${NumberFormat('#,##,###').format(net.round())}';

    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.authCardBg.withValues(alpha: 0.92),
              AppColors.authInputBg.withValues(alpha: 0.85),
            ],
          ),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.22)),
          boxShadow: [
            BoxShadow(
              color: AppColors.authGreen.withValues(alpha: 0.08),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.authGreen.withValues(alpha: 0.12),
                      border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
                    ),
                    child: Icon(Icons.verified_user_outlined, size: 16, color: AppColors.authGreen.withValues(alpha: 0.95)),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'Payout preview',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: Colors.white.withValues(alpha: 0.92),
                      letterSpacing: 0.2,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.authGreen.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      isUsdt ? 'TRC20' : 'INR',
                      style: const TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: AppColors.authGreen,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
              child: Column(
                children: [
                  Text(
                    amountLabel,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'You will receive after fees',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.authMuted.withValues(alpha: 0.72),
                    ),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: AppColors.authInputBorder.withValues(alpha: 0.85)),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: Column(
                children: [
                  _OtpSummaryRow(label: 'Method', value: flow.payoutMethodLabel),
                  const SizedBox(height: 10),
                  _OtpSummaryRow(
                    label: 'Destination',
                    value: isUsdt
                        ? _mask(flow.destination ?? '—')
                        : maskInrDestination(flow.destination ?? '—', flow.inrPayout),
                    mono: true,
                  ),
                  const SizedBox(height: 10),
                  _OtpSummaryRow(
                    label: isUsdt ? 'Network fee' : 'Platform fee',
                    value: isUsdt
                        ? '${fee.toStringAsFixed(2)} USDT'
                        : '₹${NumberFormat('#,##,###.##').format(fee)}',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OtpSummaryRow extends StatelessWidget {
  const _OtpSummaryRow({
    required this.label,
    required this.value,
    this.mono = false,
  });

  final String label;
  final String value;
  final bool mono;

  static const _labelWidth = 96.0;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: _labelWidth,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              color: AppColors.authMuted.withValues(alpha: 0.72),
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Colors.white.withValues(alpha: 0.92),
              fontFamily: mono ? 'monospace' : null,
            ),
          ),
        ),
      ],
    );
  }
}

/// OTP verify block — code input in a premium shell.
class WithdrawOtpVerifyBlock extends StatelessWidget {
  const WithdrawOtpVerifyBlock({
    required this.otpKey,
    required this.flow,
    required this.onCompleted,
    required this.onChanged,
    super.key,
  });

  final GlobalKey<AuthOtpInputState> otpKey;
  final WithdrawFlowState flow;
  final ValueChanged<String> onCompleted;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 20),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.85)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.lock_outline_rounded, size: 16, color: AppColors.authGreen.withValues(alpha: 0.85)),
              const SizedBox(width: 6),
              Text(
                'Enter verification code',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.authMuted.withValues(alpha: 0.85),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AuthOtpInput(
            key: otpKey,
            enabled: !flow.submitting,
            hasError: flow.otpError,
            onChanged: onChanged,
            onCompleted: onCompleted,
          ),
          if (flow.otpError) ...[
            const SizedBox(height: 10),
            Text(
              'Invalid code. Please try again.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.sell.withValues(alpha: 0.9)),
            ),
          ],
          if (flow.submitting) ...[
            const SizedBox(height: 18),
            const SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(color: AppColors.authGreen, strokeWidth: 2.5),
            ),
            const SizedBox(height: 10),
            Text(
              'Authorizing payout…',
              style: TextStyle(fontSize: 12.5, color: AppColors.authMuted.withValues(alpha: 0.82)),
            ),
          ],
        ],
      ),
    );
  }
}

/// Bottom notes — network warning + bullet notices.
class WithdrawOtpNoteSection extends StatelessWidget {
  const WithdrawOtpNoteSection({required this.isUsdt, super.key});

  final bool isUsdt;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.75)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.sticky_note_2_outlined, size: 14, color: AppColors.authMuted.withValues(alpha: 0.65)),
              const SizedBox(width: 6),
              Text(
                'Note',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.4,
                  color: AppColors.authMuted.withValues(alpha: 0.75),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (isUsdt) const _TronNetworkWarning(),
          if (isUsdt) const SizedBox(height: 12),
          WithdrawFormNotices(isUsdt: isUsdt),
        ],
      ),
    );
  }
}

class _TronNetworkWarning extends StatelessWidget {
  const _TronNetworkWarning();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
      decoration: BoxDecoration(
        color: AppColors.authGold.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.authGold.withValues(alpha: 0.32)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.warning_amber_rounded, size: 18, color: AppColors.authGold.withValues(alpha: 0.95)),
          const SizedBox(width: 10),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: TextStyle(
                  fontSize: 11,
                  height: 1.45,
                  color: AppColors.authGoldLight.withValues(alpha: 0.88),
                ),
                children: const [
                  TextSpan(text: 'Only send to a '),
                  TextSpan(
                    text: 'TRON (TRC20)',
                    style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.authGold),
                  ),
                  TextSpan(text: ' wallet. Funds sent on a different network will be lost permanently.'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class WithdrawSuccessStage extends StatelessWidget {
  const WithdrawSuccessStage({
    required this.flow,
    required this.feeRate,
    required this.onDone,
    required this.onWallet,
    super.key,
  });

  final WithdrawFlowState flow;
  final double feeRate;
  final VoidCallback onDone;
  final VoidCallback onWallet;

  List<DepositSuccessRow> _rows() {
    final amount = flow.amount ?? 0;
    final fee = amount * feeRate;
    final net = amount - fee;
    final isUsdt = flow.isUsdt;
    final submittedAt = flow.submittedAt ?? DateTime.now();
    final timeLabel = DateFormat('dd MMM yyyy · HH:mm:ss').format(submittedAt);
    final dest = flow.destination ?? '—';
    final masked = isUsdt
        ? (dest.length <= 8 ? dest : '${dest.substring(0, 4)}···${dest.substring(dest.length - 4)}')
        : maskInrDestination(dest, flow.inrPayout);

    return [
      DepositSuccessRow(
        label: 'Amount',
        value: isUsdt
            ? '${net.toStringAsFixed(2)} USDT'
            : '₹${NumberFormat('#,##,###').format(net.round())}',
        highlight: true,
      ),
      DepositSuccessRow(label: 'Method', value: flow.payoutMethodLabel),
      DepositSuccessRow(label: 'Destination', value: masked),
      if (flow.referenceId != null) DepositSuccessRow(label: 'Reference', value: flow.referenceId!),
      DepositSuccessRow(label: 'Status', value: 'Pending · Review', pending: true),
      DepositSuccessRow(label: 'Time', value: timeLabel),
    ];
  }

  String get _amountDisplay {
    final amount = flow.amount ?? 0;
    final net = amount - amount * feeRate;
    if (flow.isUsdt) return '\$${net.toStringAsFixed(2)} USDT';
    return '₹${NumberFormat('#,##,###').format(net.round())}';
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: AppScroll.page,
      padding: const EdgeInsets.fromLTRB(AppSpacing.pageHorizontalMobile, 0, AppSpacing.pageHorizontalMobile, AppSpacing.xxxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppSpacing.lg),
          Center(
            child: Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.lg),
                color: AppColors.authGreen.withValues(alpha: 0.12),
                border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.28)),
              ),
              child: const Icon(Icons.check_rounded, color: AppColors.authGreen, size: 28),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
              decoration: AppDesk.liveBadge(),
              child: const Text(
                'PAYOUT SUBMITTED',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: AppColors.authGreen),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(_amountDisplay, textAlign: TextAlign.center, style: AppDesk.metricHero),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Under review · Funds arrive within 24 hours',
            textAlign: TextAlign.center,
            style: AppDesk.sectionCaption.copyWith(fontWeight: FontWeight.w600, color: AppDesk.textPrimary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text('Balance updates after approval', textAlign: TextAlign.center, style: AppDesk.sectionCaption),
          const SizedBox(height: AppSpacing.xl),
          DepositInfoNote(
            text: flow.isUsdt
                ? 'TRC20 payout · Arrives in 1–24 hours after approval.'
                : 'INR payout · Credited to bank/UPI within 24 hours.',
          ),
          const SizedBox(height: AppSpacing.lg),
          DepositSuccessSummaryCard(rows: _rows()),
          const SizedBox(height: AppSpacing.sectionGap),
          DeskPrimaryCta(label: 'Done', onTap: onDone),
          const SizedBox(height: AppSpacing.md),
          DepositSecondaryButton(label: 'Go to Wallet', onPressed: onWallet),
        ],
      ),
    );
  }
}

class WithdrawFailureView extends StatelessWidget {
  const WithdrawFailureView({
    required this.message,
    required this.onRetry,
    required this.onDone,
    super.key,
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.sell.withValues(alpha: 0.12),
              border: Border.all(color: AppColors.sell.withValues(alpha: 0.35)),
            ),
            child: Icon(Icons.block_rounded, size: 40, color: AppColors.sell.withValues(alpha: 0.9)),
          ),
          const SizedBox(height: 20),
          const Text(
            'Withdrawal failed',
            style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, height: 1.45, color: AppColors.authMuted.withValues(alpha: 0.85)),
          ),
          const SizedBox(height: 28),
          AuthPrimaryButton(label: 'Try again', onPressed: onRetry),
          const SizedBox(height: 10),
          DepositSecondaryButton(label: 'Back to Wallet', onPressed: onDone),
        ],
      ),
    );
  }
}

/// Address field — paste (long-press), saved addresses, scan (exchange concept, Qorix theme).
class WithdrawDestinationField extends StatefulWidget {
  const WithdrawDestinationField({
    required this.controller,
    required this.isUsdt,
    super.key,
  });

  final TextEditingController controller;
  final bool isUsdt;

  @override
  State<WithdrawDestinationField> createState() => _WithdrawDestinationFieldState();
}

class _WithdrawDestinationFieldState extends State<WithdrawDestinationField> {
  final _focusNode = FocusNode();
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() => setState(() => _focused = _focusNode.hasFocus));
    widget.controller.addListener(_onTextChanged);
  }

  @override
  void didUpdateWidget(covariant WithdrawDestinationField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_onTextChanged);
      widget.controller.addListener(_onTextChanged);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    _focusNode.dispose();
    super.dispose();
  }

  void _onTextChanged() => setState(() {});

  Future<void> _pasteFromClipboard() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text?.trim();
    if (text == null || text.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Clipboard is empty'),
          backgroundColor: AppColors.authCardBg,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    HapticFeedback.lightImpact();
    widget.controller.text = text;
    widget.controller.selection = TextSelection.collapsed(offset: text.length);
  }

  Future<void> _openScanner() async {
    HapticFeedback.mediumImpact();
    final result = await showWithdrawQrScannerSheet(context, isUsdt: widget.isUsdt);
    if (result != null && result.isNotEmpty && mounted) {
      widget.controller.text = result;
      widget.controller.selection = TextSelection.collapsed(offset: result.length);
    }
  }

  void _openSavedAddresses() {
    HapticFeedback.lightImpact();
    showDeskBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        decoration: BoxDecoration(
          color: AppColors.authCardBg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          border: Border.all(color: AppColors.authInputBorder),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Saved addresses',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Colors.white.withValues(alpha: 0.92),
              ),
            ),
            const SizedBox(height: 14),
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () {
                  Navigator.pop(ctx);
                  widget.controller.text =
                      widget.isUsdt ? WithdrawDemo.demoTrc20Address : WithdrawDemo.demoUpiId;
                },
                borderRadius: BorderRadius.circular(12),
                child: Ink(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.authInputBg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.authInputBorder),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.bookmark_outline_rounded, color: AppColors.authGreen.withValues(alpha: 0.9)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.isUsdt ? 'My TRC20 Wallet' : 'Primary UPI',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              widget.isUsdt ? WithdrawDemo.demoTrc20Address : WithdrawDemo.demoUpiId,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 11,
                                color: AppColors.authMuted.withValues(alpha: 0.75),
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final borderColor = _focused
        ? AppColors.authGreen.withValues(alpha: 0.55)
        : AppColors.authInputBorder;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const WithdrawFormSectionLabel('Address'),
        const SizedBox(height: 10),
        GestureDetector(
          onLongPress: _pasteFromClipboard,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            constraints: const BoxConstraints(minHeight: 52),
            padding: const EdgeInsets.only(left: 14, right: 4),
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: AppColors.authInputBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: borderColor, width: _focused ? 1.5 : 1),
              boxShadow: _focused
                  ? [
                      BoxShadow(
                        color: AppColors.authGreen.withValues(alpha: 0.1),
                        blurRadius: 16,
                        spreadRadius: -2,
                      ),
                    ]
                  : null,
            ),
            child: Material(
              color: Colors.transparent,
              child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: _withdrawThemedField(
                    context,
                    TextField(
                      controller: widget.controller,
                      focusNode: _focusNode,
                      maxLines: 2,
                      minLines: 1,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.94),
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                        fontFamily: widget.controller.text.isNotEmpty ? 'monospace' : null,
                      ),
                      cursorColor: AppColors.authGreen,
                      decoration: InputDecoration(
                        hintText: 'Long press to paste',
                        hintStyle: TextStyle(
                          color: AppColors.authMuted.withValues(alpha: 0.5),
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ),
                _FieldIconButton(
                  icon: Icons.content_paste_rounded,
                  tooltip: 'Paste',
                  onTap: _pasteFromClipboard,
                ),
                _FieldIconButton(
                  icon: Icons.contacts_outlined,
                  tooltip: 'Saved',
                  onTap: _openSavedAddresses,
                ),
                _FieldIconButton(
                  icon: Icons.qr_code_scanner_rounded,
                  tooltip: 'Scan',
                  onTap: _openScanner,
                  accent: true,
                ),
              ],
            ),
            ),
          ),
        ),
      ],
    );
  }
}

class _FieldIconButton extends StatelessWidget {
  const _FieldIconButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.accent = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      tooltip: tooltip,
      icon: Icon(
        icon,
        size: 20,
        color: accent ? AppColors.authGreen : AppColors.authMuted.withValues(alpha: 0.85),
      ),
      visualDensity: VisualDensity.compact,
    );
  }
}

/// QR scanner sheet — demo scan + paste fallback (Binance-style viewfinder).
Future<String?> showWithdrawQrScannerSheet(BuildContext context, {required bool isUsdt}) {
  return showDeskBottomSheet<String>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (_) => _WithdrawQrScannerSheet(isUsdt: isUsdt),
  );
}

class _WithdrawQrScannerSheet extends StatefulWidget {
  const _WithdrawQrScannerSheet({required this.isUsdt});

  final bool isUsdt;

  @override
  State<_WithdrawQrScannerSheet> createState() => _WithdrawQrScannerSheetState();
}

class _WithdrawQrScannerSheetState extends State<_WithdrawQrScannerSheet>
    with SingleTickerProviderStateMixin {
  late final AnimationController _scanLine;
  bool _scanning = true;

  @override
  void initState() {
    super.initState();
    _scanLine = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200))
      ..repeat(reverse: true);
    _simulateScan();
  }

  Future<void> _simulateScan() async {
    await Future<void>.delayed(const Duration(milliseconds: 2400));
    if (!mounted || !_scanning) return;
    HapticFeedback.mediumImpact();
    Navigator.of(context).pop(
      widget.isUsdt ? WithdrawDemo.demoTrc20Address : WithdrawDemo.demoUpiId,
    );
  }

  Future<void> _pasteAndClose() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text?.trim();
    if (!mounted) return;
    if (text == null || text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Nothing to paste'),
          backgroundColor: AppColors.authCardBg,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    _scanning = false;
    Navigator.of(context).pop(text);
  }

  @override
  void dispose() {
    _scanning = false;
    _scanLine.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;

    return Container(
      height: MediaQuery.sizeOf(context).height * 0.88,
      decoration: BoxDecoration(
        color: AppColors.authPageBg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
        border: Border.all(color: AppColors.authInputBorder),
      ),
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.authMuted.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Icon(Icons.close_rounded, color: Colors.white.withValues(alpha: 0.9)),
                ),
                Expanded(
                  child: Text(
                    widget.isUsdt ? 'Scan wallet QR' : 'Scan UPI QR',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 48),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 16),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(18),
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          AppColors.authCardBg,
                          Colors.black.withValues(alpha: 0.85),
                        ],
                      ),
                    ),
                  ),
                  CustomPaint(
                    size: const Size(260, 260),
                    painter: _ScannerFramePainter(),
                  ),
                  AnimatedBuilder(
                    animation: _scanLine,
                    builder: (_, __) {
                      return Positioned(
                        top: 40 + _scanLine.value * 180,
                        left: 48,
                        right: 48,
                        child: Container(
                          height: 2,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.transparent,
                                AppColors.authGreen.withValues(alpha: 0.9),
                                Colors.transparent,
                              ],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.authGreen.withValues(alpha: 0.45),
                                blurRadius: 8,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  Positioned(
                    bottom: 28,
                    left: 20,
                    right: 20,
                    child: Text(
                      widget.isUsdt
                          ? 'Align the wallet QR code within the frame'
                          : 'Align the UPI QR code within the frame',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.4,
                        color: AppColors.authMuted.withValues(alpha: 0.85),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 16 + bottom),
            child: Column(
              children: [
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: _pasteAndClose,
                    borderRadius: BorderRadius.circular(14),
                    child: Ink(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.authInputBg,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.authInputBorder),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.content_paste_rounded, size: 18, color: AppColors.authGreen.withValues(alpha: 0.9)),
                          const SizedBox(width: 8),
                          Text(
                            'Paste from clipboard',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Colors.white.withValues(alpha: 0.9),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Scanning… address auto-fills when detected',
                  style: TextStyle(fontSize: 11, color: AppColors.authMuted.withValues(alpha: 0.65)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ScannerFramePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(0, 0, size.width, size.height);
    final paint = Paint()
      ..color = AppColors.authGreen.withValues(alpha: 0.85)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    const len = 28.0;
    const r = 14.0;

    // Top-left
    canvas.drawPath(
      Path()
        ..moveTo(rect.left, rect.top + len)
        ..lineTo(rect.left, rect.top + r)
        ..quadraticBezierTo(rect.left, rect.top, rect.left + r, rect.top)
        ..lineTo(rect.left + len, rect.top),
      paint,
    );
    // Top-right
    canvas.drawPath(
      Path()
        ..moveTo(rect.right - len, rect.top)
        ..lineTo(rect.right - r, rect.top)
        ..quadraticBezierTo(rect.right, rect.top, rect.right, rect.top + r)
        ..lineTo(rect.right, rect.top + len),
      paint,
    );
    // Bottom-left
    canvas.drawPath(
      Path()
        ..moveTo(rect.left, rect.bottom - len)
        ..lineTo(rect.left, rect.bottom - r)
        ..quadraticBezierTo(rect.left, rect.bottom, rect.left + r, rect.bottom)
        ..lineTo(rect.left + len, rect.bottom),
      paint,
    );
    // Bottom-right
    canvas.drawPath(
      Path()
        ..moveTo(rect.right - len, rect.bottom)
        ..lineTo(rect.right - r, rect.bottom)
        ..quadraticBezierTo(rect.right, rect.bottom, rect.right, rect.bottom - r)
        ..lineTo(rect.right, rect.bottom - len),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Quick amount helper for form validation display.
String withdrawMinLabel(WithdrawMethod method) {
  return method == WithdrawMethod.usdt
      ? 'Min ${WithdrawDemo.usdtMin.toStringAsFixed(0)} USDT'
      : 'Min ₹${WithdrawDemo.inrMin.toStringAsFixed(0)}';
}
