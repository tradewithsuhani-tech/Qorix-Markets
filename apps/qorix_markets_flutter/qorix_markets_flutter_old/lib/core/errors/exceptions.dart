class AppException implements Exception {
  const AppException(this.message);
  final String message;
  @override
  String toString() => message;
}

class NetworkException extends AppException {
  const NetworkException(super.message);
}

class AuthException extends AppException {
  const AuthException(super.message);
}

class ServerException extends AppException {
  const ServerException(super.message, {this.statusCode});
  final int? statusCode;
}

class ValidationException extends AppException {
  const ValidationException(super.message);
}

class WriteApiBlockedException extends AppException {
  const WriteApiBlockedException(super.message);
}
