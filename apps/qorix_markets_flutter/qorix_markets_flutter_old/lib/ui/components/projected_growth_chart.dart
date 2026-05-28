import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

class ProjectedGrowthChart extends StatelessWidget {
  const ProjectedGrowthChart({
    required this.currentAmount,
    required this.projectedPoints,
    this.months = 12,
    super.key,
  });

  final double currentAmount;
  final List<double> projectedPoints;
  final int months;

  @override
  Widget build(BuildContext context) {
    final points = projectedPoints.isEmpty
        ? List<double>.generate(months, (i) => currentAmount * (1 + 0.02 * (i + 1)))
        : projectedPoints;
    final end = points.last;
    final gain = end - currentAmount;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.authCardBg.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.authInputBorder.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Projected growth', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(
            '+\$${gain.toStringAsFixed(0)} over $months months (illustrative)',
            style: TextStyle(color: AppColors.authMuted.withValues(alpha: 0.85), fontSize: 12),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 48,
            child: CustomPaint(
              painter: _SparklinePainter(points),
              size: const Size(double.infinity, 48),
            ),
          ),
        ],
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  _SparklinePainter(this.points);
  final List<double> points;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final minY = points.reduce((a, b) => a < b ? a : b);
    final maxY = points.reduce((a, b) => a > b ? a : b);
    final range = (maxY - minY).abs() < 1 ? 1.0 : maxY - minY;
    final path = Path();
    for (var i = 0; i < points.length; i++) {
      final x = size.width * i / (points.length - 1);
      final y = size.height - ((points[i] - minY) / range) * size.height;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = AppColors.authGreen
        ..strokeWidth = 2
        ..style = PaintingStyle.stroke,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
