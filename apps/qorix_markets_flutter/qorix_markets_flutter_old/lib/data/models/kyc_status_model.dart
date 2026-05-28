import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/kyc/domain/entities/kyc_state.dart';

/// GET /api/kyc/status response.
class KycStatusModel {
  const KycStatusModel({
    this.kycPersonalStatus,
    this.phoneNumber,
    this.phoneVerified = false,
    this.dateOfBirth,
    this.kycStatus,
    this.kycDocumentType,
    this.kycRejectionReason,
    this.kycAddressStatus,
    this.kycAddressRejectionReason,
  });

  factory KycStatusModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return KycStatusModel(
      kycPersonalStatus: root['kycPersonalStatus'] as String?,
      phoneNumber: root['phoneNumber'] as String?,
      phoneVerified: root['phoneVerifiedAt'] != null,
      dateOfBirth: root['dateOfBirth'] as String?,
      kycStatus: root['kycStatus'] as String?,
      kycDocumentType: root['kycDocumentType'] as String?,
      kycRejectionReason: root['kycRejectionReason'] as String?,
      kycAddressStatus: root['kycAddressStatus'] as String?,
      kycAddressRejectionReason: root['kycAddressRejectionReason'] as String?,
    );
  }

  final String? kycPersonalStatus;
  final String? phoneNumber;
  final bool phoneVerified;
  final String? dateOfBirth;
  final String? kycStatus;
  final String? kycDocumentType;
  final String? kycRejectionReason;
  final String? kycAddressStatus;
  final String? kycAddressRejectionReason;

  bool get personalApproved => kycPersonalStatus == 'approved';
  bool get identityApproved => kycStatus == 'approved';
  bool get addressApproved => kycAddressStatus == 'approved';

  int get completedLevels {
    var n = 0;
    if (personalApproved) n++;
    if (identityApproved) n++;
    if (addressApproved) n++;
    return n;
  }

  KycStatus toAggregateStatus() {
    if (addressApproved && identityApproved && personalApproved) {
      return KycStatus.verified;
    }
    if (kycStatus == 'rejected' || kycAddressStatus == 'rejected') {
      return KycStatus.rejected;
    }
    if (kycStatus == 'pending' || kycAddressStatus == 'pending') {
      return KycStatus.pending;
    }
    if (personalApproved || phoneVerified || dateOfBirth != null) {
      return KycStatus.pending;
    }
    return KycStatus.notStarted;
  }

  /// Next step index: 0=Lv1, 1=Lv2, 2=Lv3, null=all done.
  int? nextStepIndex() {
    if (!phoneVerified || !personalApproved) return 0;
    if (kycStatus != 'approved') return 1;
    if (kycAddressStatus != 'approved') return 2;
    return null;
  }
}
