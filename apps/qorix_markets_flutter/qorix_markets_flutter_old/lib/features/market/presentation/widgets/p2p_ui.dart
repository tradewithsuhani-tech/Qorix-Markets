import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/p2p_entities.dart';

abstract final class _P {
  static const surface = Color(0xFF12171C);
  static const chipBg = Color(0xFF1A2028);

  static Color get textMuted => AppDesk.textTertiary;
  static Color get textSecondary => AppDesk.textSecondary;
  static Color get outline => AppDesk.borderLine;

  static const green = AppColors.authGreen;
  static const sell = Color(0xFFFF6B8A);

  static final _inr = NumberFormat('#,##0.##', 'en_IN');
  static final _usdt = NumberFormat('#,##0.00');

  static String inr(double v) => '₹${_inr.format(v)}';
  static String usdt(double v) => '${_usdt.format(v)} USDT';
}

// ─── App bar ──────────────────────────────────────────────────────────────────

class P2pAppBar extends StatelessWidget {
  const P2pAppBar({
    required this.onBack,
    required this.onOrders,
    this.pendingOrders = 0,
    super.key,
  });

  final VoidCallback onBack;
  final VoidCallback onOrders;
  final int pendingOrders;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: IconButton(
              onPressed: onBack,
              icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Colors.white.withValues(alpha: 0.88)),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
            ),
          ),
          const Text(
            'P2P Market',
            style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.2),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                IconButton(
                  onPressed: onOrders,
                  icon: Icon(Icons.receipt_long_outlined, size: 22, color: Colors.white.withValues(alpha: 0.88)),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                ),
                if (pendingOrders > 0)
                  Positioned(
                    top: 6,
                    right: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(color: _P.green, borderRadius: BorderRadius.circular(8)),
                      child: Text(
                        pendingOrders > 9 ? '9+' : '$pendingOrders',
                        style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF0A0E12)),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Balance + Post Ad ────────────────────────────────────────────────────────

class P2pBalanceRow extends StatelessWidget {
  const P2pBalanceRow({
    required this.usdtBalance,
    required this.onRefresh,
    required this.onPostAd,
    super.key,
  });

  final double usdtBalance;
  final VoidCallback onRefresh;
  final VoidCallback onPostAd;

  @override
  Widget build(BuildContext context) {
    final bal = NumberFormat('#,##0.00').format(usdtBalance);

    return Row(
      children: [
        Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: _P.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _P.outline),
            ),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: _P.green.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.account_balance_wallet_outlined, size: 16, color: _P.green.withValues(alpha: 0.95)),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('BALANCE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 0.4, color: _P.textMuted)),
                    Text(
                      '$bal USDT',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white, fontFeatures: [FontFeature.tabularFigures()]),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        _CircleIconBtn(icon: Icons.refresh_rounded, onTap: onRefresh),
        const SizedBox(width: 8),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onPostAd,
            borderRadius: BorderRadius.circular(10),
            child: Ink(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              decoration: BoxDecoration(
                color: _P.green,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.add_rounded, size: 16, color: Color(0xFF0A0E12)),
                  SizedBox(width: 2),
                  Text('+ Post Ad', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF0A0E12))),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _CircleIconBtn extends StatelessWidget {
  const _CircleIconBtn({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: _P.outline),
          ),
          child: Icon(icon, size: 18, color: _P.textSecondary),
        ),
      ),
    );
  }
}

// ─── Quick links ──────────────────────────────────────────────────────────────

class P2pQuickLinks extends StatelessWidget {
  const P2pQuickLinks({
    required this.onOrders,
    required this.onUserCenter,
    super.key,
  });

  final VoidCallback onOrders;
  final VoidCallback onUserCenter;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _QuickBtn(icon: Icons.chat_bubble_outline_rounded, label: 'Chat', onTap: () {})),
        const SizedBox(width: 8),
        Expanded(child: _QuickBtn(icon: Icons.person_outline_rounded, label: 'User Center', onTap: onUserCenter)),
        const SizedBox(width: 8),
        Expanded(child: _QuickBtn(icon: Icons.receipt_long_outlined, label: 'Orders', showChevron: true, onTap: onOrders)),
        const SizedBox(width: 8),
        Expanded(child: _QuickBtn(icon: Icons.more_horiz_rounded, label: 'More', onTap: () {})),
      ],
    );
  }
}

class _QuickBtn extends StatelessWidget {
  const _QuickBtn({
    required this.icon,
    required this.label,
    required this.onTap,
    this.showChevron = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Ink(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: _P.outline),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 14, color: _P.textSecondary),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  label,
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _P.textSecondary),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (showChevron) ...[
                const SizedBox(width: 2),
                Icon(Icons.keyboard_arrow_down_rounded, size: 14, color: _P.textMuted),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Buy / Sell tabs ──────────────────────────────────────────────────────────

class P2pBuySellTabs extends StatelessWidget {
  const P2pBuySellTabs({required this.isBuy, required this.onChanged, super.key});

  final bool isBuy;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _BuySellTab(title: 'BUY USDT', subtitle: 'Find sellers', active: isBuy, color: _P.green, onTap: () => onChanged(true))),
        Expanded(child: _BuySellTab(title: 'SELL USDT', subtitle: 'Find buyers', active: !isBuy, color: _P.sell, onTap: () => onChanged(false))),
      ],
    );
  }
}

class _BuySellTab extends StatelessWidget {
  const _BuySellTab({
    required this.title,
    required this.subtitle,
    required this.active,
    required this.color,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool active;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.2,
                color: active ? color : _P.textMuted,
              ),
            ),
            const SizedBox(height: 2),
            Text(subtitle, style: TextStyle(fontSize: 10, color: _P.textMuted)),
            const SizedBox(height: 8),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              height: 2.5,
              decoration: BoxDecoration(
                color: active ? color : Colors.transparent,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Payment filters ────────────────────────────────────────────────────────────

class P2pPaymentFilters extends StatelessWidget {
  const P2pPaymentFilters({
    required this.filters,
    required this.selected,
    required this.onSelected,
    required this.onFilterTap,
    super.key,
  });

  final List<String> filters;
  final String selected;
  final ValueChanged<String> onSelected;
  final VoidCallback onFilterTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 32,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onFilterTap,
              borderRadius: BorderRadius.circular(6),
              child: Padding(
                padding: const EdgeInsets.only(right: 10, left: 2),
                child: Icon(Icons.tune_rounded, size: 18, color: _P.textSecondary),
              ),
            ),
          ),
          for (var i = 0; i < filters.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            _FilterChip(
              label: filters[i],
              active: filters[i] == selected,
              onTap: () {
                HapticFeedback.selectionClick();
                onSelected(filters[i]);
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.active, required this.onTap});

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: active ? _P.green : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
            border: active ? null : Border.all(color: _P.outline),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: active ? const Color(0xFF0A0E12) : _P.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Market toolbar (amount + sort) ───────────────────────────────────────────

class P2pMarketToolbar extends StatelessWidget {
  const P2pMarketToolbar({
    required this.offerCount,
    required this.sortLabel,
    required this.onSort,
    required this.onAmount,
    this.amountFilter,
    this.onClearAmount,
    super.key,
  });

  final int offerCount;
  final String sortLabel;
  final double? amountFilter;
  final VoidCallback onSort;
  final VoidCallback onAmount;
  final VoidCallback? onClearAmount;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text('$offerCount ads', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _P.textMuted)),
        const Spacer(),
        if (amountFilter != null) ...[
          _ToolBtn(
            label: '₹${amountFilter!.toStringAsFixed(0)}',
            icon: Icons.close_rounded,
            onTap: onClearAmount ?? onAmount,
          ),
          const SizedBox(width: 8),
        ] else
          _ToolBtn(label: 'Amount', icon: Icons.payments_outlined, onTap: onAmount),
        const SizedBox(width: 8),
        _ToolBtn(label: sortLabel, icon: Icons.swap_vert_rounded, onTap: onSort),
      ],
    );
  }
}

class _ToolBtn extends StatelessWidget {
  const _ToolBtn({required this.label, required this.icon, required this.onTap});
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: _P.textSecondary),
              const SizedBox(width: 4),
              Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _P.textSecondary)),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Offer row (flat list item) ───────────────────────────────────────────────

class P2pOfferRow extends StatelessWidget {
  const P2pOfferRow({
    required this.offer,
    required this.isBuy,
    required this.onTrade,
    super.key,
  });

  final P2POffer offer;
  final bool isBuy;
  final VoidCallback onTrade;

  @override
  Widget build(BuildContext context) {
    final actionLabel = isBuy ? 'Buy' : 'Sell';
    final priceStr = offer.priceInr == offer.priceInr.roundToDouble()
        ? _P.inr(offer.priceInr)
        : '₹${NumberFormat('#,##0.#').format(offer.priceInr)}';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Avatar(initial: offer.merchantInitial, isOnline: offer.isOnline),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            offer.merchantName,
                            style: AppDesk.sectionTitle.copyWith(fontSize: 14),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (offer.isVerified) ...[
                          const SizedBox(width: AppSpacing.xs),
                          Icon(Icons.verified_rounded, size: 14, color: _P.green.withValues(alpha: 0.88)),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${offer.orderCount} orders · ${offer.completionRate.toStringAsFixed(offer.completionRate == offer.completionRate.roundToDouble() ? 0 : 1)}% completion'
                      '${offer.avgReleaseMins <= 5 ? ' · ${offer.avgReleaseMins}m release' : ''}',
                      style: AppDesk.sectionCaption.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              ),
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onTrade,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  child: Ink(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
                    decoration: isBuy ? AppDesk.primaryButton() : AppDesk.outlineButton(accentColor: _P.sell),
                    child: Text(
                      actionLabel,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: isBuy ? AppDesk.bg : _P.sell,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            priceStr,
            style: AppDesk.amountHero.copyWith(fontSize: 22, color: AppDesk.textPrimary),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Text(
                  'Limit ${_P.inr(offer.minLimitInr)} – ${_P.inr(offer.maxLimitInr)}',
                  style: TextStyle(fontSize: 11, color: _P.textMuted, fontWeight: FontWeight.w500),
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    _P.usdt(offer.availableUsdt),
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _P.textSecondary, fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    children: [
                      for (final m in offer.paymentMethods)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: _P.chipBg,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(m, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _P.textMuted)),
                        ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.initial, this.isOnline = true});

  final String initial;
  final bool isOnline;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _P.green.withValues(alpha: 0.15),
            shape: BoxShape.circle,
            border: Border.all(color: _P.green.withValues(alpha: 0.25)),
          ),
          child: Text(initial, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: _P.green.withValues(alpha: 0.95))),
        ),
        if (isOnline)
          Positioned(
            right: -1,
            bottom: -1,
            child: Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: _P.green,
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFF0A0E12), width: 2),
              ),
            ),
          ),
      ],
    );
  }
}

// ─── Chat FAB ─────────────────────────────────────────────────────────────────

class P2pChatFab extends StatelessWidget {
  const P2pChatFab({required this.onTap, this.badge, super.key});

  final VoidCallback onTap;
  final int? badge;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Material(
          elevation: 4,
          shadowColor: _P.green.withValues(alpha: 0.35),
          color: _P.green,
          shape: const CircleBorder(),
          child: InkWell(
            onTap: onTap,
            customBorder: const CircleBorder(),
            child: const SizedBox(
              width: 52,
              height: 52,
              child: Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF0A0E12), size: 22),
            ),
          ),
        ),
        if (badge != null && badge! > 0)
          Positioned(
            top: -2,
            right: -2,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: const BoxDecoration(color: Color(0xFFFF6B8A), shape: BoxShape.circle),
              child: Text('${badge! > 9 ? '9+' : badge}', style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: Colors.white)),
            ),
          ),
      ],
    );
  }
}
