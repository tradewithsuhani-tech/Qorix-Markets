import 'package:flutter/material.dart';

class DeskAllocationEvent {
  const DeskAllocationEvent({required this.asset, required this.action, required this.allocationPercent, required this.timeAgo});
  final String asset;
  final String action;
  final double allocationPercent;
  final String timeAgo;
}

class AllocationSlice {
  const AllocationSlice({required this.label, required this.percent, required this.color});
  final String label;
  final double percent;
  final Color color;
}

class DeskAllocationFeed extends StatelessWidget {
  const DeskAllocationFeed({required this.events, super.key});
  final List<DeskAllocationEvent> events;

  @override
  Widget build(BuildContext context) => events.isEmpty ? const SizedBox.shrink() : const SizedBox(height: 8);
}
