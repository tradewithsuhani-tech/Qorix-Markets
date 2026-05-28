import 'package:intl/intl.dart';

abstract final class ProfitHistoryMapper {
  static String defaultLabel(String type) => switch (type) {
        'referral_bonus' => 'Referral earnings',
        'bonus' => 'Bonus credit',
        _ => 'Daily profit',
      };

  static String formatDateLabel(DateTime createdAt) {
    final now = DateTime.now();
    final local = createdAt.toLocal();
    if (now.difference(local).inDays == 0) {
      return 'Today ${DateFormat('HH:mm').format(local)}';
    }
    if (now.difference(local).inDays == 1) {
      return 'Yesterday ${DateFormat('HH:mm').format(local)}';
    }
    if (now.difference(local).inDays < 7) {
      return DateFormat('EEE d MMM · HH:mm').format(local);
    }
    return DateFormat('d MMM yyyy').format(local);
  }
}
