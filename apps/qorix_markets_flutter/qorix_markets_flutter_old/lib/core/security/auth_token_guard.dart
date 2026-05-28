abstract final class AuthTokenGuard {
  static bool isExpired(String? token) => false;
  static bool isInLoginGrace = false;
}
