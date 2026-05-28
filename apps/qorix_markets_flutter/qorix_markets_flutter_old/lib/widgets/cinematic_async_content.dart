import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/qa/ux_copy.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/widgets/primary_button.dart';
import 'package:qorix_markets_flutter/widgets/skeleton_loader.dart';

/// Cinematic async UI — skeleton first load, soft refresh, cached content on error.
class CinematicAsyncContent<T> extends StatefulWidget {
  const CinematicAsyncContent({
    required this.value,
    required this.builder,
    super.key,
    this.loading,
    this.onRetry,
    this.skeletonCount = 3,
  });

  final AsyncValue<T> value;
  final Widget Function(T data, {required bool isRefreshing}) builder;
  final Widget? loading;
  final VoidCallback? onRetry;
  final int skeletonCount;

  @override
  State<CinematicAsyncContent<T>> createState() => _CinematicAsyncContentState<T>();
}

class _CinematicAsyncContentState<T> extends State<CinematicAsyncContent<T>> {
  bool _animatedOnce = false;

  @override
  Widget build(BuildContext context) {
    return widget.value.when(
      skipLoadingOnRefresh: true,
      skipLoadingOnReload: true,
      data: (data) {
        final refreshing = widget.value.isRefreshing;
        final content = Stack(
          fit: StackFit.passthrough,
          children: [
            AnimatedOpacity(
              opacity: refreshing ? 0.92 : 1,
              duration: MotionTokens.normal,
              child: widget.builder(data, isRefreshing: refreshing),
            ),
            if (refreshing)
              const Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: LinearProgressIndicator(minHeight: 2, color: AppColors.brand),
              ),
          ],
        );

        if (_animatedOnce) return content;
        _animatedOnce = true;
        return content.animate().fadeIn(duration: MotionTokens.normal, curve: MotionTokens.luxuryEnter);
      },
      loading: () {
        if (_animatedOnce) {
          final cached = widget.value.valueOrNull;
          if (cached != null) {
            return widget.builder(cached, isRefreshing: true);
          }
        }
        return widget.loading ?? SkeletonMarketList(count: widget.skeletonCount);
      },
      error: (e, _) {
        final cached = widget.value.valueOrNull;
        if (cached != null) {
          return widget.builder(cached, isRefreshing: false);
        }
        return PremiumRetryState(
          message: ErrorMessage.from(e),
          onRetry: widget.onRetry,
        );
      },
    );
  }
}

/// Fade-in wrapper — only on first reveal to avoid refresh flicker.
class CinematicReveal extends StatelessWidget {
  const CinematicReveal({required this.child, required this.revealed, super.key});

  final Widget child;
  final bool revealed;

  @override
  Widget build(BuildContext context) {
    if (!revealed) return child;
    return child.animate().fadeIn(duration: MotionTokens.normal, curve: MotionTokens.luxuryEnter);
  }
}

class PremiumRetryState extends StatelessWidget {
  const PremiumRetryState({required this.message, super.key, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.sell.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.sell.withValues(alpha: 0.2)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_outlined, color: AppColors.sell, size: 36),
          const SizedBox(height: 12),
          Text(
            UxCopy.capitalProtected,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium),
          if (onRetry != null) ...[
            const SizedBox(height: 16),
            PrimaryButton(label: UxCopy.retrySecurely, onPressed: onRetry, expand: false),
          ],
        ],
      ),
    );
  }
}
