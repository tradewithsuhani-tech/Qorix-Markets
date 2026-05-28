import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/ui/components/premium_loading_pulse.dart';
import 'package:qorix_markets_flutter/ui/components/qorix_logo.dart';

abstract final class SplashCopy {
  static const headline = 'Managed FX & Gold Capital';
  static const subtitle = 'Hedge-fund grade execution · segregated investor capital · AI-governed risk';
  static const footer = 'Tier-1 liquidity · 24/7 desk · Capital protection enabled';

  static const trustPills = [
    ('Segregated funds', Icons.account_balance_wallet_outlined),
    ('Tier-1 FX desk', Icons.public_rounded),
    ('Risk governed', Icons.shield_outlined),
  ];

  static const bootLines = [
    'Connecting to institutional liquidity…',
    'Loading FX & XAU/USD desk feeds…',
    'Initializing capital protection layer…',
    'Syncing automated execution engine…',
  ];
}

class SplashInstitutionalBody extends StatefulWidget {
  const SplashInstitutionalBody({super.key});

  @override
  State<SplashInstitutionalBody> createState() => _SplashInstitutionalBodyState();
}

class _SplashInstitutionalBodyState extends State<SplashInstitutionalBody> with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  Timer? _lineTimer;
  int _lineIndex = 0;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat(reverse: true);
    _lineTimer = Timer.periodic(const Duration(milliseconds: 1800), (_) {
      if (!mounted) return;
      setState(() => _lineIndex = (_lineIndex + 1) % SplashCopy.bootLines.length);
    });
  }

  @override
  void dispose() {
    _lineTimer?.cancel();
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          children: [
            const SizedBox(height: 24),
            Align(child: _DeskBadge(animation: _pulseCtrl)),
            const Spacer(flex: 2),
            const QorixLogo(size: 88, showWordmark: false, useAuthGreen: true, glow: true)
                .animate()
                .fadeIn(duration: MotionTokens.normal)
                .scale(begin: const Offset(0.92, 0.92), end: const Offset(1, 1), duration: MotionTokens.slow, curve: MotionTokens.enter),
            const SizedBox(height: 22),
            const _BrandWordmark().animate().fadeIn(delay: 180.ms).slideY(begin: 0.08, end: 0, duration: MotionTokens.slow, curve: MotionTokens.enter),
            const SizedBox(height: 10),
            Text(
              SplashCopy.headline,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Colors.white.withValues(alpha: 0.92),
                letterSpacing: -0.2,
                height: 1.25,
              ),
            ).animate().fadeIn(delay: 280.ms),
            const SizedBox(height: 8),
            Text(
              SplashCopy.subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11.5, height: 1.45, color: AppColors.authMuted.withValues(alpha: 0.82), fontWeight: FontWeight.w500),
            ).animate().fadeIn(delay: 360.ms),
            const SizedBox(height: 22),
            const _TrustPillRow().animate().fadeIn(delay: 440.ms),
            const Spacer(flex: 3),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 320),
              child: Text(
                SplashCopy.bootLines[_lineIndex],
                key: ValueKey(_lineIndex),
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.authGreen.withValues(alpha: 0.85), letterSpacing: 0.2),
              ),
            ).animate().fadeIn(delay: 520.ms),
            const SizedBox(height: 14),
            const PremiumLoadingPulse(size: 34, color: AppColors.authGreen).animate().fadeIn(delay: 600.ms),
            const SizedBox(height: 28),
            Text(
              SplashCopy.footer,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 9.5, height: 1.35, color: AppColors.authMuted.withValues(alpha: 0.48), fontWeight: FontWeight.w600, letterSpacing: 0.3),
            ).animate().fadeIn(delay: 680.ms),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

class _DeskBadge extends StatelessWidget {
  const _DeskBadge({required this.animation});

  final Animation<double> animation;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: AppColors.authGreen.withValues(alpha: 0.08 + animation.value * 0.05),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.28 + animation.value * 0.15)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.authGreen,
                  boxShadow: [BoxShadow(color: AppColors.authGreen.withValues(alpha: 0.45 + animation.value * 0.35), blurRadius: 6)],
                ),
              ),
              const SizedBox(width: 7),
              const Text(
                'INSTITUTIONAL DESK',
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 0.9, color: AppColors.authGreen),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _BrandWordmark extends StatelessWidget {
  const _BrandWordmark();

  @override
  Widget build(BuildContext context) {
    return RichText(
      textAlign: TextAlign.center,
      text: TextSpan(
        style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: -1.1, height: 1.05),
        children: [
          TextSpan(text: 'Qorix ', style: TextStyle(color: Colors.white.withValues(alpha: 0.96))),
          const TextSpan(text: 'Markets', style: TextStyle(color: AppColors.authGreen)),
        ],
      ),
    );
  }
}

class _TrustPillRow extends StatelessWidget {
  const _TrustPillRow();

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final pill in SplashCopy.trustPills)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(pill.$2, size: 12, color: AppColors.authGreen.withValues(alpha: 0.85)),
                const SizedBox(width: 5),
                Text(
                  pill.$1,
                  style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.authMuted.withValues(alpha: 0.78)),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
