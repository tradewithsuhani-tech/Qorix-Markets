import 'package:qorix_markets_flutter/data/models/kyc_status_model.dart';

abstract interface class KycRepository {
  Future<KycStatusModel> getStatus();

  Future<void> sendPhoneOtp({required String phoneNumber, required String channel});

  Future<void> verifyPhoneOtp({required String phoneNumber, required String otp});

  Future<void> submitPersonal({required String dateOfBirth});

  Future<void> submitIdentity({
    required String documentType,
    required String documentUrl,
    String? documentUrlBack,
  });

  Future<void> submitAddress({
    required String addressLine1,
    required String addressCity,
    required String addressState,
    required String addressCountry,
    required String addressPostalCode,
    required String documentUrl,
  });
}
