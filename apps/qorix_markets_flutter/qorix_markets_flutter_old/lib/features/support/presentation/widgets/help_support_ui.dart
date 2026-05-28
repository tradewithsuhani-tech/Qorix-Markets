import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/data/models/support_models.dart';

Future<void> openSupportEmail(String email, {String? subject}) async {
  final uri = Uri(
    scheme: 'mailto',
    path: email,
    queryParameters: {
      if (subject != null && subject.isNotEmpty) 'subject': subject,
    },
  );
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri);
  }
}

class HelpSupportContactCard extends StatelessWidget {
  const HelpSupportContactCard({required this.contact, super.key});

  final SupportContactModel contact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          colors: [
            AppColors.authGreen.withValues(alpha: 0.16),
            const Color(0xFF12171C),
          ],
        ),
        border: Border.all(color: AppColors.authGreen.withValues(alpha: 0.28)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: AppColors.authGreen.withValues(alpha: 0.14),
            ),
            child: const Icon(Icons.headset_mic_outlined, color: AppColors.authGreen),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('We\'re here to help', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
                const SizedBox(height: 4),
                Text('Support hours: ${contact.supportHours}', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.62))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class HelpSupportActionTile extends StatelessWidget {
  const HelpSupportActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    super.key,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF12171C),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF1E2630)),
          ),
          child: Row(
            children: [
              Icon(icon, color: AppColors.authGreen, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 11)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: Colors.white.withValues(alpha: 0.35)),
            ],
          ),
        ),
      ),
    );
  }
}

class HelpSupportFaqTile extends StatelessWidget {
  const HelpSupportFaqTile({required this.faq, super.key});

  final SupportFaqModel faq;

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
        collapsedBackgroundColor: const Color(0xFF12171C),
        backgroundColor: const Color(0xFF12171C),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: Color(0xFF1E2630))),
        collapsedShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: Color(0xFF1E2630))),
        title: Text(faq.question, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
        subtitle: faq.category == null
            ? null
            : Text(faq.category!, style: TextStyle(color: Colors.white.withValues(alpha: 0.45), fontSize: 10)),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(faq.answer, style: TextStyle(color: Colors.white.withValues(alpha: 0.72), fontSize: 12, height: 1.45)),
            ),
          ),
        ],
      ),
    );
  }
}
