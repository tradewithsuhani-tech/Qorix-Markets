import 'package:flutter_riverpod/flutter_riverpod.dart';

mixin CachedAsyncMixin<T> on AsyncNotifier<T> {
  T? _cached;
  T? get cachedValue => _cached;
  void cacheValue(T value) => _cached = value;

  Future<void> softRefresh(Future<T> Function() fetch) async {
    final previous = _cached;
    state = const AsyncLoading();
    try {
      final data = await fetch();
      cacheValue(data);
      state = AsyncData(data);
    } catch (e, st) {
      if (previous != null) {
        state = AsyncData(previous);
      } else {
        state = AsyncError(e, st);
      }
    }
  }
}
