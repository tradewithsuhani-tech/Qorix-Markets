import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/invest/domain/entities/investment_state.dart';

class InvestmentModel {
  const InvestmentModel({
    required this.id,
    required this.userId,
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
    this.stoppedAt,
    this.pausedAt,
    this.pendingRiskLevel,
    this.pendingRiskLevelDate,
  });

  factory InvestmentModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return InvestmentModel(
      id: _int(root['id']),
      userId: _int(root['userId']),
      amount: ApiJson.asDouble(root['amount']),
      riskLevel: _normalizeRiskLevel(root['riskLevel'] as String?),
      isActive: root['isActive'] as bool? ?? false,
      autoCompound: root['autoCompound'] as bool? ?? true,
      totalProfit: ApiJson.asDouble(root['totalProfit']),
      dailyProfit: ApiJson.asDouble(root['dailyProfit']),
      drawdown: ApiJson.asDouble(root['drawdown']),
      drawdownLimit: ApiJson.asDouble(root['drawdownLimit'], fallback: 5),
      peakBalance: ApiJson.asDouble(root['peakBalance']),
      drawdownFromPeak: ApiJson.asDouble(root['drawdownFromPeak']),
      recoveryPct: ApiJson.asDouble(root['recoveryPct']),
      isPaused: root['isPaused'] as bool? ?? false,
      startedAt: root['startedAt'] as String?,
      stoppedAt: root['stoppedAt'] as String?,
      pausedAt: root['pausedAt'] as String?,
      pendingRiskLevel: root['pendingRiskLevel'] as String?,
      pendingRiskLevelDate: root['pendingRiskLevelDate'] as String?,
    );
  }

  final int id;
  final int userId;
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
  final String? startedAt;
  final String? stoppedAt;
  final String? pausedAt;
  final String? pendingRiskLevel;
  final String? pendingRiskLevelDate;

  InvestmentState toEntity() => InvestmentState(
        id: id,
        amount: amount,
        riskLevel: riskLevel,
        isActive: isActive,
        autoCompound: autoCompound,
        totalProfit: totalProfit,
        dailyProfit: dailyProfit,
        drawdown: drawdown,
        drawdownLimit: drawdownLimit,
        peakBalance: peakBalance,
        drawdownFromPeak: drawdownFromPeak,
        recoveryPct: recoveryPct,
        isPaused: isPaused,
        startedAt: startedAt != null ? DateTime.tryParse(startedAt!) : null,
        pendingRiskLevel: pendingRiskLevel,
        pendingRiskLevelDate: pendingRiskLevelDate,
      );
}

int _int(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse('$v') ?? 0;
}

String _normalizeRiskLevel(String? raw) {
  final value = raw?.trim().toUpperCase();
  if (value == null || value.isEmpty) return 'MEDIUM';
  return value;
}
