import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/profile/presentation/providers/my_devices_providers.dart';

abstract final class _C {
  static const bg = Color(0xFF0A0E12);
  static const card = Color(0xFF12171C);
  static const border = Color(0xFF1E2630);

  static Color get muted => AppColors.authMuted.withValues(alpha: 0.72);
  static Color get faint => AppColors.authMuted.withValues(alpha: 0.48);

  static const green = AppColors.authGreen;
  static const blue = Color(0xFF60A5FA);
  static const purple = Color(0xFF818CF8);
  static const red = Color(0xFFEF4444);
}

class MyDevicesAppBar extends StatelessWidget {
  const MyDevicesAppBar({required this.onBack, super.key});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onBack,
                borderRadius: BorderRadius.circular(12),
                child: Ink(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.75)),
                  ),
                  child: Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: Colors.white.withValues(alpha: 0.9)),
                ),
              ),
            ),
          ),
          const Text(
            'My Devices',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class MyDevicesSummaryCard extends StatelessWidget {
  const MyDevicesSummaryCard({required this.sessionCount, super.key});

  final int sessionCount;

  @override
  Widget build(BuildContext context) {
    final label = sessionCount == 1 ? '1 active session' : '$sessionCount active sessions';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_C.blue.withValues(alpha: 0.2), const Color(0xFF141B2E), _C.card],
        ),
        border: Border.all(color: _C.blue.withValues(alpha: 0.24)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: _C.blue.withValues(alpha: 0.12),
              border: Border.all(color: _C.blue.withValues(alpha: 0.28)),
            ),
            child: const Icon(Icons.shield_outlined, size: 22, color: _C.blue),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(
                  "Don't recognize a device? Sign it out immediately and change your password.",
                  style: TextStyle(fontSize: 11, color: _C.muted, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class MyDevicesSectionLabel extends StatelessWidget {
  const MyDevicesSectionLabel(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 2, bottom: 8),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _C.faint, letterSpacing: 1.1),
      ),
    );
  }
}

class MyDevicesSessionCard extends StatelessWidget {
  const MyDevicesSessionCard({
    required this.session,
    this.readOnly = false,
    this.revoking = false,
    this.onRevoke,
    super.key,
  });

  final DeviceSession session;
  final bool readOnly;
  final bool revoking;
  final VoidCallback? onRevoke;

  @override
  Widget build(BuildContext context) {
    final icon = session.kind == DeviceKind.mobile ? Icons.smartphone_rounded : Icons.desktop_windows_rounded;
    final iconColor = session.kind == DeviceKind.mobile ? _C.purple : _C.blue;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _C.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: session.isCurrentDevice ? _C.green.withValues(alpha: 0.55) : _C.border,
          width: session.isCurrentDevice ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(11),
                  color: iconColor.withValues(alpha: 0.14),
                  border: Border.all(color: iconColor.withValues(alpha: 0.28)),
                ),
                child: Icon(icon, size: 20, color: iconColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        Text(session.name, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
                        if (session.isCurrentDevice) const _ThisDeviceBadge(),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(session.platform, style: TextStyle(fontSize: 11, color: _C.muted)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(Icons.location_on_outlined, size: 13, color: _C.faint),
              const SizedBox(width: 4),
              Text(session.location, style: TextStyle(fontSize: 11, color: _C.muted)),
              const SizedBox(width: 12),
              Icon(Icons.wifi_rounded, size: 13, color: _C.faint),
              const Spacer(),
              Text(
                session.lastActiveLabel,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: session.isActiveNow ? _C.green : _C.muted,
                ),
              ),
            ],
          ),
          if (!session.isCurrentDevice && !readOnly) ...[
            const SizedBox(height: 12),
            _SignOutDeviceButton(loading: revoking, onTap: onRevoke ?? () {}),
          ],
        ],
      ),
    );
  }
}

class _ThisDeviceBadge extends StatelessWidget {
  const _ThisDeviceBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _C.green.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _C.green.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 5, height: 5, decoration: const BoxDecoration(color: _C.green, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          const Text(
            'THIS DEVICE',
            style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: _C.green, letterSpacing: 0.5),
          ),
        ],
      ),
    );
  }
}

class _SignOutDeviceButton extends StatelessWidget {
  const _SignOutDeviceButton({required this.loading, required this.onTap});

  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: loading
            ? null
            : () {
                HapticFeedback.mediumImpact();
                onTap();
              },
        borderRadius: BorderRadius.circular(10),
        child: Ink(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: _C.red.withValues(alpha: 0.45)),
          ),
          child: Center(
            child: loading
                ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: _C.red.withValues(alpha: 0.8)))
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.logout_rounded, size: 16, color: _C.red.withValues(alpha: 0.9)),
                      const SizedBox(width: 6),
                      Text(
                        'Sign out this device',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: _C.red.withValues(alpha: 0.95)),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class MyDevicesSignOutAllButton extends StatelessWidget {
  const MyDevicesSignOutAllButton({
    required this.otherCount,
    required this.loading,
    required this.onTap,
    super.key,
  });

  final int otherCount;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    if (otherCount == 0) return const SizedBox.shrink();

    return CustomPaint(
      painter: _DashedBorderPainter(color: _C.red.withValues(alpha: 0.55), radius: 14),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: loading
              ? null
              : () {
                  HapticFeedback.mediumImpact();
                  onTap();
                },
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            width: double.infinity,
            height: 48,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: _C.red.withValues(alpha: 0.06),
            ),
            child: Center(
              child: loading
                  ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: _C.red.withValues(alpha: 0.85)))
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.warning_amber_rounded, size: 18, color: _C.red.withValues(alpha: 0.9)),
                        const SizedBox(width: 8),
                        Text(
                          'Sign out all other devices ($otherCount)',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: _C.red.withValues(alpha: 0.95)),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({required this.color, required this.radius});

  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;

    const dash = 6.0;
    const gap = 4.0;
    final rrect = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius));
    final path = Path()..addRRect(rrect);

    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = distance + dash;
        canvas.drawPath(metric.extractPath(distance, next.clamp(0, metric.length)), paint);
        distance = next + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.radius != radius;
}

class MyDevicesEmptyState extends StatelessWidget {
  const MyDevicesEmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: _C.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _C.border),
      ),
      child: Text(
        'No devices logged yet. Sign in again to start tracking this device.',
        style: TextStyle(fontSize: 12, color: _C.muted, height: 1.4),
      ),
    );
  }
}

class MyDevicesInfoFooter extends StatelessWidget {
  const MyDevicesInfoFooter({this.readOnly = false, this.cooldownHours = 24, super.key});

  final bool readOnly;
  final int cooldownHours;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _C.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _C.blue.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded, size: 18, color: _C.blue.withValues(alpha: 0.9)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              readOnly
                  ? 'Device history is read-only for now. Remote sign-out is coming soon. If you see suspicious activity, change your password.'
                  : 'We log every sign-in for 90 days. Revoking a session signs that device out immediately. New devices trigger a $cooldownHours-hour withdrawal cooldown.',
              style: TextStyle(fontSize: 11, color: _C.muted, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

Future<bool> confirmMyDevicesAction(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: _C.card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: _C.border)),
      title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
      content: Text(message, style: TextStyle(color: _C.muted, fontSize: 13, height: 1.4)),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: Text('Cancel', style: TextStyle(color: _C.faint, fontWeight: FontWeight.w700)),
        ),
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(confirmLabel, style: TextStyle(color: _C.red, fontWeight: FontWeight.w800)),
        ),
      ],
    ),
  );
  return result ?? false;
}
