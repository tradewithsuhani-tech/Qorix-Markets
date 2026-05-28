import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/data/models/security_models.dart';
import 'package:qorix_markets_flutter/features/profile/infrastructure/security_repository_impl.dart';

enum DeviceKind { mobile, desktop }

class DeviceSession {
  const DeviceSession({
    required this.id,
    required this.name,
    required this.platform,
    required this.location,
    required this.lastActiveLabel,
    required this.isCurrentDevice,
    required this.kind,
    this.isActiveNow = false,
    this.isRevoked = false,
  });

  final String id;
  final String name;
  final String platform;
  final String location;
  final String lastActiveLabel;
  final bool isCurrentDevice;
  final bool isActiveNow;
  final bool isRevoked;
  final DeviceKind kind;
}

class MyDevicesState {
  const MyDevicesState({
    required this.sessions,
    this.readOnly = false,
    this.cooldownHours = 24,
    this.revokingSessionId,
    this.revokingAll = false,
  });

  final List<DeviceSession> sessions;
  final bool readOnly;
  final int cooldownHours;
  final String? revokingSessionId;
  final bool revokingAll;

  int get activeCount => sessions.where((s) => !s.isRevoked).length;
  int get otherCount => sessions.where((s) => !s.isCurrentDevice && !s.isRevoked).length;

  MyDevicesState copyWith({
    List<DeviceSession>? sessions,
    bool? readOnly,
    int? cooldownHours,
    String? revokingSessionId,
    bool clearRevokingSessionId = false,
    bool? revokingAll,
  }) {
    return MyDevicesState(
      sessions: sessions ?? this.sessions,
      readOnly: readOnly ?? this.readOnly,
      cooldownHours: cooldownHours ?? this.cooldownHours,
      revokingSessionId: clearRevokingSessionId ? null : (revokingSessionId ?? this.revokingSessionId),
      revokingAll: revokingAll ?? this.revokingAll,
    );
  }
}

DeviceSession _mapDevice(DeviceRecordModel d) {
  final os = d.os ?? '';
  final kind = os.toLowerCase().contains('android') ||
          os.toLowerCase().contains('ios') ||
          os.toLowerCase().contains('iphone')
      ? DeviceKind.mobile
      : DeviceKind.desktop;
  final location = [d.city, d.country].where((e) => e != null && e!.isNotEmpty).join(', ');
  return DeviceSession(
    id: d.id,
    name: d.browser?.isNotEmpty == true ? d.browser! : 'Device',
    platform: os.isNotEmpty ? os : (d.browser ?? 'Unknown'),
    location: location.isEmpty ? 'Unknown' : location,
    lastActiveLabel: d.lastSeenAt ?? '—',
    isCurrentDevice: d.isCurrent,
    isActiveNow: d.isCurrent,
    kind: kind,
  );
}

final myDevicesLiveProvider =
    AsyncNotifierProvider<MyDevicesLiveNotifier, MyDevicesState>(MyDevicesLiveNotifier.new);

class MyDevicesLiveNotifier extends AsyncNotifier<MyDevicesState> {
  @override
  Future<MyDevicesState> build() async => _load();

  Future<MyDevicesState> _load() async {
    final list = await ref.read(securityRepositoryProvider).getDevices();
    return MyDevicesState(
      sessions: list.devices.map(_mapDevice).toList(),
      readOnly: UiDemoMode.blocksWriteApi,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_load);
  }

  Future<void> revokeSession(String id) async {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(current.copyWith(revokingSessionId: id));
    try {
      await ref.read(securityRepositoryProvider).revokeSession(id);
      await refresh();
    } catch (e) {
      state = AsyncData(current.copyWith(clearRevokingSessionId: true));
      rethrow;
    }
  }

  Future<void> revokeAllOthers() async {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(current.copyWith(revokingAll: true));
    try {
      await ref.read(securityRepositoryProvider).revokeOtherSessions();
      await refresh();
    } catch (e) {
      state = AsyncData(current.copyWith(revokingAll: false));
      rethrow;
    }
  }
}
