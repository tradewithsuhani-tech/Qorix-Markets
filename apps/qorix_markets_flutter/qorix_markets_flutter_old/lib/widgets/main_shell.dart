import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/application/live_desk_hub.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/ui/components/qorix_bottom_nav.dart';
import 'package:qorix_markets_flutter/widgets/app_background.dart';

class MainShell extends StatelessWidget {
  const MainShell({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return LiveDeskBootstrap(
      child: AppBackground(
        glowIntensity: 0.28,
        child: Scaffold(
          backgroundColor: AppDesk.bg,
          extendBody: false,
          body: navigationShell,
          bottomNavigationBar: QorixBottomNav(
            currentIndex: navigationShell.currentIndex,
            onTabSelected: (index) => navigationShell.goBranch(
              index,
              initialLocation: index == navigationShell.currentIndex,
            ),
          ),
        ),
      ),
    );
  }
}
