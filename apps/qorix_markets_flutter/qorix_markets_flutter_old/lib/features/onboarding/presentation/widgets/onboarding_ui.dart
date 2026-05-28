import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';

class OnboardingSlide {
  const OnboardingSlide({
    required this.icon,
    required this.title,
    required this.highlight,
    required this.body,
    this.pills = const [],
  });

  final IconData icon;
  final String title;
  final String highlight;
  final String body;
  final List<(String label, IconData icon)> pills;
}

abstract final class OnboardingCopy {
  static const slides = [
    OnboardingSlide(
      icon: Icons.show_chart_rounded,
      title: 'Institutional',
      highlight: 'FX & Gold',
      body: 'Hedge-fund grade execution on XAU/USD and major pairs — built for serious capital.',
      pills: [
        ('Tier-1 liquidity', Icons.water_drop_outlined),
        ('Live desk feeds', Icons.bolt_rounded),
      ],
    ),
    OnboardingSlide(
      icon: Icons.shield_outlined,
      title: 'Capital',
      highlight: 'Protection',
      body: 'Segregated Main · Funding · Profit wallets with drawdown limits before risk breaches.',
      pills: [
        ('Segregated funds', Icons.account_balance_wallet_outlined),
        ('Auto risk pause', Icons.pause_circle_outline_rounded),
      ],
    ),
    OnboardingSlide(
      icon: Icons.smart_toy_outlined,
      title: 'AI-Governed',
      highlight: 'Execution',
      body: 'Deploy strategy capital, track profit history, and withdraw with bank-grade security.',
      pills: [
        ('2FA & device lock', Icons.lock_outline_rounded),
        ('24/7 support', Icons.support_agent_outlined),
      ],
    ),
  ];
}

class OnboardingPageDots extends StatelessWidget {
  const OnboardingPageDots({required this.count, required this.index, super.key});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final active = i == index;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: active ? 22 : 7,
          height: 7,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            color: active ? AppColors.authGreen : AppColors.authInputBorder.withValues(alpha: 0.9),
          ),
        );
      }),
    );
  }
}

class OnboardingSlideView extends StatelessWidget {
  const OnboardingSlideView({required this.slide, super.key});

  final OnboardingSlide slide;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        children: [
          const Spacer(flex: 2),
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              color: AppColors.authGreen.withValues(alpha: 0.12),
              border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
            ),
            child: Icon(slide.icon, size: 34, color: AppColors.authGreen),
          ),
          const SizedBox(height: AppSpacing.xxl),
          RichText(
            textAlign: TextAlign.center,
            text: TextSpan(
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w900,
                color: Colors.white,
                letterSpacing: -0.6,
                height: 1.1,
              ),
              children: [
                TextSpan(text: '${slide.title}\n'),
                TextSpan(
                  text: slide.highlight,
                  style: const TextStyle(color: AppColors.authGreen),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            slide.body,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              height: 1.5,
              color: AppColors.authMuted.withValues(alpha: 0.88),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: slide.pills.map((p) => _OnboardingPill(label: p.$1, icon: p.$2)).toList(),
          ),
          const Spacer(flex: 3),
        ],
      ),
    );
  }
}

class _OnboardingPill extends StatelessWidget {
  const _OnboardingPill({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.85)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.authGreen.withValues(alpha: 0.9)),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: Colors.white.withValues(alpha: 0.85),
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}
