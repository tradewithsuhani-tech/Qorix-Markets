import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qorix_markets_flutter/core/connectivity/connectivity_service.dart';

class OfflineRecoveryBanner extends ConsumerWidget {
  const OfflineRecoveryBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(isOnlineProvider).value ?? true;
    if (online) return const SizedBox.shrink();
    return const Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Material(
        color: Color(0xFFB45309),
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text('You are offline — reconnecting…', style: TextStyle(color: Colors.white, fontSize: 12)),
        ),
      ),
    );
  }
}
