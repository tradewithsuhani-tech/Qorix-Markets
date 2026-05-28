import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/features/onboarding/presentation/providers/onboarding_provider.dart';
import 'package:qorix_markets_flutter/features/onboarding/presentation/widgets/onboarding_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/ui/components/qorix_logo.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _pageController = PageController();
  int _pageIndex = 0;
  bool _finishing = false;

  static final _slides = OnboardingCopy.slides;
  bool get _isLastPage => _pageIndex >= _slides.length - 1;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    if (_finishing) return;
    setState(() => _finishing = true);
    HapticFeedback.mediumImpact();
    await setOnboardingComplete();
    ref.invalidate(onboardingCompleteProvider);
    if (!mounted) return;
    context.go(RoutePaths.login);
  }

  void _next() {
    HapticFeedback.lightImpact();
    if (_isLastPage) {
      _finish();
      return;
    }
    _pageController.nextPage(
      duration: const Duration(milliseconds: 380),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.authPageBg,
      body: AuthBackground(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: Row(
                  children: [
                    const QorixLogo(size: 40, useAuthGreen: true),
                    const Spacer(),
                    TextButton(
                      onPressed: _finishing ? null : _finish,
                      child: Text(
                        'Skip',
                        style: TextStyle(
                          color: AppColors.authMuted.withValues(alpha: 0.9),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  itemCount: _slides.length,
                  onPageChanged: (i) => setState(() => _pageIndex = i),
                  itemBuilder: (_, i) => OnboardingSlideView(slide: _slides[i]),
                ),
              ),
              OnboardingPageDots(count: _slides.length, index: _pageIndex),
              const SizedBox(height: AppSpacing.xl),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
                child: AuthPrimaryButton(
                  label: _isLastPage ? 'Get started' : 'Continue',
                  loading: _finishing,
                  onPressed: _finishing ? null : _next,
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  'Capital at risk · Past performance is not indicative of future results',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 9.5,
                    height: 1.35,
                    color: AppColors.authMuted.withValues(alpha: 0.45),
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.2,
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
