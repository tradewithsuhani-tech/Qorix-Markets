import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Global session expiry signal — auth interceptor → premium UX.
class SessionEvents {
  SessionEvents._();
  static final instance = SessionEvents._();

  final _controller = StreamController<bool>.broadcast();
  bool _expired = false;

  Stream<bool> get stream => _controller.stream;

  void expire() {
    if (_expired) return;
    _expired = true;
    if (!_controller.isClosed) _controller.add(true);
  }

  void reset() => _expired = false;
}

/// Notifier wired to [SessionEvents] for premium re-auth UX.
final sessionExpiredProvider =
    NotifierProvider<SessionExpiredNotifier, bool>(SessionExpiredNotifier.new);

class SessionExpiredNotifier extends Notifier<bool> {
  StreamSubscription<bool>? _sub;

  @override
  bool build() {
    _sub = SessionEvents.instance.stream.listen((_) {
      state = true;
    });
    ref.onDispose(() => _sub?.cancel());
    return false;
  }

  void dismiss() {
    SessionEvents.instance.reset();
    state = false;
  }
}

final sessionGuardProvider = Provider<void>((ref) {
  ref.watch(sessionExpiredProvider);
});
