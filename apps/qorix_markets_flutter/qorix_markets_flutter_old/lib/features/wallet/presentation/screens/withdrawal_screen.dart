import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/features/wallet/application/inr_payout_methods_provider.dart';
import 'package:qorix_markets_flutter/features/wallet/application/withdraw_flow_provider.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_inr_options.dart'
    show InrPayoutMethod, buildInrDestination;
import 'package:qorix_markets_flutter/features/wallet/presentation/widgets/deposit_ui.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/widgets/withdraw_inr_ui.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/widgets/withdraw_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

/// Withdraw Funds — auth-green flow matching deposit (USDT + INR, OTP, success).
class WithdrawalScreen extends ConsumerStatefulWidget {
  const WithdrawalScreen({super.key});

  @override
  ConsumerState<WithdrawalScreen> createState() => _WithdrawalScreenState();
}

class _WithdrawalScreenState extends ConsumerState<WithdrawalScreen> {
  final _amount = TextEditingController();
  final _destination = TextEditingController();
  final _accountHolder = TextEditingController();
  final _accountNumber = TextEditingController();
  final _ifsc = TextEditingController();
  final _upiId = TextEditingController();
  final _qorixUserId = TextEditingController();
  final _otpKey = GlobalKey<AuthOtpInputState>();

  @override
  void dispose() {
    _amount.dispose();
    _destination.dispose();
    _accountHolder.dispose();
    _accountNumber.dispose();
    _ifsc.dispose();
    _upiId.dispose();
    _qorixUserId.dispose();
    super.dispose();
  }

  void _goBack() {
    final flow = ref.read(withdrawFlowProvider);
    switch (flow.phase) {
      case WithdrawFlowPhase.otp:
        ref.read(withdrawFlowProvider.notifier).backToForm();
      case WithdrawFlowPhase.inrDetails:
        ref.read(withdrawFlowProvider.notifier).backToInrPayoutSelect();
      case WithdrawFlowPhase.inrPayoutSelect:
        ref.read(withdrawFlowProvider.notifier).backToInrForm();
      case WithdrawFlowPhase.success:
      case WithdrawFlowPhase.failure:
        ref.read(withdrawFlowProvider.notifier).reset();
        if (context.canPop()) context.pop();
      case WithdrawFlowPhase.form:
        if (context.canPop()) context.pop();
    }
  }

  double? get _parsedAmount => double.tryParse(_amount.text.trim());

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.authCardBg),
    );
  }

  Future<void> _submitUsdtForm() async {
    final value = _parsedAmount;
    final dest = _destination.text.trim();

    if (value == null || value <= 0 || dest.length < 10) {
      _showSnack('Enter amount and valid TRC20 address');
      return;
    }

    final limits = ref.read(withdrawLimitsProvider);
    if (value > limits.available) {
      _showSnack('Maximum ${limits.available.toStringAsFixed(2)} USDT available');
      return;
    }

    HapticFeedback.mediumImpact();
    try {
      await ref.read(withdrawFlowProvider.notifier).requestOtp(
            amount: value,
            destination: dest,
          );
    } catch (e) {
      if (!mounted) return;
      _showSnack(ErrorMessage.brief(e));
    }
  }

  Future<void> _proceedInrAmount() async {
    final value = _parsedAmount;
    if (value == null || value <= 0) {
      _showSnack('Enter withdrawal amount first');
      return;
    }

    final limits = ref.read(withdrawLimitsProvider);
    final error = withdrawAmountValidationError(
      amount: value,
      isUsdt: false,
      availableUsdt: limits.available,
    );
    if (error != null) {
      HapticFeedback.heavyImpact();
      _showSnack(error);
      return;
    }

    HapticFeedback.mediumImpact();
    try {
      ref.read(withdrawFlowProvider.notifier).proceedInrAmount(value);
    } catch (e) {
      _showSnack(ErrorMessage.brief(e));
    }
  }

  void _selectInrPayout(InrPayoutMethod payout) {
    HapticFeedback.selectionClick();
    ref.read(withdrawFlowProvider.notifier).selectInrPayoutMethod(payout);
  }

  bool _validateInrDetails(InrPayoutMethod payout) {
    switch (payout) {
      case InrPayoutMethod.bank:
        if (_accountHolder.text.trim().length < 2) {
          _showSnack('Enter account holder name');
          return false;
        }
        if (_accountNumber.text.trim().length < 6) {
          _showSnack('Enter valid account number');
          return false;
        }
        if (_ifsc.text.trim().length < 8) {
          _showSnack('Enter valid IFSC code');
          return false;
        }
      case InrPayoutMethod.upi:
        final upi = _upiId.text.trim();
        if (!upi.contains('@') || upi.length < 5) {
          _showSnack('Enter valid UPI ID');
          return false;
        }
      case InrPayoutMethod.qorixUser:
        if (_qorixUserId.text.trim().length < 3) {
          _showSnack('Enter valid referral code');
          return false;
        }
    }
    return true;
  }

  String? _bankNameForDestination() {
    final acct = _accountNumber.text.trim();
    final banks = ref.read(inrPayoutMethodsProvider).valueOrNull
            ?.where((m) => m.type == InrPayoutMethod.bank) ??
        const [];
    for (final bank in banks) {
      if (bank.accountValue == acct) return bank.bankName;
    }
    return null;
  }

  Future<void> _submitInrDetails() async {
    final flow = ref.read(withdrawFlowProvider);
    final payout = flow.inrPayout;
    final amount = flow.amount;
    if (payout == null || amount == null) return;
    if (!_validateInrDetails(payout)) return;

    final destination = buildInrDestination(
      payout: payout,
      accountHolder: _accountHolder.text.trim(),
      accountNumber: _accountNumber.text.trim(),
      ifsc: _ifsc.text.trim().toUpperCase(),
      upiId: _upiId.text.trim(),
      qorixUserId: _qorixUserId.text.trim(),
      bankName: payout == InrPayoutMethod.bank ? _bankNameForDestination() : null,
    );

    HapticFeedback.mediumImpact();
    try {
      await ref.read(withdrawFlowProvider.notifier).requestOtp(
            amount: amount,
            destination: destination,
            inrPayout: payout,
          );
    } catch (e) {
      if (!mounted) return;
      _showSnack(ErrorMessage.brief(e));
    }
  }

  Future<void> _verifyOtp(String code) async {
    HapticFeedback.mediumImpact();
    await ref.read(withdrawFlowProvider.notifier).submitWithdrawal(code);
  }

  @override
  Widget build(BuildContext context) {
    final flow = ref.watch(withdrawFlowProvider);
    final limits = ref.watch(withdrawLimitsProvider);

    return Scaffold(
      backgroundColor: AppColors.authPageBg,
      resizeToAvoidBottomInset: true,
      body: AuthBackground(
        child: DepositPageScaffold(
          onBack: _goBack,
          child: switch (flow.phase) {
            WithdrawFlowPhase.form => _WithdrawFormPage(
                amount: _amount,
                destination: _destination,
                flow: flow,
                limits: limits,
                onSubmitUsdt: _submitUsdtForm,
                onProceedInr: _proceedInrAmount,
              ),
            WithdrawFlowPhase.inrPayoutSelect => _WithdrawInrPayoutSelectPage(
                flow: flow,
                onSelect: _selectInrPayout,
              ),
            WithdrawFlowPhase.inrDetails => _WithdrawInrDetailsPage(
                flow: flow,
                accountHolder: _accountHolder,
                accountNumber: _accountNumber,
                ifsc: _ifsc,
                upiId: _upiId,
                qorixUserId: _qorixUserId,
                onChangeMethod: () => ref.read(withdrawFlowProvider.notifier).backToInrPayoutSelect(),
                onSubmit: _submitInrDetails,
              ),
            WithdrawFlowPhase.otp => _WithdrawOtpPage(
                flow: flow,
                feeRate: limits.feeRate,
                otpKey: _otpKey,
                onCompleted: _verifyOtp,
                onOtpChanged: (_) => ref.read(withdrawFlowProvider.notifier).clearOtpError(),
              ),
            WithdrawFlowPhase.success => WithdrawSuccessStage(
                flow: flow,
                feeRate: limits.feeRate,
                onDone: () {
                  ref.read(withdrawFlowProvider.notifier).reset();
                  context.pop();
                },
                onWallet: () {
                  ref.read(withdrawFlowProvider.notifier).reset();
                  context.go(RoutePaths.wallet);
                },
              ),
            WithdrawFlowPhase.failure => WithdrawFailureView(
                message: flow.errorMessage ??
                    'We could not process this withdrawal. Your balances are unchanged.',
                onRetry: () => ref.read(withdrawFlowProvider.notifier).reset(),
                onDone: () {
                  ref.read(withdrawFlowProvider.notifier).reset();
                  context.pop();
                },
              ),
          },
        ),
      ),
    );
  }
}

class _WithdrawFormPage extends ConsumerStatefulWidget {
  const _WithdrawFormPage({
    required this.amount,
    required this.destination,
    required this.flow,
    required this.limits,
    required this.onSubmitUsdt,
    required this.onProceedInr,
  });

  final TextEditingController amount;
  final TextEditingController destination;
  final WithdrawFlowState flow;
  final ({double available, double feeRate}) limits;
  final VoidCallback onSubmitUsdt;
  final VoidCallback onProceedInr;

  @override
  ConsumerState<_WithdrawFormPage> createState() => _WithdrawFormPageState();
}

class _WithdrawFormPageState extends ConsumerState<_WithdrawFormPage> {
  @override
  void initState() {
    super.initState();
    widget.amount.addListener(_onAmountChanged);
  }

  @override
  void dispose() {
    widget.amount.removeListener(_onAmountChanged);
    super.dispose();
  }

  void _onAmountChanged() => setState(() {});

  void _setMaxAmount(bool isUsdt, double available) {
    if (isUsdt) {
      widget.amount.text = available.toStringAsFixed(2);
    } else {
      widget.amount.text = (available * 83.5).round().toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    final flow = widget.flow;
    final limits = widget.limits;
    final amount = widget.amount;
    final destination = widget.destination;
    final isUsdt = flow.isUsdt;
    final parsed = double.tryParse(amount.text.trim()) ?? 0;
    final amountError = isUsdt
        ? null
        : withdrawAmountValidationError(
            amount: parsed,
            isUsdt: false,
            availableUsdt: limits.available,
          );

    if (isUsdt) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: WithdrawPageHeader(
                          title: 'Send USDT',
                          subtitle: 'Enter amount and TRC20 address · OTP verify · Admin approval before payout.',
                        ),
                      ),
                      const SizedBox(width: 10),
                      WithdrawMethodPill(
                        method: flow.method,
                        onChanged: (m) {
                          ref.read(withdrawFlowProvider.notifier).setMethod(m);
                          setState(() {});
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  WithdrawDestinationField(controller: destination, isUsdt: true),
                  const SizedBox(height: 20),
                  const WithdrawNetworkField(isUsdt: true),
                  const SizedBox(height: 20),
                  WithdrawAmountField(
                    controller: amount,
                    available: limits.available,
                    isUsdt: true,
                    onMax: () => _setMaxAmount(true, limits.available),
                  ),
                  const SizedBox(height: 24),
                  const WithdrawFormNotices(isUsdt: true),
                ],
              ),
            ),
          ),
          WithdrawSubmitBar(
            amount: parsed,
            feeRate: limits.feeRate,
            isUsdt: true,
            submitting: flow.submitting,
            onSubmit: widget.onSubmitUsdt,
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: WithdrawPageHeader(
                        title: 'Withdraw INR',
                        subtitle: 'Amount → payout method → details → email OTP → admin approval.',
                      ),
                    ),
                    const SizedBox(width: 10),
                    WithdrawMethodPill(
                      method: flow.method,
                      onChanged: (m) {
                        ref.read(withdrawFlowProvider.notifier).setMethod(m);
                        setState(() {});
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const WithdrawInrStepIndicator(step: 0),
                const SizedBox(height: 24),
                WithdrawAmountField(
                  controller: amount,
                  available: limits.available,
                  isUsdt: false,
                  errorText: amountError,
                  onMax: () => _setMaxAmount(false, limits.available),
                ),
                const SizedBox(height: 16),
                WithdrawInrQuickAmounts(
                  onPick: (v) {
                    amount.text = v.round().toString();
                    setState(() {});
                  },
                ),
                const SizedBox(height: 24),
                const WithdrawFormNotices(isUsdt: false),
              ],
            ),
          ),
        ),
        WithdrawInrContinueBar(
          amount: parsed,
          availableUsdt: limits.available,
          onContinue: widget.onProceedInr,
        ),
      ],
    );
  }
}

class _WithdrawInrPayoutSelectPage extends StatelessWidget {
  const _WithdrawInrPayoutSelectPage({
    required this.flow,
    required this.onSelect,
  });

  final WithdrawFlowState flow;
  final ValueChanged<InrPayoutMethod> onSelect;

  @override
  Widget build(BuildContext context) {
    final amount = flow.amount ?? 0;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          WithdrawInrPayoutSelectHeader(amount: amount),
          const SizedBox(height: 24),
          WithdrawInrPayoutSection(onSelect: onSelect),
        ],
      ),
    );
  }
}

class _WithdrawInrDetailsPage extends StatefulWidget {
  const _WithdrawInrDetailsPage({
    required this.flow,
    required this.accountHolder,
    required this.accountNumber,
    required this.ifsc,
    required this.upiId,
    required this.qorixUserId,
    required this.onChangeMethod,
    required this.onSubmit,
  });

  final WithdrawFlowState flow;
  final TextEditingController accountHolder;
  final TextEditingController accountNumber;
  final TextEditingController ifsc;
  final TextEditingController upiId;
  final TextEditingController qorixUserId;
  final VoidCallback onChangeMethod;
  final VoidCallback onSubmit;

  @override
  State<_WithdrawInrDetailsPage> createState() => _WithdrawInrDetailsPageState();
}

class _WithdrawInrDetailsPageState extends State<_WithdrawInrDetailsPage> {
  @override
  void initState() {
    super.initState();
    for (final c in [
      widget.accountHolder,
      widget.accountNumber,
      widget.ifsc,
      widget.upiId,
      widget.qorixUserId,
    ]) {
      c.addListener(_onFieldChanged);
    }
  }

  @override
  void dispose() {
    for (final c in [
      widget.accountHolder,
      widget.accountNumber,
      widget.ifsc,
      widget.upiId,
      widget.qorixUserId,
    ]) {
      c.removeListener(_onFieldChanged);
    }
    super.dispose();
  }

  void _onFieldChanged() => setState(() {});

  bool get _canSubmit {
    final payout = widget.flow.inrPayout;
    if (payout == null || widget.flow.submitting) return false;
    return switch (payout) {
      InrPayoutMethod.bank =>
        widget.accountHolder.text.trim().length >= 2 &&
            widget.accountNumber.text.trim().length >= 6 &&
            widget.ifsc.text.trim().length >= 8,
      InrPayoutMethod.upi =>
        widget.upiId.text.trim().contains('@') && widget.upiId.text.trim().length >= 5,
      InrPayoutMethod.qorixUser => widget.qorixUserId.text.trim().length >= 3,
    };
  }

  @override
  Widget build(BuildContext context) {
    final flow = widget.flow;
    final payout = flow.inrPayout;
    if (payout == null) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                WithdrawInrDetailsHeader(amount: flow.amount ?? 0, payout: payout),
                const SizedBox(height: 20),
                WithdrawInrSelectedMethodCard(payout: payout, onChange: widget.onChangeMethod),
                const SizedBox(height: 24),
                switch (payout) {
                  InrPayoutMethod.bank => WithdrawInrBankForm(
                      accountHolder: widget.accountHolder,
                      accountNumber: widget.accountNumber,
                      ifsc: widget.ifsc,
                    ),
                  InrPayoutMethod.upi => WithdrawInrUpiForm(upiId: widget.upiId),
                  InrPayoutMethod.qorixUser => WithdrawInrQorixUserForm(userId: widget.qorixUserId),
                },
                const SizedBox(height: 20),
                WithdrawInrDetailsHighlights(payout: payout),
              ],
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, 14 + MediaQuery.paddingOf(context).bottom),
          child: AuthPrimaryButton(
            label: flow.submitting
                ? 'Sending OTP…'
                : payout == InrPayoutMethod.qorixUser
                    ? 'Continue · verify with OTP'
                    : 'Continue · verify with OTP',
            loading: flow.submitting,
            onPressed: _canSubmit ? widget.onSubmit : null,
          ),
        ),
      ],
    );
  }
}

class _WithdrawOtpPage extends StatelessWidget {
  const _WithdrawOtpPage({
    required this.flow,
    required this.feeRate,
    required this.otpKey,
    required this.onCompleted,
    required this.onOtpChanged,
  });

  final WithdrawFlowState flow;
  final double feeRate;
  final GlobalKey<AuthOtpInputState> otpKey;
  final ValueChanged<String> onCompleted;
  final ValueChanged<String> onOtpChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          WithdrawPageHeader(
            title: flow.isUsdt ? 'Verify Payout' : 'Verify Withdrawal',
            subtitle: 'Enter the 6-digit code sent to your registered email.',
          ),
          const SizedBox(height: 22),
          WithdrawOtpSummaryCard(flow: flow, feeRate: feeRate),
          const SizedBox(height: 20),
          WithdrawOtpVerifyBlock(
            otpKey: otpKey,
            flow: flow,
            onChanged: onOtpChanged,
            onCompleted: onCompleted,
          ),
          const SizedBox(height: 24),
          WithdrawOtpNoteSection(isUsdt: flow.isUsdt),
        ],
      ),
    );
  }
}
