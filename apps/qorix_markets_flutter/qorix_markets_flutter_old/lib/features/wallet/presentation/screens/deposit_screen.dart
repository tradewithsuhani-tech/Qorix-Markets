import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/features/dashboard/application/dashboard_providers.dart';
import 'package:qorix_markets_flutter/features/wallet/application/deposit_address_detail_provider.dart';
import 'package:qorix_markets_flutter/features/wallet/application/deposit_flow_provider.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/deposit_demo.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/widgets/deposit_ui.dart';

/// Add Funds — reference layout, Qorix auth-green theme (Crypto + INR).
class DepositScreen extends ConsumerStatefulWidget {
  const DepositScreen({super.key});

  @override
  ConsumerState<DepositScreen> createState() => _DepositScreenState();
}

class _DepositScreenState extends ConsumerState<DepositScreen> {
  final _amount = TextEditingController();
  final _utr = TextEditingController();

  @override
  void dispose() {
    _amount.dispose();
    _utr.dispose();
    super.dispose();
  }

  void _goBack() {
    final flow = ref.read(depositFlowProvider);
    switch (flow.phase) {
      case DepositFlowPhase.merchant:
        ref.read(depositFlowProvider.notifier).backToAmount();
      case DepositFlowPhase.qr:
        if (flow.mode == DepositMode.inr) {
          ref.read(depositFlowProvider.notifier).backToMerchant();
        } else {
          ref.read(depositFlowProvider.notifier).reset();
        }
      case DepositFlowPhase.verify:
        ref.read(depositFlowProvider.notifier).backToQr();
      case DepositFlowPhase.confirming:
        if (flow.mode == DepositMode.inr) {
          ref.read(depositFlowProvider.notifier).backToVerify();
        } else {
          ref.read(depositFlowProvider.notifier).reset();
        }
      case DepositFlowPhase.success:
        ref.read(depositFlowProvider.notifier).reset();
        if (context.canPop()) context.pop();
      case DepositFlowPhase.amount:
        if (context.canPop()) context.pop();
    }
  }

  double? get _parsedAmount => double.tryParse(_amount.text.trim());

  bool _validateAmount(DepositMode mode) {
    final value = _parsedAmount;
    final min = mode == DepositMode.crypto ? DepositDemo.cryptoMinUsdt : DepositDemo.inrMin;
    final unit = mode == DepositMode.crypto ? 'USDT' : 'INR';
    if (value == null || value < min) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Minimum ${min.toStringAsFixed(0)} $unit required'),
          backgroundColor: AppColors.authCardBg,
        ),
      );
      return false;
    }
    return true;
  }

  Future<void> _pickInr(InrPaymentMethod method) async {
    if (!_validateAmount(DepositMode.inr)) return;
    HapticFeedback.mediumImpact();
    try {
      await ref.read(depositFlowProvider.notifier).proceedWithInr(method, _parsedAmount!);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorMessage.brief(e)), backgroundColor: AppColors.authCardBg),
      );
    }
  }

  Future<void> _pickMerchant(String merchantId) async {
    HapticFeedback.mediumImpact();
    try {
      await ref.read(depositFlowProvider.notifier).selectMerchant(merchantId);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorMessage.brief(e)), backgroundColor: AppColors.authCardBg),
      );
    }
  }

  Future<void> _pickCrypto(CryptoAsset asset) async {
    if (!_validateAmount(DepositMode.crypto)) return;
    HapticFeedback.mediumImpact();
    try {
      await ref.read(depositFlowProvider.notifier).proceedWithCrypto(asset, _parsedAmount!);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorMessage.brief(e)), backgroundColor: AppColors.authCardBg),
      );
    }
  }

  void _goToVerify() {
    HapticFeedback.mediumImpact();
    ref.read(depositFlowProvider.notifier).proceedToVerify();
  }

  void _paymentSent() {
    final flow = ref.read(depositFlowProvider);
    if (flow.mode == DepositMode.inr) {
      _goToVerify();
    } else {
      _startConfirming();
    }
  }

  void _startConfirming() {
    HapticFeedback.mediumImpact();
    ref.read(depositFlowProvider.notifier).startConfirming();
  }

  Future<void> _submitPaymentProof() async {
    final flow = ref.read(depositFlowProvider);
    if (flow.mode == DepositMode.crypto) {
      _startConfirming();
      return;
    }

    final utr = _utr.text.trim();
    if (utr.length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Enter a valid UTR / transaction reference'),
          backgroundColor: AppColors.authCardBg,
        ),
      );
      return;
    }

    final merchant = DepositMerchants.resolve(flow.selectedMerchantId, flow.merchants);

    HapticFeedback.mediumImpact();
    try {
      await ref.read(depositFlowProvider.notifier).submitInrPayment(
            utr: utr,
            referenceCode: merchant.referenceCode,
          );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorMessage.brief(e)), backgroundColor: AppColors.authCardBg),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final flow = ref.watch(depositFlowProvider);
    final balance = ref.watch(dashboardProvider).maybeWhen(data: (s) => s.totalBalance, orElse: () => 4720.0);

    return Scaffold(
      backgroundColor: AppColors.authPageBg,
      resizeToAvoidBottomInset: true,
      body: AuthBackground(
        child: DepositPageScaffold(
          onBack: _goBack,
          child: switch (flow.phase) {
            DepositFlowPhase.amount => _AddFundsPage(
                balance: balance,
                amountController: _amount,
                mode: flow.mode,
                onModeChanged: ref.read(depositFlowProvider.notifier).setMode,
                onInrMethod: _pickInr,
                onCrypto: _pickCrypto,
              ),
            DepositFlowPhase.merchant => _MerchantPage(
                flow: flow,
                onSelectMerchant: _pickMerchant,
              ),
            DepositFlowPhase.qr => _PaymentPage(
                flow: flow,
                utrController: _utr,
                onSent: _paymentSent,
              ),
            DepositFlowPhase.verify => _VerifyPaymentPage(
                flow: flow,
                utrController: _utr,
                onSubmit: _submitPaymentProof,
              ),
            DepositFlowPhase.confirming => _ConfirmPage(flow: flow),
            DepositFlowPhase.success => _SuccessPage(
                flow: flow,
                onDone: () {
                  ref.read(depositFlowProvider.notifier).reset();
                  context.pop();
                },
                onWallet: () {
                  ref.read(depositFlowProvider.notifier).reset();
                  context.go(RoutePaths.wallet);
                },
              ),
          },
        ),
      ),
    );
  }
}

class _AddFundsPage extends StatelessWidget {
  const _AddFundsPage({
    required this.balance,
    required this.amountController,
    required this.mode,
    required this.onModeChanged,
    required this.onInrMethod,
    required this.onCrypto,
  });

  final double balance;
  final TextEditingController amountController;
  final DepositMode mode;
  final ValueChanged<DepositMode> onModeChanged;
  final ValueChanged<InrPaymentMethod> onInrMethod;
  final ValueChanged<CryptoAsset> onCrypto;

  @override
  Widget build(BuildContext context) {
    final isInr = mode == DepositMode.inr;
    final symbol = isInr ? '₹' : '\$';
    final quick = isInr ? DepositDemo.inrQuickAmounts : DepositDemo.cryptoQuickAmounts;
    final subtitle = isInr
        ? 'Funds are credited instantly via Razorpay secure gateway.'
        : 'Crypto deposits credited after on-chain confirmation.';
    final security = isInr
        ? 'Secured by Razorpay · HMAC-SHA256 verified · Anti-fraud protected'
        : 'On-chain verified · Multi-sig custody · Wrong network = lost funds';

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DepositPageHeader(subtitle: subtitle),
          const SizedBox(height: 22),
          DepositBalanceCard(balance: balance),
          const SizedBox(height: 22),
          Row(
            children: [
              const DepositSectionLabel('Deposit Amount'),
              const Spacer(),
              DepositCurrencyPill(mode: mode, onChanged: onModeChanged),
            ],
          ),
          const SizedBox(height: 12),
          DepositLargeAmountField(controller: amountController, symbol: symbol),
          const SizedBox(height: 12),
          DepositQuickRow(
            amounts: quick,
            prefix: symbol,
            onPick: (v) => amountController.text = v.toStringAsFixed(0),
          ),
          const SizedBox(height: 24),
          DepositSectionLabel(isInr ? 'Payment Method' : 'Crypto Currency'),
          const SizedBox(height: 10),
          if (isInr)
            ...DepositOptions.inrMethods.map(
              (m) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: DepositInrMethodTile(option: m, onTap: () => onInrMethod(m.id)),
              ),
            )
          else
            ...DepositOptions.cryptoAssets.map(
              (c) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: DepositCryptoTile(option: c, onTap: () => onCrypto(c.id)),
              ),
            ),
          const SizedBox(height: 16),
          DepositSecurityFooter(text: security),
        ],
      ),
    );
  }
}

class _MerchantPage extends StatelessWidget {
  const _MerchantPage({
    required this.flow,
    required this.onSelectMerchant,
  });

  final DepositFlowState flow;
  final ValueChanged<String> onSelectMerchant;

  @override
  Widget build(BuildContext context) {
    final amount = flow.amount ?? 0;
    final method = flow.inrMethod ?? InrPaymentMethod.upi;
    final methodLabel = DepositOptions.inr(method).title;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DepositMerchantHeader(amount: amount),
          const SizedBox(height: 8),
          Text(
            methodLabel,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: AppColors.authMuted.withValues(alpha: 0.75),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 18),
          const DepositEscrowBanner(),
          const SizedBox(height: 16),
          if (flow.merchantsLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(
                child: CircularProgressIndicator(color: AppColors.authGreen, strokeWidth: 2.5),
              ),
            )
          else if (flow.merchants.isEmpty)
            const DepositInfoNote(text: 'No merchants available for this amount. Try a different amount or method.')
          else
            ...flow.merchants.map(
              (m) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: DepositMerchantCard(
                  merchant: m,
                  onPay: () => onSelectMerchant(m.id),
                ),
              ),
            ),
          const SizedBox(height: 8),
          Text(
            'All merchants verified · 24/7 dispute support · 0% gateway fees',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 10.5,
              height: 1.45,
              color: AppColors.authMuted.withValues(alpha: 0.65),
            ),
          ),
        ],
      ),
    );
  }
}

class _PaymentPage extends ConsumerWidget {
  const _PaymentPage({
    required this.flow,
    required this.utrController,
    required this.onSent,
  });

  final DepositFlowState flow;
  final TextEditingController utrController;
  final VoidCallback onSent;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
      child: flow.mode == DepositMode.crypto
          ? _CryptoPaymentBody(flow: flow, onSent: onSent)
          : _InrPaymentBody(flow: flow, utrController: utrController, onSent: onSent),
    );
  }
}

class _CryptoPaymentBody extends ConsumerWidget {
  const _CryptoPaymentBody({required this.flow, required this.onSent});

  final DepositFlowState flow;
  final VoidCallback onSent;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asset = flow.cryptoAsset ?? CryptoAsset.usdt;
    final option = DepositOptions.crypto(asset);
    final amount = flow.amount ?? 0;
    final addressAsync = ref.watch(depositAddressDetailProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DepositPageHeader(
          subtitle: 'Your unique TRC20 USDT address — scan QR or copy below.',
        ),
        const SizedBox(height: 20),
        addressAsync.when(
          loading: () => const Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: CircularProgressIndicator(color: AppColors.authGreen, strokeWidth: 2.5),
            ),
          ),
          error: (_, __) => Column(
            children: [
              const DepositInfoNote(text: 'Unable to load wallet address.'),
              const SizedBox(height: 12),
              AuthPrimaryButton(
                label: 'Retry',
                onPressed: () => ref.read(depositAddressDetailProvider.notifier).refresh(),
              ),
            ],
          ),
          data: (addr) => Column(
            children: [
              Center(
                child: Column(
                  children: [
                    DepositQrBlock(data: addr.address, size: 168),
                    const SizedBox(height: 14),
                    Text(
                      'Send ${amount.toStringAsFixed(2)} ${addr.token}',
                      style: const TextStyle(
                        color: AppColors.authGreen,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${option.name} · ${addr.network}',
                      style: TextStyle(fontSize: 11, color: AppColors.authMuted.withValues(alpha: 0.8)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              DepositCopyRow(label: 'Wallet address', value: addr.address),
              const SizedBox(height: 8),
              DepositCopyRow(label: 'Network', value: addr.network),
              const SizedBox(height: 12),
              DepositInfoNote(
                text: 'Send only ${option.symbol} on the correct network. Wrong network may result in loss.',
              ),
              const SizedBox(height: 22),
              AuthPrimaryButton(label: "I've sent ${option.symbol}", onPressed: onSent),
            ],
          ),
        ),
      ],
    );
  }
}

class _InrPaymentBody extends StatelessWidget {
  const _InrPaymentBody({
    required this.flow,
    required this.utrController,
    required this.onSent,
  });

  final DepositFlowState flow;
  final TextEditingController utrController;
  final VoidCallback onSent;

  @override
  Widget build(BuildContext context) {
    final method = flow.inrMethod ?? InrPaymentMethod.upi;

    if (method == InrPaymentMethod.upi) {
      return _UpiPaymentBody(flow: flow, onSent: onSent);
    }

    return _BankTransferPaymentBody(flow: flow, onSent: onSent);
  }
}

class _UpiPaymentBody extends StatelessWidget {
  const _UpiPaymentBody({required this.flow, required this.onSent});

  final DepositFlowState flow;
  final VoidCallback onSent;

  @override
  Widget build(BuildContext context) {
    final amount = flow.amount ?? 0;
    final merchant = DepositMerchants.resolve(flow.selectedMerchantId, flow.merchants);
    final payLabel = "I've Paid ₹${NumberFormat('#,##,###').format(amount.toInt())}";

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        UpiPaymentHeader(amount: amount),
        const SizedBox(height: 18),
        UpiMerchantInfoCard(merchant: merchant),
        const SizedBox(height: 14),
        UpiScanQrSection(
          upiId: merchant.upiId,
          amount: amount,
          payeeName: merchant.accountHolder,
          note: merchant.referenceCode,
        ),
        const SizedBox(height: 18),
        const UpiOrDivider(),
        const SizedBox(height: 14),
        UpiDetailsCard(
          upiId: merchant.upiId,
          amount: amount,
          reference: merchant.referenceCode,
        ),
        const SizedBox(height: 14),
        UpiExactAmountWarning(amount: amount),
        const SizedBox(height: 18),
        const UpiHowItWorks(),
        const SizedBox(height: 20),
        AuthPrimaryButton(label: payLabel, onPressed: onSent),
        const SizedBox(height: 14),
        const UpiEscrowFooter(),
      ],
    );
  }
}

class _BankTransferPaymentBody extends StatelessWidget {
  const _BankTransferPaymentBody({required this.flow, required this.onSent});

  final DepositFlowState flow;
  final VoidCallback onSent;

  @override
  Widget build(BuildContext context) {
    final method = flow.inrMethod ?? InrPaymentMethod.impsNeft;
    final amount = flow.amount ?? 0;
    final merchant = DepositMerchants.resolve(flow.selectedMerchantId, flow.merchants);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        BankTransferPaymentHeader(amount: amount, method: method),
        const SizedBox(height: 18),
        BankTransferMerchantInfoCard(merchant: merchant),
        const SizedBox(height: 14),
        BankTransferBeneficiaryCard(merchant: merchant),
        const SizedBox(height: 14),
        BankTransferReferenceCard(reference: merchant.referenceCode),
        const SizedBox(height: 14),
        BankTransferExactAmountWarning(amount: amount),
        const SizedBox(height: 16),
        BankTransferInstructions(amount: amount, method: method),
        const SizedBox(height: 20),
        UpiConfirmPayButton(amount: amount, onPressed: onSent),
        const SizedBox(height: 14),
        const UpiEscrowFooter(),
      ],
    );
  }
}

class _VerifyPaymentPage extends StatefulWidget {
  const _VerifyPaymentPage({
    required this.flow,
    required this.utrController,
    required this.onSubmit,
  });

  final DepositFlowState flow;
  final TextEditingController utrController;
  final VoidCallback onSubmit;

  @override
  State<_VerifyPaymentPage> createState() => _VerifyPaymentPageState();
}

class _VerifyPaymentPageState extends State<_VerifyPaymentPage> {
  int _screenshots = 0;
  static const _maxScreenshots = 3;
  static const _minUtrLen = 8;

  bool get _canSubmit => widget.utrController.text.trim().length >= _minUtrLen;

  void _refresh() => setState(() {});

  void _addScreenshot() {
    if (_screenshots >= _maxScreenshots) return;
    HapticFeedback.lightImpact();
    setState(() => _screenshots++);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Screenshot $_screenshots added (demo)'),
        backgroundColor: AppColors.authCardBg,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final amount = widget.flow.amount ?? 0;
    final merchant = DepositMerchants.resolve(widget.flow.selectedMerchantId, widget.flow.merchants);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          VerifyPaymentHeader(amount: amount),
          const SizedBox(height: 18),
          VerifyAwaitingBanner(merchant: merchant),
          const SizedBox(height: 22),
          VerifyUtrField(controller: widget.utrController, onChanged: _refresh),
          const SizedBox(height: 22),
          VerifyScreenshotUpload(
            count: _screenshots,
            maxCount: _maxScreenshots,
            onAdd: _addScreenshot,
          ),
          const SizedBox(height: 18),
          const VerifyInfoBar(),
          const SizedBox(height: 22),
          VerifySubmitButton(
            enabled: _canSubmit && !widget.flow.submitting,
            loading: widget.flow.submitting,
            onPressed: _canSubmit && !widget.flow.submitting
                ? () {
                    HapticFeedback.mediumImpact();
                    widget.onSubmit();
                  }
                : null,
          ),
        ],
      ),
    );
  }
}

class _ConfirmPage extends StatelessWidget {
  const _ConfirmPage({required this.flow});

  final DepositFlowState flow;

  @override
  Widget build(BuildContext context) {
    final amount = flow.amount ?? 0;
    final isCrypto = flow.mode == DepositMode.crypto;
    final isUpi = flow.mode == DepositMode.inr && flow.inrMethod == InrPaymentMethod.upi;
    final detail = isCrypto
        ? 'Scanning blockchain for ${amount.toStringAsFixed(2)} USDT'
        : isUpi
            ? 'Matching UTR & verifying payment of ₹${amount.toStringAsFixed(0)}'
            : 'Matching payment of ₹${amount.toStringAsFixed(0)}';

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(
            width: 56,
            height: 56,
            child: CircularProgressIndicator(color: AppColors.authGreen, strokeWidth: 2.5),
          ),
          const SizedBox(height: 20),
          const Text(
            'Confirming deposit…',
            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            detail,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppColors.authMuted.withValues(alpha: 0.85), height: 1.4),
          ),
          const SizedBox(height: 20),
          DepositInfoNote(
            text: isCrypto
                ? 'On-chain confirmation usually takes 1–3 minutes.'
                : 'INR verification typically completes within 5–15 minutes.',
          ),
        ],
      ),
    );
  }
}

class _SuccessPage extends StatelessWidget {
  const _SuccessPage({
    required this.flow,
    required this.onDone,
    required this.onWallet,
  });

  final DepositFlowState flow;
  final VoidCallback onDone;
  final VoidCallback onWallet;

  static bool _isHighValue(double amount, {required bool isCrypto}) =>
      isCrypto ? amount >= 500 : amount >= 25000;

  List<DepositSuccessRow> _summaryRows() {
    final amount = flow.confirmedAmount ?? flow.amount ?? 0;
    final isCrypto = flow.mode == DepositMode.crypto;
    final submittedAt = flow.submittedAt ?? DateTime.now();
    final timeLabel = DateFormat('dd MMM yyyy · HH:mm:ss').format(submittedAt);

    if (isCrypto) {
      final asset = flow.cryptoAsset ?? CryptoAsset.usdt;
      final option = DepositOptions.crypto(asset);
      return [
        DepositSuccessRow(
          label: 'Amount',
          value: '${amount.toStringAsFixed(2)} ${option.symbol}',
          highlight: true,
        ),
        DepositSuccessRow(label: 'Network', value: option.network.split(' / ').first),
        DepositSuccessRow(label: 'Status', value: 'Confirming · On-chain', pending: true),
        DepositSuccessRow(label: 'Time', value: timeLabel),
      ];
    }

    final method = DepositOptions.inr(flow.inrMethod ?? InrPaymentMethod.upi);
    final merchant = flow.selectedMerchantId != null
        ? DepositMerchants.resolve(flow.selectedMerchantId, flow.merchants)
        : null;

    return [
      DepositSuccessRow(
        label: 'Amount',
        value: '₹${NumberFormat('#,##,###').format(amount.toInt())}',
        highlight: true,
      ),
      DepositSuccessRow(label: 'Method', value: method.title),
      if (merchant != null) DepositSuccessRow(label: 'Merchant', value: merchant.name),
      if (merchant != null) DepositSuccessRow(label: 'Reference', value: merchant.referenceCode),
      if (flow.depositReferenceId != null)
        DepositSuccessRow(label: 'Deposit ID', value: flow.depositReferenceId!),
      DepositSuccessRow(label: 'Status', value: 'Pending · Merchant Review', pending: true),
      DepositSuccessRow(label: 'Time', value: timeLabel),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final amount = flow.confirmedAmount ?? flow.amount ?? 0;
    final isCrypto = flow.mode == DepositMode.crypto;
    final isHighValue = _isHighValue(amount, isCrypto: isCrypto);

    return DepositSuccessStage(
      amount: amount,
      isCrypto: isCrypto,
      isHighValue: isHighValue,
      rows: _summaryRows(),
      onDone: onDone,
      onWallet: onWallet,
    );
  }
}
