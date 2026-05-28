import 'package:flutter/material.dart';

class AiDeskEvent {
  const AiDeskEvent({required this.label, required this.detail, required this.impactPercent, required this.timeAgo});
  final String label;
  final String detail;
  final double impactPercent;
  final String timeAgo;
}

class AiDeskFeed extends StatelessWidget {
  const AiDeskFeed({required this.events, super.key});
  final List<AiDeskEvent> events;

  @override
  Widget build(BuildContext context) {
    if (events.isEmpty) return const SizedBox.shrink();
    return Column(
      children: events.map((e) => ListTile(title: Text(e.label), subtitle: Text('${e.detail} · ${e.timeAgo}'))).toList(),
    );
  }
}
