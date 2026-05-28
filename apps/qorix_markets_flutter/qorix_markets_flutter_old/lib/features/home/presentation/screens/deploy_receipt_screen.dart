import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:qorix_markets_flutter/core/motion/sensory_feedback.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/bot_setup_demo.dart';
import 'package:qorix_markets_flutter/features/home/presentation/widgets/deploy_receipt_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

class DeployReceiptScreen extends ConsumerStatefulWidget {
  const DeployReceiptScreen({
    required this.botId,
    required this.amountInr,
    super.key,
  });

  final String botId;
  final double amountInr;

  @override
  ConsumerState<DeployReceiptScreen> createState() => _DeployReceiptScreenState();
}

class _DeployReceiptScreenState extends ConsumerState<DeployReceiptScreen> {
  late final String _txnId;
  late final DateTime _deployedAt;

  BotExploreItem? get _bot => BotSetupDemo.findExploreBot(widget.botId);

  @override
  void initState() {
    super.initState();
    _txnId = BotSetupDemo.generateTxnId();
    _deployedAt = DateTime.now();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      HapticFeedback.mediumImpact();
      SensoryFeedback.trigger(SensoryMoment.activationSuccess);
    });
  }

  void _goHome() => context.go(RoutePaths.home);

  @override
  Widget build(BuildContext context) {
    final bot = _bot;
    if (bot == null || widget.amountInr <= 0) {
      return Scaffold(
        backgroundColor: AppDesk.bg,
        body: Center(
          child: Text('Receipt unavailable', style: TextStyle(color: AppColors.authMuted.withValues(alpha: 0.7))),
        ),
      );
    }

    final metrics = BotSetupDemo.receiptMetrics(bot: bot, amountInr: widget.amountInr);

    return Scaffold(
      backgroundColor: AppDesk.bg,
      body: SafeArea(
        bottom: false,
        child: Responsive.constrained(
          context,
          ListView(
            physics: AppScroll.page,
            padding: EdgeInsets.fromLTRB(
              Responsive.pagePadding(context).left,
              AppSpacing.screenTopInset,
              Responsive.pagePadding(context).right,
              AppSpacing.lg + MediaQuery.paddingOf(context).bottom,
            ),
            children: [
              DeployReceiptSuccessHeader(bot: bot, amountInr: widget.amountInr),
              AppSpacing.gapSection(),
              DeployReceiptCard(
                bot: bot,
                txnId: _txnId,
                deployedAt: _deployedAt,
                metrics: metrics,
              ),
              const SizedBox(height: AppSpacing.xl),
              DeployReceiptActions(onTrackLive: _goHome, onDashboard: _goHome),
              AppSpacing.gapSection(),
              const DeployWhatHappensNext(),
              const SizedBox(height: AppSpacing.md),
              const DeployReceiptFooter(),
            ],
          ),
        ),
      ),
    );
  }
}
