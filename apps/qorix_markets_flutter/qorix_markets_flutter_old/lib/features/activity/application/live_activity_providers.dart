import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/activity/domain/entities/live_activity_event.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';

class LiveActivityNotifier extends Notifier<List<LiveActivityEvent>> {
  @override
  List<LiveActivityEvent> build() {
    if (UiDemoMode.isActive) return UiDemoFixtures.liveActivityEvents();
    return const [];
  }

  Future<void> refresh() async {
    if (UiDemoMode.isActive) state = UiDemoFixtures.liveActivityEvents();
  }

  void ingestWsEvent(String type, Map<String, dynamic> payload) {}
}

final liveActivityProvider = NotifierProvider<LiveActivityNotifier, List<LiveActivityEvent>>(LiveActivityNotifier.new);
