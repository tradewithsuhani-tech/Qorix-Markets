import 'package:flutter/material.dart';

class StrategyDetailScreen extends StatelessWidget {
  const StrategyDetailScreen({required this.profileId, super.key});

  final String profileId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Strategy detail')),
      body: Center(child: Text('Profile: $profileId')),
    );
  }
}
