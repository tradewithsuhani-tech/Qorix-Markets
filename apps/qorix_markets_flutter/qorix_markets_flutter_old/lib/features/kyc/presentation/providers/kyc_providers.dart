import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/data/models/kyc_status_model.dart';
import 'package:qorix_markets_flutter/features/kyc/data/repositories/kyc_repository_impl.dart';
import 'package:qorix_markets_flutter/features/kyc/domain/entities/kyc_state.dart';

/// Live KYC status from GET /api/kyc/status.
final kycLiveStatusProvider = FutureProvider<KycStatusModel>((ref) async {
  return ref.watch(kycRepositoryProvider).getStatus();
});

void refreshKycStatus(WidgetRef ref) {
  ref.invalidate(kycLiveStatusProvider);
}

/// Aggregate status for overview screen.
final kycStatusProvider = Provider<AsyncValue<KycState>>((ref) {
  final live = ref.watch(kycLiveStatusProvider);
  return live.whenData((m) => KycState(status: m.toAggregateStatus(), detail: m));
});

final kycStatusLegacyProvider = Provider<KycState>((ref) {
  return ref.watch(kycStatusProvider).valueOrNull ?? const KycState(status: KycStatus.notStarted);
});

final kycSubmitProvider = Provider<AsyncValue<void>>((ref) {
  final live = ref.watch(kycLiveStatusProvider);
  return live.isLoading ? const AsyncLoading() : const AsyncData(null);
});

/// In-flight mutations (phone OTP, uploads).
class KycActionState {
  const KycActionState({this.isLoading = false});
  final bool isLoading;
}

final kycActionProvider = StateNotifierProvider<KycActionNotifier, KycActionState>((ref) {
  return KycActionNotifier(ref);
});

class KycActionNotifier extends StateNotifier<KycActionState> {
  KycActionNotifier(this._ref) : super(const KycActionState());
  final Ref _ref;

  Future<void> _run(Future<void> Function() fn) async {
    state = const KycActionState(isLoading: true);
    try {
      await fn();
      _ref.invalidate(kycLiveStatusProvider);
    } finally {
      state = const KycActionState();
    }
  }

  Future<void> sendPhoneOtp({required String phone, required String channel}) => _run(
        () => _ref.read(kycRepositoryProvider).sendPhoneOtp(phoneNumber: phone, channel: channel),
      );

  Future<void> verifyPhoneOtp({required String phone, required String otp}) => _run(
        () => _ref.read(kycRepositoryProvider).verifyPhoneOtp(phoneNumber: phone, otp: otp),
      );

  Future<void> submitPersonal(String dob) => _run(
        () => _ref.read(kycRepositoryProvider).submitPersonal(dateOfBirth: dob),
      );

  Future<void> submitIdentity({
    required String documentType,
    required String front,
    String? back,
  }) =>
      _run(
        () => _ref.read(kycRepositoryProvider).submitIdentity(
              documentType: documentType,
              documentUrl: front,
              documentUrlBack: back,
            ),
      );

  Future<void> submitAddress({
    required String line1,
    required String city,
    required String state,
    required String country,
    required String postal,
    required String proofUrl,
  }) =>
      _run(
        () => _ref.read(kycRepositoryProvider).submitAddress(
              addressLine1: line1,
              addressCity: city,
              addressState: state,
              addressCountry: country,
              addressPostalCode: postal,
              documentUrl: proofUrl,
            ),
      );
}
