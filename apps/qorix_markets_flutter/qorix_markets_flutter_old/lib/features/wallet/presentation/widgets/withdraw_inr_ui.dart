import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/features/wallet/application/inr_payout_methods_provider.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/inr_payout_method.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_demo.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_inr_options.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/widgets/deposit_ui.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/widgets/withdraw_ui.dart';

/// Payout method list — Bank · UPI · Qorix User.
class WithdrawInrPayoutSection extends StatelessWidget {
  const WithdrawInrPayoutSection({required this.onSelect, super.key});

  final ValueChanged<InrPayoutMethod> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const WithdrawFormSectionLabel('Payout Method'),
        const SizedBox(height: 10),
        ...InrPayoutOption.list.map(
          (option) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: DepositListTile(
              icon: option.icon,
              title: option.title,
              subtitle: option.subtitle,
              onTap: () => onSelect(option.id),
            ),
          ),
        ),
        const SizedBox(height: 8),
        const WithdrawInrComplianceFooter(),
      ],
    );
  }
}

class WithdrawInrStepIndicator extends StatelessWidget {
  const WithdrawInrStepIndicator({required this.step, super.key});

  final int step;

  @override
  Widget build(BuildContext context) {
    const labels = ['Amount', 'Method', 'Details', 'Verify'];
    return Row(
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          if (i > 0)
            Expanded(
              child: Container(
                height: 2,
                margin: const EdgeInsets.only(bottom: 14),
                color: i < step ? AppColors.authGreen.withValues(alpha: 0.55) : AppColors.authInputBorder,
              ),
            ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: i <= step ? AppColors.authGreen.withValues(alpha: 0.16) : AppColors.authInputBg,
                  border: Border.all(
                    color: i <= step ? AppColors.authGreen.withValues(alpha: 0.55) : AppColors.authInputBorder,
                  ),
                ),
                child: Text(
                  '${i + 1}',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: i <= step ? AppColors.authGreen : AppColors.authMuted.withValues(alpha: 0.55),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                labels[i],
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w600,
                  color: i <= step ? AppColors.authGreen.withValues(alpha: 0.9) : AppColors.authMuted.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class WithdrawInrAmountSummaryChip extends StatelessWidget {
  const WithdrawInrAmountSummaryChip({required this.amount, super.key});

  final double amount;

  @override
  Widget build(BuildContext context) {
    final formatted = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0).format(amount);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.authGreen.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.22)),
      ),
      child: Row(
        children: [
          Icon(Icons.payments_outlined, size: 16, color: AppColors.authGreen.withValues(alpha: 0.9)),
          const SizedBox(width: 8),
          Text('Withdrawing', style: TextStyle(fontSize: 12, color: AppColors.authMuted.withValues(alpha: 0.8))),
          const Spacer(),
          Text(formatted, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.authGreen)),
        ],
      ),
    );
  }
}

class WithdrawInrQuickAmounts extends StatelessWidget {
  const WithdrawInrQuickAmounts({required this.onPick, super.key});

  final ValueChanged<double> onPick;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: WithdrawDemo.inrQuickAmounts.map((amount) {
        final label = NumberFormat.compactCurrency(locale: 'en_IN', symbol: '₹', decimalDigits: 0).format(amount);
        return Material(
          color: AppColors.authInputBg,
          borderRadius: BorderRadius.circular(999),
          child: InkWell(
            onTap: () {
              HapticFeedback.selectionClick();
              onPick(amount);
            },
            borderRadius: BorderRadius.circular(999),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.authInputBorder),
              ),
              child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white.withValues(alpha: 0.88))),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class WithdrawInrPayoutSelectHeader extends StatelessWidget {
  const WithdrawInrPayoutSelectHeader({required this.amount, super.key});

  final double amount;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const WithdrawInrStepIndicator(step: 1),
        const SizedBox(height: 20),
        const Text(
          'Choose payout method',
          style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.4),
        ),
        const SizedBox(height: 8),
        Text(
          'Select where you want to receive your INR withdrawal.',
          style: TextStyle(fontSize: 13, height: 1.4, color: AppColors.authMuted.withValues(alpha: 0.85)),
        ),
        const SizedBox(height: 16),
        WithdrawInrAmountSummaryChip(amount: amount),
      ],
    );
  }
}

class WithdrawInrComplianceFooter extends StatelessWidget {
  const WithdrawInrComplianceFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.75)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.shield_outlined, size: 16, color: AppColors.authGreen.withValues(alpha: 0.85)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'All withdrawals reviewed by compliance · 2FA verified · Anti-money-laundering checks',
              style: TextStyle(
                fontSize: 10.5,
                height: 1.45,
                color: AppColors.authMuted.withValues(alpha: 0.78),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class WithdrawInrDetailsHeader extends StatelessWidget {
  const WithdrawInrDetailsHeader({required this.amount, required this.payout, super.key});

  final double amount;
  final InrPayoutMethod payout;

  @override
  Widget build(BuildContext context) {
    final formatted = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2).format(amount);
    final subtitle = switch (payout) {
      InrPayoutMethod.bank => '$formatted · enter bank account details',
      InrPayoutMethod.upi => '$formatted · enter your UPI ID',
      InrPayoutMethod.qorixUser => '$formatted · enter recipient referral code',
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const WithdrawInrStepIndicator(step: 2),
        const SizedBox(height: 20),
        const Text(
          'Payout destination',
          style: TextStyle(
            color: Colors.white,
            fontSize: 26,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            height: 1.15,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          style: TextStyle(
            fontSize: 13,
            height: 1.4,
            color: AppColors.authMuted.withValues(alpha: 0.85),
          ),
        ),
      ],
    );
  }
}

class WithdrawInrSelectedMethodCard extends StatelessWidget {
  const WithdrawInrSelectedMethodCard({
    required this.payout,
    required this.onChange,
    super.key,
  });

  final InrPayoutMethod payout;
  final VoidCallback onChange;

  @override
  Widget build(BuildContext context) {
    final option = InrPayoutOption.byId(payout);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(
        color: AppColors.authGreen.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.45)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.authGreen.withValues(alpha: 0.14),
              border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
            ),
            child: Icon(option.icon, color: AppColors.authGreen, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  option.title,
                  style: const TextStyle(
                    color: AppColors.authGreen,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  option.subtitle,
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.authMuted.withValues(alpha: 0.75),
                  ),
                ),
              ],
            ),
          ),
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                HapticFeedback.selectionClick();
                onChange();
              },
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Text(
                  'Change',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: AppColors.authGreen.withValues(alpha: 0.95),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class WithdrawInrDetailsHighlights extends StatelessWidget {
  const WithdrawInrDetailsHighlights({required this.payout, super.key});

  final InrPayoutMethod payout;

  @override
  Widget build(BuildContext context) {
    final items = switch (payout) {
      InrPayoutMethod.qorixUser => const [
          _HighlightItem(Icons.bolt_rounded, 'Instant'),
          _HighlightItem(Icons.savings_outlined, 'Zero fee'),
          _HighlightItem(Icons.lock_outline_rounded, 'Final'),
        ],
      InrPayoutMethod.upi => const [
          _HighlightItem(Icons.schedule_rounded, 'Within 24h'),
          _HighlightItem(Icons.verified_outlined, 'Verified UPI'),
          _HighlightItem(Icons.shield_outlined, 'Encrypted'),
        ],
      InrPayoutMethod.bank => const [
          _HighlightItem(Icons.schedule_rounded, 'Within 24h'),
          _HighlightItem(Icons.account_balance_outlined, 'IMPS / NEFT'),
          _HighlightItem(Icons.shield_outlined, 'Encrypted'),
        ],
    };

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: items.map((item) => _HighlightChip(item: item)).toList(),
    );
  }
}

class _HighlightItem {
  const _HighlightItem(this.icon, this.label);

  final IconData icon;
  final String label;
}

class _HighlightChip extends StatelessWidget {
  const _HighlightChip({required this.item});

  final _HighlightItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.authGreen.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.22)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(item.icon, size: 14, color: AppColors.authGreen.withValues(alpha: 0.92)),
          const SizedBox(width: 6),
          Text(
            item.label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Colors.white.withValues(alpha: 0.88),
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

class WithdrawInrBankForm extends ConsumerStatefulWidget {
  const WithdrawInrBankForm({
    required this.accountHolder,
    required this.accountNumber,
    required this.ifsc,
    super.key,
  });

  final TextEditingController accountHolder;
  final TextEditingController accountNumber;
  final TextEditingController ifsc;

  @override
  ConsumerState<WithdrawInrBankForm> createState() => _WithdrawInrBankFormState();
}

class _WithdrawInrBankFormState extends ConsumerState<WithdrawInrBankForm> {
  int? _selectedMethodId;
  bool _useNewAccount = false;

  void _autoSelectIfNeeded(List<InrPayoutMethodEntity> banks) {
    if (_selectedMethodId != null || _useNewAccount || banks.isEmpty) return;
    InrPayoutMethodEntity? pick;
    for (final bank in banks) {
      if (bank.isDefault) {
        pick = bank;
        break;
      }
    }
    _selectSaved(pick ?? banks.first);
  }

  void _selectSaved(InrPayoutMethodEntity method) {
    setState(() {
      _selectedMethodId = method.id;
      _useNewAccount = false;
      widget.accountHolder.text = method.accountName;
      widget.accountNumber.text = method.accountValue;
      widget.ifsc.text = method.ifsc ?? '';
    });
    HapticFeedback.selectionClick();
  }

  void _useNew() {
    setState(() {
      _selectedMethodId = null;
      _useNewAccount = true;
      widget.accountHolder.clear();
      widget.accountNumber.clear();
      widget.ifsc.clear();
    });
    HapticFeedback.selectionClick();
  }

  @override
  Widget build(BuildContext context) {
    final savedBanks = ref.watch(inrPayoutMethodsByTypeProvider(InrPayoutMethod.bank));
    ref.listen(inrPayoutMethodsByTypeProvider(InrPayoutMethod.bank), (prev, next) {
      _autoSelectIfNeeded(next);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _autoSelectIfNeeded(savedBanks));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const WithdrawFormSectionLabel('Select bank account'),
        const SizedBox(height: 10),
        ...savedBanks.map((bank) {
          final selected = _selectedMethodId == bank.id && !_useNewAccount;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Material(
              color: selected ? AppColors.authGreen.withValues(alpha: 0.08) : AppColors.authInputBg,
              borderRadius: BorderRadius.circular(14),
              child: InkWell(
                onTap: () => _selectSaved(bank),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: selected ? AppColors.authGreen.withValues(alpha: 0.45) : AppColors.authInputBorder,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.account_balance_outlined, color: selected ? AppColors.authGreen : AppColors.authMuted.withValues(alpha: 0.75)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              bank.bankName ?? bank.label,
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: selected ? AppColors.authGreen : Colors.white),
                            ),
                            const SizedBox(height: 2),
                            Text(bank.displaySubtitle, style: TextStyle(fontSize: 11, color: AppColors.authMuted.withValues(alpha: 0.75))),
                          ],
                        ),
                      ),
                      if (selected) Icon(Icons.check_circle_rounded, size: 18, color: AppColors.authGreen.withValues(alpha: 0.95)),
                    ],
                  ),
                ),
              ),
            ),
          );
        }),
        Material(
          color: _useNewAccount ? AppColors.authGreen.withValues(alpha: 0.08) : AppColors.authInputBg,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            onTap: _useNew,
            borderRadius: BorderRadius.circular(14),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: _useNewAccount ? AppColors.authGreen.withValues(alpha: 0.45) : AppColors.authInputBorder,
                ),
              ),
              child: Row(
                children: [
                  Icon(Icons.add_circle_outline_rounded, color: _useNewAccount ? AppColors.authGreen : AppColors.authMuted.withValues(alpha: 0.75)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Add new bank account',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: _useNewAccount ? AppColors.authGreen : Colors.white),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (_useNewAccount || _selectedMethodId == null) ...[
          const SizedBox(height: 20),
          const WithdrawFormSectionLabel('Bank account details'),
          const SizedBox(height: 12),
          _InrFieldLabel('Account Holder Name'),
          const SizedBox(height: 8),
          AuthInputField(
            controller: widget.accountHolder,
            hint: 'As per bank records',
            icon: Icons.person_outline_rounded,
          ),
          const SizedBox(height: 16),
          _InrFieldLabel('Account Number'),
          const SizedBox(height: 8),
          AuthInputField(
            controller: widget.accountNumber,
            hint: '1234567890',
            icon: Icons.numbers_rounded,
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 16),
          _InrFieldLabel('IFSC Code'),
          const SizedBox(height: 8),
          AuthInputField(
            controller: widget.ifsc,
            hint: 'HDFC0001234',
            icon: Icons.account_balance_outlined,
          ),
        ],
      ],
    );
  }
}

class WithdrawInrUpiForm extends ConsumerStatefulWidget {
  const WithdrawInrUpiForm({required this.upiId, super.key});

  final TextEditingController upiId;

  @override
  ConsumerState<WithdrawInrUpiForm> createState() => _WithdrawInrUpiFormState();
}

class _WithdrawInrUpiFormState extends ConsumerState<WithdrawInrUpiForm> {
  int? _selectedMethodId;
  bool _useNewUpi = false;

  void _autoSelectIfNeeded(List<InrPayoutMethodEntity> methods) {
    if (_selectedMethodId != null || _useNewUpi || methods.isEmpty) return;
    InrPayoutMethodEntity? pick;
    for (final method in methods) {
      if (method.isDefault) {
        pick = method;
        break;
      }
    }
    _selectSaved(pick ?? methods.first);
  }

  void _selectSaved(InrPayoutMethodEntity method) {
    setState(() {
      _selectedMethodId = method.id;
      _useNewUpi = false;
      widget.upiId.text = method.accountValue;
    });
    HapticFeedback.selectionClick();
  }

  void _useNew() {
    setState(() {
      _selectedMethodId = null;
      _useNewUpi = true;
      widget.upiId.clear();
    });
    HapticFeedback.selectionClick();
  }

  @override
  Widget build(BuildContext context) {
    final savedUpi = ref.watch(inrPayoutMethodsByTypeProvider(InrPayoutMethod.upi));
    ref.listen(inrPayoutMethodsByTypeProvider(InrPayoutMethod.upi), (prev, next) {
      _autoSelectIfNeeded(next);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _autoSelectIfNeeded(savedUpi));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (savedUpi.isNotEmpty) ...[
          const WithdrawFormSectionLabel('Select UPI ID'),
          const SizedBox(height: 10),
          ...savedUpi.map((method) {
            final selected = _selectedMethodId == method.id && !_useNewUpi;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Material(
                color: selected ? AppColors.authGreen.withValues(alpha: 0.08) : AppColors.authInputBg,
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  onTap: () => _selectSaved(method),
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: selected ? AppColors.authGreen.withValues(alpha: 0.45) : AppColors.authInputBorder,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.bolt_rounded, color: selected ? AppColors.authGreen : AppColors.authMuted.withValues(alpha: 0.75)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                method.label.isNotEmpty ? method.label : method.accountValue,
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: selected ? AppColors.authGreen : Colors.white),
                              ),
                              if (method.label.isNotEmpty)
                                Text(method.accountValue, style: TextStyle(fontSize: 11, color: AppColors.authMuted.withValues(alpha: 0.75))),
                            ],
                          ),
                        ),
                        if (selected) Icon(Icons.check_circle_rounded, size: 18, color: AppColors.authGreen.withValues(alpha: 0.95)),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }),
          Material(
            color: _useNewUpi ? AppColors.authGreen.withValues(alpha: 0.08) : AppColors.authInputBg,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              onTap: _useNew,
              borderRadius: BorderRadius.circular(14),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: _useNewUpi ? AppColors.authGreen.withValues(alpha: 0.45) : AppColors.authInputBorder,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(Icons.add_circle_outline_rounded, color: _useNewUpi ? AppColors.authGreen : AppColors.authMuted.withValues(alpha: 0.75)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Use different UPI ID',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: _useNewUpi ? AppColors.authGreen : Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],
        if (savedUpi.isEmpty || _useNewUpi || _selectedMethodId == null) ...[
          const WithdrawFormSectionLabel('UPI details'),
          const SizedBox(height: 12),
          _InrFieldLabel('UPI ID'),
          const SizedBox(height: 8),
          AuthInputField(
            controller: widget.upiId,
            hint: 'yourname@bank',
            icon: Icons.alternate_email_rounded,
          ),
        ],
      ],
    );
  }
}

class WithdrawInrQorixUserForm extends StatelessWidget {
  const WithdrawInrQorixUserForm({required this.userId, super.key});

  final TextEditingController userId;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const WithdrawFormSectionLabel('Qorix user transfer'),
        const SizedBox(height: 12),
        _InrFieldLabel('Referral code'),
        const SizedBox(height: 8),
        AuthInputField(
          controller: userId,
          hint: 'QX-ABC123',
          icon: Icons.person_search_outlined,
        ),
      ],
    );
  }
}

class _InrFieldLabel extends StatelessWidget {
  const _InrFieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: AppColors.authMuted.withValues(alpha: 0.85),
      ),
    );
  }
}
