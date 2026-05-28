abstract final class AnalyticsEvents {
  static const appLaunch = 'app_launch';
  static const login = 'login_success';
}

/// Event names passed to [AnalyticsService.track].
abstract final class AnalyticsEvent {
  static const biometricPrepViewed = 'biometric_prep_viewed';
}
