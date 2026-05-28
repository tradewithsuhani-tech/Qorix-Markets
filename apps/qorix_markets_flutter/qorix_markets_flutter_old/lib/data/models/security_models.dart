import 'package:qorix_markets_flutter/core/network/api_json.dart';

class SecurityStatusModel {
  const SecurityStatusModel({
    this.kycApproved = false,
    this.emailVerified = false,
    this.twoFactorEnabled = false,
    this.withdrawalLockedByPassword = false,
    this.passwordChangedAt,
    this.withdrawalLockedByNewDevice = false,
    this.fraudFlagsPresent = false,
    this.accountRestricted = false,
  });

  factory SecurityStatusModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return SecurityStatusModel(
      kycApproved: root['kycApproved'] as bool? ?? false,
      emailVerified: root['emailVerified'] as bool? ?? false,
      twoFactorEnabled: root['twoFactorEnabled'] as bool? ?? false,
      withdrawalLockedByPassword: root['withdrawalLockedByPassword'] as bool? ?? false,
      passwordChangedAt: root['passwordChangedAt'] as String?,
      withdrawalLockedByNewDevice: root['withdrawalLockedByNewDevice'] as bool? ?? false,
      fraudFlagsPresent: root['fraudFlagsPresent'] as bool? ?? false,
      accountRestricted: root['accountRestricted'] as bool? ?? false,
    );
  }

  final bool kycApproved;
  final bool emailVerified;
  final bool twoFactorEnabled;
  final bool withdrawalLockedByPassword;
  final String? passwordChangedAt;
  final bool withdrawalLockedByNewDevice;
  final bool fraudFlagsPresent;
  final bool accountRestricted;

  DateTime? get passwordChangedDate => passwordChangedAt != null ? DateTime.tryParse(passwordChangedAt!) : null;
}

class ChangePasswordResult {
  const ChangePasswordResult({
    this.success = false,
    this.message,
    this.passwordChangedAt,
    this.withdrawalLockedUntil,
    this.withdrawalLockHours,
  });

  factory ChangePasswordResult.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return ChangePasswordResult(
      success: root['success'] as bool? ?? true,
      message: root['message'] as String?,
      passwordChangedAt: root['passwordChangedAt'] as String?,
      withdrawalLockedUntil: root['withdrawalLockedUntil'] as String?,
      withdrawalLockHours: root['withdrawalLockHours'] as int?,
    );
  }

  final bool success;
  final String? message;
  final String? passwordChangedAt;
  final String? withdrawalLockedUntil;
  final int? withdrawalLockHours;
}

class TwoFactorStatusModel {
  const TwoFactorStatusModel({
    this.enabled = false,
    this.method,
    this.enabledAt,
  });

  factory TwoFactorStatusModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return TwoFactorStatusModel(
      enabled: root['enabled'] as bool? ?? false,
      method: root['method'] as String?,
      enabledAt: root['enabledAt'] as String?,
    );
  }

  final bool enabled;
  final String? method;
  final String? enabledAt;

  DateTime? get enabledDate => enabledAt != null ? DateTime.tryParse(enabledAt!) : null;
}

class TwoFactorSetupModel {
  const TwoFactorSetupModel({
    this.qrDataUrl,
    this.manualCode,
    this.issuer,
    this.accountName,
  });

  factory TwoFactorSetupModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return TwoFactorSetupModel(
      qrDataUrl: root['qrDataUrl'] as String?,
      manualCode: root['manualCode'] as String?,
      issuer: root['issuer'] as String?,
      accountName: root['accountName'] as String?,
    );
  }

  final String? qrDataUrl;
  final String? manualCode;
  final String? issuer;
  final String? accountName;
}

class TwoFactorVerifySetupResult {
  const TwoFactorVerifySetupResult({
    this.enabled = false,
    this.backupCodes = const [],
  });

  factory TwoFactorVerifySetupResult.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    final codes = root['backupCodes'];
    return TwoFactorVerifySetupResult(
      enabled: root['enabled'] as bool? ?? true,
      backupCodes: codes is List ? codes.map((e) => '$e').toList() : const [],
    );
  }

  final bool enabled;
  final List<String> backupCodes;
}

class DeviceRecordModel {
  const DeviceRecordModel({
    required this.id,
    required this.browser,
    required this.os,
    this.firstSeenAt,
    this.lastSeenAt,
    this.city,
    this.country,
    this.isCurrent = false,
    this.isRevoked = false,
  });

  factory DeviceRecordModel.fromJson(Map<String, dynamic> json) {
    return DeviceRecordModel(
      id: '${json['id'] ?? ''}',
      browser: json['browser'] as String? ?? 'Unknown device',
      os: json['os'] as String? ?? '',
      firstSeenAt: json['firstSeenAt'] as String?,
      lastSeenAt: json['lastSeenAt'] as String?,
      city: json['city'] as String?,
      country: json['country'] as String?,
      isCurrent: json['isCurrent'] as bool? ?? false,
      isRevoked: json['isRevoked'] as bool? ?? false,
    );
  }

  final String id;
  final String browser;
  final String os;
  final String? firstSeenAt;
  final String? lastSeenAt;
  final String? city;
  final String? country;
  final bool isCurrent;
  final bool isRevoked;

  String get locationLabel {
    final parts = [city, country].whereType<String>().where((s) => s.trim().isNotEmpty);
    return parts.isEmpty ? 'Unknown location' : parts.join(', ');
  }

  String get deviceName => browser.trim().isNotEmpty ? browser : os;
}

class DevicesListModel {
  const DevicesListModel({
    this.devices = const [],
    this.cooldownHours = 24,
    this.currentDeviceTracked = false,
  });

  factory DevicesListModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    final list = root['devices'];
    return DevicesListModel(
      devices: list is List
          ? list.whereType<Map>().map((e) => DeviceRecordModel.fromJson(Map<String, dynamic>.from(e))).toList()
          : const [],
      cooldownHours: root['cooldownHours'] as int? ?? 24,
      currentDeviceTracked: root['currentDeviceTracked'] as bool? ?? false,
    );
  }

  final List<DeviceRecordModel> devices;
  final int cooldownHours;
  final bool currentDeviceTracked;
}
