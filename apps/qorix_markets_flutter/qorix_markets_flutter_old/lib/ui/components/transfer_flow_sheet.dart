import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/motion/desk_sheets.dart';
import 'package:qorix_markets_flutter/core/motion/sensory_feedback.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/features/wallet/application/transfer_flow_provider.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/widgets/transfer_ui.dart';

/// Internal transfer sheet — Main ↔ Funding with direction-specific rules.
Future<void> showTransferFlowSheet(BuildContext context) {
  return showDeskBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (ctx) => const _TransferFlowSheet(),
  );
}

class _TransferFlowSheet extends ConsumerStatefulWidget {
  const _TransferFlowSheet();

  @override
  ConsumerState<_TransferFlowSheet> createState() => _TransferFlowSheetState();
}

class _TransferFlowSheetState extends ConsumerState<_TransferFlowSheet> {
  final _amount = TextEditingController();

  @override
  void initState() {
    super.initState();
    _amount.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(transferFlowProvider.notifier).reset();
    });
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  double? get _parsedAmount => double.tryParse(_amount.text.trim());

  void _close() {
    ref.read(transferFlowProvider.notifier).reset();
    Navigator.pop(context);
  }

  void _setMax(double max) {
    if (max <= 0) return;
    _amount.text = max.toStringAsFixed(2);
  }

  Future<void> _submit() async {
    final amount = _parsedAmount;
    if (amount == null || amount <= 0) return;

    HapticFeedback.mediumImpact();
    try {
      await ref.read(transferFlowProvider.notifier).submitTransfer(amount);
      if (!mounted) return;
      SensoryFeedback.trigger(SensoryMoment.transferComplete);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ErrorMessage.brief(e)),
          backgroundColor: AppColors.authCardBg,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final flow = ref.watch(transferFlowProvider);
    final balances = ref.watch(transferBalanceProvider);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final maxAmount = balances.maxTransferable(flow.direction);
    final parsed = _parsedAmount ?? 0;
    final canSubmit = parsed > 0 && parsed <= maxAmount && !flow.submitting;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.92,
        ),
        decoration: BoxDecoration(
          color: AppColors.authPageBg,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.85)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.45),
              blurRadius: 32,
              offset: const Offset(0, -8),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
            child: flow.phase == TransferFlowPhase.success
                ? TransferSuccessView(
                    flow: flow,
                    balances: balances,
                    onDone: _close,
                  )
                : SingleChildScrollView(
                    physics: AppScroll.page,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TransferSheetHeader(onClose: _close),
                        const SizedBox(height: 22),
                        TransferWalletRoute(
                          direction: flow.direction,
                          balances: balances,
                          onSwap: () => ref.read(transferFlowProvider.notifier).swapDirection(),
                        ),
                        if (balances.showCapitalBreakdown(flow.direction)) ...[
                          const SizedBox(height: 14),
                          TransferCapitalBreakdown(
                            locked: balances.strategyLocked,
                            free: balances.freeFunding,
                          ),
                        ],
                        const SizedBox(height: 22),
                        TransferAmountSection(
                          controller: _amount,
                          maxAmount: maxAmount,
                          onMax: () => _setMax(maxAmount),
                        ),
                        const SizedBox(height: 16),
                        TransferInfoNote(text: balances.infoNote(flow.direction)),
                        const SizedBox(height: 22),
                        AuthPrimaryButton(
                          label: transferCtaLabel(
                            amount: parsed,
                            maxAmount: maxAmount,
                            submitting: flow.submitting,
                          ),
                          loading: flow.submitting,
                          onPressed: canSubmit ? _submit : null,
                        ),
                        const SizedBox(height: 14),
                        const TransferTrustFooter(),
                      ],
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
