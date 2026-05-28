import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

abstract final class SettingsDemo {
  static const displayName = 'Demo Investor';
  static const email = 'trader@qorixmarkets.com';
  static const accountId = 'QORIX-000156';
  static final memberSince = DateTime(2026, 4, 1);
  static const maskedPhone = '+91 ******9174';
  static const phoneVerified = true;
  static const emailVerified = true;
  static const passwordLastChanged = 'Never';
  static const twoFactorEnabled = false;
  static const isPro = true;
  static const kycVerified = false;
  static const portfolioInr = 52100.0;
  static const totalPnlInr = 5527.0;
  static const totalPnlPercent = 11.05;
  static const referralEarnedInr = 146.0;
}

abstract final class _S {
  static const bg = Color(0xFF0A0E12);
  static const card = Color(0xFF12171C);
  static const cardHi = Color(0xFF161D24);
  static const border = Color(0xFF1E2630);

  static Color get muted => AppColors.authMuted.withValues(alpha: 0.72);
  static Color get faint => AppColors.authMuted.withValues(alpha: 0.48);
  static Color get text2 => Colors.white.withValues(alpha: 0.88);

  static const green = AppColors.authGreen;
  static const teal = Color(0xFF34D399);
  static const gold = Color(0xFFF59E0B);
  static const red = Color(0xFFFF6B8A);

  static final _inr = NumberFormat('#,##0', 'en_IN');
  static String inr(num v) => '₹${_inr.format(v)}';
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

class SettingsAppBar extends StatelessWidget {
  const SettingsAppBar({this.unreadCount = 0, this.onNotifications, super.key});

  final int unreadCount;
  final VoidCallback? onNotifications;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Text(
          'More',
          style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -0.3),
        ),
        const Spacer(),
        _NotifyBtn(count: unreadCount, onTap: onNotifications),
      ],
    );
  }
}

class _NotifyBtn extends StatelessWidget {
  const _NotifyBtn({required this.count, this.onTap});

  final int count;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.75)),
          ),
          child: Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              Icon(Icons.notifications_none_rounded, size: 20, color: Colors.white.withValues(alpha: 0.9)),
              if (count > 0)
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                    decoration: BoxDecoration(
                      color: _S.green,
                      borderRadius: BorderRadius.circular(6),
                      boxShadow: [BoxShadow(color: _S.green.withValues(alpha: 0.45), blurRadius: 6)],
                    ),
                    child: Text(
                      count > 9 ? '9+' : '$count',
                      style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: _S.bg),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Profile hero (reference layout) ─────────────────────────────────────────

class SettingsProfileCard extends StatelessWidget {
  const SettingsProfileCard({
    required this.name,
    required this.email,
    required this.accountId,
    required this.memberSince,
    required this.portfolioInr,
    required this.totalPnlInr,
    required this.totalPnlPercent,
    this.isPro = false,
    super.key,
  });

  final String name;
  final String email;
  final String accountId;
  final DateTime memberSince;
  final double portfolioInr;
  final double totalPnlInr;
  final double totalPnlPercent;
  final bool isPro;

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return 'Q';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final initials = _initials(name);
    final memberLabel = DateFormat('MMM yyyy').format(memberSince);
    final pnlPositive = totalPnlInr >= 0;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _S.green.withValues(alpha: 0.55),
            _S.teal.withValues(alpha: 0.25),
            _S.border.withValues(alpha: 0.8),
          ],
        ),
        boxShadow: [
          BoxShadow(color: _S.green.withValues(alpha: 0.06), blurRadius: 28, offset: const Offset(0, 10)),
        ],
      ),
      padding: const EdgeInsets.all(1.2),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(19),
          color: _S.card,
        ),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SquareAvatar(initials: initials),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: -0.3),
                            ),
                          ),
                          if (isPro) ...[
                            const SizedBox(width: 8),
                            const _ProBadge(),
                          ],
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(
                        '$email · $accountId',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 11, color: _S.muted, height: 1.35),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Divider(height: 1, color: Colors.white.withValues(alpha: 0.06)),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: _StatCol(label: 'PORTFOLIO', value: _S.inr(portfolioInr), valueColor: Colors.white),
                ),
                Container(width: 1, height: 36, color: Colors.white.withValues(alpha: 0.06)),
                Expanded(
                  child: _StatCol(
                    label: 'TOTAL P&L',
                    value: '${pnlPositive ? '+' : ''}${_S.inr(totalPnlInr.abs())}',
                    sub: '${pnlPositive ? '+' : ''}${totalPnlPercent.toStringAsFixed(2)}%',
                    valueColor: pnlPositive ? _S.green : _S.red,
                    subColor: pnlPositive ? _S.green.withValues(alpha: 0.85) : _S.red.withValues(alpha: 0.85),
                  ),
                ),
                Container(width: 1, height: 36, color: Colors.white.withValues(alpha: 0.06)),
                Expanded(
                  child: _StatCol(label: 'MEMBER', value: memberLabel, valueColor: Colors.white),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SquareAvatar extends StatelessWidget {
  const _SquareAvatar({required this.initials});

  final String initials;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 56,
          height: 56,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                _S.green.withValues(alpha: 0.85),
                const Color(0xFF059669),
                _S.teal.withValues(alpha: 0.7),
              ],
            ),
            boxShadow: [BoxShadow(color: _S.green.withValues(alpha: 0.2), blurRadius: 12)],
          ),
          child: Text(
            initials,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 0.5),
          ),
        ),
        Positioned(
          right: -3,
          bottom: -3,
          child: Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _S.green,
              border: Border.all(color: _S.card, width: 2),
            ),
            child: const Icon(Icons.check_rounded, size: 11, color: _S.bg),
          ),
        ),
      ],
    );
  }
}

class _ProBadge extends StatelessWidget {
  const _ProBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: _S.gold.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: _S.gold.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.star_rounded, size: 10, color: _S.gold.withValues(alpha: 0.95)),
          const SizedBox(width: 3),
          Text('PRO', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 0.4, color: _S.gold)),
        ],
      ),
    );
  }
}

class _StatCol extends StatelessWidget {
  const _StatCol({
    required this.label,
    required this.value,
    required this.valueColor,
    this.sub,
    this.subColor,
  });

  final String label;
  final String value;
  final Color valueColor;
  final String? sub;
  final Color? subColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: _S.faint)),
        const SizedBox(height: 5),
        Text(
          value,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: valueColor),
        ),
        if (sub != null) ...[
          const SizedBox(height: 2),
          Text(
            sub!,
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: subColor ?? valueColor),
          ),
        ],
      ],
    );
  }
}

// ─── Promo banners ────────────────────────────────────────────────────────────

class SettingsReferBanner extends StatelessWidget {
  const SettingsReferBanner({required this.earnedInr, required this.onTap, super.key});

  final double earnedInr;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _PromoBanner(
      onTap: onTap,
      gradient: LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [
          const Color(0xFF0D2818),
          _S.green.withValues(alpha: 0.12),
          _S.card,
        ],
      ),
      borderColor: _S.green.withValues(alpha: 0.22),
      icon: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: _S.green.withValues(alpha: 0.12),
          border: Border.all(color: _S.green.withValues(alpha: 0.28)),
        ),
        child: Icon(Icons.card_giftcard_rounded, size: 20, color: _S.green.withValues(alpha: 0.95)),
      ),
      title: 'Refer & Earn',
      titleBadge: Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(
          color: _S.gold.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: _S.gold.withValues(alpha: 0.35)),
        ),
        child: Text(
          '${_S.inr(earnedInr)} earned',
          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: _S.gold),
        ),
      ),
      subtitle: 'Invite friends and earn commission on their trades',
    );
  }
}

class SettingsKycBanner extends StatelessWidget {
  const SettingsKycBanner({required this.isVerified, required this.onTap, super.key});

  final bool isVerified;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _PromoBanner(
      onTap: onTap,
      gradient: LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [
          _S.green.withValues(alpha: 0.18),
          const Color(0xFF0D2818),
          _S.card,
        ],
      ),
      borderColor: _S.green.withValues(alpha: 0.32),
      icon: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: _S.green.withValues(alpha: 0.15),
          border: Border.all(color: _S.green.withValues(alpha: 0.35)),
        ),
        child: Icon(Icons.verified_rounded, size: 22, color: _S.green),
      ),
      title: 'Identity Verification (KYC)',
      titleBadge: Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(
          color: _S.green.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: _S.green.withValues(alpha: 0.35)),
        ),
        child: Text(
          isVerified ? 'VERIFIED' : 'PENDING',
          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: isVerified ? _S.green : _S.gold),
        ),
      ),
      subtitle: isVerified ? 'Pan Card, Aadhaar Card & Bank Verified' : 'Complete verification to unlock withdrawals',
    );
  }
}

class _PromoBanner extends StatelessWidget {
  const _PromoBanner({
    required this.onTap,
    required this.gradient,
    required this.borderColor,
    required this.icon,
    required this.title,
    required this.titleBadge,
    required this.subtitle,
  });

  final VoidCallback onTap;
  final Gradient gradient;
  final Color borderColor;
  final Widget icon;
  final String title;
  final Widget titleBadge;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: gradient,
            border: Border.all(color: borderColor),
          ),
          child: Row(
            children: [
              icon,
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        Text(title, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800)),
                        titleBadge,
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(subtitle, style: TextStyle(fontSize: 11, color: _S.muted, height: 1.3)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, size: 20, color: _S.faint),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Section chrome ───────────────────────────────────────────────────────────

class SettingsSectionLabel extends StatelessWidget {
  const SettingsSectionLabel(this.title, {super.key});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title.toUpperCase(),
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.7, color: _S.faint),
      ),
    );
  }
}

class SettingsGroupCard extends StatelessWidget {
  const SettingsGroupCard({required this.children, super.key});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: _S.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _S.border),
      ),
      child: Column(children: children),
    );
  }
}

class SettingsGroupDivider extends StatelessWidget {
  const SettingsGroupDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return Divider(height: 1, thickness: 1, indent: 56, color: Colors.white.withValues(alpha: 0.05));
  }
}

// ─── Contact ──────────────────────────────────────────────────────────────────

class SettingsContactCard extends StatelessWidget {
  const SettingsContactCard({
    required this.maskedPhone,
    required this.email,
    required this.phoneVerified,
    required this.emailVerified,
    super.key,
  });

  final String maskedPhone;
  final String email;
  final bool phoneVerified;
  final bool emailVerified;

  @override
  Widget build(BuildContext context) {
    return SettingsGroupCard(
      children: [
        _ContactRow(
          icon: Icons.phone_outlined,
          iconColor: _S.green,
          title: 'Mobile Number',
          value: maskedPhone,
          verified: phoneVerified,
        ),
        const SettingsGroupDivider(),
        _ContactRow(
          icon: Icons.email_outlined,
          iconColor: const Color(0xFF60A5FA),
          title: 'Email Address',
          value: email,
          verified: emailVerified,
        ),
      ],
    );
  }
}

class _ContactRow extends StatelessWidget {
  const _ContactRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.value,
    required this.verified,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String value;
  final bool verified;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(11),
              color: iconColor.withValues(alpha: 0.12),
              border: Border.all(color: iconColor.withValues(alpha: 0.22)),
            ),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(value, style: TextStyle(fontSize: 11, color: _S.muted)),
              ],
            ),
          ),
          if (verified) const _VerifiedPill(),
        ],
      ),
    );
  }
}

class _VerifiedPill extends StatelessWidget {
  const _VerifiedPill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _S.green.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _S.green.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.check_circle_rounded, size: 11, color: _S.green),
          const SizedBox(width: 4),
          Text('Verified', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _S.green)),
        ],
      ),
    );
  }
}

// ─── Explore (former side menu) ──────────────────────────────────────────────

class SettingsTradeCard extends StatelessWidget {
  const SettingsTradeCard({
    required this.onMarkets,
    required this.onP2p,
    required this.onMarketInsights,
    super.key,
  });

  final VoidCallback onMarkets;
  final VoidCallback onP2p;
  final VoidCallback onMarketInsights;

  @override
  Widget build(BuildContext context) {
    return SettingsGroupCard(
      children: [
        _SettingsListRow(
          icon: Icons.candlestick_chart_rounded,
          iconColor: _S.green,
          title: 'Markets',
          subtitle: 'USDT/INR spot · chart & order book',
          onTap: onMarkets,
          trailing: Icon(Icons.chevron_right_rounded, size: 20, color: _S.faint),
        ),
        const SettingsGroupDivider(),
        _SettingsListRow(
          icon: Icons.swap_horiz_rounded,
          iconColor: _S.green,
          title: 'P2P Trade',
          subtitle: 'USDT/INR peer offers',
          onTap: onP2p,
          trailing: Icon(Icons.chevron_right_rounded, size: 20, color: _S.faint),
        ),
        const SettingsGroupDivider(),
        _SettingsListRow(
          icon: Icons.calendar_month_rounded,
          iconColor: _S.teal,
          title: 'Market Insights',
          subtitle: 'Economic calendar & events',
          onTap: onMarketInsights,
          trailing: Icon(Icons.chevron_right_rounded, size: 20, color: _S.faint),
        ),
      ],
    );
  }
}

class SettingsAccountMenuCard extends StatelessWidget {
  const SettingsAccountMenuCard({
    required this.onHistory,
    this.onPayoutMethods,
    super.key,
  });

  final VoidCallback onHistory;
  final VoidCallback? onPayoutMethods;

  @override
  Widget build(BuildContext context) {
    return SettingsGroupCard(
      children: [
        _SettingsListRow(
          icon: Icons.receipt_long_outlined,
          iconColor: _S.teal,
          title: 'History',
          subtitle: 'Deposits · profits · transfers',
          onTap: onHistory,
          trailing: Icon(Icons.chevron_right_rounded, size: 20, color: _S.faint),
        ),
        if (onPayoutMethods != null) ...[
          const SettingsGroupDivider(),
          _SettingsListRow(
            icon: Icons.account_balance_outlined,
            iconColor: _S.green,
            title: 'INR payout methods',
            subtitle: 'Saved bank · UPI · Qorix user',
            onTap: onPayoutMethods!,
            trailing: Icon(Icons.chevron_right_rounded, size: 20, color: _S.faint),
          ),
        ],
      ],
    );
  }
}

// ─── Security ─────────────────────────────────────────────────────────────────

class SettingsSecurityCard extends StatelessWidget {
  const SettingsSecurityCard({
    required this.passwordLastChanged,
    required this.twoFactorEnabled,
    required this.appLockEnabled,
    required this.onUpdatePassword,
    required this.onToggle2Fa,
    required this.onAppLock,
    required this.onMyDevices,
    super.key,
  });

  final String passwordLastChanged;
  final bool twoFactorEnabled;
  final bool appLockEnabled;
  final VoidCallback onUpdatePassword;
  final VoidCallback onToggle2Fa;
  final VoidCallback onAppLock;
  final VoidCallback onMyDevices;

  @override
  Widget build(BuildContext context) {
    return SettingsGroupCard(
      children: [
        _SettingsListRow(
          icon: Icons.vpn_key_outlined,
          iconColor: const Color(0xFF818CF8),
          title: 'Password',
          subtitle: 'Last changed: $passwordLastChanged',
          onTap: onUpdatePassword,
          trailing: _OutlineBtn(label: 'Update', color: _S.green),
        ),
        const SettingsGroupDivider(),
        _SettingsListRow(
          icon: Icons.lock_outline_rounded,
          iconColor: const Color(0xFF60A5FA),
          title: 'Two-Factor Auth',
          subtitle: 'Adds extra login protection',
          onTap: onToggle2Fa,
          trailing: _OutlineBtn(label: twoFactorEnabled ? 'Manage' : 'Enable', color: _S.gold),
        ),
        const SettingsGroupDivider(),
        _SettingsListRow(
          icon: Icons.fingerprint_rounded,
          iconColor: AppColors.authGreen,
          title: 'App Lock',
          subtitle: appLockEnabled ? 'PIN & biometric · active' : 'Face ID · fingerprint · PIN',
          onTap: onAppLock,
          trailing: _OutlineBtn(label: appLockEnabled ? 'Manage' : 'Enable', color: AppColors.authGreen),
        ),
        const SettingsGroupDivider(),
        _SettingsListRow(
          icon: Icons.smartphone_rounded,
          iconColor: _S.red,
          title: 'My Devices',
          subtitle: 'See where your account is signed in',
          onTap: onMyDevices,
          trailing: Icon(Icons.chevron_right_rounded, size: 20, color: _S.faint),
        ),
      ],
    );
  }
}

// ─── Preferences & help ───────────────────────────────────────────────────────

class SettingsPreferencesCard extends StatelessWidget {
  const SettingsPreferencesCard({
    required this.onHelp,
    super.key,
  });

  final VoidCallback onHelp;

  @override
  Widget build(BuildContext context) {
    return SettingsGroupCard(
      children: [
        _SettingsListRow(
          icon: Icons.help_outline_rounded,
          iconColor: const Color(0xFF60A5FA),
          title: 'Help & Support',
          subtitle: 'FAQs · chat · ticket',
          onTap: onHelp,
          trailing: Icon(Icons.chevron_right_rounded, size: 20, color: _S.faint),
        ),
      ],
    );
  }
}

class _SettingsListRow extends StatelessWidget {
  const _SettingsListRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
    required this.trailing,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(11),
                  color: iconColor.withValues(alpha: 0.12),
                  border: Border.all(color: iconColor.withValues(alpha: 0.22)),
                ),
                child: Icon(icon, size: 18, color: iconColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: TextStyle(fontSize: 11, color: _S.muted, height: 1.25)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              trailing,
            ],
          ),
        ),
      ),
    );
  }
}

class _OutlineBtn extends StatelessWidget {
  const _OutlineBtn({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.45)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color),
      ),
    );
  }
}

// ─── Sign out & footer ────────────────────────────────────────────────────────

class SettingsSignOutTile extends StatelessWidget {
  const SettingsSignOutTile({required this.onSignOut, super.key});

  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.mediumImpact();
          onSignOut();
        },
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: _S.red.withValues(alpha: 0.1),
            border: Border.all(color: _S.red.withValues(alpha: 0.2)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.logout_rounded, size: 18, color: _S.red.withValues(alpha: 0.92)),
              const SizedBox(width: 8),
              Text('Log out', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: _S.red.withValues(alpha: 0.92))),
            ],
          ),
        ),
      ),
    );
  }
}

class SettingsFooter extends StatelessWidget {
  const SettingsFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        'Qorix Markets · Auto-Trading Platform · v3.1',
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _S.faint, letterSpacing: 0.3),
      ),
    );
  }
}
