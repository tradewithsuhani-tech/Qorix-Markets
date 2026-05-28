import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/kyc_status_model.dart';
import 'package:qorix_markets_flutter/features/kyc/domain/repositories/kyc_repository.dart';
import 'package:qorix_markets_flutter/services/api/kyc_api_service.dart';

final kycRepositoryProvider = Provider<KycRepository>((ref) {
  return KycRepositoryImpl(ref.watch(kycApiServiceProvider));
});

class KycRepositoryImpl implements KycRepository {
  KycRepositoryImpl(this._api);
  final KycApiService _api;

  @override
  Future<KycStatusModel> getStatus() async {
    if (UiDemoMode.isActive) {
      return const KycStatusModel(kycPersonalStatus: 'approved', kycStatus: 'approved', kycAddressStatus: 'approved');
    }
    try {
      return await _api.getStatus();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> sendPhoneOtp({required String phoneNumber, required String channel}) async {
    try {
      await _api.sendPhoneOtp(phoneNumber: phoneNumber, channel: channel);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> verifyPhoneOtp({required String phoneNumber, required String otp}) async {
    try {
      await _api.verifyPhoneOtp(phoneNumber: phoneNumber, otp: otp);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> submitPersonal({required String dateOfBirth}) async {
    try {
      await _api.submitPersonal(dateOfBirth: dateOfBirth);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> submitIdentity({
    required String documentType,
    required String documentUrl,
    String? documentUrlBack,
  }) async {
    try {
      await _api.submitIdentity(
        documentType: documentType,
        documentUrl: documentUrl,
        documentUrlBack: documentUrlBack,
      );
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> submitAddress({
    required String addressLine1,
    required String addressCity,
    required String addressState,
    required String addressCountry,
    required String addressPostalCode,
    required String documentUrl,
  }) async {
    try {
      await _api.submitAddress(
        addressLine1: addressLine1,
        addressCity: addressCity,
        addressState: addressState,
        addressCountry: addressCountry,
        addressPostalCode: addressPostalCode,
        documentUrl: documentUrl,
      );
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }
}
