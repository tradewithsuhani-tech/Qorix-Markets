import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/widgets/desk_widgets.dart';
import 'package:qorix_markets_flutter/features/wallet/application/transfer_flow_provider.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/transfer_balances.dart';
import 'package:qorix_markets_flutter/ui/components/magnetic_press.dart';

ThemeData _transferFieldTheme(BuildContext context) => Theme.of(context).copyWith(
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

Widget _transferThemedField(BuildContext context, Widget field) => Material(
      color: Colors.transparent,
      child: Theme(data: _transferFieldTheme(context), child: field),
    );

class TransferSheetHeader extends StatelessWidget {
  const TransferSheetHeader({required this.onClose, super.key});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.authGreen.withValues(alpha: 0.12),
            border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
          ),
          child: Icon(Icons.swap_horiz_rounded, color: AppColors.authGreen.withValues(alpha: 0.95), size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Internal Transfer',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                'Move funds between wallets',
                style: TextStyle(
                  fontSize: 12.5,
                  color: AppColors.authMuted.withValues(alpha: 0.82),
                ),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.authGreen.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
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
              const Text(
                'INSTANT',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                  color: AppColors.authGreen,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              HapticFeedback.lightImpact();
              onClose();
            },
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.all(6),
              child: Icon(Icons.close_rounded, size: 20, color: AppColors.authMuted.withValues(alpha: 0.85)),
            ),
          ),
        ),
      ],
    );
  }
}

class TransferWalletRoute extends StatelessWidget {
  const TransferWalletRoute({
    required this.direction,
    required this.balances,
    required this.onSwap,
    super.key,
  });

  final TransferDirection direction;
  final TransferBalanceSnapshot balances;
  final VoidCallback onSwap;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      clipBehavior: Clip.none,
      children: [
        Column(
          children: [
            TransferWalletCard(
              role: TransferCardRole.from,
              wallet: direction.fromWallet,
              balance: balances.balanceOf(direction.fromWallet),
            ),
            const SizedBox(height: 10),
            TransferWalletCard(
              role: TransferCardRole.to,
              wallet: direction.toWallet,
              balance: balances.balanceOf(direction.toWallet),
            ),
          ],
        ),
        Positioned(
          child: TransferSwapButton(onSwap: onSwap),
        ),
      ],
    );
  }
}

enum TransferCardRole { from, to }

class TransferWalletCard extends StatelessWidget {
  const TransferWalletCard({
    required this.role,
    required this.wallet,
    required this.balance,
    super.key,
  });

  final TransferCardRole role;
  final InternalWallet wallet;
  final double balance;

  static final _usd = NumberFormat.currency(symbol: '\$', decimalDigits: 2);

  @override
  Widget build(BuildContext context) {
    final isFrom = role == TransferCardRole.from;
    final badgeColor = isFrom ? AppColors.authGreen : const Color(0xFF3B82F6);
    final (title, subtitle, icon) = switch (wallet) {
      InternalWallet.main => (
          'Main Wallet',
          'Withdrawable balance',
          Icons.account_balance_wallet_outlined,
        ),
      InternalWallet.funding => (
          'Funding Wallet',
          'Deployed capital',
          Icons.show_chart_rounded,
        ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isFrom
              ? AppColors.authGreen.withValues(alpha: 0.28)
              : const Color(0xFF3B82F6).withValues(alpha: 0.28),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: badgeColor.withValues(alpha: 0.12),
              border: Border.all(color: badgeColor.withValues(alpha: 0.3)),
            ),
            child: Icon(icon, color: badgeColor.withValues(alpha: 0.95), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: badgeColor.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    isFrom ? 'FROM' : 'TO',
                    style: TextStyle(
                      fontSize: 8.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: badgeColor,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.authMuted.withValues(alpha: 0.72),
                  ),
                ),
              ],
            ),
          ),
          Text(
            '${_usd.format(balance)} USD',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Colors.white.withValues(alpha: 0.92),
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

class TransferSwapButton extends StatelessWidget {
  const TransferSwapButton({required this.onSwap, super.key});

  final VoidCallback onSwap;

  static const _size = 44.0;

  static const _orbGradient = RadialGradient(
    center: Alignment(-0.32, -0.38),
    radius: 1.05,
    colors: [Color(0xFF9BFFC8), Color(0xFF00E676), Color(0xFF00A844), Color(0xFF006B2E)],
    stops: [0.0, 0.42, 0.78, 1.0],
  );

  @override
  Widget build(BuildContext context) {
    return MagneticPress(
      onPressed: () {
        HapticFeedback.mediumImpact();
        onSwap();
      },
      glowColor: AppColors.authGreen,
      borderRadius: BorderRadius.circular(_size),
      scale: 0.88,
      child: SizedBox(
        width: _size,
        height: _size,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Positioned(
              left: 4,
              right: 4,
              bottom: -1,
              child: Container(
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.authGreen.withValues(alpha: 0.4),
                      blurRadius: 14,
                      spreadRadius: 0,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
              ),
            ),
            Container(
              width: _size,
              height: _size,
              padding: const EdgeInsets.all(2),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.authPageBg,
              ),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: _orbGradient,
                  border: Border.all(color: Colors.white.withValues(alpha: 0.34), width: 1.1),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.42),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipOval(
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Positioned(
                        top: 0,
                        left: 0,
                        right: 0,
                        height: _size * 0.46,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.white.withValues(alpha: 0.36),
                                Colors.white.withValues(alpha: 0),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        top: 7,
                        left: 10,
                        child: Container(
                          width: 13,
                          height: 6,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(6),
                            gradient: LinearGradient(
                              colors: [
                                Colors.white.withValues(alpha: 0.78),
                                Colors.white.withValues(alpha: 0),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const Icon(Icons.swap_vert_rounded, color: Color(0xFF041208), size: 20),
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
}

class TransferCapitalBreakdown extends StatelessWidget {
  const TransferCapitalBreakdown({
    required this.locked,
    required this.free,
    super.key,
  });

  final double locked;
  final double free;

  static final _usd = NumberFormat.currency(symbol: '\$', decimalDigits: 2);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.75)),
      ),
      child: Column(
        children: [
          _BreakdownRow(
            label: 'Active Strategy (locked)',
            value: _usd.format(locked),
            dotColor: AppColors.authGreen,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Divider(height: 1, color: AppColors.authInputBorder.withValues(alpha: 0.7)),
          ),
          _BreakdownRow(
            label: 'Free Capital (transferable)',
            value: _usd.format(free),
            dotColor: AppColors.warning,
            highlight: true,
          ),
        ],
      ),
    );
  }
}

class _BreakdownRow extends StatelessWidget {
  const _BreakdownRow({
    required this.label,
    required this.value,
    required this.dotColor,
    this.highlight = false,
  });

  final String label;
  final String value;
  final Color dotColor;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(shape: BoxShape.circle, color: dotColor.withValues(alpha: 0.9)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: AppColors.authMuted.withValues(alpha: highlight ? 0.88 : 0.75),
              fontWeight: highlight ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w800,
            color: highlight ? AppColors.authGreen : Colors.white.withValues(alpha: 0.9),
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

class TransferAmountSection extends StatelessWidget {
  const TransferAmountSection({
    required this.controller,
    required this.maxAmount,
    required this.onMax,
    super.key,
  });

  final TextEditingController controller;
  final double maxAmount;
  final VoidCallback onMax;

  static final _usd = NumberFormat.currency(symbol: '\$', decimalDigits: 2);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text(
              'TRANSFER AMOUNT',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: AppColors.authMuted.withValues(alpha: 0.65),
              ),
            ),
            const Spacer(),
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: maxAmount > 0
                    ? () {
                        HapticFeedback.selectionClick();
                        onMax();
                      }
                    : null,
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.authGreen.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
                  ),
                  child: Text(
                    'MAX · ${_usd.format(maxAmount)}',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: AppColors.authGreen,
                    ),
                  ),
                ),
              ),
            ),
          ],
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
                Text(
                  '\$',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.authGreen.withValues(alpha: 0.9),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _transferThemedField(
                    context,
                    TextField(
                      controller: controller,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
                      ],
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                      cursorColor: AppColors.authGreen,
                      decoration: InputDecoration(
                        hintText: '0.00',
                        hintStyle: TextStyle(
                          color: AppColors.authMuted.withValues(alpha: 0.45),
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class TransferInfoNote extends StatelessWidget {
  const TransferInfoNote({required this.text, super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.authGreen.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.28)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded, size: 18, color: AppColors.authGreen.withValues(alpha: 0.9)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 11.5,
                height: 1.45,
                color: AppColors.authMuted.withValues(alpha: 0.85),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class TransferTrustFooter extends StatelessWidget {
  const TransferTrustFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.verified_user_outlined, size: 14, color: AppColors.authGreen.withValues(alpha: 0.8)),
        const SizedBox(width: 6),
        Text(
          'Settled instantly · zero fees',
          style: TextStyle(
            fontSize: 11,
            color: AppColors.authMuted.withValues(alpha: 0.65),
          ),
        ),
      ],
    );
  }
}

class TransferSuccessView extends StatelessWidget {
  const TransferSuccessView({
    required this.flow,
    required this.balances,
    required this.onDone,
    super.key,
  });

  final TransferFlowState flow;
  final TransferBalanceSnapshot balances;
  final VoidCallback onDone;

  static final _usd = NumberFormat.currency(symbol: '\$', decimalDigits: 2);

  @override
  Widget build(BuildContext context) {
    final amount = flow.amount ?? 0;
    final from = flow.direction.fromWallet;
    final to = flow.direction.toWallet;

    String walletName(InternalWallet w) => w == InternalWallet.main ? 'Main Wallet' : 'Funding Wallet';

    return Column(
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
        Text(
          _usd.format(amount),
          textAlign: TextAlign.center,
          style: AppDesk.metricHero,
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          '${walletName(from)} → ${walletName(to)}',
          textAlign: TextAlign.center,
          style: AppDesk.sectionCaption,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Transfer complete · settled instantly',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: AppColors.authGreen.withValues(alpha: 0.9), fontWeight: FontWeight.w600),
        ),
        if (flow.referenceId != null) ...[
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Ref ${flow.referenceId}',
            textAlign: TextAlign.center,
            style: AppDesk.overline.copyWith(fontFamily: 'monospace', letterSpacing: 0.2),
          ),
        ],
        const SizedBox(height: AppSpacing.sectionGap),
        DeskPrimaryCta(label: 'Done', onTap: onDone),
      ],
    );
  }
}

String transferCtaLabel({
  required double amount,
  required double maxAmount,
  required bool submitting,
}) {
  if (submitting) return 'Processing…';
  if (amount <= 0) return 'Enter Amount';
  if (amount > maxAmount) return 'Insufficient balance';
  return 'Transfer ${NumberFormat.currency(symbol: '\$', decimalDigits: 2).format(amount)}';
}
