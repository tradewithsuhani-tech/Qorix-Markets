import 'package:qorix_markets_flutter/core/errors/exceptions.dart';
import 'package:qorix_markets_flutter/core/qa/ux_copy.dart';

/// Maps exceptions to user-facing messages — delegates to [UxCopy] for consistency.
abstract final class ErrorMessage {
  static String from(Object error) {
    if (error is String) return error;
    if (error is StateError) {
      final msg = error.message;
      if (msg.isNotEmpty) return msg;
    }
    return switch (error) {
      NetworkException _ => UxCopy.connectionInterrupted,
      AuthException e => _authMessage(e),
      ServerException e => _serverMessage(e),
      ValidationException e => e.message,
      WriteApiBlockedException e => e.message,
      _ => UxCopy.requestIncomplete,
    };
  }

  static String _authMessage(AuthException e) {
    final msg = e.message.trim();
    if (_isGoogleDeveloperError(msg)) return _googleDeveloperErrorHelp;
    if (msg.isEmpty || msg == 'Unauthorized' || msg == 'Invalid token') {
      return 'Authentication failed. Check your details and try again.';
    }
    if (msg == 'Invalid credentials') {
      return 'Invalid email or password.';
    }
    return msg;
  }

  static String fromObject(Object error) {
    if (error is AuthException) return _authMessage(error);
    final text = error.toString();
    if (_isGoogleDeveloperError(text)) return _googleDeveloperErrorHelp;
    return from(error);
  }

  static bool _isGoogleDeveloperError(String text) =>
      text.contains('ApiException: 10') ||
      text.contains(': 10:') ||
      text.contains('DEVELOPER_ERROR');

  static const _googleDeveloperErrorHelp =
      'Google Sign-In setup pending in Google Cloud Console. '
      'Add Android OAuth client for package com.qorixmarkets.app with your SHA-1 fingerprint.';

  static String _serverMessage(ServerException e) {
    final msg = e.message.trim();
    final code = e.statusCode;

    final kyc = _mapKycError(msg, code);
    if (kyc != null) return kyc;

    if (msg.isNotEmpty && !msg.startsWith('Request failed')) {
      if (code == null || code < 500) {
        return _humanizeSnakeCaseCode(msg) ?? msg;
      }
    }

    // Show API text for user-fixable HTTP errors (validation, conflict, etc.)
    if (code != null && code >= 400 && code < 500 && msg.isNotEmpty && !msg.startsWith('Request failed')) {
      return msg;
    }

    final lower = msg.toLowerCase();
    if (lower.contains('insufficient') || lower.contains('balance')) {
      return 'Insufficient Main Balance for this transfer.';
    }
    if (lower.contains('otp') || lower.contains('verification')) {
      return 'Verification could not be completed. No funds were moved.';
    }
    if (lower.contains('limit') || lower.contains('minimum')) {
      return 'This amount is outside allowed limits. Adjust and try again.';
    }
    if (lower.contains('investment') || lower.contains('active')) {
      return 'Strategy update unavailable right now. Your deployment status is unchanged.';
    }
    if (e.statusCode != null && e.statusCode! >= 500) {
      return UxCopy.systemsBusy;
    }
    return UxCopy.requestIncomplete;
  }

  static String? _mapKycError(String msg, int? code) {
    final key = msg.toLowerCase();
    return switch (key) {
      'invalid_phone' => 'Enter a valid mobile number.',
      'personal_already_verified' => 'Your phone is already verified.',
      'phone_in_use' => 'This mobile number is already linked to another account.',
      'phone_mismatch' => 'Phone number does not match the verified number.',
      'otp_send_failed' => 'Could not send verification code. Try again in a moment.',
      'otp_delivery_failed' => 'Could not reach your phone. Check the number and try again.',
      'sms_not_configured' =>
        'Phone verification is temporarily unavailable. Try again shortly or contact support.',
      'otp_invalid' => 'Invalid or expired code. Request a new one.',
      'phone_not_verified' => 'Verify your mobile number with OTP first.',
      'kyc_required' => 'Complete KYC verification before withdrawing.',
      'withdrawal_otp_required' => 'Request a verification code first, then try again.',
      'withdrawal_locked_new_account' => msg.isNotEmpty ? msg : 'New accounts must wait before first withdrawal.',
      'withdrawal_locked_password_change' => msg.isNotEmpty ? msg : 'Withdrawals paused after a recent password change.',
      'invalid_referral_code' => 'This referral code is not valid.',
      'validation_failed' => 'Check the details and try again.',
      'limit_reached' => 'Maximum 10 payout methods saved. Remove one to add another.',
      'type_limit_reached' => 'Limit reached for this payout type. Remove an existing method first.',
      'duplicate_method' => 'This payout method is already saved.',
      'invalid_qorix_user' => 'Referral code not found. Check and try again.',
      'self_transfer' => 'You cannot add your own referral code.',
      'not_found' => 'Payout method not found.',
      'forbidden' => 'You do not have permission to do this.',
      'session_not_found' => 'Session not found or already signed out.',
      'cannot_revoke_current' => 'You cannot sign out this device from here. Use Log out instead.',
      'no_other_sessions' => 'No other active sessions to sign out.',
      'insufficient_balance' => 'Insufficient Trading balance. Transfer funds from Main wallet first.',
      'investment_already_active' => 'Strategy is already active. Stop it before starting again.',
      'invalid_otp' => 'Invalid or expired verification code. Request a new one.',
      'maintenance' || 'maintenance_mode' =>
        'Verification is temporarily unavailable. Please try again shortly.',
      _ when key.contains('verification service') => msg,
      _ when code == 503 => 'Service temporarily unavailable. Try again shortly.',
      _ when code == 404 => 'This feature is not available on the server yet. Pull to refresh or update the app.',
      _ => null,
    };
  }

  /// Converts raw API codes like `phone_in_use` when no explicit mapping exists.
  static String? _humanizeSnakeCaseCode(String msg) {
    if (!RegExp(r'^[a-z][a-z0-9_]*$').hasMatch(msg)) return null;
    final mapped = _mapKycError(msg, null);
    if (mapped != null) return mapped;
    final words = msg.split('_').where((w) => w.isNotEmpty).join(' ');
    if (words.isEmpty) return null;
    return '${words[0].toUpperCase()}${words.substring(1)}.';
  }

  static String brief(Object error) {
    final full = from(error);
    if (full.length <= 72) return full;
    return '${full.substring(0, 69)}…';
  }

  /// B8.1 session revoke — maps live API error codes from DELETE /api/auth/sessions/*.
  static String sessionRevoke(Object error) {
    if (error is ServerException) {
      final key = error.message.trim().toLowerCase();
      final mapped = switch (key) {
        'forbidden' => 'This session does not belong to your account.',
        'session_not_found' => 'Session not found or already signed out.',
        'cannot_revoke_current' => 'You cannot sign out this device from here. Use Log out instead.',
        'no_other_sessions' => 'No other active sessions to sign out.',
        _ => null,
      };
      if (mapped != null) return mapped;
    }
    return brief(error);
  }

  static bool isSessionNotFoundError(Object error) {
    if (error is ServerException) {
      return error.message.trim().toLowerCase() == 'session_not_found';
    }
    return false;
  }
}
