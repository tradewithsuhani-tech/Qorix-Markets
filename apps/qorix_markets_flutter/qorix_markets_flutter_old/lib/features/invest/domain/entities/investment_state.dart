import 'package:equatable/equatable.dart';

/// Active deployment snapshot from `/investment`.
class InvestmentState extends Equatable {
  const InvestmentState({
    required this.id,
    required this.amount,
    required this.riskLevel,
    required this.isActive,
    required this.autoCompound,
    required this.totalProfit,
    required this.dailyProfit,
    required this.drawdown,
    required this.drawdownLimit,
    required this.peakBalance,
    required this.drawdownFromPeak,
    required this.recoveryPct,
    required this.isPaused,
    this.startedAt,
    this.pendingRiskLevel,
    this.pendingRiskLevelDate,
  });

  final int id;
  final double amount;
  final String riskLevel;
  final bool isActive;
  final bool autoCompound;
  final double totalProfit;
  final double dailyProfit;
  final double drawdown;
  final double drawdownLimit;
  final double peakBalance;
  final double drawdownFromPeak;
  final double recoveryPct;
  final bool isPaused;
  final DateTime? startedAt;
  final String? pendingRiskLevel;
  final String? pendingRiskLevelDate;

  bool get hasPendingRiskChange =>
      pendingRiskLevel != null && pendingRiskLevel!.trim().isNotEmpty;

  bool get isProtectionTriggered => isPaused;

  double get drawdownUsedPercent => drawdownFromPeak > 0 ? drawdownFromPeak : drawdown;

  /// Desk confidence derived from drawdown headroom — 0..1.
  double get strategyConfidence {
    if (drawdownLimit <= 0) return 0.75;
    final headroom = 1 - (drawdownUsedPercent / drawdownLimit).clamp(0.0, 1.0);
    return (0.55 + headroom * 0.4).clamp(0.45, 0.98);
  }

  InvestmentState copyWith({
    int? id,
    double? amount,
    String? riskLevel,
    bool? isActive,
    bool? autoCompound,
    double? totalProfit,
    double? dailyProfit,
    double? drawdown,
    double? drawdownLimit,
    double? peakBalance,
    double? drawdownFromPeak,
    double? recoveryPct,
    bool? isPaused,
    DateTime? startedAt,
    String? pendingRiskLevel,
    String? pendingRiskLevelDate,
    bool clearPendingRisk = false,
  }) =>
      InvestmentState(
        id: id ?? this.id,
        amount: amount ?? this.amount,
        riskLevel: riskLevel ?? this.riskLevel,
        isActive: isActive ?? this.isActive,
        autoCompound: autoCompound ?? this.autoCompound,
        totalProfit: totalProfit ?? this.totalProfit,
        dailyProfit: dailyProfit ?? this.dailyProfit,
        drawdown: drawdown ?? this.drawdown,
        drawdownLimit: drawdownLimit ?? this.drawdownLimit,
        peakBalance: peakBalance ?? this.peakBalance,
        drawdownFromPeak: drawdownFromPeak ?? this.drawdownFromPeak,
        recoveryPct: recoveryPct ?? this.recoveryPct,
        isPaused: isPaused ?? this.isPaused,
        startedAt: startedAt ?? this.startedAt,
        pendingRiskLevel: clearPendingRisk ? null : (pendingRiskLevel ?? this.pendingRiskLevel),
        pendingRiskLevelDate: clearPendingRisk ? null : (pendingRiskLevelDate ?? this.pendingRiskLevelDate),
      );

  String? get pendingRiskLevelLabel {
    final raw = pendingRiskLevel?.trim().toUpperCase();
    if (raw == null || raw.isEmpty) return null;
    return _riskLabel(raw);
  }

  String get riskLevelLabel => _riskLabel(riskLevel.trim().toUpperCase());

  static String _riskLabel(String raw) => switch (raw) {
        'LOW' => 'Conservative',
        'MEDIUM' => 'Balanced',
        'HIGH' => 'Aggressive',
        _ => raw,
      };

  @override
  List<Object?> get props => [
        id,
        amount,
        riskLevel,
        isActive,
        autoCompound,
        totalProfit,
        dailyProfit,
        drawdown,
        drawdownLimit,
        peakBalance,
        drawdownFromPeak,
        recoveryPct,
        isPaused,
        startedAt,
        pendingRiskLevel,
        pendingRiskLevelDate,
      ];
}
