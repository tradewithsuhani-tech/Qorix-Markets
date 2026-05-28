import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/haptics.dart';
import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

/// Flat bottom nav — active glow + gradient indicator (Qorix green theme).
class QorixBottomNav extends StatelessWidget {
  const QorixBottomNav({
    required this.currentIndex,
    this.onTabSelected,
    super.key,
  });

  final int currentIndex;
  final ValueChanged<int>? onTabSelected;

  static const barHeight = 56.0;

  static const _tabs = [
    _NavTabData(
      index: 0,
      label: 'Dashboard',
      icon: Icons.bar_chart_rounded,
      activeIcon: Icons.bar_chart_rounded,
    ),
    _NavTabData(
      index: 1,
      label: 'Wallet',
      icon: Icons.account_balance_wallet_outlined,
      activeIcon: Icons.account_balance_wallet_rounded,
    ),
    _NavTabData(
      index: 2,
      label: 'BOT',
      icon: Icons.smart_toy_outlined,
      activeIcon: Icons.smart_toy_rounded,
    ),
    _NavTabData(
      index: 3,
      label: 'Portfolio',
      icon: Icons.pie_chart_outline_rounded,
      activeIcon: Icons.pie_chart_rounded,
    ),
    _NavTabData(
      index: 4,
      label: 'More',
      icon: Icons.person_outline_rounded,
      activeIcon: Icons.person_rounded,
    ),
  ];

  static const _routes = [
    RoutePaths.home,
    RoutePaths.wallet,
    RoutePaths.botSetup,
    RoutePaths.portfolio,
    RoutePaths.profile,
  ];

  static double reservedHeight(BuildContext context) {
    return barHeight + MediaQuery.paddingOf(context).bottom;
  }

  static double overlayHeight(BuildContext context) => reservedHeight(context);

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppDesk.bg,
      elevation: 0,
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: AppDesk.bg,
          border: Border(
            top: BorderSide(color: AppDesk.border.withValues(alpha: 0.5)),
          ),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: barHeight,
            child: Row(
              children: [
                for (final tab in _tabs)
                  _NavTabItem(
                    label: tab.label,
                    icon: tab.icon,
                    activeIcon: tab.activeIcon,
                    isActive: currentIndex == tab.index,
                    onTap: () => _go(context, tab.index),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _go(BuildContext context, int index) {
    if (index == currentIndex) return;
    AppHaptics.tabSwitch();
    if (onTabSelected != null) {
      onTabSelected!(index);
      return;
    }
    context.go(_routes[index]);
  }
}

class _NavTabData {
  const _NavTabData({
    required this.index,
    required this.label,
    required this.icon,
    required this.activeIcon,
  });

  final int index;
  final String label;
  final IconData icon;
  final IconData activeIcon;
}

class _NavTabItem extends StatelessWidget {
  const _NavTabItem({
    required this.label,
    required this.icon,
    required this.activeIcon,
    required this.isActive,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final IconData activeIcon;
  final bool isActive;
  final VoidCallback onTap;

  static const _indicatorGradient = LinearGradient(
    colors: [
      Color(0xFF38BDF8),
      AppColors.authGreen,
      AppColors.authGreenLight,
    ],
  );

  @override
  Widget build(BuildContext context) {
    final inactive = AppColors.authMuted.withValues(alpha: 0.52);

    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              height: 30,
              width: double.infinity,
              child: Stack(
                alignment: Alignment.topCenter,
                clipBehavior: Clip.none,
                children: [
                  if (isActive) ...[
                    Positioned(
                      top: 6,
                      child: Container(
                        width: 44,
                        height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.authGreen.withValues(alpha: 0.38),
                              blurRadius: 18,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      top: 0,
                      child: AnimatedContainer(
                        duration: MotionTokens.tabSwitch,
                        curve: MotionTokens.luxuryEnter,
                        width: 32,
                        height: 3,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(2),
                          gradient: _indicatorGradient,
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.authGreen.withValues(alpha: 0.45),
                              blurRadius: 6,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  Positioned(
                    top: isActive ? 10 : 4,
                    child: Icon(
                      isActive ? activeIcon : icon,
                      size: 22,
                      color: isActive ? AppColors.authGreen : inactive,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 2),
            AnimatedDefaultTextStyle(
              duration: MotionTokens.tabSwitch,
              curve: MotionTokens.luxuryEnter,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                color: isActive ? Colors.white.withValues(alpha: 0.95) : inactive,
                letterSpacing: 0.1,
                height: 1.1,
              ),
              child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      ),
    );
  }
}
