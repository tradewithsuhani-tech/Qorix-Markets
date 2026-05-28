import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/utils/responsive.dart';

/// Standard bottom spacer — clears floating nav + gesture bar on tab pages.
class NavScrollSpacer extends StatelessWidget {
  const NavScrollSpacer({super.key});

  @override
  Widget build(BuildContext context) => SizedBox(height: Responsive.scrollBottomInset(context));
}
