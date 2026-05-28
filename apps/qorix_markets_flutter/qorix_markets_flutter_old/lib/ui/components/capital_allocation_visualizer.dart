import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/ui/components/desk_allocation_feed.dart';

class CapitalAllocationVisualizer extends StatelessWidget {
  const CapitalAllocationVisualizer({required this.slices, super.key});
  final List<AllocationSlice> slices;

  @override
  Widget build(BuildContext context) => const SizedBox(height: 120);
}
