import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/data/models/broker_models.dart';
import 'package:qorix_markets_flutter/features/broker/application/broker_providers.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/services/api/broker_api_service.dart';
import 'package:qorix_markets_flutter/widgets/cinematic_async_content.dart';
import 'package:qorix_markets_flutter/widgets/desk_scroll.dart';

abstract final class _B {
  static const bg = Color(0xFF0A0E12);
  static const card = Color(0xFF12171C);
  static const border = Color(0xFF1E2630);
  static const green = AppColors.authGreen;
  static const blue = Color(0xFF387ED1);
}

class BrokerHubScreen extends ConsumerStatefulWidget {
  const BrokerHubScreen({super.key});

  @override
  ConsumerState<BrokerHubScreen> createState() => _BrokerHubScreenState();
}

class _BrokerHubScreenState extends ConsumerState<BrokerHubScreen> {
  bool _connecting = false;

  Future<void> _connectZerodha() async {
    setState(() => _connecting = true);
    try {
      final login = await ref.read(brokerApiServiceProvider).getZerodhaLoginUrl();
      final result = await FlutterWebAuth2.authenticate(
        url: login.url,
        callbackUrlScheme: 'qorixmarkets',
      );
      final uri = Uri.parse(result);
      final token = uri.queryParameters['request_token'];
      if (token == null || token.isEmpty) {
        throw StateError('No request token returned from Zerodha');
      }
      await ref.read(brokerStatusProvider.notifier).connectZerodha(token);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Zerodha connected successfully')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Connect failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusAsync = ref.watch(brokerStatusProvider);

    return Scaffold(
      backgroundColor: _B.bg,
      appBar: AppBar(
        backgroundColor: _B.bg,
        elevation: 0,
        title: const Text('Market Broker'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
      ),
      body: CinematicAsyncContent<BrokerStatusModel>(
        value: statusAsync,
        onRetry: () => ref.read(brokerStatusProvider.notifier).refresh(),
        builder: (status, {required isRefreshing}) {
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              _ModeCard(
                mode: status.mode,
                onChanged: (mode) => ref.read(brokerStatusProvider.notifier).setMode(mode),
                zerodhaConnected: status.zerodhaConnected,
              ),
              const SizedBox(height: AppSpacing.lg),
              _BrokerTile(
                title: 'Demo Trading',
                subtitle: '₹10L virtual balance · simulated orders · no real trades',
                icon: Icons.science_outlined,
                accent: _B.green,
                trailing: status.mode == BrokerTradingMode.demo
                    ? const _LiveChip(label: 'Active')
                    : TextButton(
                        onPressed: () =>
                            ref.read(brokerStatusProvider.notifier).setMode(BrokerTradingMode.demo),
                        child: const Text('Use demo'),
                      ),
                onOpen: () => context.push(RoutePaths.brokerTerminal),
              ),
              const SizedBox(height: AppSpacing.md),
              _BrokerTile(
                title: 'Zerodha (Live)',
                subtitle: status.zerodhaConnected
                    ? 'Connected · ${status.zerodhaUserName ?? status.zerodhaUserId ?? ''}'
                    : 'OAuth connect · read-only Phase 1 (no order placement)',
                icon: Icons.account_balance_outlined,
                accent: _B.blue,
                trailing: status.zerodhaConnected
                    ? TextButton(
                        onPressed: () async {
                          await ref.read(brokerStatusProvider.notifier).disconnectZerodha();
                        },
                        child: const Text('Disconnect'),
                      )
                    : FilledButton(
                        onPressed: _connecting ? null : _connectZerodha,
                        style: FilledButton.styleFrom(backgroundColor: _B.blue),
                        child: _connecting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Connect'),
                      ),
                onOpen: status.zerodhaConnected
                    ? () async {
                        if (status.mode != BrokerTradingMode.live) {
                          await ref
                              .read(brokerStatusProvider.notifier)
                              .setMode(BrokerTradingMode.live);
                        }
                        if (context.mounted) context.push(RoutePaths.brokerTerminal);
                      }
                    : null,
              ),
              const SizedBox(height: AppSpacing.xl),
              FilledButton.icon(
                onPressed: () => context.push(RoutePaths.brokerTerminal),
                icon: const Icon(Icons.candlestick_chart_outlined),
                label: const Text('Open trading terminal'),
                style: FilledButton.styleFrom(
                  backgroundColor: _B.green,
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.lg)),
                ),
              ),
              const NavScrollSpacer(),
            ],
          );
        },
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  const _ModeCard({
    required this.mode,
    required this.onChanged,
    required this.zerodhaConnected,
  });

  final BrokerTradingMode mode;
  final ValueChanged<BrokerTradingMode> onChanged;
  final bool zerodhaConnected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: _B.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: _B.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Trading mode',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 4),
          Text(
            mode == BrokerTradingMode.demo
                ? 'Demo — virtual portfolio, same UI as live'
                : 'Live — connected Zerodha account (read-only)',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 13),
          ),
          const SizedBox(height: AppSpacing.md),
          SegmentedButton<BrokerTradingMode>(
            segments: const [
              ButtonSegment(value: BrokerTradingMode.demo, label: Text('Demo')),
              ButtonSegment(value: BrokerTradingMode.live, label: Text('Live')),
            ],
            selected: {mode},
            onSelectionChanged: (s) {
              final next = s.first;
              if (next == BrokerTradingMode.live && !zerodhaConnected) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Connect Zerodha before switching to live mode')),
                );
                return;
              }
              onChanged(next);
            },
          ),
        ],
      ),
    );
  }
}

class _BrokerTile extends StatelessWidget {
  const _BrokerTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.accent,
    required this.trailing,
    this.onOpen,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color accent;
  final Widget trailing;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _B.card,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        onTap: onOpen,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: accent.withValues(alpha: 0.25)),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(icon, color: accent),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 12),
                    ),
                  ],
                ),
              ),
              trailing,
            ],
          ),
        ),
      ),
    );
  }
}

class _LiveChip extends StatelessWidget {
  const _LiveChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: _B.green.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: _B.green.withValues(alpha: 0.4)),
      ),
      child: Text(label, style: const TextStyle(color: _B.green, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}
