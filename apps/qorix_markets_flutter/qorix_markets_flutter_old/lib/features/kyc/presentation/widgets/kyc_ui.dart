import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/kyc/domain/entities/kyc_state.dart';

enum KycPreviewMode { live, verified, pending, notStarted }

abstract final class KycDemo {
  static const dailyDepositLimit = 50000;
  static const maxPortfolioLimit = 200000;
  static const verifiedDailyDeposit = 1000000;
  static const verifiedDailyWithdrawal = 500000;
  static const totalDocs = 3;

  static final _inr = NumberFormat('#,##0', 'en_IN');
  static String inr(num v) => '₹${_inr.format(v)}';
}

abstract final class _K {
  static const bg = Color(0xFF0A0E12);
  static const card = Color(0xFF12171C);
  static const border = Color(0xFF1E2630);

  static Color get muted => AppColors.authMuted.withValues(alpha: 0.72);
  static Color get faint => AppColors.authMuted.withValues(alpha: 0.48);

  static const green = AppColors.authGreen;
  static const gold = Color(0xFFF59E0B);
  static const red = Color(0xFFFF6B8A);
  static const blue = Color(0xFF60A5FA);
  static const purple = Color(0xFF818CF8);
}

// ─── App bar ──────────────────────────────────────────────────────────────────

class KycAppBar extends StatelessWidget {
  const KycAppBar({required this.onBack, super.key});

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
            'Identity Verification',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

// ─── Preview chips (demo) ─────────────────────────────────────────────────────

class KycPreviewStrip extends StatelessWidget {
  const KycPreviewStrip({required this.selected, required this.onSelect, super.key});

  final KycPreviewMode selected;
  final ValueChanged<KycPreviewMode> onSelect;

  static const _labels = {
    KycPreviewMode.live: 'Live',
    KycPreviewMode.verified: 'Verified',
    KycPreviewMode.pending: 'Pending',
    KycPreviewMode.notStarted: 'Not started',
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: _K.gold.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _K.gold.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.visibility_outlined, size: 12, color: _K.gold.withValues(alpha: 0.9)),
              const SizedBox(width: 5),
              Text(
                'PREVIEW STATE',
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: _K.gold),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: KycPreviewMode.values.map((mode) {
                final active = mode == selected;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onSelect(mode);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: active ? _K.gold.withValues(alpha: 0.12) : Colors.white.withValues(alpha: 0.03),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: active ? _K.gold.withValues(alpha: 0.5) : _K.border),
                      ),
                      child: Text(
                        _labels[mode]!,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: active ? _K.gold : _K.muted,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Status hero ──────────────────────────────────────────────────────────────

class KycStatusHero extends StatelessWidget {
  const KycStatusHero({required this.status, required this.completedDocs, super.key});

  final KycStatus status;
  final int completedDocs;

  @override
  Widget build(BuildContext context) {
    final progress = status == KycStatus.verified ? 1.0 : completedDocs / KycDemo.totalDocs;

    final decoration = switch (status) {
      KycStatus.pending => BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [
              _K.gold.withValues(alpha: 0.14),
              const Color(0xFF1A1408),
              _K.card,
            ],
          ),
          border: Border.all(color: _K.gold.withValues(alpha: 0.22)),
        ),
      KycStatus.verified => BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              _K.green.withValues(alpha: 0.28),
              const Color(0xFF0D2818),
              _K.card,
            ],
          ),
          border: Border.all(color: _K.green.withValues(alpha: 0.35)),
          boxShadow: [BoxShadow(color: _K.green.withValues(alpha: 0.08), blurRadius: 20, offset: const Offset(0, 6))],
        ),
      _ => BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              _K.green.withValues(alpha: 0.16),
              const Color(0xFF0D2818),
              _K.card,
            ],
          ),
          border: Border.all(color: _K.green.withValues(alpha: 0.22)),
        ),
    };

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: decoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _HeroHeader(status: status),
          const SizedBox(height: 16),
          Row(
            children: [
              Text('COMPLETION', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: _K.faint)),
              const Spacer(),
              Text(
                '$completedDocs / ${KycDemo.totalDocs}',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _K.muted),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: status == KycStatus.pending ? 0.08 : progress,
              minHeight: 5,
              backgroundColor: Colors.white.withValues(alpha: 0.06),
              valueColor: AlwaysStoppedAnimation(
                status == KycStatus.pending
                    ? _K.gold.withValues(alpha: 0.75)
                    : status == KycStatus.verified
                        ? _K.green
                        : _K.green.withValues(alpha: 0.85),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroHeader extends StatelessWidget {
  const _HeroHeader({required this.status});

  final KycStatus status;

  @override
  Widget build(BuildContext context) {
    if (status == KycStatus.pending) {
      return Stack(
        clipBehavior: Clip.none,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _HeroIcon(status: status),
              const SizedBox(width: 12),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 2, right: 88),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Documents under review',
                        style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Usually completes within 24 hours',
                        style: TextStyle(fontSize: 11, color: _K.muted, height: 1.35),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const Positioned(
            top: 0,
            right: 0,
            child: _StatusBadge(label: 'UNDER REVIEW', color: _K.gold),
          ),
        ],
      );
    }

    if (status == KycStatus.verified) {
      return Stack(
        clipBehavior: Clip.none,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _HeroIcon(status: status),
              const SizedBox(width: 12),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 2, right: 72),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "You're fully verified",
                        style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'All trading & withdrawal limits unlocked',
                        style: TextStyle(fontSize: 11, color: _K.green.withValues(alpha: 0.75), height: 1.35),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const Positioned(
            top: 0,
            right: 0,
            child: _StatusBadge(label: 'VERIFIED', color: _K.green),
          ),
        ],
      );
    }

    final (badge, badgeColor, title, subtitle) = switch (status) {
      KycStatus.rejected => ('REJECTED', _K.red, 'Verification Failed', 'Please re-upload your documents'),
      _ => ('INCOMPLETE', _K.purple, 'Complete your KYC', 'Required to enable withdrawals & higher limits'),
    };

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _HeroIcon(status: status),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(subtitle, style: TextStyle(fontSize: 11, color: _K.muted, height: 1.35)),
            ],
          ),
        ),
        _StatusBadge(label: badge, color: badgeColor),
      ],
    );
  }
}

class _HeroIcon extends StatelessWidget {
  const _HeroIcon({required this.status});

  final KycStatus status;

  @override
  Widget build(BuildContext context) {
    if (status == KycStatus.pending) {
      return Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_K.gold, const Color(0xFFD97706)],
          ),
          boxShadow: [BoxShadow(color: _K.gold.withValues(alpha: 0.2), blurRadius: 10)],
        ),
        child: const Icon(Icons.schedule_rounded, size: 22, color: Colors.white),
      );
    }

    if (status == KycStatus.verified) {
      return Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_K.green, const Color(0xFF059669)],
          ),
          boxShadow: [BoxShadow(color: _K.green.withValues(alpha: 0.25), blurRadius: 12)],
        ),
        child: const Icon(Icons.check_rounded, size: 24, color: Colors.white),
      );
    }

    final (color, icon) = switch (status) {
      KycStatus.rejected => (_K.red, Icons.error_outline_rounded),
      _ => (_K.blue, Icons.shield_outlined),
    };

    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Icon(icon, size: 22, color: color),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 5, height: 5, decoration: BoxDecoration(shape: BoxShape.circle, color: color)),
          const SizedBox(width: 5),
          Text(label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, letterSpacing: 0.4, color: color)),
        ],
      ),
    );
  }
}

// ─── Documents ────────────────────────────────────────────────────────────────

enum KycDocStatus { required, pending, verified }

class KycDocumentItem {
  const KycDocumentItem({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.iconColor,
    required this.status,
  });

  final String id;
  final String title;
  final String subtitle;
  final IconData icon;
  final Color iconColor;
  final KycDocStatus status;
}

class KycDocumentsCard extends StatelessWidget {
  const KycDocumentsCard({required this.documents, this.onDocTap, super.key});

  final List<KycDocumentItem> documents;
  final ValueChanged<KycDocumentItem>? onDocTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const KycSectionLabel('Documents'),
        Container(
          decoration: BoxDecoration(
            color: _K.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _K.border),
          ),
          child: Column(
            children: [
              for (var i = 0; i < documents.length; i++) ...[
                if (i > 0) Divider(height: 1, indent: 56, color: Colors.white.withValues(alpha: 0.05)),
                _DocRow(doc: documents[i], onTap: onDocTap == null ? null : () => onDocTap!(documents[i])),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _DocRow extends StatelessWidget {
  const _DocRow({required this.doc, this.onTap});

  final KycDocumentItem doc;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap == null
            ? null
            : () {
                HapticFeedback.selectionClick();
                onTap!();
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
                  color: doc.iconColor.withValues(alpha: 0.12),
                  border: Border.all(color: doc.iconColor.withValues(alpha: 0.22)),
                ),
                child: Icon(doc.icon, size: 18, color: doc.iconColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(doc.title, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(doc.subtitle, style: TextStyle(fontSize: 11, color: _K.muted, height: 1.25)),
                  ],
                ),
              ),
              _DocBadge(status: doc.status),
            ],
          ),
        ),
      ),
    );
  }
}

class _DocBadge extends StatelessWidget {
  const _DocBadge({required this.status});

  final KycDocStatus status;

  @override
  Widget build(BuildContext context) {
    final (label, color, icon) = switch (status) {
      KycDocStatus.required => ('Required', _K.purple, Icons.error_outline_rounded),
      KycDocStatus.pending => ('Review', _K.gold, Icons.schedule_rounded),
      KycDocStatus.verified => ('Done', _K.green, Icons.check_rounded),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color)),
        ],
      ),
    );
  }
}

// ─── Limits ───────────────────────────────────────────────────────────────────

class KycLimitsCard extends StatelessWidget {
  const KycLimitsCard({required this.status, super.key});

  final KycStatus status;

  bool get _verified => status == KycStatus.verified;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const KycSectionLabel('Your Limits'),
        Container(
          decoration: BoxDecoration(
            color: _K.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _K.border),
          ),
          child: Column(
            children: [
              _LimitRow(
                label: 'Daily Deposit',
                value: _verified ? KycDemo.inr(KycDemo.verifiedDailyDeposit) : KycDemo.inr(KycDemo.dailyDepositLimit),
                valueColor: Colors.white,
              ),
              Divider(height: 1, color: Colors.white.withValues(alpha: 0.05)),
              _LimitRow(
                label: 'Daily Withdrawal',
                value: _verified ? KycDemo.inr(KycDemo.verifiedDailyWithdrawal) : 'Locked',
                valueColor: _verified ? Colors.white : _K.red,
              ),
              Divider(height: 1, color: Colors.white.withValues(alpha: 0.05)),
              _LimitRow(
                label: 'Max Portfolio',
                value: _verified ? 'Unlimited' : KycDemo.inr(KycDemo.maxPortfolioLimit),
                valueColor: Colors.white,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _LimitRow extends StatelessWidget {
  const _LimitRow({required this.label, required this.value, required this.valueColor});

  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: _K.muted, fontWeight: FontWeight.w600)),
          const Spacer(),
          Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: valueColor)),
        ],
      ),
    );
  }
}

class KycSectionLabel extends StatelessWidget {
  const KycSectionLabel(this.title, {super.key});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title.toUpperCase(),
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.7, color: _K.faint),
      ),
    );
  }
}

// ─── CTA & footer ─────────────────────────────────────────────────────────────

class KycStartButton extends StatelessWidget {
  const KycStartButton({
    required this.label,
    required this.onTap,
    this.loading = false,
    this.pendingStyle = false,
    super.key,
  });

  final String label;
  final VoidCallback? onTap;
  final bool loading;
  final bool pendingStyle;

  @override
  Widget build(BuildContext context) {
    final gradient = pendingStyle
        ? LinearGradient(
            colors: [_K.green, const Color(0xFF34D399), const Color(0xFF059669)],
          )
        : LinearGradient(
            colors: [_K.green, _K.green.withValues(alpha: 0.75), const Color(0xFF059669)],
          );

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: loading ? null : onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          height: 52,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: gradient,
            boxShadow: [BoxShadow(color: _K.green.withValues(alpha: 0.25), blurRadius: 16, offset: const Offset(0, 6))],
          ),
          child: Center(
            child: loading
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: _K.bg))
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        pendingStyle ? Icons.visibility_outlined : Icons.upload_rounded,
                        size: 20,
                        color: _K.bg,
                      ),
                      const SizedBox(width: 8),
                      Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: _K.bg)),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class KycSecurityNote extends StatelessWidget {
  const KycSecurityNote({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _K.blue.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _K.blue.withValues(alpha: 0.18)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded, size: 16, color: _K.blue.withValues(alpha: 0.9)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Your documents are encrypted with AES-256 and processed by globally regulated KYC partners.',
              style: TextStyle(fontSize: 11, color: _K.blue.withValues(alpha: 0.85), height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

/// Default document list for demo / not-started flow.
List<KycDocumentItem> kycDefaultDocuments({KycStatus status = KycStatus.notStarted}) {
  if (status == KycStatus.verified) {
    return [
      KycDocumentItem(
        id: 'pan',
        title: 'PAN Card',
        subtitle: 'ABCXX1234L · Verified',
        icon: Icons.credit_card_rounded,
        iconColor: _K.purple,
        status: KycDocStatus.verified,
      ),
      KycDocumentItem(
        id: 'aadhaar',
        title: 'Aadhaar Card',
        subtitle: 'XXXX XXXX 4521 · eKYC verified',
        icon: Icons.badge_outlined,
        iconColor: _K.red,
        status: KycDocStatus.verified,
      ),
      KycDocumentItem(
        id: 'selfie',
        title: 'Live Photo',
        subtitle: 'Captured · Face match passed',
        icon: Icons.photo_camera_outlined,
        iconColor: _K.gold,
        status: KycDocStatus.verified,
      ),
    ];
  }

  KycDocStatus docStatus(KycDocStatus required) => switch (status) {
        KycStatus.pending => KycDocStatus.pending,
        _ => required,
      };

  return [
    KycDocumentItem(
      id: 'pan',
      title: 'PAN Card',
      subtitle: 'Required for tax & compliance',
      icon: Icons.credit_card_rounded,
      iconColor: _K.purple,
      status: docStatus(KycDocStatus.required),
    ),
    KycDocumentItem(
      id: 'aadhaar',
      title: 'Aadhaar Card',
      subtitle: 'Identity & address proof',
      icon: Icons.badge_outlined,
      iconColor: _K.red,
      status: docStatus(KycDocStatus.required),
    ),
    KycDocumentItem(
      id: 'selfie',
      title: 'Live Photo',
      subtitle: 'Selfie for face match verification',
      icon: Icons.photo_camera_outlined,
      iconColor: _K.gold,
      status: docStatus(KycDocStatus.required),
    ),
  ];
}

int kycCompletedDocs(KycStatus status) => switch (status) {
      KycStatus.verified => 3,
      _ => 0,
    };
