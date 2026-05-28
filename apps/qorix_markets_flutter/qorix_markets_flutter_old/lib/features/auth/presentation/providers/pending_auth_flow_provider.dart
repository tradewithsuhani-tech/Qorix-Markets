import 'package:flutter_riverpod/flutter_riverpod.dart';

class PendingLoginApproval {
  const PendingLoginApproval({
    required this.attemptId,
    required this.pollToken,
    this.expiresAt,
    this.otpFallbackAfterMs = 0,
    this.deviceBrowser,
    this.deviceOs,
  });

  final int attemptId;
  final String pollToken;
  final String? expiresAt;
  final int otpFallbackAfterMs;
  final String? deviceBrowser;
  final String? deviceOs;

  String get deviceLabel {
    final parts = <String>[
      if (deviceBrowser != null && deviceBrowser!.isNotEmpty) deviceBrowser!,
      if (deviceOs != null && deviceOs!.isNotEmpty) deviceOs!,
    ];
    return parts.isEmpty ? 'New device' : parts.join(' · ');
  }

  DateTime? get expiresAtDate => expiresAt != null ? DateTime.tryParse(expiresAt!) : null;
}

final pending2faTokenProvider = StateProvider<String?>((ref) => null);

final pendingLoginApprovalProvider = StateProvider<PendingLoginApproval?>((ref) => null);

final pendingVerifyEmailProvider = StateProvider<String?>((ref) => null);
