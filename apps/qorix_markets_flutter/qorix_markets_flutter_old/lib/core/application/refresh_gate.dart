/// Prevents refresh storms from pull-to-refresh spam or rapid tab switches.
class RefreshGate {
  RefreshGate({this.cooldown = const Duration(milliseconds: 1800)});

  final Duration cooldown;
  DateTime? _lastRun;
  bool _running = false;

  Future<void> run(Future<void> Function() action) async {
    final now = DateTime.now();
    if (_running) return;
    if (_lastRun != null && now.difference(_lastRun!) < cooldown) return;

    _running = true;
    _lastRun = now;
    try {
      await action();
    } finally {
      _running = false;
    }
  }
}
