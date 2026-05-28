import 'package:flutter/material.dart';

class RiskProfile {
  const RiskProfile({
    required this.id,
    required this.label,
    required this.tagline,
    required this.description,
    required this.monthlyRange,
    required this.drawdownLimit,
    required this.accentColor,
    required this.icon,
    this.recommended = false,
  });

  final String id;
  final String label;
  final String tagline;
  final String description;
  final String monthlyRange;
  final double drawdownLimit;
  final Color accentColor;
  final IconData icon;
  final bool recommended;
}

abstract final class RiskProfiles {
  static const all = [
    RiskProfile(
      id: 'LOW',
      label: 'Conservative',
      tagline: 'Capital preservation first',
      description: 'Lower volatility desk with tighter drawdown controls.',
      monthlyRange: '3–6%',
      drawdownLimit: 3,
      accentColor: Color(0xFF10B981),
      icon: Icons.shield_outlined,
    ),
    RiskProfile(
      id: 'MEDIUM',
      label: 'Balanced',
      tagline: 'Institutional default',
      description: 'Balanced growth with professional risk management.',
      monthlyRange: '6–12%',
      drawdownLimit: 5,
      accentColor: Color(0xFF8B5CF6),
      icon: Icons.auto_graph_rounded,
      recommended: true,
    ),
    RiskProfile(
      id: 'HIGH',
      label: 'Aggressive',
      tagline: 'Maximum desk velocity',
      description: 'Higher return potential with elevated drawdown tolerance.',
      monthlyRange: '12–20%',
      drawdownLimit: 10,
      accentColor: Color(0xFFF59E0B),
      icon: Icons.bolt_rounded,
    ),
  ];
}
