import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/routes/route_paths.dart';

/// Pops the current route when the stack allows it; otherwise [context.go]s to [fallback].
void safePop(BuildContext context, {String fallback = RoutePaths.home}) {
  if (context.canPop()) {
    context.pop();
  } else {
    context.go(fallback);
  }
}
