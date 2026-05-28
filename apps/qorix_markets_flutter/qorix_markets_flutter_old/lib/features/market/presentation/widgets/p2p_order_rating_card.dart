import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/features/market/application/p2p_order_rating_provider.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/p2p_entities.dart';

class P2pOrderRatingCard extends ConsumerStatefulWidget {
  const P2pOrderRatingCard({required this.orderId, required this.counterpartyName, super.key});

  final int orderId;
  final String counterpartyName;

  @override
  ConsumerState<P2pOrderRatingCard> createState() => _P2pOrderRatingCardState();
}

class _P2pOrderRatingCardState extends ConsumerState<P2pOrderRatingCard> {
  int _stars = 0;
  final _comment = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_stars < 1 || _submitting) return;
    setState(() => _submitting = true);
    final ok = await ref.read(p2pOrderRatingProvider(widget.orderId).notifier).submit(
          rating: _stars,
          comment: _comment.text.trim().isEmpty ? null : _comment.text.trim(),
        );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Thanks for your feedback'), behavior: SnackBarBehavior.floating),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ref.read(p2pOrderRatingProvider(widget.orderId)).error?.toString() ?? 'Could not submit rating'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final ratingAsync = ref.watch(p2pOrderRatingProvider(widget.orderId));

    return Container(
      padding: AppDesk.densePadding,
      decoration: AppDesk.card(),
      child: ratingAsync.when(
        loading: () => const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator())),
        error: (e, _) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Rate ${widget.counterpartyName}', style: AppDesk.sectionTitle.copyWith(fontSize: 13)),
            const SizedBox(height: 8),
            Text(ErrorMessage.brief(e), style: AppDesk.sectionCaption),
            TextButton(onPressed: () => ref.invalidate(p2pOrderRatingProvider(widget.orderId)), child: const Text('Retry')),
          ],
        ),
        data: (existing) {
          if (existing != null) return _SubmittedRating(rating: existing);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Rate ${widget.counterpartyName}', style: AppDesk.sectionTitle.copyWith(fontSize: 13)),
              const SizedBox(height: 4),
              Text('How was your experience?', style: AppDesk.sectionCaption),
              const SizedBox(height: 12),
              _StarRow(value: _stars, onChanged: (v) => setState(() => _stars = v)),
              const SizedBox(height: 12),
              TextField(
                controller: _comment,
                maxLength: 200,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Optional comment',
                  hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.35)),
                  filled: true,
                  fillColor: const Color(0xFF0A0E12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  counterStyle: TextStyle(color: Colors.white.withValues(alpha: 0.35), fontSize: 10),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: FilledButton(
                  onPressed: _stars < 1 || _submitting ? null : _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.authGreen,
                    foregroundColor: const Color(0xFF0A0E12),
                  ),
                  child: _submitting
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Submit Rating', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SubmittedRating extends StatelessWidget {
  const _SubmittedRating({required this.rating});
  final P2pOrderRating rating;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Your rating', style: AppDesk.sectionTitle.copyWith(fontSize: 13)),
        const SizedBox(height: 10),
        _StarRow(value: rating.rating.round(), readOnly: true),
        if (rating.comment != null && rating.comment!.trim().isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(rating.comment!, style: AppDesk.sectionCaption.copyWith(color: AppDesk.textPrimary)),
        ],
      ],
    );
  }
}

class _StarRow extends StatelessWidget {
  const _StarRow({required this.value, this.onChanged, this.readOnly = false});

  final int value;
  final ValueChanged<int>? onChanged;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(5, (i) {
        final filled = i < value;
        return IconButton(
          padding: EdgeInsets.zero,
          visualDensity: VisualDensity.compact,
          onPressed: readOnly || onChanged == null ? null : () => onChanged!(i + 1),
          icon: Icon(
            filled ? Icons.star_rounded : Icons.star_outline_rounded,
            color: filled ? const Color(0xFFF59E0B) : Colors.white.withValues(alpha: 0.25),
            size: 28,
          ),
        );
      }),
    );
  }
}
