import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_radius.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/features/home/presentation/data/bot_presets.dart';
import 'package:qorix_markets_flutter/widgets/desk_widgets.dart';

ThemeData _botFieldTheme(BuildContext context) => Theme.of(context).copyWith(
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: AppColors.authGreen,
        selectionColor: AppColors.authGreen.withValues(alpha: 0.25),
        selectionHandleColor: AppColors.authGreen,
      ),
      inputDecorationTheme: const InputDecorationTheme(
        filled: false,
        fillColor: Colors.transparent,
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        contentPadding: EdgeInsets.zero,
        isDense: true,
      ),
    );

// ─── Step 1: Wizard header + status ─────────────────────────────────────────

class BotWizardHeader extends StatelessWidget {
  const BotWizardHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: AppDesk.densePadding,
      decoration: AppDesk.card(accent: AppColors.authGreen),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const DeskIconBox(icon: Icons.smart_toy_outlined),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('AI Trading Bot Setup', style: AppDesk.sectionTitle.copyWith(fontSize: 18)),
                    Text(
                      'Four quick steps to calibrate your bot',
                      style: AppDesk.sectionCaption,
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
                decoration: BoxDecoration(
                  color: AppColors.authGreen.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
                ),
                child: const Text('V3.1', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.authGreen)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: const [
              Expanded(child: _StatusCell(label: 'ENGINE', value: 'ONLINE', live: true)),
              SizedBox(width: 6),
              Expanded(child: _StatusCell(label: 'LATENCY', value: '12ms', live: true)),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: const [
              Expanded(child: _StatusCell(label: 'UPTIME', value: '99.96%', live: true)),
              SizedBox(width: 6),
              Expanded(child: _StatusCell(label: 'STATUS', value: 'AWAITING', live: false)),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.6)),
            ),
            child: Text(
              '>_ qorix-bot ~ \$ init --calibrate',
              style: TextStyle(
                fontSize: 10,
                fontFamily: 'monospace',
                color: AppColors.authGreen.withValues(alpha: 0.85),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusCell extends StatelessWidget {
  const _StatusCell({required this.label, required this.value, required this.live});

  final String label;
  final String value;
  final bool live;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
      decoration: BoxDecoration(
        color: AppColors.authInputBg.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: live ? AppColors.authGreen : AppColors.warning,
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 7, fontWeight: FontWeight.w700, letterSpacing: 0.4, color: AppColors.authMuted.withValues(alpha: 0.55))),
                Text(value, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: live ? AppColors.authGreen : AppColors.warning)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class BotStepHeader extends StatelessWidget {
  const BotStepHeader({
    required this.step,
    required this.title,
    this.trailing,
    super.key,
  });

  final String step;
  final String title;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
          decoration: BoxDecoration(
            color: AppColors.authGreen.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
          ),
          child: Text(step, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.authGreen, letterSpacing: 0.4)),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(title, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
        ),
        if (trailing != null)
          Text(trailing!, style: TextStyle(fontSize: 10, color: AppColors.authMuted.withValues(alpha: 0.65))),
      ],
    );
  }
}

// ─── Bot personality card (Step 1 list + Step 2 hero) ─────────────────────────

class BotPersonalityCard extends StatelessWidget {
  const BotPersonalityCard({
    required this.preset,
    required this.onTap,
    this.selected = false,
    this.compact = false,
    super.key,
  });

  final BotPreset preset;
  final VoidCallback onTap;
  final bool selected;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final accent = preset.accent;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          padding: EdgeInsets.all(compact ? 14 : 16),
          decoration: BoxDecoration(
            color: AppColors.authCardBg.withValues(alpha: selected ? 0.75 : 0.55),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? accent.withValues(alpha: 0.65) : AppColors.authInputBorder.withValues(alpha: 0.85),
              width: selected ? 1.5 : 1,
            ),
            boxShadow: selected ? [BoxShadow(color: accent.withValues(alpha: 0.15), blurRadius: 16)] : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Text(
                    preset.codename,
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: accent),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: AppColors.authInputBg,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(preset.version, style: TextStyle(fontSize: 9, color: AppColors.authMuted.withValues(alpha: 0.7))),
                  ),
                  const SizedBox(width: 6),
                  _LiveDot(),
                  if (preset.recommended) ...[
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.authGreen.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.4)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.star_rounded, size: 10, color: AppColors.authGreen.withValues(alpha: 0.95)),
                          const SizedBox(width: 3),
                          const Text('RECOMMENDED', style: TextStyle(fontSize: 7.5, fontWeight: FontWeight.w800, color: AppColors.authGreen, letterSpacing: 0.3)),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      color: accent.withValues(alpha: 0.12),
                      border: Border.all(color: accent.withValues(alpha: 0.3)),
                    ),
                    child: Icon(Icons.smart_toy_outlined, color: accent, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(preset.personality, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: -0.3)),
                        const SizedBox(height: 2),
                        Text(
                          preset.strategyType,
                          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: AppColors.authMuted.withValues(alpha: 0.6)),
                        ),
                      ],
                    ),
                  ),
                  if (selected)
                    Icon(Icons.check_circle_rounded, color: accent, size: 22)
                  else if (!compact)
                    Icon(Icons.chevron_right_rounded, color: AppColors.authMuted.withValues(alpha: 0.45), size: 22),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                preset.description,
                style: TextStyle(fontSize: 12, height: 1.4, color: AppColors.authMuted.withValues(alpha: 0.82)),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.authInputBg.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Expanded(child: _MetricCol(label: 'WIN RATE', value: '${preset.winRate}%', color: accent)),
                    Expanded(child: _MetricCol(label: 'TRADES/D', value: preset.tradesPerDay)),
                    Expanded(child: _MetricCol(label: 'LATENCY', value: '${preset.latencyMs}ms', color: AppColors.authGreen)),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  _TagChip(preset.monthlyTag, accent: true, color: accent),
                  _TagChip(preset.ddTag),
                  _TagChip(preset.pairs),
                  _TagChip(preset.uptimeTag, accent: true, color: AppColors.authGreen),
                ],
              ),
              const SizedBox(height: 12),
              BotRiskExposureRow(level: preset.riskExposure, max: preset.riskMax, accent: accent),
            ],
          ),
        ),
      ),
    );
  }
}

class _LiveDot extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 5,
          height: 5,
          decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.authGreen, boxShadow: [BoxShadow(color: AppColors.authGreen.withValues(alpha: 0.7), blurRadius: 4)]),
        ),
        const SizedBox(width: 4),
        const Text('LIVE', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: AppColors.authGreen, letterSpacing: 0.5)),
      ],
    );
  }
}

class _MetricCol extends StatelessWidget {
  const _MetricCol({required this.label, required this.value, this.color});

  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontSize: 7, fontWeight: FontWeight.w700, letterSpacing: 0.4, color: AppColors.authMuted.withValues(alpha: 0.55))),
        const SizedBox(height: 3),
        Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: color ?? Colors.white)),
      ],
    );
  }
}

class _TagChip extends StatelessWidget {
  const _TagChip(this.text, {this.accent = false, this.color});

  final String text;
  final bool accent;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.authMuted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: accent ? c.withValues(alpha: 0.5) : AppColors.authInputBorder.withValues(alpha: 0.75)),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: accent ? c : AppColors.authMuted.withValues(alpha: 0.75)),
      ),
    );
  }
}

class BotRiskExposureRow extends StatelessWidget {
  const BotRiskExposureRow({required this.level, required this.max, required this.accent, super.key});

  final int level;
  final int max;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Text('RISK EXPOSURE', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: AppColors.authMuted.withValues(alpha: 0.55))),
            const Spacer(),
            Text('$level/$max', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: accent)),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          children: List.generate(max, (i) {
            return Expanded(
              child: Container(
                height: 4,
                margin: EdgeInsets.only(right: i < max - 1 ? 3 : 0),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  color: i < level ? accent.withValues(alpha: 0.9) : AppColors.authInputBorder.withValues(alpha: 0.5),
                ),
              ),
            );
          }),
        ),
      ],
    );
  }
}

// ─── Step 2: Fund the bot ─────────────────────────────────────────────────────

class BotFundSection extends StatelessWidget {
  const BotFundSection({
    required this.available,
    required this.controller,
    required this.onMax,
    required this.onPercent,
    super.key,
  });

  final double available;
  final TextEditingController controller;
  final VoidCallback onMax;
  final ValueChanged<double> onPercent;

  static final _usd = NumberFormat.currency(symbol: '\$', decimalDigits: 2);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.85)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          BotStepHeader(
            step: 'STEP 02',
            title: 'Fund the Bot',
            trailing: 'Available: ${_usd.format(available)}',
          ),
          const SizedBox(height: 14),
          Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: AppColors.authInputBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.9)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Theme(
                    data: _botFieldTheme(context),
                    child: TextField(
                      controller: controller,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'))],
                      style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
                      cursorColor: AppColors.authGreen,
                      decoration: InputDecoration(
                        hintText: '0.00',
                        hintStyle: TextStyle(color: AppColors.authMuted.withValues(alpha: 0.4), fontSize: 22),
                        border: InputBorder.none,
                        isDense: true,
                      ),
                    ),
                  ),
                ),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: onMax,
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      child: Text('MAX', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.authGreen.withValues(alpha: 0.95))),
                    ),
                  ),
                ),
                Text('USD', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.authMuted.withValues(alpha: 0.65))),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [25, 50, 75, 100].map((pct) {
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: pct != 100 ? 6 : 0),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => onPercent(pct / 100),
                      borderRadius: BorderRadius.circular(10),
                      child: Ink(
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.authInputBg,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.85)),
                        ),
                        child: Center(
                          child: Text('$pct%', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.authMuted.withValues(alpha: 0.8))),
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

// ─── Step 3: Circuit breaker ──────────────────────────────────────────────────

class BotCircuitBreakerSection extends StatelessWidget {
  const BotCircuitBreakerSection({
    required this.preset,
    required this.selectedLimit,
    required this.onSelect,
    super.key,
  });

  final BotPreset preset;
  final double selectedLimit;
  final ValueChanged<double> onSelect;

  static const _options = [3.0, 5.0, 10.0];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.85)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: BotStepHeader(step: 'STEP 03', title: 'Safety Circuit Breaker')),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.authGreen.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
                ),
                child: const Text('● Armed', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.authGreen)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Bot auto-pauses if drawdown hits your limit — your capital stays safe.',
            style: TextStyle(fontSize: 11, height: 1.4, color: AppColors.authMuted.withValues(alpha: 0.75)),
          ),
          const SizedBox(height: 14),
          Row(
            children: _options.map((limit) {
              final selected = selectedLimit == limit;
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: limit != 10 ? 8 : 0),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        onSelect(limit);
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Ink(
                        height: 48,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          color: selected ? AppColors.authGreen.withValues(alpha: 0.1) : AppColors.authInputBg,
                          border: Border.all(
                            color: selected ? AppColors.authGreen.withValues(alpha: 0.55) : AppColors.authInputBorder.withValues(alpha: 0.85),
                          ),
                        ),
                        child: Center(
                          child: Text(
                            '${limit.toStringAsFixed(0)}%',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: selected ? AppColors.authGreen : Colors.white.withValues(alpha: 0.85),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),
          Text(
            'Default: ${preset.defaultDrawdown.toStringAsFixed(0)}% for ${preset.personality} strategy',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 10, color: AppColors.authMuted.withValues(alpha: 0.55)),
          ),
        ],
      ),
    );
  }
}

// ─── Preview: risk & reward summary ─────────────────────────────────────────

class BotRiskRewardCard extends StatelessWidget {
  const BotRiskRewardCard({
    required this.preset,
    required this.amount,
    required this.drawdownLimit,
    super.key,
  });

  final BotPreset preset;
  final double amount;
  final double drawdownLimit;

  static final _usd = NumberFormat.currency(symbol: '\$', decimalDigits: 2);

  @override
  Widget build(BuildContext context) {
    final (low, high) = preset.monthlyReturnRange(amount);
    final maxLoss = preset.maxDrawdownLoss(amount, drawdownLimit);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            preset.accent.withValues(alpha: 0.14),
            AppColors.authCardBg.withValues(alpha: 0.65),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: preset.accent.withValues(alpha: 0.4)),
        boxShadow: [BoxShadow(color: preset.accent.withValues(alpha: 0.08), blurRadius: 20, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.balance_rounded, size: 18, color: preset.accent),
              const SizedBox(width: 8),
              const Expanded(
                child: Text('Risk & Reward', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: preset.accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: preset.accent.withValues(alpha: 0.35)),
                ),
                child: Text(preset.personality, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: preset.accent)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.28),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Expanded(child: _MetricCol(label: 'WIN RATE', value: '${preset.winRate}%', color: preset.accent)),
                Expanded(
                  child: _MetricCol(label: 'TARGET', value: preset.monthlyTarget, color: preset.accent),
                ),
                Expanded(
                  child: _MetricCol(
                    label: 'MAX DD',
                    value: '${drawdownLimit.toStringAsFixed(0)}%',
                    color: AppColors.warning,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.authGreen.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.35)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'MONTHLY TARGET RETURN',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: AppColors.authGreen.withValues(alpha: 0.85)),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '+${_usd.format(low)} – ${_usd.format(high)}',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.authGreen, height: 1.1),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Tier-based projection · auto-distributed monthly',
                        style: TextStyle(fontSize: 10, height: 1.35, color: AppColors.authMuted.withValues(alpha: 0.65)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.45)),
                  ),
                  child: Text(
                    preset.monthlyTag,
                    style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.authGreen),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.authInputBg.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.85)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'DRAWDOWN PROTECTION',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: AppColors.authMuted.withValues(alpha: 0.6)),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Max ${_usd.format(maxLoss)} loss',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.warning.withValues(alpha: 0.55)),
                  ),
                  child: Text(
                    '${drawdownLimit.toStringAsFixed(0)}% limit',
                    style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.warning),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          BotRiskExposureRow(level: preset.riskExposure, max: preset.riskMax, accent: preset.accent),
        ],
      ),
    );
  }
}

// ─── Config summary ───────────────────────────────────────────────────────────

class BotConfigurationSummary extends StatelessWidget {
  const BotConfigurationSummary({
    required this.preset,
    required this.amount,
    required this.drawdownLimit,
    super.key,
  });

  final BotPreset preset;
  final double amount;
  final double drawdownLimit;

  @override
  Widget build(BuildContext context) {
    final capital = '\$${amount.toStringAsFixed(2)} USD';
    final ready = amount >= 50;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.22)),
        boxShadow: [BoxShadow(color: AppColors.authGreen.withValues(alpha: 0.06), blurRadius: 18, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.memory_outlined, size: 18, color: AppColors.authGreen),
              const SizedBox(width: 8),
              const Expanded(child: Text('Bot Configuration', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800))),
              Text(
                ready ? 'READY TO DEPLOY' : 'AWAITING FUNDS',
                style: TextStyle(
                  fontSize: 8,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.4,
                  color: ready ? AppColors.authGreen : AppColors.warning,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          _ConfigRow('Capital', capital),
          _ConfigRow('Strategy', preset.personality),
          _ConfigRow('Monthly Target', preset.monthlyTarget, highlight: true),
          _ConfigRow('Risk Level', 'Active'),
          _ConfigRow('Drawdown Limit', '${drawdownLimit.toStringAsFixed(0)}%'),
          _ConfigRow('Compounding', 'Configurable post-start', muted: true, isLast: true),
        ],
      ),
    );
  }
}

class _ConfigRow extends StatelessWidget {
  const _ConfigRow(this.label, this.value, {this.highlight = false, this.muted = false, this.isLast = false});

  final String label;
  final String value;
  final bool highlight;
  final bool muted;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 11),
      decoration: BoxDecoration(
        border: isLast ? null : Border(bottom: BorderSide(color: AppColors.authInputBorder.withValues(alpha: 0.45))),
      ),
      child: Row(
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: AppColors.authMuted.withValues(alpha: 0.72))),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: highlight
                    ? AppColors.authGreen
                    : muted
                        ? AppColors.authMuted.withValues(alpha: 0.55)
                        : Colors.white.withValues(alpha: 0.92),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class BotCapabilitiesCard extends StatelessWidget {
  const BotCapabilitiesCard({required this.preset, super.key});

  final BotPreset preset;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: preset.accent.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.bolt_rounded, size: 18, color: preset.accent),
              const SizedBox(width: 8),
              const Text('Bot Capabilities', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 12),
          ...preset.capabilities.map(
            (c) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.north_east_rounded, size: 14, color: preset.accent.withValues(alpha: 0.85)),
                  const SizedBox(width: 8),
                  Expanded(child: Text(c, style: TextStyle(fontSize: 12, color: AppColors.authMuted.withValues(alpha: 0.85)))),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class BotSetupTrustFooter extends StatelessWidget {
  const BotSetupTrustFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.lock_outline_rounded, size: 13, color: AppColors.authGreen.withValues(alpha: 0.75)),
        const SizedBox(width: 6),
        Text(
          'Funds secured · Capital protected · XAU/USD only',
          style: TextStyle(fontSize: 10, color: AppColors.authMuted.withValues(alpha: 0.6)),
        ),
      ],
    );
  }
}
