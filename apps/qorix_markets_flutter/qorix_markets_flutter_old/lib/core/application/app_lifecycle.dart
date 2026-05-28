import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AppForegroundState { foreground, background }

/// Global foreground/background — pauses polling when app is not visible.
final appForegroundProvider =
    NotifierProvider<AppForegroundNotifier, AppForegroundState>(AppForegroundNotifier.new);

class AppForegroundNotifier extends Notifier<AppForegroundState> {
  @override
  AppForegroundState build() => AppForegroundState.foreground;

  void setForeground() {
    if (state != AppForegroundState.foreground) {
      state = AppForegroundState.foreground;
    }
  }

  void setBackground() {
    if (state != AppForegroundState.background) {
      state = AppForegroundState.background;
    }
  }

  bool get isForeground => state == AppForegroundState.foreground;
}
