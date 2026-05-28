/// Detects B8.1 session revocation — revoked devices get 401 + `session_revoked`.
bool isSessionRevokedResponse(int? statusCode, dynamic data) {
  if (statusCode != 401) return false;
  if (data is! Map) return false;
  final error = (data['error'] as String?)?.trim().toLowerCase();
  return error == 'session_revoked';
}
