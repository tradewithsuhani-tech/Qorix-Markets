import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/bot_setup_demo.dart';
import 'package:qorix_markets_flutter/widgets/desk_widgets.dart';

abstract final class _R {
  static const bg = Color(0xFF0A0E12);
  static const card = Color(0xFF12171C);
  static const border = Color(0xFF1E2630);
  static const red = Color(0xFFFF4D6A);

  static Color get muted => AppColors.authMuted.withValues(alpha: 0.72);
  static Color get faint => AppColors.authMuted.withValues(alpha: 0.48);
  static const green = AppColors.authGreen;

  static final _inr = NumberFormat('#,##0.###', 'en_IN');
  static String inr(num v) => '₹${_inr.format(v)}';
  static String inrSigned(num v, {required bool positive}) => '${positive ? '+' : '-'}₹${_inr.format(v.abs())}';

  static String deployedAt(DateTime dt) {
    final time = DateFormat('h:mm a').format(dt).toLowerCase();
    final date = DateFormat('d MMM y').format(dt);
    return '$time · $date';
  }
}

class DeployReceiptSuccessHeader extends StatelessWidget {
  const DeployReceiptSuccessHeader({
    required this.bot,
    required this.amountInr,
    super.key,
  });

  final BotExploreItem bot;
  final double amountInr;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            color: _R.green.withValues(alpha: 0.12),
            border: Border.all(color: _R.green.withValues(alpha: 0.32)),
          ),
          child: const Icon(Icons.check_rounded, size: 32, color: _R.green),
        ),
        const SizedBox(height: AppSpacing.lg),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
          decoration: AppDesk.liveBadge(),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 6, height: 6, decoration: const BoxDecoration(color: _R.green, shape: BoxShape.circle)),
              const SizedBox(width: AppSpacing.sm),
              const Text('BOT NOW LIVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _R.green, letterSpacing: 0.6)),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        const Text('Capital Deployed', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -0.4)),
        const SizedBox(height: AppSpacing.md),
        Text(
          _R.inr(amountInr),
          style: AppDesk.metricHero.copyWith(fontSize: 34),
        ),
        const SizedBox(height: AppSpacing.lg),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            'Funds are placed with ${bot.name} ${bot.deployVersion} and will start trading on the next market tick.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: _R.muted, height: 1.45),
          ),
        ),
      ],
    );
  }
}

class DeployReceiptCard extends StatelessWidget {
  const DeployReceiptCard({
    required this.bot,
    required this.txnId,
    required this.deployedAt,
    required this.metrics,
    super.key,
  });

  final BotExploreItem bot;
  final String txnId;
  final DateTime deployedAt;
  final DeployReceiptMetrics metrics;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: AppDesk.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            child: Text('DEPLOYMENT RECEIPT', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: _R.faint, letterSpacing: 0.9)),
          ),
          const Divider(height: 1, color: _R.border),
          _ReceiptRow(label: 'Transaction ID', value: txnId, bold: true),
          _ReceiptRow(
            label: 'Strategy',
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    color: bot.accent.withValues(alpha: 0.14),
                    border: Border.all(color: bot.accent.withValues(alpha: 0.3)),
                  ),
                  child: Icon(Icons.memory_rounded, size: 12, color: bot.accent),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    '${bot.name} ${bot.deployVersion}',
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          _ReceiptRow(
            label: 'Risk profile',
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _R.green.withValues(alpha: 0.35)),
                color: _R.green.withValues(alpha: 0.08),
              ),
              child: Text(bot.riskLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _R.green.withValues(alpha: 0.95))),
            ),
          ),
          _ReceiptRow(
            label: 'Expected / mo',
            value: '${_R.inrSigned(metrics.expectedProfitInr, positive: true)} (${metrics.returnLabel})',
            valueColor: _R.green,
          ),
          _ReceiptRow(
            label: 'Stop-loss',
            value: '${_R.inrSigned(metrics.stopLossInr, positive: false)} (-${metrics.stopLossPct.toStringAsFixed(2)}% cap)',
            valueColor: _R.red,
          ),
          _ReceiptRow(label: 'Deployed at', value: _R.deployedAt(deployedAt), isLast: true),
        ],
      ),
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow({
    required this.label,
    this.value,
    this.child,
    this.valueColor,
    this.bold = false,
    this.isLast = false,
  });

  final String label;
  final String? value;
  final Widget? child;
  final Color? valueColor;
  final bool bold;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 108,
                child: Text(label, style: TextStyle(fontSize: 11, color: _R.muted, height: 1.3)),
              ),
              Expanded(
                child: Align(
                  alignment: Alignment.centerRight,
                  child: child ??
                      Text(
                        value ?? '',
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          fontSize: bold ? 14 : 13,
                          fontWeight: bold ? FontWeight.w900 : FontWeight.w700,
                          color: valueColor ?? Colors.white.withValues(alpha: 0.92),
                          height: 1.25,
                        ),
                      ),
                ),
              ),
            ],
          ),
        ),
        if (!isLast) const Divider(height: 1, indent: 16, endIndent: 16, color: _R.border),
      ],
    );
  }
}

class DeployWhatHappensNext extends StatelessWidget {
  const DeployWhatHappensNext({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('What happens next', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        const _TimelineStep(
          state: _TimelineStepState.done,
          title: 'Funds settled in trading pool',
          subtitle: 'Just now',
          isFirst: true,
        ),
        const _TimelineStep(
          state: _TimelineStepState.active,
          title: 'Bot picks first signal',
          subtitle: 'Within 2–5 minutes',
        ),
        const _TimelineStep(
          state: _TimelineStepState.pending,
          title: 'First payout settled',
          subtitle: 'Daily at 6:00 PM IST',
          isLast: true,
        ),
      ],
    );
  }
}

enum _TimelineStepState { done, active, pending }

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({
    required this.state,
    required this.title,
    required this.subtitle,
    this.isFirst = false,
    this.isLast = false,
  });

  final _TimelineStepState state;
  final String title;
  final String subtitle;
  final bool isFirst;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final lineColor = state == _TimelineStepState.done ? _R.green.withValues(alpha: 0.45) : _R.border;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 36,
            child: Column(
              children: [
                if (!isFirst)
                  Expanded(
                    child: Container(width: 2, color: lineColor),
                  ),
                _StepDot(state: state),
                if (!isLast)
                  Expanded(
                    child: Container(width: 2, color: state == _TimelineStepState.done ? _R.green.withValues(alpha: 0.45) : _R.border),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 18, top: isFirst ? 0 : 2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: state == _TimelineStepState.pending ? _R.muted : Colors.white.withValues(alpha: 0.95),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(subtitle, style: TextStyle(fontSize: 11, color: _R.faint)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StepDot extends StatelessWidget {
  const _StepDot({required this.state});

  final _TimelineStepState state;

  @override
  Widget build(BuildContext context) {
    return switch (state) {
      _TimelineStepState.done => Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: _R.green.withValues(alpha: 0.15),
            border: Border.all(color: _R.green.withValues(alpha: 0.5)),
          ),
          child: const Icon(Icons.check_rounded, size: 16, color: _R.green),
        ),
      _TimelineStepState.active => Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: _R.green.withValues(alpha: 0.12),
            border: Border.all(color: _R.green.withValues(alpha: 0.45)),
          ),
          child: const Icon(Icons.bolt_rounded, size: 15, color: _R.green),
        ),
      _TimelineStepState.pending => Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withValues(alpha: 0.04),
            border: Border.all(color: _R.border),
          ),
          child: Icon(Icons.show_chart_rounded, size: 15, color: _R.faint),
        ),
    };
  }
}

class DeployReceiptActions extends StatelessWidget {
  const DeployReceiptActions({
    required this.onTrackLive,
    required this.onDashboard,
    super.key,
  });

  final VoidCallback onTrackLive;
  final VoidCallback onDashboard;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DeskPrimaryCta(
          label: 'Track live trades',
          onTap: onTrackLive,
          trailing: Icon(Icons.monitor_heart_outlined, size: AppDesk.iconMd, color: AppDesk.bg),
        ),
        const SizedBox(height: AppSpacing.md),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              HapticFeedback.selectionClick();
              onDashboard();
            },
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: Ink(
              height: AppSpacing.buttonHeightSm,
              decoration: AppDesk.outlineButton(),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.home_outlined, size: AppDesk.iconSm, color: AppDesk.textPrimary),
                  const SizedBox(width: AppSpacing.sm),
                  Text('Back to dashboard', style: AppDesk.sectionTitle.copyWith(fontSize: 14)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class DeployReceiptFooter extends StatelessWidget {
  const DeployReceiptFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.verified_user_outlined, size: 14, color: _R.faint),
        const SizedBox(width: 6),
        Text('Receipt mailed to your registered email', style: TextStyle(fontSize: 10, color: _R.muted)),
      ],
    );
  }
}
