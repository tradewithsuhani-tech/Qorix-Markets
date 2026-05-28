import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

class AiConfidenceMeter extends StatelessWidget {
  const AiConfidenceMeter({required this.confidence, super.key, this.subtitle});
  final double confidence;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LinearProgressIndicator(value: confidence.clamp(0, 1), color: AppColors.brand),
        if (subtitle != null) Text(subtitle!, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
