import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/p2p_demo.dart';

class P2pUserCenterScreen extends StatelessWidget {
  const P2pUserCenterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: BackButton(onPressed: () => safePop(context), color: Colors.white),
        title: const Text('P2P User Center', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _Section(
            title: 'Payment Methods',
            action: '+ Add',
            onAction: () {},
            child: Column(
              children: P2pDemo.userPaymentMethods.map((pm) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF12171C),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: pm.isDefault ? AppColors.authGreen.withValues(alpha: 0.4) : Colors.white.withValues(alpha: 0.08)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: AppColors.authGreen.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(4)),
                        child: Text(pm.method, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.authGreen)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(pm.label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                            Text(pm.accountValue, style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.45))),
                          ],
                        ),
                      ),
                      if (pm.isDefault) Text('Default', style: TextStyle(fontSize: 10, color: AppColors.authGreen.withValues(alpha: 0.8))),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 20),
          _Section(
            title: 'Merchant Stats',
            child: Row(
              children: [
                _StatBox(label: '30d Orders', value: '24'),
                const SizedBox(width: 10),
                _StatBox(label: 'Completion', value: '100%'),
                const SizedBox(width: 10),
                _StatBox(label: 'Avg Release', value: '4 min'),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _Section(
            title: 'Settings',
            child: Column(
              children: [
                _SettingsTile(icon: Icons.notifications_none_rounded, label: 'Order Notifications'),
                _SettingsTile(icon: Icons.shield_outlined, label: 'P2P Security Guide'),
                _SettingsTile(icon: Icons.help_outline_rounded, label: 'Help & Support'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child, this.action, this.onAction});
  final String title;
  final Widget child;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white.withValues(alpha: 0.85))),
            const Spacer(),
            if (action != null)
              GestureDetector(
                onTap: onAction,
                child: Text(action!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.authGreen)),
              ),
          ],
        ),
        const SizedBox(height: 10),
        child,
      ],
    );
  }
}

class _StatBox extends StatelessWidget {
  const _StatBox({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: const Color(0xFF12171C),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: Column(
          children: [
            Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
            Text(label, style: TextStyle(fontSize: 9, color: Colors.white.withValues(alpha: 0.4))),
          ],
        ),
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.white.withValues(alpha: 0.5)),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontWeight: FontWeight.w600))),
          Icon(Icons.chevron_right_rounded, size: 18, color: Colors.white.withValues(alpha: 0.25)),
        ],
      ),
    );
  }
}
