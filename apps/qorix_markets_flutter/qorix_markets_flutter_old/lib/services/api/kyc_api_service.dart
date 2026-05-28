import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/kyc_status_model.dart';

final kycApiServiceProvider = Provider<KycApiService>((ref) {
  return KycApiService(ref.watch(legacyApiClientProvider));
});

class KycApiService {
  const KycApiService(this._client);
  final ApiClient _client;

  Future<KycStatusModel> getStatus() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.kycStatus);
    return KycStatusModel.fromJson(ApiJson.object(res.data));
  }

  Future<void> sendPhoneOtp({
    required String phoneNumber,
    required String channel,
  }) async {
    await _client.post(
      ApiEndpoints.kycPhoneSendOtp,
      data: {'phoneNumber': phoneNumber, 'channel': channel},
    );
  }

  Future<void> verifyPhoneOtp({
    required String phoneNumber,
    required String otp,
  }) async {
    await _client.post(
      ApiEndpoints.kycPhoneVerifyOtp,
      data: {'phoneNumber': phoneNumber, 'otp': otp},
    );
  }

  Future<void> submitPersonal({required String dateOfBirth}) async {
    await _client.post(
      ApiEndpoints.kycPersonal,
      data: {'dateOfBirth': dateOfBirth},
    );
  }

  Future<void> submitIdentity({
    required String documentType,
    required String documentUrl,
    String? documentUrlBack,
  }) async {
    await _client.post(
      ApiEndpoints.kycSubmit,
      data: {
        'documentType': documentType,
        'documentUrl': documentUrl,
        if (documentUrlBack != null && documentUrlBack.isNotEmpty)
          'documentUrlBack': documentUrlBack,
      },
    );
  }

  Future<void> submitAddress({
    required String addressLine1,
    required String addressCity,
    required String addressState,
    required String addressCountry,
    required String addressPostalCode,
    required String documentUrl,
  }) async {
    await _client.post(
      ApiEndpoints.kycAddress,
      data: {
        'addressLine1': addressLine1,
        'addressCity': addressCity,
        'addressState': addressState,
        'addressCountry': addressCountry,
        'addressPostalCode': addressPostalCode,
        'documentUrl': documentUrl,
      },
    );
  }
}
