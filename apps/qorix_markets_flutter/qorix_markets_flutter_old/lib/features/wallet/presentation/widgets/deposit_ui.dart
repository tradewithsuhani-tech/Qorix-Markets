import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/features/wallet/application/deposit_flow_provider.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/deposit_demo.dart';

/// Full-page deposit shell — back + scroll body.
class DepositPageScaffold extends StatelessWidget {
  const DepositPageScaffold({
    required this.onBack,
    required this.child,
    super.key,
  });

  final VoidCallback onBack;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 12),
          Padding(
            padding: EdgeInsets.fromLTRB(
              Responsive.pagePadding(context).left - 12,
              AppSpacing.xs,
              AppSpacing.pageHorizontalMobile,
              0,
            ),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    onBack();
                  },
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  child: Ink(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(color: AppDesk.border),
                    ),
                    child: Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: AppDesk.textPrimary),
                  ),
                ),
              ),
            ),
          ),
          AppSpacing.gapMd(),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class DepositPageHeader extends StatelessWidget {
  const DepositPageHeader({required this.subtitle, super.key});

  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Add Funds', style: AppDesk.pageTitle),
        const SizedBox(height: AppSpacing.sm),
        Text(subtitle, style: AppDesk.pageSubtitle),
      ],
    );
  }
}

class DepositBalanceCard extends StatelessWidget {
  const DepositBalanceCard({required this.balance, super.key});

  final double balance;

  @override
  Widget build(BuildContext context) {
    final formatted = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 3).format(balance);

    return Container(
      padding: AppDesk.densePadding,
      decoration: AppDesk.card(),
      child: Row(
        children: [
          Text('Current Balance', style: AppDesk.metricLabel.copyWith(fontSize: 12)),
          const Spacer(),
          Text(
            formatted,
            style: AppDesk.metricValue.copyWith(color: AppColors.authGreen, fontSize: 16),
          ),
        ],
      ),
    );
  }
}

/// Compact ₹ INR / ₮ USDT toggle — reference style.
class DepositCurrencyPill extends StatelessWidget {
  const DepositCurrencyPill({
    required this.mode,
    required this.onChanged,
    super.key,
  });

  final DepositMode mode;
  final ValueChanged<DepositMode> onChanged;

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
          _PillTab(
            label: '₹ INR',
            selected: mode == DepositMode.inr,
            onTap: () => onChanged(DepositMode.inr),
          ),
          _PillTab(
            label: '₮ USDT',
            selected: mode == DepositMode.crypto,
            onTap: () => onChanged(DepositMode.crypto),
          ),
        ],
      ),
    );
  }
}

class _PillTab extends StatelessWidget {
  const _PillTab({
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

class DepositLargeAmountField extends StatelessWidget {
  const DepositLargeAmountField({
    required this.controller,
    required this.symbol,
    super.key,
  });

  final TextEditingController controller;
  final String symbol;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.authInputBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authInputBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            symbol,
            style: TextStyle(
              color: AppColors.authMuted.withValues(alpha: 0.75),
              fontSize: 28,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Material(
              color: Colors.transparent,
              child: Theme(
                data: Theme.of(context).copyWith(
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
                ),
                child: TextField(
                  controller: controller,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 36,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                    height: 1.1,
                  ),
                  cursorColor: AppColors.authGreen,
                  decoration: InputDecoration.collapsed(
                    hintText: '0',
                    hintStyle: TextStyle(
                      color: AppColors.authMuted.withValues(alpha: 0.35),
                      fontSize: 36,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class DepositQuickRow extends StatelessWidget {
  const DepositQuickRow({
    required this.amounts,
    required this.prefix,
    required this.onPick,
    super.key,
  });

  final List<double> amounts;
  final String prefix;
  final ValueChanged<double> onPick;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: amounts.map((a) {
        final label = a >= 1000 ? '$prefix${(a / 1000).toStringAsFixed(0)}K' : '$prefix${a.toStringAsFixed(0)}';
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: a != amounts.last ? 8 : 0),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () {
                  HapticFeedback.selectionClick();
                  onPick(a);
                },
                borderRadius: BorderRadius.circular(10),
                child: Ink(
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.authCardBg.withValues(alpha: 0.8),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.authInputBorder),
                  ),
                  child: Center(
                    child: Text(
                      label,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.88),
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class DepositSectionLabel extends StatelessWidget {
  const DepositSectionLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text.toUpperCase(), style: AppDesk.overline);
  }
}

class DepositInrMethodTile extends StatelessWidget {
  const DepositInrMethodTile({
    required this.option,
    required this.onTap,
    super.key,
  });

  final DepositInrMethodOption option;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return DepositListTile(
      icon: option.icon,
      iconColor: AppColors.authGreen,
      title: option.title,
      subtitle: option.subtitle,
      onTap: onTap,
    );
  }
}

class DepositCryptoTile extends StatelessWidget {
  const DepositCryptoTile({
    required this.option,
    required this.onTap,
    super.key,
  });

  final DepositCryptoOption option;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return DepositListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: option.color.withValues(alpha: 0.18),
          border: Border.all(color: option.color.withValues(alpha: 0.45)),
        ),
        alignment: Alignment.center,
        child: Text(
          option.iconLetter,
          style: TextStyle(
            color: option.color,
            fontSize: 16,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      title: option.symbol,
      subtitle: '${option.name} · ${option.network}',
      onTap: onTap,
    );
  }
}

class DepositListTile extends StatelessWidget {
  const DepositListTile({
    required this.title,
    required this.subtitle,
    required this.onTap,
    super.key,
    this.icon,
    this.iconColor,
    this.leading,
  });

  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final IconData? icon;
  final Color? iconColor;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Ink(
          padding: AppDesk.densePadding,
          decoration: AppDesk.card(),
          child: Row(
            children: [
              leading ??
                  Container(
                    width: AppDesk.iconBoxSize,
                    height: AppDesk.iconBoxSize,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: (iconColor ?? AppColors.authGreen).withValues(alpha: 0.1),
                      border: Border.all(color: (iconColor ?? AppColors.authGreen).withValues(alpha: 0.22)),
                    ),
                    child: Icon(icon, color: iconColor ?? AppColors.authGreen, size: AppDesk.iconMd),
                  ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppDesk.sectionTitle.copyWith(fontSize: 15)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: AppDesk.sectionCaption.copyWith(fontSize: 11.5)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: AppDesk.textTertiary, size: AppDesk.iconMd),
            ],
          ),
        ),
      ),
    );
  }
}

class DepositSecurityFooter extends StatelessWidget {
  const DepositSecurityFooter({required this.text, super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.7)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.shield_outlined, size: 16, color: AppColors.authGreen.withValues(alpha: 0.85)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 10.5,
                height: 1.45,
                color: AppColors.authMuted.withValues(alpha: 0.82),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class DepositCopyRow extends StatelessWidget {
  const DepositCopyRow({
    required this.label,
    required this.value,
    super.key,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.7)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.authMuted.withValues(alpha: 0.8),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                SelectableText(
                  value,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: value));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('$label copied'), backgroundColor: AppColors.authCardBg),
              );
            },
            icon: const Icon(Icons.copy_rounded, color: AppColors.authGreen, size: 18),
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}

class DepositQrBlock extends StatelessWidget {
  const DepositQrBlock({this.data, this.size = 160, super.key});

  final String? data;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: AppColors.authGreen.withValues(alpha: 0.1), blurRadius: 16),
        ],
      ),
      child: CustomPaint(size: Size(size, size), painter: _DepositQrPainter()),
    );
  }
}

class _DepositQrPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cell = size.width / 25;
    final paint = Paint()..color = const Color(0xFF0A1A0F);

    for (var row = 0; row < 25; row++) {
      for (var col = 0; col < 25; col++) {
        if ((row + col + row * col) % 3 == 0 ||
            (row < 7 && col < 7) ||
            (row < 7 && col > 17) ||
            (row > 17 && col < 7)) {
          canvas.drawRect(
            Rect.fromLTWH(col * cell, row * cell, cell - 0.5, cell - 0.5),
            paint,
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class DepositInfoNote extends StatelessWidget {
  const DepositInfoNote({required this.text, super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.authGreen.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.22)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded, size: 16, color: AppColors.authGreen.withValues(alpha: 0.9)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(fontSize: 11, height: 1.4, color: AppColors.authMuted.withValues(alpha: 0.9)),
            ),
          ),
        ],
      ),
    );
  }
}

/// P2P merchant picker header — reference layout, auth-green theme.
class DepositMerchantAmountHeader extends StatelessWidget {
  const DepositMerchantAmountHeader({required this.amount, super.key});

  final double amount;

  @override
  Widget build(BuildContext context) {
    final display = '₹${NumberFormat('#,##,###').format(amount.toInt())}';

    return Text(
      display,
      textAlign: TextAlign.center,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 30,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.5,
        height: 1.1,
      ),
    );
  }
}

class DepositMerchantHeader extends StatelessWidget {
  const DepositMerchantHeader({required this.amount, super.key});

  final double amount;

  @override
  Widget build(BuildContext context) {
    final display = '₹${NumberFormat('#,##,###').format(amount.toInt())}';

    return Column(
      children: [
        Text(
          'SELECT P2P MERCHANT',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.4,
            color: AppColors.authGreen.withValues(alpha: 0.9),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Pay $display',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 30,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
            height: 1.1,
          ),
        ),
      ],
    );
  }
}

class DepositEscrowBanner extends StatelessWidget {
  const DepositEscrowBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.authGreen.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Icon(Icons.shield_outlined, size: 18, color: AppColors.authGreen.withValues(alpha: 0.9)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Escrow-protected · Funds released after merchant confirms',
              style: TextStyle(
                fontSize: 11.5,
                height: 1.4,
                color: AppColors.authMuted.withValues(alpha: 0.88),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class DepositMerchantCard extends StatelessWidget {
  const DepositMerchantCard({
    required this.merchant,
    required this.onPay,
    super.key,
  });

  final P2pMerchant merchant;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authInputBorder),
      ),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: merchant.ringColor.withValues(alpha: 0.12),
                  border: Border.all(color: merchant.ringColor.withValues(alpha: 0.65), width: 1.5),
                ),
                alignment: Alignment.center,
                child: Text(
                  merchant.avatarLetter,
                  style: TextStyle(
                    color: merchant.ringColor,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (merchant.online)
                Positioned(
                  right: -1,
                  bottom: -1,
                  child: Container(
                    width: 11,
                    height: 11,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFFF5252),
                      border: Border.all(color: AppColors.authCardBg, width: 2),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  merchant.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  merchant.limitLabel,
                  style: TextStyle(
                    fontSize: 10.5,
                    color: AppColors.authMuted.withValues(alpha: 0.75),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                HapticFeedback.mediumImpact();
                onPay();
              },
              borderRadius: BorderRadius.circular(10),
              child: Ink(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  gradient: AppColors.authGreenGradient,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.authGreen.withValues(alpha: 0.25),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Pay',
                      style: TextStyle(
                        color: Color(0xFF0A1A0F),
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(width: 2),
                    Icon(Icons.chevron_right_rounded, color: Color(0xFF0A1A0F), size: 18),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// UPI payment header — reference layout.
class UpiPaymentHeader extends StatelessWidget {
  const UpiPaymentHeader({required this.amount, super.key});

  final double amount;

  @override
  Widget build(BuildContext context) {
    final display = '₹${NumberFormat('#,##,###').format(amount.toInt())}';

    return Column(
      children: [
        Text(
          'UPI PAYMENT',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.5,
            color: AppColors.authGreen.withValues(alpha: 0.9),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Pay $display',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 30,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
            height: 1.1,
          ),
        ),
      ],
    );
  }
}

class UpiMerchantInfoCard extends StatelessWidget {
  const UpiMerchantInfoCard({required this.merchant, super.key});

  final P2pMerchant merchant;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authInputBorder),
      ),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: merchant.ringColor.withValues(alpha: 0.15),
                  border: Border.all(color: merchant.ringColor.withValues(alpha: 0.6), width: 1.5),
                ),
                alignment: Alignment.center,
                child: Text(
                  merchant.avatarLetter,
                  style: TextStyle(color: merchant.ringColor, fontSize: 18, fontWeight: FontWeight.w800),
                ),
              ),
              if (merchant.online)
                Positioned(
                  right: -1,
                  bottom: -1,
                  child: Container(
                    width: 11,
                    height: 11,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFFF5252),
                      border: Border.all(color: AppColors.authCardBg, width: 2),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              merchant.name,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.4,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.5)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.shield_outlined, size: 13, color: AppColors.authGreen.withValues(alpha: 0.9)),
                const SizedBox(width: 4),
                Text(
                  'ESCROW',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                    color: AppColors.authGreen.withValues(alpha: 0.95),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class UpiScanQrSection extends StatelessWidget {
  const UpiScanQrSection({
    required this.upiId,
    required this.amount,
    required this.payeeName,
    required this.note,
    super.key,
  });

  final String upiId;
  final double amount;
  final String payeeName;
  final String note;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('SCAN TO PAY', style: AppDesk.overline.copyWith(color: AppColors.authGreen.withValues(alpha: 0.88))),
        const SizedBox(height: AppSpacing.md),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.md),
          decoration: AppDesk.card(accent: AppColors.authGreen),
          child: Column(
            children: [
              DepositQrBlock(data: upiId, size: 168),
              const SizedBox(height: 14),
              const _UpiAppShortcuts(),
            ],
          ),
        ),
      ],
    );
  }
}

class _UpiAppShortcuts extends StatelessWidget {
  const _UpiAppShortcuts();

  static const _apps = [
    ('PhonePe', Color(0xFF5F259F)),
    ('GPay', Color(0xFF4285F4)),
    ('Paytm', Color(0xFF00BAF2)),
    ('BHIM', Color(0xFF00897B)),
  ];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: _apps.map((app) {
        final (label, color) = app;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: label == 'BHIM' ? 0 : 8),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.03),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: color.withValues(alpha: 0.45)),
              ),
              alignment: Alignment.center,
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: color.withValues(alpha: 0.95),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class UpiOrDivider extends StatelessWidget {
  const UpiOrDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Divider(color: AppColors.authInputBorder.withValues(alpha: 0.8), height: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            'OR PAY USING UPI ID',
            style: TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: AppColors.authMuted.withValues(alpha: 0.65),
            ),
          ),
        ),
        Expanded(child: Divider(color: AppColors.authInputBorder.withValues(alpha: 0.8), height: 1)),
      ],
    );
  }
}

class UpiDetailCopyRow extends StatelessWidget {
  const UpiDetailCopyRow({
    required this.icon,
    required this.label,
    required this.value,
    super.key,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.authGreen.withValues(alpha: 0.1),
              border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.28)),
            ),
            child: Icon(icon, size: 16, color: AppColors.authGreen),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.authMuted.withValues(alpha: 0.75),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                Clipboard.setData(ClipboardData(text: value));
                HapticFeedback.lightImpact();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('$label copied'), backgroundColor: AppColors.authCardBg),
                );
              },
              borderRadius: BorderRadius.circular(8),
              child: Ink(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.45)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.copy_rounded, size: 13, color: AppColors.authGreen.withValues(alpha: 0.9)),
                    const SizedBox(width: 4),
                    Text(
                      'Copy',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.authGreen.withValues(alpha: 0.95),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class UpiDetailsCard extends StatelessWidget {
  const UpiDetailsCard({
    required this.upiId,
    required this.amount,
    required this.reference,
    super.key,
  });

  final String upiId;
  final double amount;
  final String reference;

  @override
  Widget build(BuildContext context) {
    final amountStr = '₹${NumberFormat('#,##,###').format(amount.toInt())}';

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF12171C),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF1E2630)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          UpiDetailCopyRow(icon: Icons.alternate_email_rounded, label: 'UPI ID', value: upiId),
          Divider(height: 1, color: const Color(0xFF1E2630)),
          UpiDetailCopyRow(icon: Icons.currency_rupee_rounded, label: 'Amount', value: amountStr),
          Divider(height: 1, color: const Color(0xFF1E2630)),
          UpiDetailCopyRow(icon: Icons.tag_rounded, label: 'Reference No.', value: reference),
        ],
      ),
    );
  }
}

class UpiExactAmountWarning extends StatelessWidget {
  const UpiExactAmountWarning({required this.amount, super.key});

  final double amount;

  @override
  Widget build(BuildContext context) {
    final display = '₹${NumberFormat('#,##,###').format(amount.toInt())}';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(
        color: const Color(0xFFFF9800).withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFF9800).withValues(alpha: 0.32)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.warning_amber_rounded, size: 18, color: const Color(0xFFFFB74D).withValues(alpha: 0.95)),
          const SizedBox(width: 10),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: TextStyle(fontSize: 11.5, height: 1.45, color: AppColors.authMuted.withValues(alpha: 0.88)),
                children: [
                  const TextSpan(text: 'Pay '),
                  TextSpan(
                    text: 'exactly $display',
                    style: const TextStyle(
                      color: Color(0xFFFFB74D),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const TextSpan(text: ' · Do not add any note or remarks while paying'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class UpiHowItWorks extends StatelessWidget {
  const UpiHowItWorks({super.key});

  static const _steps = [
    'Scan QR or paste UPI ID in any UPI app',
    'Pay the exact amount — no remarks needed',
    'Submit UTR + screenshot · funds credited in 2 mins',
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'HOW IT WORKS',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.1,
            color: AppColors.authMuted.withValues(alpha: 0.65),
          ),
        ),
        const SizedBox(height: 10),
        ...List.generate(_steps.length, (i) {
          return Padding(
            padding: EdgeInsets.only(bottom: i < _steps.length - 1 ? 10 : 0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.authGreen.withValues(alpha: 0.12),
                    border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.4)),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${i + 1}',
                    style: const TextStyle(
                      color: AppColors.authGreen,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: Text(
                      _steps[i],
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.35,
                        color: Colors.white.withValues(alpha: 0.86),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}

/// Primary CTA — "I've Paid ₹…" with trailing arrow (reference layout).
class UpiConfirmPayButton extends StatelessWidget {
  const UpiConfirmPayButton({
    required this.amount,
    required this.onPressed,
    super.key,
  });

  final double amount;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final label = "I've Paid ₹${NumberFormat('#,##,###').format(amount.toInt())}";

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.mediumImpact();
          onPressed();
        },
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Ink(
          height: AppSpacing.deskButtonHeight,
          decoration: AppDesk.primaryButton(),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    color: AppDesk.bg,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppDesk.bg.withValues(alpha: 0.12),
                ),
                child: const Icon(Icons.arrow_forward_rounded, size: 16, color: AppDesk.bg),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class UpiEscrowFooter extends StatelessWidget {
  const UpiEscrowFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.info_outline_rounded, size: 14, color: AppColors.authMuted.withValues(alpha: 0.6)),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            'Funds held in escrow · Released only after merchant confirms · 0% fees',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 10,
              height: 1.4,
              color: AppColors.authMuted.withValues(alpha: 0.62),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Bank transfer (NEFT / IMPS / Net Banking) ────────────────────────────────

class BankTransferPaymentHeader extends StatelessWidget {
  const BankTransferPaymentHeader({
    required this.amount,
    required this.method,
    super.key,
  });

  final double amount;
  final InrPaymentMethod method;

  String get _methodLabel => switch (method) {
        InrPaymentMethod.netBanking => 'BANK TRANSFER · NET BANKING',
        InrPaymentMethod.impsNeft => 'BANK TRANSFER · NEFT/IMPS',
        InrPaymentMethod.upi => 'BANK TRANSFER',
      };

  @override
  Widget build(BuildContext context) {
    final display = '₹${NumberFormat('#,##,###').format(amount.toInt())}';

    return Column(
      children: [
        Text(
          _methodLabel,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.2,
            color: AppColors.authGreen.withValues(alpha: 0.9),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Pay $display',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 30,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
            height: 1.1,
          ),
        ),
      ],
    );
  }
}

class BankTransferMerchantInfoCard extends StatelessWidget {
  const BankTransferMerchantInfoCard({required this.merchant, super.key});

  final P2pMerchant merchant;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authInputBorder),
      ),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: merchant.ringColor.withValues(alpha: 0.15),
                  border: Border.all(color: merchant.ringColor.withValues(alpha: 0.6), width: 1.5),
                ),
                alignment: Alignment.center,
                child: Text(
                  merchant.avatarLetter,
                  style: TextStyle(color: merchant.ringColor, fontSize: 18, fontWeight: FontWeight.w800),
                ),
              ),
              if (merchant.online)
                Positioned(
                  right: -1,
                  bottom: -1,
                  child: Container(
                    width: 11,
                    height: 11,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFFF5252),
                      border: Border.all(color: AppColors.authCardBg, width: 2),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              merchant.name,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.4,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.5)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.authGreen),
                ),
                const SizedBox(width: 5),
                Text(
                  'LIVE',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                    color: AppColors.authGreen.withValues(alpha: 0.95),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class BankTransferBeneficiaryCard extends StatelessWidget {
  const BankTransferBeneficiaryCard({required this.merchant, super.key});

  final P2pMerchant merchant;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF12171C),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF1E2630)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
            child: Text(
              'BENEFICIARY ACCOUNT DETAILS',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8,
                color: AppColors.authMuted.withValues(alpha: 0.65),
              ),
            ),
          ),
          UpiDetailCopyRow(icon: Icons.person_outline_rounded, label: 'Account Holder', value: merchant.accountHolder),
          Divider(height: 1, color: const Color(0xFF1E2630)),
          UpiDetailCopyRow(icon: Icons.tag_rounded, label: 'Account Number', value: merchant.accountNumber),
          Divider(height: 1, color: const Color(0xFF1E2630)),
          UpiDetailCopyRow(icon: Icons.vpn_key_outlined, label: 'IFSC Code', value: merchant.ifsc),
          Divider(height: 1, color: const Color(0xFF1E2630)),
          UpiDetailCopyRow(icon: Icons.account_balance_outlined, label: 'Bank', value: merchant.bankName),
        ],
      ),
    );
  }
}

class BankTransferReferenceCard extends StatelessWidget {
  const BankTransferReferenceCard({required this.reference, super.key});

  final String reference;

  void _copy(BuildContext context) {
    Clipboard.setData(ClipboardData(text: reference));
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: const Text('Reference copied'), backgroundColor: AppColors.authCardBg),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: AppColors.authGreen.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.55), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(
                'DEPOSIT REFERENCE ID',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.7,
                  color: AppColors.authGreen.withValues(alpha: 0.9),
                ),
              ),
              const Spacer(),
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => _copy(context),
                  borderRadius: BorderRadius.circular(8),
                  child: Ink(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.45)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.copy_rounded, size: 13, color: AppColors.authGreen.withValues(alpha: 0.9)),
                        const SizedBox(width: 4),
                        Text(
                          'Copy',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.authGreen.withValues(alpha: 0.95),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            reference,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

class BankTransferExactAmountWarning extends StatelessWidget {
  const BankTransferExactAmountWarning({required this.amount, super.key});

  final double amount;

  @override
  Widget build(BuildContext context) {
    final display = '₹${NumberFormat('#,##,###').format(amount.toInt())}';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(
        color: const Color(0xFFFF5252).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFF5252).withValues(alpha: 0.28)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.warning_amber_rounded, size: 18, color: const Color(0xFFFF8A80).withValues(alpha: 0.95)),
          const SizedBox(width: 10),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: TextStyle(fontSize: 11.5, height: 1.45, color: AppColors.authMuted.withValues(alpha: 0.88)),
                children: [
                  const TextSpan(text: 'Transfer the '),
                  TextSpan(
                    text: 'exact amount of $display',
                    style: const TextStyle(color: Color(0xFFFF8A80), fontWeight: FontWeight.w800),
                  ),
                  const TextSpan(text: '. Different amount, wrong account, or remarks in transfer may delay/reject crediting.'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class BankTransferInstructions extends StatelessWidget {
  const BankTransferInstructions({required this.amount, required this.method, super.key});

  final double amount;
  final InrPaymentMethod method;

  @override
  Widget build(BuildContext context) {
    final display = '₹${NumberFormat('#,##,###').format(amount.toInt())}';
    final transferModes = method == InrPaymentMethod.netBanking ? 'Net Banking' : 'NEFT / IMPS / RTGS';
    final steps = [
      'Open your bank app and add the account above as beneficiary (or use Quick Transfer).',
      'Send exactly $display via $transferModes — leave the transfer remark/note field blank.',
      'Tap "I\'ve Paid" below and submit your UTR — funds usually credited within 2 minutes.',
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      decoration: BoxDecoration(
        color: const Color(0xFF12171C).withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF1E2630)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'INSTRUCTIONS',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.1,
              color: AppColors.authMuted.withValues(alpha: 0.65),
            ),
          ),
          const SizedBox(height: 10),
          ...List.generate(steps.length, (i) {
            return Padding(
              padding: EdgeInsets.only(bottom: i < steps.length - 1 ? 10 : 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.authGreen.withValues(alpha: 0.12),
                      border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.4)),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '${i + 1}',
                      style: const TextStyle(color: AppColors.authGreen, fontSize: 10, fontWeight: FontWeight.w800),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 1),
                      child: Text(
                        steps[i],
                        style: TextStyle(fontSize: 12, height: 1.35, color: Colors.white.withValues(alpha: 0.86)),
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

/// Verify payment — UTR + screenshot upload (reference layout).
class VerifyPaymentHeader extends StatelessWidget {
  const VerifyPaymentHeader({required this.amount, super.key});

  final double amount;

  @override
  Widget build(BuildContext context) {
    final display = '₹${NumberFormat('#,##,###').format(amount.toInt())}';

    return Column(
      children: [
        Text(
          'VERIFY PAYMENT',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.5,
            color: AppColors.authGreen.withValues(alpha: 0.9),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Confirm $display',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 30,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
            height: 1.1,
          ),
        ),
      ],
    );
  }
}

class VerifyAwaitingBanner extends StatelessWidget {
  const VerifyAwaitingBanner({required this.merchant, super.key});

  final P2pMerchant merchant;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.authGreen.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: merchant.ringColor.withValues(alpha: 0.15),
              border: Border.all(color: merchant.ringColor.withValues(alpha: 0.55)),
            ),
            alignment: Alignment.center,
            child: Text(
              merchant.avatarLetter,
              style: TextStyle(color: merchant.ringColor, fontSize: 16, fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Awaiting verification',
                  style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  'Submit UTR & screenshot from your UPI payment',
                  style: TextStyle(
                    fontSize: 11.5,
                    height: 1.4,
                    color: AppColors.authMuted.withValues(alpha: 0.82),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class VerifyUtrField extends StatelessWidget {
  const VerifyUtrField({
    required this.controller,
    required this.onChanged,
    super.key,
  });

  final TextEditingController controller;
  final VoidCallback onChanged;

  static const maxLen = 22;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Text(
              'UTR / Transaction Reference',
              style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
            ),
            const Spacer(),
            ListenableBuilder(
              listenable: controller,
              builder: (_, __) => Text(
                '${controller.text.length}/$maxLen',
                style: TextStyle(
                  fontSize: 11,
                  color: AppColors.authMuted.withValues(alpha: 0.7),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: AppColors.authInputBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.authInputBorder),
          ),
          child: Material(
            color: Colors.transparent,
            child: Theme(
              data: Theme.of(context).copyWith(
                inputDecorationTheme: const InputDecorationTheme(
                  filled: false,
                  fillColor: Colors.transparent,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                ),
              ),
              child: TextField(
                controller: controller,
                maxLength: maxLen,
                onChanged: (_) => onChanged(),
                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                cursorColor: AppColors.authGreen,
                decoration: InputDecoration(
                  counterText: '',
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  hintText: '# e.g. 240501234567 or N12345678901234',
                  hintStyle: TextStyle(
                    color: AppColors.authMuted.withValues(alpha: 0.45),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Find UTR in your bank app\'s transaction history (12–22 chars, IMPS/NEFT/RTGS).',
          style: TextStyle(fontSize: 10.5, height: 1.4, color: AppColors.authMuted.withValues(alpha: 0.65)),
        ),
      ],
    );
  }
}

class VerifyScreenshotUpload extends StatelessWidget {
  const VerifyScreenshotUpload({
    required this.count,
    required this.maxCount,
    required this.onAdd,
    super.key,
  });

  final int count;
  final int maxCount;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Text(
              'Payment Screenshot',
              style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
            ),
            const Spacer(),
            Text(
              '$count/$maxCount',
              style: TextStyle(
                fontSize: 11,
                color: AppColors.authMuted.withValues(alpha: 0.7),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: count < maxCount ? onAdd : null,
            borderRadius: BorderRadius.circular(12),
            child: Ink(
              width: 110,
              height: 110,
              decoration: BoxDecoration(
                color: AppColors.authInputBg.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.45), width: 1.5),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.cloud_upload_outlined, size: 28, color: AppColors.authGreen.withValues(alpha: 0.85)),
                  const SizedBox(height: 6),
                  Text(
                    'Upload',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Up to 3 images · PNG or JPG · Max 5 MB each · Show full transaction',
          style: TextStyle(fontSize: 10.5, height: 1.4, color: AppColors.authMuted.withValues(alpha: 0.65)),
        ),
      ],
    );
  }
}

class VerifyInfoBar extends StatelessWidget {
  const VerifyInfoBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.75)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.shield_outlined, size: 15, color: AppColors.authGreen.withValues(alpha: 0.85)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Verified within 2 mins · Auto-credited on UTR match · 24/7 support if delayed',
              style: TextStyle(fontSize: 10.5, height: 1.45, color: AppColors.authMuted.withValues(alpha: 0.75)),
            ),
          ),
        ],
      ),
    );
  }
}

class VerifySubmitButton extends StatelessWidget {
  const VerifySubmitButton({
    required this.enabled,
    required this.onPressed,
    this.loading = false,
    super.key,
  });

  final bool enabled;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: enabled && !loading ? onPressed : null,
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            decoration: BoxDecoration(
              gradient: enabled ? AppColors.authGreenGradient : null,
              color: enabled ? null : AppColors.authInputBg,
              borderRadius: BorderRadius.circular(14),
              border: enabled ? null : Border.all(color: AppColors.authInputBorder),
            ),
            child: Center(
              child: Text(
                enabled ? 'Submit for verification' : 'Enter UTR to continue',
                style: TextStyle(
                  color: enabled ? const Color(0xFF0A1A0F) : Colors.white.withValues(alpha: 0.45),
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Full cinematic success stage — glow, sparks, shimmer, glass cards.
class DepositSuccessStage extends StatefulWidget {
  const DepositSuccessStage({
    required this.amount,
    required this.isCrypto,
    required this.isHighValue,
    required this.rows,
    required this.onDone,
    required this.onWallet,
    super.key,
  });

  final double amount;
  final bool isCrypto;
  final bool isHighValue;
  final List<DepositSuccessRow> rows;
  final VoidCallback onDone;
  final VoidCallback onWallet;

  @override
  State<DepositSuccessStage> createState() => _DepositSuccessStageState();
}

class _DepositSuccessStageState extends State<DepositSuccessStage> with TickerProviderStateMixin {
  late final AnimationController _master;
  late final AnimationController _pulse;
  late final AnimationController _shimmer;

  Color get _accent => widget.isHighValue ? AppColors.authGold : AppColors.authGreen;
  LinearGradient get _accentGradient =>
      widget.isHighValue ? AppColors.authGoldGradient : AppColors.authGreenGradient;

  @override
  void initState() {
    super.initState();
    _master = AnimationController(vsync: this, duration: MotionTokens.deliberate)..forward();
    _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 4000))..repeat();
    _shimmer = AnimationController(vsync: this, duration: MotionTokens.shimmerPeriod)..repeat();
    WidgetsBinding.instance.addPostFrameCallback((_) => HapticFeedback.mediumImpact());
  }

  @override
  void dispose() {
    _master.dispose();
    _pulse.dispose();
    _shimmer.dispose();
    super.dispose();
  }

  Animation<double> _interval(double start, double end) => CurvedAnimation(
        parent: _master,
        curve: Interval(start, end, curve: Curves.easeOutCubic),
      );

  Widget _reveal({required Animation<double> anim, required Widget child, double dy = 22}) {
    return AnimatedBuilder(
      animation: anim,
      builder: (_, c) => Opacity(
        opacity: anim.value,
        child: Transform.translate(offset: Offset(0, dy * (1 - anim.value)), child: c),
      ),
      child: child,
    );
  }

  String get _amountDisplay {
    if (widget.isCrypto) return widget.amount.toStringAsFixed(2);
    return NumberFormat('#,##,###').format(widget.amount.toInt());
  }

  @override
  Widget build(BuildContext context) {
    final heroAnim = _interval(0, 0.55);
    final amountAnim = _interval(0.18, 0.72);
    final pendingAnim = _interval(0.38, 0.82);
    final receiptAnim = _interval(0.52, 0.92);
    final ctaAnim = _interval(0.68, 1);

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned(
          top: -40,
          left: -20,
          right: -20,
          child: IgnorePointer(
            child: AnimatedBuilder(
              animation: Listenable.merge([_master, _pulse]),
              builder: (_, __) {
                final breathe = 0.92 + _pulse.value * 0.08;
                return Opacity(
                  opacity: heroAnim.value * 0.95,
                  child: Transform.scale(
                    scale: breathe,
                    child: Container(
                      height: 320,
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          center: Alignment.topCenter,
                          radius: 0.85,
                          colors: [
                            _accent.withValues(alpha: 0.28),
                            _accent.withValues(alpha: 0.1),
                            _accent.withValues(alpha: 0.03),
                            Colors.transparent,
                          ],
                          stops: const [0, 0.35, 0.65, 1],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        SingleChildScrollView(
          physics: AppScroll.page,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 36),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _reveal(
                anim: heroAnim,
                dy: 16,
                child: SizedBox(
                  height: 140,
                  child: Center(
                    child: _SuccessHeroCore(
                      accent: _accent,
                      accentGradient: _accentGradient,
                      isHighValue: widget.isHighValue,
                      master: _master,
                      pulse: _pulse,
                    ),
                  ),
                ),
              ),
              _reveal(
                anim: amountAnim,
                child: Column(
                  children: [
                    _SuccessBadge(
                      label: widget.isHighValue ? 'PREMIUM DEPOSIT' : 'PAYMENT RECEIVED',
                      accent: _accent,
                      isPremium: widget.isHighValue,
                    ),
                    const SizedBox(height: 14),
                    _ShimmerAmountText(
                      text: '${widget.isCrypto ? '\$' : '₹'}$_amountDisplay${widget.isCrypto ? ' USDT' : ''}',
                      isHighValue: widget.isHighValue,
                      shimmer: _shimmer,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Awaiting merchant verification',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Colors.white.withValues(alpha: 0.88),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Wallet balance updates after approval',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.35,
                        color: AppColors.authMuted.withValues(alpha: 0.72),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              _reveal(
                anim: pendingAnim,
                child: _SuccessPendingGlass(
                  isCrypto: widget.isCrypto,
                  accent: _accent,
                  pulse: _pulse,
                ),
              ),
              const SizedBox(height: 16),
              _reveal(
                anim: receiptAnim,
                child: DepositSuccessSummaryCard(
                  rows: widget.rows,
                  isHighValue: widget.isHighValue,
                  borderPulse: _pulse,
                  shimmer: _shimmer,
                ),
              ),
              const SizedBox(height: 28),
              _reveal(
                anim: ctaAnim,
                child: Column(
                  children: [
                    AuthPrimaryButton(label: 'Back to Terminal', onPressed: widget.onDone),
                    const SizedBox(height: 10),
                    DepositSecondaryButton(label: 'Go to Wallet', onPressed: widget.onWallet),
                    const SizedBox(height: 16),
                    _TrustFooter(accent: _accent),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SuccessHeroCore extends StatelessWidget {
  const _SuccessHeroCore({
    required this.accent,
    required this.accentGradient,
    required this.isHighValue,
    required this.master,
    required this.pulse,
  });

  final Color accent;
  final LinearGradient accentGradient;
  final bool isHighValue;
  final AnimationController master;
  final AnimationController pulse;

  @override
  Widget build(BuildContext context) {
    final scale = CurvedAnimation(parent: master, curve: MotionTokens.enter);
    final ringFade = CurvedAnimation(
      parent: master,
      curve: const Interval(0.15, 0.75, curve: Curves.easeOut),
    );

    return AnimatedBuilder(
      animation: Listenable.merge([master, pulse]),
      builder: (_, __) {
        return Stack(
          alignment: Alignment.center,
          children: [
            for (var i = 0; i < 1; i++)
              Transform.scale(
                scale: 1 + (pulse.value + i * 0.45) % 1 * 0.12,
                child: Opacity(
                  opacity: (1 - ((pulse.value + i * 0.45) % 1)) * ringFade.value * 0.18,
                  child: Container(
                    width: 118,
                    height: 118,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: accent.withValues(alpha: 0.35), width: 1.5),
                    ),
                  ),
                ),
              ),
            Opacity(
              opacity: ringFade.value,
              child: Container(
                width: 148,
                height: 148,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      accent.withValues(alpha: 0.22),
                      accent.withValues(alpha: 0.06),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Transform.scale(
              scale: scale.value,
              child: Container(
                width: 92,
                height: 92,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: accentGradient,
                  boxShadow: [
                    BoxShadow(color: accent.withValues(alpha: 0.55), blurRadius: 32, spreadRadius: 2),
                    BoxShadow(color: accent.withValues(alpha: 0.25), blurRadius: 64, spreadRadius: 8),
                  ],
                ),
                child: Icon(
                  Icons.check_rounded,
                  color: isHighValue ? const Color(0xFF1A1408) : const Color(0xFF0A1A0F),
                  size: 50,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _SuccessBadge extends StatelessWidget {
  const _SuccessBadge({required this.label, required this.accent, required this.isPremium});

  final String label;
  final Color accent;
  final bool isPremium;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [accent.withValues(alpha: 0.16), accent.withValues(alpha: 0.06)],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: accent.withValues(alpha: 0.45)),
        boxShadow: [BoxShadow(color: accent.withValues(alpha: 0.12), blurRadius: 16)],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isPremium ? Icons.workspace_premium_rounded : Icons.verified_rounded,
            size: 14,
            color: accent,
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
              color: accent,
            ),
          ),
        ],
      ),
    );
  }
}

class _ShimmerAmountText extends StatelessWidget {
  const _ShimmerAmountText({
    required this.text,
    required this.isHighValue,
    required this.shimmer,
  });

  final String text;
  final bool isHighValue;
  final AnimationController shimmer;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: shimmer,
      builder: (_, __) {
        return ShaderMask(
          shaderCallback: (bounds) {
            final colors = isHighValue
                ? const [
                    Color(0xFFB8860B),
                    Color(0xFFF5D76E),
                    Colors.white,
                    Color(0xFFF5D76E),
                    Color(0xFFB8860B),
                  ]
                : const [
                    Color(0xFF00C853),
                    Color(0xFF69F0AE),
                    Colors.white,
                    Color(0xFF69F0AE),
                    Color(0xFF00C853),
                  ];
            return LinearGradient(
              begin: Alignment(-1.2 + shimmer.value * 2.4, 0),
              end: Alignment(-0.2 + shimmer.value * 2.4, 0),
              colors: colors,
              stops: const [0.0, 0.32, 0.5, 0.68, 1.0],
            ).createShader(bounds);
          },
          blendMode: BlendMode.srcIn,
          child: Text(
            text,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 48,
              fontWeight: FontWeight.w900,
              letterSpacing: -1.2,
              height: 1,
            ),
          ),
        );
      },
    );
  }
}

class _SuccessPendingGlass extends StatelessWidget {
  const _SuccessPendingGlass({
    required this.isCrypto,
    required this.accent,
    required this.pulse,
  });

  final bool isCrypto;
  final Color accent;
  final AnimationController pulse;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: pulse,
      builder: (_, __) {
        return ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Colors.white.withValues(alpha: 0.08),
                    Colors.white.withValues(alpha: 0.02),
                    AppColors.warning.withValues(alpha: 0.04),
                  ],
                ),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: Color.lerp(
                    accent.withValues(alpha: 0.2),
                    AppColors.warning.withValues(alpha: 0.45),
                    0.55 + pulse.value * 0.1,
                  )!,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.warning.withValues(alpha: 0.06 + pulse.value * 0.04),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [
                          AppColors.warning.withValues(alpha: 0.22),
                          AppColors.warning.withValues(alpha: 0.08),
                        ],
                      ),
                      border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
                    ),
                    child: Icon(Icons.hourglass_top_rounded, color: AppColors.warning.withValues(alpha: 0.95), size: 20),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              'Verification in Progress',
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                color: Colors.white.withValues(alpha: 0.94),
                              ),
                            ),
                            const SizedBox(width: 8),
                            _ReviewPulseDots(pulse: pulse),
                          ],
                        ),
                        const SizedBox(height: 5),
                        Text(
                          isCrypto
                              ? 'On-chain confirmation in progress. Wallet balance updates once verified.'
                              : 'Merchant is reviewing your payment. Balance reflects after approval.',
                          style: TextStyle(
                            fontSize: 11.5,
                            height: 1.45,
                            color: AppColors.authMuted.withValues(alpha: 0.82),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ReviewPulseDots extends StatelessWidget {
  const _ReviewPulseDots({required this.pulse});

  final AnimationController pulse;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (i) {
        final phase = (pulse.value + i * 0.22) % 1.0;
        final scale = 0.55 + (phase < 0.5 ? phase * 0.9 : (1 - phase) * 0.9);
        return Padding(
          padding: const EdgeInsets.only(right: 3),
          child: Transform.scale(
            scale: scale,
            child: Container(
              width: 5,
              height: 5,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.warning.withValues(alpha: 0.55 + scale * 0.35),
              ),
            ),
          ),
        );
      }),
    );
  }
}

class _TrustFooter extends StatelessWidget {
  const _TrustFooter({required this.accent});

  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.lock_outline_rounded, size: 11, color: accent.withValues(alpha: 0.65)),
        const SizedBox(width: 5),
        Flexible(
          child: Text(
            'Escrow protected · Merchant review · 0% fees',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 10, color: AppColors.authMuted.withValues(alpha: 0.55)),
          ),
        ),
      ],
    );
  }
}

class DepositSuccessSummaryCard extends StatelessWidget {
  const DepositSuccessSummaryCard({
    required this.rows,
    this.isHighValue = false,
    this.borderPulse,
    this.shimmer,
    super.key,
  });

  final List<DepositSuccessRow> rows;
  final bool isHighValue;
  final AnimationController? borderPulse;
  final AnimationController? shimmer;

  @override
  Widget build(BuildContext context) {
    final accent = isHighValue ? AppColors.authGold : AppColors.authGreen;

    return AnimatedBuilder(
      animation: Listenable.merge([
        if (borderPulse != null) borderPulse!,
        if (shimmer != null) shimmer!,
      ]),
      builder: (_, __) {
        final pulse = borderPulse?.value ?? 0.0;
        final shine = shimmer?.value ?? 0.0;

        return ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Colors.white.withValues(alpha: 0.07),
                    AppColors.authCardBg.withValues(alpha: 0.55),
                    AppColors.authCardBg.withValues(alpha: 0.35),
                  ],
                ),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: accent.withValues(alpha: 0.18 + pulse * 0.12)),
                boxShadow: [
                  BoxShadow(
                    color: accent.withValues(alpha: 0.08 + pulse * 0.06),
                    blurRadius: 28,
                    offset: const Offset(0, 10),
                  ),
                  BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 8)),
                ],
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: 0,
                    left: -80 + shine * 360,
                    right: 0,
                    child: Container(
                      height: 1,
                      width: 120,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.transparent,
                            accent.withValues(alpha: 0.55),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 15, 16, 11),
                        child: Row(
                          children: [
                            Container(
                              width: 28,
                              height: 28,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: accent.withValues(alpha: 0.12),
                                border: Border.all(color: accent.withValues(alpha: 0.3)),
                              ),
                              child: Icon(Icons.receipt_long_rounded, size: 14, color: accent.withValues(alpha: 0.9)),
                            ),
                            const SizedBox(width: 10),
                            Text(
                              'Transaction Receipt',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: Colors.white.withValues(alpha: 0.92),
                                letterSpacing: 0.2,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Divider(height: 1, color: AppColors.authInputBorder.withValues(alpha: 0.55)),
                      ...List.generate(rows.length, (i) {
                        final row = rows[i];
                        return Column(
                          children: [
                            _ReceiptDataRow(row: row, accent: accent),
                            if (i < rows.length - 1)
                              Divider(
                                height: 1,
                                indent: 16,
                                endIndent: 16,
                                color: AppColors.authInputBorder.withValues(alpha: 0.45),
                              ),
                          ],
                        );
                      }),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class DepositSuccessRow {
  const DepositSuccessRow({
    required this.label,
    required this.value,
    this.highlight = false,
    this.pending = false,
  });

  final String label;
  final String value;
  final bool highlight;
  final bool pending;
}

class _ReceiptDataRow extends StatelessWidget {
  const _ReceiptDataRow({required this.row, required this.accent});

  static const _labelWidth = 98.0;

  final DepositSuccessRow row;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final isStatus = row.label == 'Status';
    final statusColor = row.pending ? AppColors.warning : AppColors.authGreen;
    final labelStyle = TextStyle(
      fontSize: 11.5,
      color: AppColors.authMuted.withValues(alpha: 0.72),
      fontWeight: FontWeight.w500,
      height: 1.25,
    );
    final valueStyle = TextStyle(
      fontSize: isStatus ? 10.5 : 13,
      fontWeight: FontWeight.w700,
      height: 1.25,
      color: row.highlight ? accent : Colors.white.withValues(alpha: 0.92),
      fontFeatures: row.label == 'Time' ? const [FontFeature.tabularFigures()] : null,
    );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: _labelWidth,
            child: Text(row.label, style: labelStyle),
          ),
          Expanded(
            child: isStatus
                ? Align(
                    alignment: Alignment.centerRight,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: statusColor.withValues(alpha: 0.38)),
                      ),
                      child: Text(
                        row.value,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: statusColor,
                          height: 1.2,
                        ),
                      ),
                    ),
                  )
                : Text(
                    row.value,
                    textAlign: TextAlign.end,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: valueStyle,
                  ),
          ),
        ],
      ),
    );
  }
}

class DepositSecondaryButton extends StatelessWidget {
  const DepositSecondaryButton({required this.label, required this.onPressed, super.key});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            HapticFeedback.lightImpact();
            onPressed();
          },
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.22)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.layers_outlined, size: 16, color: AppColors.authGreen.withValues(alpha: 0.85)),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.92),
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
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
