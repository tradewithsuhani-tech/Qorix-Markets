import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/referral/domain/entities/referral_info.dart';

abstract final class _R {
  static const bg = Color(0xFF0A0E12);
  static const card = Color(0xFF12171C);
  static const border = Color(0xFF1E2630);

  static Color get muted => Colors.white.withValues(alpha: 0.42);
  static Color get text2 => Colors.white.withValues(alpha: 0.78);

  static const green = AppColors.authGreen;
  static const whatsapp = Color(0xFF25D366);

  static final _usd = NumberFormat('#,##0.00');
}

// ─── App bar ──────────────────────────────────────────────────────────────────

class ReferralsAppBar extends StatelessWidget {
  const ReferralsAppBar({required this.onBack, super.key});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Colors.white.withValues(alpha: 0.88)),
            style: IconButton.styleFrom(
              backgroundColor: Colors.white.withValues(alpha: 0.06),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const Expanded(
            child: Text(
              'Referrals',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: -0.3),
            ),
          ),
          const SizedBox(width: 48),
        ],
      ),
    );
  }
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

class ReferralsHeroCard extends StatelessWidget {
  const ReferralsHeroCard({
    required this.totalPartners,
    required this.activePartners,
    required this.commissionEarned,
    required this.monthlyEarnings,
    super.key,
  });

  final int totalPartners;
  final int activePartners;
  final double commissionEarned;
  final double monthlyEarnings;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _R.green.withValues(alpha: 0.14),
            _R.card,
            _R.card,
          ],
        ),
        border: Border.all(color: _R.green.withValues(alpha: 0.28)),
        boxShadow: [
          BoxShadow(color: _R.green.withValues(alpha: 0.08), blurRadius: 24, offset: const Offset(0, 8)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _R.green.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: _R.green.withValues(alpha: 0.3)),
                    ),
                    child: const Text(
                      'PARTNER PROGRAM',
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 0.6, color: _R.green),
                    ),
                  ),
                  const Spacer(),
                  Icon(Icons.workspace_premium_rounded, size: 20, color: _R.green.withValues(alpha: 0.75)),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                '\$${_R._usd.format(commissionEarned)}',
                style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: _R.green, height: 1, letterSpacing: -1),
              ),
              const SizedBox(height: 4),
              Text('Total commission earned', style: TextStyle(fontSize: 12, color: _R.muted, fontWeight: FontWeight.w500)),
              if (monthlyEarnings > 0) ...[
                const SizedBox(height: 6),
                Text(
                  '+\$${_R._usd.format(monthlyEarnings)} this month',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _R.green.withValues(alpha: 0.85)),
                ),
              ],
              const SizedBox(height: 16),
              Container(height: 1, color: Colors.white.withValues(alpha: 0.06)),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _HeroStat(label: 'Total partners', value: '$totalPartners', icon: Icons.groups_outlined),
                  ),
                  Container(width: 1, height: 36, color: Colors.white.withValues(alpha: 0.08)),
                  Expanded(
                    child: _HeroStat(label: 'Active investors', value: '$activePartners', icon: Icons.trending_up_rounded),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.label, required this.value, required this.icon});

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, size: 16, color: _R.green.withValues(alpha: 0.7)),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white, height: 1)),
            Text(label, style: TextStyle(fontSize: 10, color: _R.muted)),
          ],
        ),
      ],
    );
  }
}

/// Legacy wrapper — kept for embedded usages.
class ReferralsStatRow extends StatelessWidget {
  const ReferralsStatRow({
    required this.totalPartners,
    required this.activePartners,
    required this.commissionEarned,
    super.key,
  });

  final int totalPartners;
  final int activePartners;
  final double commissionEarned;

  @override
  Widget build(BuildContext context) {
    return ReferralsHeroCard(
      totalPartners: totalPartners,
      activePartners: activePartners,
      commissionEarned: commissionEarned,
      monthlyEarnings: 0,
    );
  }
}

// ─── Reward structure ─────────────────────────────────────────────────────────

class ReferralsRewardCard extends StatelessWidget {
  const ReferralsRewardCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _R.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _R.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('REWARD STRUCTURE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: _R.muted)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _RewardTile(pct: '3%', label: 'Activation bonus', icon: Icons.bolt_rounded, accent: _R.green)),
              const SizedBox(width: 10),
              Expanded(child: _RewardTile(pct: '10%', label: 'Lifetime daily share', icon: Icons.all_inclusive_rounded, accent: const Color(0xFF60A5FA))),
            ],
          ),
        ],
      ),
    );
  }
}

class _RewardTile extends StatelessWidget {
  const _RewardTile({required this.pct, required this.label, required this.icon, required this.accent});

  final String pct;
  final String label;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accent.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: accent),
          const SizedBox(height: 10),
          Text(pct, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: accent, height: 1)),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontSize: 10, color: _R.muted, fontWeight: FontWeight.w500, height: 1.3)),
        ],
      ),
    );
  }
}

// ─── Partner credentials ────────────────────────────────────────────────────────

class ReferralsCredentialsCard extends StatefulWidget {
  const ReferralsCredentialsCard({
    required this.link,
    required this.code,
    super.key,
  });

  final String link;
  final String code;

  @override
  State<ReferralsCredentialsCard> createState() => _ReferralsCredentialsCardState();
}

class _ReferralsCredentialsCardState extends State<ReferralsCredentialsCard> {
  bool _showLink = true;

  void _copy(String value, String label) {
    Clipboard.setData(ClipboardData(text: value));
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$label copied'), behavior: SnackBarBehavior.floating, duration: const Duration(seconds: 1)),
    );
  }

  void _shareWhatsApp() {
    final message = 'Join QorixMarkets with my partner link — AI-managed strategies with capital protection.\n${widget.link}';
    Clipboard.setData(ClipboardData(text: message));
    HapticFeedback.mediumImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Message copied — paste in WhatsApp'), behavior: SnackBarBehavior.floating, duration: Duration(seconds: 2)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final display = _showLink ? widget.link : widget.code;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _R.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _R.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Your partner credentials', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('Share your link or code — every signup is tracked automatically.', style: TextStyle(fontSize: 11, color: _R.muted)),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: _R.bg,
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: _R.border),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _ToggleBtn(
                    label: 'Partner Link',
                    icon: Icons.link_rounded,
                    active: _showLink,
                    onTap: () => setState(() => _showLink = true),
                  ),
                ),
                Expanded(
                  child: _ToggleBtn(
                    label: 'Partner Code',
                    icon: Icons.tag_rounded,
                    active: !_showLink,
                    onTap: () => setState(() => _showLink = false),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            decoration: BoxDecoration(
              color: _R.bg,
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: _R.green.withValues(alpha: 0.18)),
            ),
            child: Text(
              display,
              style: TextStyle(fontSize: 12, color: _R.text2, fontWeight: FontWeight.w600, height: 1.35),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Material(
                  color: _R.whatsapp.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    onTap: _shareWhatsApp,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: _R.whatsapp.withValues(alpha: 0.35)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.chat_rounded, size: 16, color: _R.whatsapp),
                          SizedBox(width: 6),
                          Text('WhatsApp', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: _R.whatsapp)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Material(
                  color: _R.green.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    onTap: () => _copy(display, _showLink ? 'Link' : 'Code'),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: _R.green.withValues(alpha: 0.35)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.copy_rounded, size: 16, color: _R.green),
                          const SizedBox(width: 6),
                          Text('Copy ${_showLink ? 'link' : 'code'}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: _R.green)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ToggleBtn extends StatelessWidget {
  const _ToggleBtn({
    required this.label,
    required this.icon,
    required this.active,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(9),
        child: Ink(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: active ? _R.green.withValues(alpha: 0.14) : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
            border: active ? Border.all(color: _R.green.withValues(alpha: 0.35)) : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 14, color: active ? _R.green : _R.muted),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  label,
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: active ? _R.green : _R.muted),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Network ──────────────────────────────────────────────────────────────────

class ReferralsNetworkCard extends StatelessWidget {
  const ReferralsNetworkCard({
    required this.partners,
    required this.onCopyLink,
    super.key,
  });

  final List<ReferredUser> partners;
  final VoidCallback onCopyLink;

  @override
  Widget build(BuildContext context) {
    final registered = partners.length;
    final active = partners.where((p) => p.isActive).length;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _R.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _R.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('Your network', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _R.green.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _R.green.withValues(alpha: 0.25)),
                ),
                child: Text(
                  '$active active',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _R.green),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text('$registered registered partners', style: TextStyle(fontSize: 11, color: _R.muted)),
          const SizedBox(height: 14),
          if (partners.isEmpty)
            _EmptyNetwork(onCopyLink: onCopyLink)
          else
            ...partners.asMap().entries.map((e) {
              final isLast = e.key == partners.length - 1;
              return Padding(
                padding: EdgeInsets.only(bottom: isLast ? 0 : 8),
                child: _PartnerRow(user: e.value),
              );
            }),
        ],
      ),
    );
  }
}

class _EmptyNetwork extends StatelessWidget {
  const _EmptyNetwork({required this.onCopyLink});
  final VoidCallback onCopyLink;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      decoration: BoxDecoration(
        color: _R.bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: _R.green.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _R.green.withValues(alpha: 0.22)),
            ),
            child: Icon(Icons.people_outline_rounded, size: 26, color: _R.green.withValues(alpha: 0.8)),
          ),
          const SizedBox(height: 12),
          Text('No partners yet', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: _R.text2)),
          const SizedBox(height: 4),
          Text(
            'Share your link to start earning\n3% activation + 10% daily share.',
            style: TextStyle(fontSize: 11, color: _R.muted, height: 1.4),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Material(
            color: _R.green.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(24),
            child: InkWell(
              onTap: onCopyLink,
              borderRadius: BorderRadius.circular(24),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: _R.green.withValues(alpha: 0.4)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.link_rounded, size: 16, color: _R.green),
                    SizedBox(width: 8),
                    Text('Copy partner link', style: TextStyle(color: _R.green, fontWeight: FontWeight.w800, fontSize: 13)),
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

class _PartnerRow extends StatelessWidget {
  const _PartnerRow({required this.user});
  final ReferredUser user;

  @override
  Widget build(BuildContext context) {
    final initial = user.fullName.isNotEmpty ? user.fullName[0].toUpperCase() : '?';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(
        color: _R.bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [_R.green.withValues(alpha: 0.22), _R.green.withValues(alpha: 0.08)],
              ),
              shape: BoxShape.circle,
              border: Border.all(color: _R.green.withValues(alpha: 0.28)),
            ),
            child: Text(initial, style: const TextStyle(fontWeight: FontWeight.w900, color: _R.green, fontSize: 14)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(user.fullName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 2),
                Text(user.email, style: TextStyle(fontSize: 10, color: _R.muted)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('\$${user.investmentAmount.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w800, color: _R.green, fontSize: 13)),
              const SizedBox(height: 3),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  color: user.isActive ? _R.green.withValues(alpha: 0.12) : Colors.white.withValues(alpha: 0.05),
                  border: Border.all(color: user.isActive ? _R.green.withValues(alpha: 0.28) : Colors.white.withValues(alpha: 0.08)),
                ),
                child: Text(
                  user.isActive ? 'Active' : 'Inactive',
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: user.isActive ? _R.green : _R.muted),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
