import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/profile/application/security_providers.dart';
import 'package:qorix_markets_flutter/features/profile/presentation/providers/my_devices_providers.dart';
import 'package:qorix_markets_flutter/features/profile/presentation/widgets/my_devices_ui.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';

class MyDevicesScreen extends ConsumerWidget {
  const MyDevicesScreen({super.key});

  Future<void> _revokeOne(BuildContext context, WidgetRef ref, DeviceSession session) async {
    final confirmed = await confirmMyDevicesAction(
      context,
      title: 'Sign out this device?',
      message: '${session.name} on ${session.platform} will be signed out immediately.',
      confirmLabel: 'Sign out',
    );
    if (!confirmed) return;

    try {
      await ref.read(myDevicesLiveProvider.notifier).revokeSession(session.id);
      if (!context.mounted) return;
      HapticFeedback.mediumImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Device signed out'), behavior: SnackBarBehavior.floating),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorMessage.sessionRevoke(e)), behavior: SnackBarBehavior.floating),
      );
    }
  }

  Future<void> _revokeAllOthers(BuildContext context, WidgetRef ref, int count) async {
    final confirmed = await confirmMyDevicesAction(
      context,
      title: 'Sign out all other devices?',
      message: 'This will end $count active session${count == 1 ? '' : 's'} on other devices. This device stays signed in.',
      confirmLabel: 'Sign out all',
    );
    if (!confirmed) return;

    try {
      await ref.read(myDevicesLiveProvider.notifier).revokeAllOthers();
      if (!context.mounted) return;
      HapticFeedback.mediumImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('All other devices signed out'), behavior: SnackBarBehavior.floating),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorMessage.sessionRevoke(e)), behavior: SnackBarBehavior.floating),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final devicesAsync = ref.watch(myDevicesLiveProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      body: SafeArea(
        bottom: false,
        child: CinematicAsyncContent<MyDevicesState>(
          value: devicesAsync,
          onRetry: () => ref.read(myDevicesLiveProvider.notifier).refresh(),
          builder: (state, {required isRefreshing}) {
            return Responsive.constrained(
              context,
              RefreshIndicator(
                onRefresh: () => ref.read(myDevicesLiveProvider.notifier).refresh(),
                child: ListView(
                  physics: AppScroll.page,
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  children: [
                    MyDevicesAppBar(onBack: () => safePop(context)),
                    const SizedBox(height: 16),
                    MyDevicesSummaryCard(sessionCount: state.activeCount),
                    const SizedBox(height: 18),
                    const MyDevicesSectionLabel('DEVICES'),
                    if (state.sessions.isEmpty)
                      const MyDevicesEmptyState()
                    else
                      ...state.sessions.map((session) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: MyDevicesSessionCard(
                            session: session,
                            readOnly: state.readOnly,
                            revoking: state.revokingSessionId == session.id,
                            onRevoke: session.isCurrentDevice || session.isRevoked || state.readOnly
                                ? null
                                : () => _revokeOne(context, ref, session),
                          ),
                        );
                      }),
                    const SizedBox(height: 14),
                    if (!state.readOnly)
                      MyDevicesSignOutAllButton(
                        otherCount: state.otherCount,
                        loading: state.revokingAll,
                        onTap: () => _revokeAllOthers(context, ref, state.otherCount),
                      ),
                    const SizedBox(height: 16),
                    MyDevicesInfoFooter(readOnly: state.readOnly, cooldownHours: state.cooldownHours),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
