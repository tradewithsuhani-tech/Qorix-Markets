/// UI / API integration modes.
///
/// Phase 1 (read-only live): [enabled]=false, [readOnlyApi]=true
/// Full UI mock: [enabled]=true
/// Full live (Phase 2+): [enabled]=false, [readOnlyApi]=false
abstract final class UiDemoMode {
  /// Full mock — no network, auth gates disabled.
  static const enabled = false;

  /// Full live API — reads + writes (wallet, KYC, investment, security).
  static const readOnlyApi = false;

  static bool get isActive => enabled;

  /// Live staging/production reads + auth.
  static bool get usesLiveApi => !enabled;

  /// Block POST/PATCH/PUT/DELETE except auth bootstrap endpoints.
  static bool get blocksWriteApi => enabled || readOnlyApi;

  static const splashDurationMs = 2800;

  /// When UI demo: preview login after splash. Live API: normal bootstrap.
  static const startOnLogin = enabled;
}
