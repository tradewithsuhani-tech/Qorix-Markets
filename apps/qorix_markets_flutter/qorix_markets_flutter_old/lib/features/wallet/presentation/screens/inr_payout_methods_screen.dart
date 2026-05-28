import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/features/wallet/application/inr_payout_methods_provider.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/inr_payout_method.dart';
import 'package:qorix_markets_flutter/features/wallet/presentation/data/withdraw_inr_options.dart';
import 'package:qorix_markets_flutter/widgets/app_background.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';
import 'package:qorix_markets_flutter/widgets/glass_card.dart';
import 'package:qorix_markets_flutter/widgets/skeleton_loader.dart';

class InrPayoutMethodsScreen extends ConsumerWidget {
  const InrPayoutMethodsScreen({super.key});

  Future<void> _refresh(WidgetRef ref) => ref.read(inrPayoutMethodsProvider.notifier).refresh();

  Future<void> _setDefault(BuildContext context, WidgetRef ref, int id) async {
    try {
      await ref.read(inrPayoutMethodsProvider.notifier).setDefaultMethod(id);
      if (context.mounted) {
        HapticFeedback.selectionClick();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Default payout method updated'), behavior: SnackBarBehavior.floating),
        );
      }
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorMessage.brief(e)), behavior: SnackBarBehavior.floating),
      );
    }
  }

  Future<void> _deleteMethod(BuildContext context, WidgetRef ref, int id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF12171C),
        title: const Text('Remove payout method?', style: TextStyle(color: Colors.white)),
        content: Text(
          'This method will no longer appear in withdraw INR.',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.72)),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove', style: TextStyle(color: Color(0xFFEF4444))),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(inrPayoutMethodsProvider.notifier).deleteMethod(id);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payout method removed'), behavior: SnackBarBehavior.floating),
        );
      }
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorMessage.brief(e)), behavior: SnackBarBehavior.floating),
      );
    }
  }

  Future<void> _showAddSheet(BuildContext context, WidgetRef ref) async {
    var type = InrPayoutMethod.bank;
    final label = TextEditingController();
    final accountName = TextEditingController();
    final accountValue = TextEditingController();
    final bankName = TextEditingController();
    final ifsc = TextEditingController();

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF12171C),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(ctx).bottom + 16),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Add payout method',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<InrPayoutMethod>(
                      initialValue: type,
                      dropdownColor: const Color(0xFF12171C),
                      style: const TextStyle(color: Colors.white),
                      decoration: _fieldDecoration('Type'),
                      items: InrPayoutOption.list
                          .map(
                            (o) => DropdownMenuItem(
                              value: o.id,
                              child: Text(o.title),
                            ),
                          )
                          .toList(),
                      onChanged: (v) => setSheetState(() => type = v ?? InrPayoutMethod.bank),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: label,
                      style: const TextStyle(color: Colors.white),
                      decoration: _fieldDecoration('Label (optional)'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: accountName,
                      style: const TextStyle(color: Colors.white),
                      decoration: _fieldDecoration(
                        type == InrPayoutMethod.qorixUser ? 'Recipient name' : 'Account holder name',
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: accountValue,
                      style: const TextStyle(color: Colors.white),
                      decoration: _fieldDecoration(switch (type) {
                        InrPayoutMethod.bank => 'Account number',
                        InrPayoutMethod.upi => 'UPI ID',
                        InrPayoutMethod.qorixUser => 'Qorix referral code',
                      },),
                    ),
                    if (type == InrPayoutMethod.bank) ...[
                      const SizedBox(height: 10),
                      TextField(
                        controller: bankName,
                        style: const TextStyle(color: Colors.white),
                        decoration: _fieldDecoration('Bank name'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: ifsc,
                        style: const TextStyle(color: Colors.white),
                        decoration: _fieldDecoration('IFSC code'),
                      ),
                    ],
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      style: FilledButton.styleFrom(backgroundColor: AppColors.authGreen),
                      child: const Text('Save'),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (saved != true) {
      label.dispose();
      accountName.dispose();
      accountValue.dispose();
      bankName.dispose();
      ifsc.dispose();
      return;
    }

    final body = <String, dynamic>{
      'type': type.apiValue,
      if (label.text.trim().isNotEmpty) 'label': label.text.trim(),
      'accountName': accountName.text.trim(),
      'accountValue': accountValue.text.trim(),
      if (type == InrPayoutMethod.bank) ...{
        'bankName': bankName.text.trim(),
        'ifsc': ifsc.text.trim().toUpperCase(),
      },
    };

    label.dispose();
    accountName.dispose();
    accountValue.dispose();
    bankName.dispose();
    ifsc.dispose();

    try {
      await ref.read(inrPayoutMethodsProvider.notifier).addMethod(body);
      if (context.mounted) {
        HapticFeedback.mediumImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payout method saved'), behavior: SnackBarBehavior.floating),
        );
      }
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ErrorMessage.brief(e)), behavior: SnackBarBehavior.floating),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final methodsAsync = ref.watch(inrPayoutMethodsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AppBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, size: 20),
            onPressed: () => context.pop(),
          ),
          title: const Text('INR payout methods'),
          actions: [
            TextButton(
              onPressed: () => _showAddSheet(context, ref),
              child: const Text('+ Add', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ],
        ),
        body: SafeArea(
          child: Responsive.constrained(
            context,
            CinematicAsyncContent<List<InrPayoutMethodEntity>>(
              value: methodsAsync,
              onRetry: () => _refresh(ref),
              loading: const _MethodsSkeleton(),
              builder: (methods, {required isRefreshing}) => RefreshIndicator(
                onRefresh: () => _refresh(ref),
                color: AppColors.authGreen,
                child: methods.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: Responsive.pagePadding(context),
                        children: [
                          const SizedBox(height: 48),
                          Icon(Icons.account_balance_wallet_outlined, size: 48, color: AppColors.muted(isDark)),
                          const SizedBox(height: 16),
                          Text(
                            'No payout methods yet',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.muted(isDark),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Add a bank account or UPI ID for faster INR withdrawals.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 13, color: AppColors.muted(isDark).withValues(alpha: 0.75)),
                          ),
                          const SizedBox(height: 24),
                          Center(
                            child: AuthPrimaryButton(
                              label: 'Add payout method',
                              onPressed: () => _showAddSheet(context, ref),
                            ),
                          ),
                        ],
                      )
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: Responsive.pagePadding(context),
                        itemCount: methods.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final method = methods[index];
                          return _MethodTile(
                            method: method,
                            onSetDefault: method.isDefault ? null : () => _setDefault(context, ref, method.id),
                            onDelete: () => _deleteMethod(context, ref, method.id),
                          );
                        },
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MethodTile extends StatelessWidget {
  const _MethodTile({
    required this.method,
    required this.onDelete,
    this.onSetDefault,
  });

  final InrPayoutMethodEntity method;
  final VoidCallback onDelete;
  final VoidCallback? onSetDefault;

  @override
  Widget build(BuildContext context) {
    final option = InrPayoutOption.byId(method.type);
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.authGreen.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(option.icon, color: AppColors.authGreen, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        method.label.isNotEmpty ? method.label : option.title,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                    ),
                    if (method.isDefault)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.authGreen.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'Default',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.authGreen),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  method.displaySubtitle,
                  style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.55)),
                ),
                const SizedBox(height: 2),
                Text(
                  option.title,
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.35)),
                ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            icon: Icon(Icons.more_vert_rounded, color: Colors.white.withValues(alpha: 0.45), size: 20),
            color: const Color(0xFF12171C),
            onSelected: (value) {
              if (value == 'default') {
                onSetDefault?.call();
              } else if (value == 'delete') {
                onDelete();
              }
            },
            itemBuilder: (ctx) => [
              if (onSetDefault != null)
                const PopupMenuItem(
                  value: 'default',
                  child: Text('Set as default', style: TextStyle(color: Colors.white)),
                ),
              const PopupMenuItem(
                value: 'delete',
                child: Text('Remove', style: TextStyle(color: Color(0xFFEF4444))),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MethodsSkeleton extends StatelessWidget {
  const _MethodsSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: Responsive.pagePadding(context),
      itemCount: 3,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, __) => const SkeletonBox(height: 72, borderRadius: 16),
    );
  }
}

InputDecoration _fieldDecoration(String label) {
  return InputDecoration(
    labelText: label,
    labelStyle: TextStyle(color: Colors.white.withValues(alpha: 0.55)),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: AppColors.authGreen),
    ),
  );
}
