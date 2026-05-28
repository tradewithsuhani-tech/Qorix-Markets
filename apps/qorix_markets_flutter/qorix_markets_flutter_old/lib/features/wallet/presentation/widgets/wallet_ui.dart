import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/motion/desk_sheets.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/wallet_entity.dart';
import 'package:qorix_markets_flutter/ui/components/magnetic_press.dart';

/// Demo INR/USDT rate for UI preview.
const _inrPerUsdt = 83.5;

class WalletPortfolioHero extends StatefulWidget {
  const WalletPortfolioHero({
    required this.wallet,
    required this.dailyPnl,
    required this.dailyPnlPercent,
    required this.onDeposit,
    required this.onWithdraw,
    required this.onTransfer,
    super.key,
  });

  final WalletEntity wallet;
  final double dailyPnl;
  final double dailyPnlPercent;
  final VoidCallback onDeposit;
  final VoidCallback onWithdraw;
  final VoidCallback onTransfer;

  @override
  State<WalletPortfolioHero> createState() => _WalletPortfolioHeroState();
}

class _WalletPortfolioHeroState extends State<WalletPortfolioHero> {
  bool _hideBalance = false;
  bool _showInr = true;

  double get _totalUsdt =>
      widget.wallet.mainBalance + widget.wallet.tradingBalance + widget.wallet.profitBalance;

  String _amountNumber() {
    if (_hideBalance) return '••••••••';
    if (_showInr) {
      return NumberFormat('#,##,##0.00', 'en_IN').format(_totalUsdt * _inrPerUsdt);
    }
    return NumberFormat('#,##0.00').format(_totalUsdt);
  }

  String _todayPnlText() {
    if (_hideBalance) return '••••';
    final pnl = _showInr ? widget.dailyPnl * _inrPerUsdt : widget.dailyPnl;
    final sign = pnl >= 0 ? '+' : '';
    final symbol = _showInr ? '₹' : '\$';
    final fmt = _showInr ? NumberFormat('#,##,##0.00', 'en_IN') : NumberFormat('#,##0.00');
    return '$sign$symbol${fmt.format(pnl.abs())}';
  }

  bool get _pnlUp => widget.dailyPnl >= 0;

  String get _currencyLabel => _showInr ? 'INR' : 'USD';

  Future<void> _pickCurrency() async {
    final picked = await showDeskBottomSheet<bool>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Display currency',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.authMuted.withValues(alpha: 0.85)),
              ),
              const SizedBox(height: 10),
              _CurrencySheetTile(
                label: 'USD',
                subtitle: 'US Dollar',
                selected: !_showInr,
                onTap: () => Navigator.pop(ctx, false),
              ),
              const SizedBox(height: 8),
              _CurrencySheetTile(
                label: 'INR',
                subtitle: 'Indian Rupee',
                selected: _showInr,
                onTap: () => Navigator.pop(ctx, true),
              ),
            ],
          ),
        ),
      ),
    );
    if (picked != null && picked != _showInr) {
      setState(() => _showInr = picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: AppDesk.card(),
      padding: AppDesk.cardPadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const _WalletDottedLabel('Total Value'),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: Text(
                  _amountNumber(),
                  style: AppDesk.heroValue.copyWith(fontSize: 30),
                ),
              ),
              const SizedBox(width: 8),
              _CurrencySelector(
                label: _currencyLabel,
                onTap: _pickCurrency,
              ),
              const SizedBox(width: 6),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: _DeskMiniBtn(
                  icon: _hideBalance ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                  onTap: () => setState(() => _hideBalance = !_hideBalance),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const _WalletDottedLabel("Today's PnL"),
              const SizedBox(width: 8),
              Text(
                _todayPnlText(),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: _pnlUp ? AppColors.authGreen : AppColors.sell,
                ),
              ),
              Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: AppColors.authMuted.withValues(alpha: 0.7)),
            ],
          ),
          const SizedBox(height: 16),
          WalletActionRow(
            onDeposit: widget.onDeposit,
            onWithdraw: widget.onWithdraw,
            onTransfer: widget.onTransfer,
          ),
        ],
      ),
    );
  }
}

class _WalletDottedLabel extends StatelessWidget {
  const _WalletDottedLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: AppColors.authMuted.withValues(alpha: 0.78),
        decoration: TextDecoration.underline,
        decorationStyle: TextDecorationStyle.dotted,
        decorationColor: AppColors.authMuted.withValues(alpha: 0.45),
        decorationThickness: 1.2,
      ),
    );
  }
}

class _CurrencySelector extends StatelessWidget {
  const _CurrencySelector({required this.label, required this.onTap});

  final String label;
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
        child: Padding(
          padding: const EdgeInsets.fromLTRB(2, 2, 0, 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white.withValues(alpha: 0.92),
                ),
              ),
              Icon(Icons.arrow_drop_down_rounded, size: 22, color: AppColors.authMuted.withValues(alpha: 0.85)),
            ],
          ),
        ),
      ),
    );
  }
}

class _CurrencySheetTile extends StatelessWidget {
  const _CurrencySheetTile({
    required this.label,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            color: selected ? AppColors.authGreen.withValues(alpha: 0.1) : AppColors.authInputBg,
            border: Border.all(color: selected ? AppColors.authGreen.withValues(alpha: 0.4) : AppColors.authInputBorder),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
                    Text(subtitle, style: TextStyle(fontSize: 11, color: AppColors.authMuted.withValues(alpha: 0.75))),
                  ],
                ),
              ),
              if (selected) Icon(Icons.check_circle_rounded, size: 18, color: AppColors.authGreen.withValues(alpha: 0.95)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Deposit · Withdraw · Transfer — Cred-style circular actions (no box-in-box).
class WalletActionRow extends StatelessWidget {
  const WalletActionRow({
    required this.onDeposit,
    required this.onWithdraw,
    required this.onTransfer,
    super.key,
  });

  final VoidCallback onDeposit;
  final VoidCallback onWithdraw;
  final VoidCallback onTransfer;

  static const _actionWidth = 74.0;
  static const _leftNudge = 4.0;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final gap = ((constraints.maxWidth - _actionWidth * 3) / 2).clamp(28.0, 52.0);

        return Transform.translate(
          offset: const Offset(-_leftNudge, 0),
          child: Row(
            children: [
              SizedBox(
                width: _actionWidth,
                child: Center(
                  child: _WalletCircleAction(
                    label: 'Deposit',
                    icon: Icons.south_west_rounded,
                    primary: true,
                    onTap: onDeposit,
                  ),
                ),
              ),
              SizedBox(width: gap),
              SizedBox(
                width: _actionWidth,
                child: Center(
                  child: _WalletCircleAction(
                    label: 'Withdraw',
                    icon: Icons.north_east_rounded,
                    onTap: onWithdraw,
                  ),
                ),
              ),
              SizedBox(width: gap),
              SizedBox(
                width: _actionWidth,
                child: Center(
                  child: _WalletCircleAction(
                    label: 'Transfer',
                    icon: Icons.swap_horiz_rounded,
                    onTap: onTransfer,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _WalletCircleAction extends StatelessWidget {
  const _WalletCircleAction({
    required this.label,
    required this.icon,
    required this.onTap,
    this.primary = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool primary;

  static const _orbSize = 62.0;

  @override
  Widget build(BuildContext context) {
    return MagneticPress(
      onPressed: onTap,
      glowColor: primary ? AppColors.authGreen : AppColors.authGreen.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(_orbSize),
      scale: 0.9,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: _orbSize,
            height: _orbSize,
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                if (primary)
                  Positioned(
                    left: 4,
                    right: 4,
                    bottom: -2,
                    child: Container(
                      height: 12,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.authGreen.withValues(alpha: 0.45),
                            blurRadius: 18,
                            spreadRadius: 1,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                    ),
                  ),
                Container(
                  width: _orbSize,
                  height: _orbSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: primary ? _primaryOrbGradient : _secondaryOrbGradient,
                    border: Border.all(
                      color: primary
                          ? Colors.white.withValues(alpha: 0.38)
                          : Colors.white.withValues(alpha: 0.1),
                      width: 1.2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: primary ? 0.4 : 0.55),
                        blurRadius: primary ? 10 : 14,
                        offset: Offset(0, primary ? 5 : 6),
                      ),
                      if (!primary)
                        BoxShadow(
                          color: Colors.white.withValues(alpha: 0.06),
                          blurRadius: 0,
                          offset: const Offset(-1, -1),
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
                          height: _orbSize * 0.48,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Colors.white.withValues(alpha: primary ? 0.38 : 0.12),
                                  Colors.white.withValues(alpha: 0),
                                ],
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          top: 10,
                          left: 14,
                          child: Container(
                            width: 16,
                            height: 8,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              gradient: LinearGradient(
                                colors: [
                                  Colors.white.withValues(alpha: primary ? 0.8 : 0.25),
                                  Colors.white.withValues(alpha: 0),
                                ],
                              ),
                            ),
                          ),
                        ),
                        Icon(
                          icon,
                          size: 24,
                          color: primary ? const Color(0xFF031108) : AppColors.authGreen,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
              color: primary
                  ? AppColors.authGreen
                  : Colors.white.withValues(alpha: 0.82),
            ),
          ),
        ],
      ),
    );
  }

  static const _primaryOrbGradient = RadialGradient(
    center: Alignment(-0.32, -0.38),
    radius: 1.05,
    colors: [Color(0xFF9BFFC8), Color(0xFF00E676), Color(0xFF00A844), Color(0xFF006B2E)],
    stops: [0.0, 0.42, 0.78, 1.0],
  );

  static const _secondaryOrbGradient = RadialGradient(
    center: Alignment(-0.35, -0.4),
    radius: 1.05,
    colors: [Color(0xFF1A282E), Color(0xFF0E171B), Color(0xFF060C0F)],
    stops: [0.0, 0.55, 1.0],
  );
}

class _DeskMiniBtn extends StatelessWidget {
  const _DeskMiniBtn({this.icon, this.label, required this.onTap});

  final IconData? icon;
  final String? label;
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
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: label != null ? 10 : 8, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.authInputBg,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.authInputBorder),
          ),
          child: icon != null
              ? Icon(icon, size: 14, color: AppColors.authMuted.withValues(alpha: 0.85))
              : Text(
                  label!,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: AppColors.authGreen.withValues(alpha: 0.9),
                  ),
                ),
        ),
      ),
    );
  }
}

class WalletActivityHeader extends StatelessWidget {
  const WalletActivityHeader({this.onSeeMore, super.key});

  final VoidCallback? onSeeMore;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          'Transaction History',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: Colors.white.withValues(alpha: 0.94),
          ),
        ),
        const Spacer(),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onSeeMore,
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'See more',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.authGreen.withValues(alpha: 0.9),
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded, size: 16, color: AppColors.authGreen.withValues(alpha: 0.85)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class WalletActivityTile extends StatelessWidget {
  const WalletActivityTile({
    required this.type,
    required this.amount,
    required this.currency,
    required this.isCredit,
    required this.date,
    required this.status,
    this.description,
    super.key,
  });

  final String type;
  final double amount;
  final String currency;
  final bool isCredit;
  final String date;
  final String status;
  final String? description;

  bool get _isPending => status.toLowerCase() == 'pending';

  String get _title {
    if (description != null && description!.isNotEmpty) return description!;
    return switch (type.toLowerCase()) {
      'deposit' => currency == 'INR' ? 'INR UPI deposit' : 'TRC20 USDT deposit',
      'withdrawal' => 'Profit withdrawal',
      'profit' => 'Daily profit credit',
      'transfer' => 'Capital transfer',
      'referral' => 'Partner commission',
      _ => type,
    };
  }

  ({IconData icon, Color color}) get _iconMeta {
    if (_isPending) return (icon: Icons.hourglass_top_rounded, color: AppColors.warning);
    return switch (type.toLowerCase()) {
      'deposit' => (icon: Icons.arrow_downward_rounded, color: AppColors.authGreen),
      'withdrawal' => (icon: Icons.arrow_upward_rounded, color: AppColors.sell),
      'profit' => (icon: Icons.trending_up_rounded, color: AppColors.authGreen),
      'transfer' => (icon: Icons.swap_horiz_rounded, color: AppColors.authMuted),
      'referral' => (icon: Icons.people_outline_rounded, color: AppColors.authGreenLight),
      _ => (
          icon: isCredit ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
          color: isCredit ? AppColors.authGreen : AppColors.sell,
        ),
    };
  }

  Color get _amountColor {
    if (_isPending) return AppColors.warning;
    return isCredit ? AppColors.authGreen : AppColors.sell;
  }

  Color get _statusDot {
    if (_isPending) return AppColors.warning;
    return isCredit ? AppColors.authGreen : AppColors.authMuted;
  }

  @override
  Widget build(BuildContext context) {
    final icon = _iconMeta;
    final sign = amount >= 0 && isCredit ? '+' : (amount < 0 ? '-' : '');
    final abs = amount.abs();
    final displayAmount = currency == 'INR'
        ? '$sign₹${NumberFormat('#,##,###').format(abs.toInt())}'
        : '$sign₹${NumberFormat('#,##,###.###').format(abs * _inrPerUsdt)}';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: icon.color.withValues(alpha: 0.1),
              border: Border.all(color: icon.color.withValues(alpha: 0.35)),
            ),
            child: Icon(icon.icon, size: 20, color: icon.color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Colors.white.withValues(alpha: 0.92),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  date,
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.authMuted.withValues(alpha: 0.68),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            displayAmount,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: _amountColor,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _statusDot,
              boxShadow: [BoxShadow(color: _statusDot.withValues(alpha: 0.45), blurRadius: 4)],
            ),
          ),
        ],
      ),
    );
  }
}

class WalletEmptyActivity extends StatelessWidget {
  const WalletEmptyActivity({required this.onDeposit, super.key});

  final VoidCallback onDeposit;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppColors.authCardBg.withValues(alpha: 0.45),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.authInputBorder),
          ),
          child: Column(
            children: [
              Icon(Icons.account_balance_wallet_outlined, size: 36, color: AppColors.authGreen.withValues(alpha: 0.7)),
              const SizedBox(height: 12),
              Text(
                'No transactions yet',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Colors.white.withValues(alpha: 0.9),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Deposit, withdraw, or transfer funds to get started.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, height: 1.4, color: AppColors.authMuted.withValues(alpha: 0.78)),
              ),
              const SizedBox(height: 18),
              AuthPrimaryButton(label: 'Make first deposit', onPressed: onDeposit),
            ],
          ),
        ),
      ),
    );
  }
}

class WalletHeroSkeleton extends StatelessWidget {
  const WalletHeroSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 290,
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.authInputBorder),
      ),
    );
  }
}
